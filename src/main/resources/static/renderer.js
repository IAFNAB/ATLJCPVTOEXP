/*
=========================================================================================
File: renderer.js
Description:
Three.js 3D Rendering Engine & Spatial Tracking Layer

Project:
JCPenney Virtual Try-On Experience (Hackathon Prototype)

Team:
Not a Bug, It's a Feature

Overview:
This module initializes the WebGL environment and acts as the bridge between
the 2D video feed and the 3D augmented reality models.

It creates a transparent overlay canvas, dynamically scales and loads .glb files,
and continuously repaints the scene at the browser refresh rate.

Furthermore, it exposes public methods allowing the ML tracking layer to update
the spatial coordinates of virtual merchandise in real-time.

Debugging instrumentation has also been added to assist QA testing and help
measure asset load performance during model initialization.
=========================================================================================
*/


// ============================================================================
// 1. SCENE AND CAMERA CONFIGURATION
// ============================================================================

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    640 / 480,
    0.1,
    1000
);

camera.position.z = 5;

// ============================================================================
// 2. WEBGL RENDERER INITIALIZATION
// ============================================================================

const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
});

renderer.setSize(
    640,
    480
);

renderer.domElement.style.position = "absolute";
renderer.domElement.style.top = "0";
renderer.domElement.style.left = "0";
renderer.domElement.style.pointerEvents = "none";

document
    .querySelector(".video-frame")
    .appendChild(renderer.domElement);

// ============================================================================
// 3. SCENE LIGHTING
// ============================================================================

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        2.5
    );

scene.add(
    ambientLight
);

const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        1.5
    );

directionalLight.position.set(
    0,
    2,
    2
);

scene.add(
    directionalLight
);

// ============================================================================
// 3.5 OCCLUSION SETUP (INVISIBLE HEAD)
// ============================================================================

let headGeometry =
    new THREE.SphereGeometry(
        0.6,
        32,
        32
    );

const occlusionMaterial =
    new THREE.MeshBasicMaterial({
        colorWrite: false
    });

const headOccluder =
    new THREE.Mesh(
        headGeometry,
        occlusionMaterial
    );

scene.add(
    headOccluder
);

// ============================================================================
// 4. ASSET LOADING AND INITIALIZATION
// ============================================================================

let currentModel;
let currentModelFile = "top_hat.glb";
let firstPoseDetected = false;

let latestTrackingData = null;

const assetLoadingMessage =
    document.getElementById(
        "assetLoadingMessage"
    );

const loader =
    new THREE.GLTFLoader();

// ============================================================================
// 4A. MODEL CONFIGURATION
// ============================================================================

const MODEL_CONFIGS = {

    "top_hat.glb": {
        scale: 0.6,
        offsetX: 0,
        offsetY: 1.0,
        offsetZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        occluderRadius: 0.6,
        occluderOffsetY: -0.8,
        occluderOffsetZ: 0,
        anchorPoint: "nose"
    },

    "raybanglasses.glb": {
        scale: 0.4,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        occluderRadius: 0.55,
        occluderOffsetY: -0.2,
        occluderOffsetZ: 0,
        anchorPoint: "nose"
    },

    "heartnecklace.glb": {
        scale: 7,
        offsetX: 0,
        offsetY: -0.5,
        offsetZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        occluderRadius: 0.7,
        occluderOffsetY: -0.8,
        occluderOffsetZ: 0,
        anchorPoint: "chest"
    },

    "female_beach_hat.glb": {
        scale: 0.6,
        offsetX: 0,
        offsetY: 1.0,
        offsetZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        occluderRadius: 0.6,
        occluderOffsetY: -0.8,
        occluderOffsetZ: 0,
        anchorPoint: "nose"
    }
};

// ============================================================================
// 4B. GUI STATE
// ============================================================================

const guiState = {
    scale: 1,
    offsetX: 0,
    offsetY: 1,
    offsetZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,

    showOccluder: false,
    occluderRadius: 0.6,
    occluderOffsetY: -0.8,
    occluderOffsetZ: 0,

    anchorPoint: "nose",

    ambientIntensity: 2.5,
    directionalIntensity: 1.5,

    logConfig() {

        const output = {
            scale: guiState.scale,
            offsetX: guiState.offsetX,
            offsetY: guiState.offsetY,
            offsetZ: guiState.offsetZ,
            rotationX: guiState.rotationX,
            rotationY: guiState.rotationY,
            rotationZ: guiState.rotationZ,
            occluderRadius: guiState.occluderRadius,
            occluderOffsetY: guiState.occluderOffsetY,
            occluderOffsetZ: guiState.occluderOffsetZ,
            anchorPoint: guiState.anchorPoint
        };

        console.log(
            `"${currentModelFile}":`,
            output
        );
    }
};

// ============================================================================
// 4C. GUI INITIALIZATION
// ============================================================================

function initializeGUI() {


    const gui = new lil.GUI({
        title: "JCP AR Developer Tools"
    });

    gui.hide();

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.ctrlKey &&
                event.key.toLowerCase() === "h"
            ) {

                const hidden =
                    gui.domElement.style.display === "none";

                if (hidden) {
                    gui.show();
                } else {
                    gui.hide();
                }
            }
        }
    );

    const transformFolder =
        gui.addFolder("Transform");

    transformFolder.add(guiState, "scale", 0.01, 10, 0.01);
    transformFolder.add(guiState, "offsetX", -5, 5, 0.01);
    transformFolder.add(guiState, "offsetY", -5, 5, 0.01);
    transformFolder.add(guiState, "offsetZ", -5, 5, 0.01);

    transformFolder.add(guiState, "rotationX", -Math.PI, Math.PI, 0.01);
    transformFolder.add(guiState, "rotationY", -Math.PI, Math.PI, 0.01);
    transformFolder.add(guiState, "rotationZ", -Math.PI, Math.PI, 0.01);

    const occlusionFolder =
        gui.addFolder("Occlusion");

    occlusionFolder.add(guiState, "showOccluder");

    occlusionFolder.add(
        guiState,
        "occluderRadius",
        0.1,
        3,
        0.01
    );

    occlusionFolder.add(
        guiState,
        "occluderOffsetY",
        -5,
        5,
        0.01
    );

    occlusionFolder.add(
        guiState,
        "occluderOffsetZ",
        -5,
        5,
        0.01
    );

    const trackingFolder =
        gui.addFolder("Tracking");

    trackingFolder.add(
        guiState,
        "anchorPoint",
        ["nose", "chest"]
    );

    const lightingFolder =
        gui.addFolder("Lighting");

    lightingFolder.add(
        guiState,
        "ambientIntensity",
        0,
        10,
        0.01
    );

    lightingFolder.add(
        guiState,
        "directionalIntensity",
        0,
        10,
        0.01
    );

    gui.add(
        guiState,
        "logConfig"
    );
}

initializeGUI();

// ============================================================================
// 4D. MODEL LOADING
// ============================================================================

function loadARModel(modelFile) {

    currentModelFile = modelFile;

    if (assetLoadingMessage) {
        assetLoadingMessage.style.display =
            "block";
    }

    if (currentModel) {
        scene.remove(currentModel);
    }

    loader.load(
        `models/${modelFile}`,
        function (gltf) {

            currentModel =
                gltf.scene;

            currentModel.visible = false;

            scene.add(
                currentModel
            );

            const config =
                MODEL_CONFIGS[modelFile];

            if (config) {

                guiState.scale = config.scale;
                guiState.offsetX = config.offsetX;
                guiState.offsetY = config.offsetY;
                guiState.offsetZ = config.offsetZ;

                guiState.rotationX = config.rotationX;
                guiState.rotationY = config.rotationY;
                guiState.rotationZ = config.rotationZ;

                guiState.occluderRadius =
                    config.occluderRadius;

                guiState.occluderOffsetY =
                    config.occluderOffsetY;

                guiState.occluderOffsetZ =
                    config.occluderOffsetZ;

                guiState.anchorPoint =
                    config.anchorPoint;
            }

            if (assetLoadingMessage) {
                assetLoadingMessage.style.display =
                    "none";
            }
        }
    );
}

// ============================================================================
// 4E. PREVIEW WINDOW INITIALIZATION
// ============================================================================

const previewScene =
    new THREE.Scene();

const previewCamera =
    new THREE.PerspectiveCamera(
        45,
        1,
        0.1,
        1000
    );

previewCamera.position.z = 4;

const previewRenderer =
    new THREE.WebGLRenderer({
        canvas:
            document.getElementById(
                "previewCanvas"
            ),
        alpha: true,
        antialias: true
    });

previewRenderer.setSize(
    200,
    200
);

previewScene.add(
    new THREE.AmbientLight(
        0xffffff,
        3
    )
);

let previewModel;

function loadPreviewModel(modelFile) {

    if (previewModel) {
        previewScene.remove(previewModel);
    }

    loader.load(
        `models/${modelFile}`,
        function (gltf) {

            previewModel =
                gltf.scene;

            previewModel.scale.set(
                0.6,
                0.6,
                0.6
            );

            previewScene.add(
                previewModel
            );
        }
    );
}

loadARModel("top_hat.glb");
loadPreviewModel("top_hat.glb");

// ============================================================================
// 5. SPATIAL TRACKING
// ============================================================================

const vFov =
    camera.fov * Math.PI / 180;

const planeHeight =
    2 *
    Math.tan(vFov / 2) *
    camera.position.z;

const planeWidth =
    planeHeight *
    camera.aspect;

// ============================================================================
// 5A. TRACKING UPDATE API
// ============================================================================

window.updateModelPosition = (trackingData) => {

    latestTrackingData =
        trackingData;

    if (!currentModel) {
        return;
    }

    if (!firstPoseDetected) {

        console.log(
            "Renderer: First pose detection received."
        );

        firstPoseDetected = true;
    }

    currentModel.visible = true;
};

// ============================================================================
// 5B. POSITION UPDATE
// ============================================================================

function updateTrackedModel() {

    if (
        !currentModel ||
        !latestTrackingData
    ) {
        return;
    }

    const landmarks =
        latestTrackingData.landmarks;

    let anchor;

    if (
        guiState.anchorPoint === "chest" &&
        landmarks[11] &&
        landmarks[12]
    ) {

        anchor = {
            x:
                (landmarks[11].x +
                    landmarks[12].x) / 2,

            y:
                (landmarks[11].y +
                    landmarks[12].y) / 2
        };

    } else {

        anchor =
            landmarks[0];
    }

    const x =
        (anchor.x - 0.5) *
        planeWidth;

    const y =
        -(anchor.y - 0.5) *
        planeHeight;

    const faceWidth =
        Math.max(
            latestTrackingData.faceWidth,
            0.001
        );

    const scaleMultiplier =
        faceWidth * 8;

    const finalScale =
        guiState.scale *
        scaleMultiplier;

    currentModel.scale.set(
        finalScale,
        finalScale,
        finalScale
    );

    currentModel.position.set(
        x + guiState.offsetX,
        y + guiState.offsetY,
        guiState.offsetZ
    );

    currentModel.rotation.x =
        guiState.rotationX;

    currentModel.rotation.y =
        guiState.rotationY;

    currentModel.rotation.z =
        (-latestTrackingData.roll) +
        guiState.rotationZ;

    headOccluder.visible =
        guiState.showOccluder;

    headOccluder.position.copy(
        currentModel.position
    );

    headOccluder.position.y +=
        guiState.occluderOffsetY;

    headOccluder.position.z +=
        guiState.occluderOffsetZ;

    const occluderScale =
        guiState.occluderRadius *
        scaleMultiplier;

    headOccluder.scale.set(
        occluderScale,
        occluderScale,
        occluderScale
    );
}

// ============================================================================
// 5C. PRODUCT SELECTION EVENTS
// ============================================================================

document
    .querySelectorAll(
        ".asset-card"
    )
    .forEach(card => {

        card.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".asset-card"
                    )
                    .forEach(c => {
                        c.classList.remove(
                            "active"
                        );
                    });

                card.classList.add(
                    "active"
                );

                const modelFile =
                    card.dataset.model;

                loadARModel(
                    modelFile
                );

                loadPreviewModel(
                    modelFile
                );
            }
        );
    });

// ============================================================================
// PUBLIC METHOD
// ============================================================================

window.hideModel = () => {

    if (currentModel) {
        currentModel.visible = false;
    }
};

// ============================================================================
// 6. RENDER LOOP
// ============================================================================

function animate() {

    requestAnimationFrame(
        animate
    );

    ambientLight.intensity =
        guiState.ambientIntensity;

    directionalLight.intensity =
        guiState.directionalIntensity;

    updateTrackedModel();

    if (previewModel) {
        previewModel.rotation.y += 0.01;
    }

    renderer.render(
        scene,
        camera
    );

    previewRenderer.render(
        previewScene,
        previewCamera
    );
}

animate();
