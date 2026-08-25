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

// The Scene is the 3D virtual environment where our models and lights exist.
const scene = new THREE.Scene();

// The PerspectiveCamera simulates a standard human eye view.
//
// Parameters:
//
// Field of View (45 deg)
// Aspect Ratio (640/480)
// Near Plane (0.1)
// Far Plane (1000)

const camera = new THREE.PerspectiveCamera(
    45,
    640 / 480,
    0.1,
    1000
);

// Move the camera backward so loaded assets sit inside view.
camera.position.z = 5;

// ============================================================================
// 2. WEBGL RENDERER INITIALIZATION
// ============================================================================

// alpha:true allows the camera feed to remain visible behind the 3D layer.
//
// antialias:true smooths jagged polygon edges.

const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
});

renderer.setSize(
    640,
    480
);

// Style the generated canvas so it perfectly overlays the video stream.

renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';

// Prevent the Three.js layer from blocking UI interactions.

renderer.domElement.style.pointerEvents = 'none';

// Inject the WebGL canvas into the video frame container.

document
    .querySelector('.video-frame')
    .appendChild(renderer.domElement);

// ============================================================================
// 3. SCENE LIGHTING
// ============================================================================

// AmbientLight provides consistent illumination across the scene.
//
// Elevated intensity helps dark merchandise remain visible.

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        2.5
    );

scene.add(
    ambientLight
);

// DirectionalLight simulates sunlight and improves depth perception.

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
// 4. ASSET LOADING AND INITIALIZATION
// ============================================================================

// Global reference to the currently active AR model.

let currentModel;

// Used to prevent console spam once tracking begins.

let firstPoseDetected = false;

// Reference to the HTML loading indicator.

const assetLoadingMessage =
    document.getElementById(
        'assetLoadingMessage'
    );

// GLTF model loader.

const loader =
    new THREE.GLTFLoader();

// ============================================================================
// 4A. MODEL CONFIGURATION
// ============================================================================

// Future-proof container.
//
// As additional assets are tuned,
// scales and offsets can be configured
// individually.

const MODEL_CONFIGS = {

    "top_hat.glb": {
        scale: 0.6
    },

    "raybanglasses.glb": {
        scale: 0.4
    },

    "heartnecklace.glb": {
        scale: 5
    },

    "female_beach_hat.glb": {
        scale: 0.6
    }

};

// ============================================================================
// 4B. PRIMARY AR MODEL LOADER
// ============================================================================

/**
 * Loads a selected asset
 * into the live AR scene.
 *
 * @param {string} modelFile
 */

function loadARModel(modelFile) {

    if (assetLoadingMessage) {

        assetLoadingMessage.style.display =
            "block";

    }

    if (currentModel) {

        scene.remove(
            currentModel
        );

    }

    loader.load(

        `models/${modelFile}`,

        function (gltf) {

            console.log(
                `Renderer: ${modelFile} loaded successfully.`
            );

            currentModel =
                gltf.scene;

            const config =
                MODEL_CONFIGS[modelFile] ||
                { scale: 0.6 };

            currentModel.scale.set(
                config.scale,
                config.scale,
                config.scale
            );

            // Remain hidden until MediaPipe tracking acquires a face.

            currentModel.visible = false;

            // Register the model within the scene graph.

            scene.add(
                currentModel
            );

            if (assetLoadingMessage) {

                assetLoadingMessage.style.display =
                    "none";

            }

        },

        undefined,

        function (error) {

            console.error(
                "Renderer Error: Failed to load the 3D model.",
                error
            );

            if (assetLoadingMessage) {

                assetLoadingMessage.innerText =
                    "Asset Load Failed";

                assetLoadingMessage.style.color =
                    "#ff4444";

            }

        }

    );

}

// ============================================================================
// 4C. PREVIEW WINDOW INITIALIZATION
// ============================================================================

// Separate scene used for the
// rotating product preview.

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

const previewAmbientLight =
    new THREE.AmbientLight(
        0xffffff,
        3
    );

previewScene.add(
    previewAmbientLight
);

let previewModel;

// ============================================================================
// 4D. PREVIEW MODEL LOADER
// ============================================================================

/**
 * Loads the rotating model preview.
 *
 * @param {string} modelFile
 */

function loadPreviewModel(modelFile) {

    if (previewModel) {

        previewScene.remove(
            previewModel
        );

    }

    loader.load(

        `models/${modelFile}`,

        function (gltf) {

            previewModel =
                gltf.scene;

            const config =
                MODEL_CONFIGS[modelFile] ||
                { scale: 0.6 };

            previewModel.scale.set(
                config.scale,
                config.scale,
                config.scale
            );

            previewScene.add(
                previewModel
            );

        },

        undefined,

        function (error) {

            console.error(
                "Preview Load Error:",
                error
            );

        }

    );

}

// Begin timing asset initialization.

console.time(
    "TopHatLoad"
);

// Default startup asset.

loadARModel(
    "top_hat.glb"
);

loadPreviewModel(
    "top_hat.glb"
);

console.timeEnd(
    "TopHatLoad"
);

// ============================================================================
// 5. SPATIAL TRACKING MAPPING (2D TO 3D CONVERSION)
// ============================================================================

// Calculate the dimensions of the visible render plane.
//
// These values allow conversion of MediaPipe's
// normalized coordinates into Three.js coordinates.

const vFov =
    camera.fov * Math.PI / 180;

const planeHeight =
    2 *
    Math.tan(vFov / 2) *
    camera.position.z;

const planeWidth =
    planeHeight *
    camera.aspect;

/**
 * Public Method:
 * updateModelPosition
 *
 * Invoked by tracking.js whenever MediaPipe Pose
 * successfully detects facial landmarks.
 *
 * @param {number} x
 * Normalized X position (0.0 to 1.0)
 *
 * @param {number} y
 * Normalized Y position (0.0 to 1.0)
 */

window.updateModelPosition = (x, y) => {

    // Ensure asset is fully loaded before performing updates.

    if (!currentModel) {

        return;

    }

    // First successful track event.
    //
    // Useful QA checkpoint:
    //
    // Camera Working?
    // Tracking Working?
    // Model Ready?

    if (!firstPoseDetected) {

        console.log(
            "Renderer: First pose detection received."
        );

        console.log(
            `Tracking Coordinates: x=${x}, y=${y}`
        );

        firstPoseDetected = true;

    }

    // Asset becomes visible once tracking data exists.

    currentModel.visible = true;

    // Convert normalized MediaPipe X coordinate
    // into Three.js scene space.

    currentModel.position.x =
        (x - 0.5) *
        planeWidth;

    // Browser and WebGL coordinate systems
    // use opposite Y directions.

    currentModel.position.y =
        -(y - 0.5) *
        planeHeight;

    // Vertical offset placing the hat above the nose anchor.

    currentModel.position.y += 1.0;

};

// ============================================================================
// 5A. PRODUCT SELECTION EVENTS
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

/**
 * Public Method:
 * hideModel
 *
 * Invoked by camera.js whenever:
 *
 * - camera turns off
 * - tracking is lost
 * - user leaves frame
 */

window.hideModel = () => {

    if (currentModel) {

        currentModel.visible = false;

    }

};

// ============================================================================
// 6. THE RENDER LOOP (ANIMATION PIPELINE)
// ============================================================================

/**
 * Core rendering loop.
 *
 * requestAnimationFrame aligns rendering to the
 * browser refresh rate for maximum efficiency.
 */

function animate() {

    requestAnimationFrame(
        animate
    );

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

// Kick off the render pipeline.

animate();
