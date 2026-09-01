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

// ============================================================================
// DEVELOPER TOOLS (PHASE 1)
// ============================================================================

let developerGui;

// 1. Keep your exact original debug settings
const debugSettings = {
    showOccluder: false,
    showLandmarks: false,
    showAnchor: false
};

// 2. Add the robust variables for tuning the assets
const devControls = {
    anchor: 'nose', // Dropdown options
    scale: 0.6,
    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.0,
    rotX: 0.0,
    rotY: 0.0,
    rotZ: 0.0,
    // Per-model mirror offset: Math.PI for webcam-mirrored face assets (hats/glasses),
    // 0 for body assets (watch) that don't need the flip compensation.
    mirrorOffset: Math.PI,
    occluderRadius: 0.6,
    occluderOffsetY: -0.8,
    occluderOffsetZ: 0.0,
    logValues: () => {
        // This formats the output exactly how you need it for your code
        const configStr = `scale: ${devControls.scale.toFixed(2)}, anchor: '${devControls.anchor}', offsetX: ${devControls.offsetX.toFixed(2)}, offsetY: ${devControls.offsetY.toFixed(2)}, offsetZ: ${devControls.offsetZ.toFixed(2)}, rotX: ${devControls.rotX.toFixed(2)}, rotY: ${devControls.rotY.toFixed(2)}, rotZ: ${devControls.rotZ.toFixed(2)}, mirrorOffset: ${devControls.mirrorOffset.toFixed(4)}, occluderRadius: ${devControls.occluderRadius.toFixed(2)}, occluderOffsetY: ${devControls.occluderOffsetY.toFixed(2)}, occluderOffsetZ: ${devControls.occluderOffsetZ.toFixed(2)}, showOccluder: ${debugSettings.showOccluder}`;
        console.log(`[COPY THIS TO MODEL_CONFIGS]: \n{ ${configStr} }`);
        alert("Config printed to browser console!");
    }
};

function initializeDeveloperTools() {
    developerGui = new lil.GUI({ title: "🛠️ JCP AR Developer Tools" });

    // New Tracking Folder
    const trackFolder = developerGui.addFolder("Tracking & Anchor");
    trackFolder.add(devControls, 'anchor', ['nose', 'ears', 'chest']).name('Anchor Point');

    // New Transform Folder (Sliders)
    // New Transform Folder (Sliders) - EXPANDED LIMITS FOR BAD PIVOT POINTS
    const transformFolder = developerGui.addFolder("Transform (Item)");
    
    // Increased scale limit to 100 for tiny assets
    transformFolder.add(devControls, 'scale', 0.01, 100.0, 0.1).name('Scale').listen();
    
    // Increased offsets from +/- 5.0 to +/- 20.0 so you can pull flying items back down
    transformFolder.add(devControls, 'offsetX', -20.0, 20.0, 0.1).name('Offset X');
    transformFolder.add(devControls, 'offsetY', -20.0, 20.0, 0.1).name('Offset Y');
    transformFolder.add(devControls, 'offsetZ', -20.0, 20.0, 0.1).name('Offset Z');
    
    transformFolder.add(devControls, 'rotX', -Math.PI, Math.PI, 0.05).name('Pitch (Rot X)');
    transformFolder.add(devControls, 'rotY', -Math.PI, Math.PI, 0.05).name('Yaw (Rot Y)');
    transformFolder.add(devControls, 'rotZ', -Math.PI, Math.PI, 0.05).name('Roll (Rot Z)');
    // 0 = no mirror flip (watch), Math.PI = webcam mirror compensation (hats/glasses)
    transformFolder.add(devControls, 'mirrorOffset', 0, Math.PI * 2, 0.05).name('Mirror Offset');

    // New Occlusion Folder
    const occFolder = developerGui.addFolder("Occlusion (Head)");
    occFolder.add(devControls, 'occluderRadius', 0.1, 2.0, 0.05).name('Radius');
    occFolder.add(devControls, 'occluderOffsetY', -3.0, 3.0, 0.05).name('Offset Y');
    occFolder.add(devControls, 'occluderOffsetZ', -3.0, 3.0, 0.05).name('Offset Z');

// New Lighting Folder (MOVED HERE)
    const lightFolder = developerGui.addFolder("Lighting");
    lightFolder.add(ambientLight, 'intensity', 0.1, 4.0, 0.1).name('Ambient Light');

    // Your EXACT original debug folder
    const debugFolder = developerGui.addFolder("Debug");
    debugFolder.add(debugSettings, "showOccluder");
    debugFolder.add(debugSettings, "showLandmarks");
    debugFolder.add(debugSettings, "showAnchor");

    developerGui.add(devControls, 'logValues').name('📋 Print Config');

    // Keeps your Ctrl+X shortcut exactly the same
    developerGui.hide();
    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === "x") {
            const hidden = developerGui.domElement.style.display === "none";
            if (hidden) { developerGui.show(); } else { developerGui.hide(); }
        }
    });

    console.log("Developer Tools Initialized. Press Ctrl+X.");
}

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

// Lowered ambient light intensity to 0.8 to remove the flat 2D washed-out look!
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 2, 2);
scene.add(directionalLight);


// ============================================================================
// 3.5 OCCLUSION & DEBUG LANDMARKS SETUP
// ============================================================================
const headGeometry = new THREE.SphereGeometry(0.6, 32, 32); 
const invisibleOcclusionMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
const visibleOcclusionMaterial = new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.4 });
const headOccluder = new THREE.Mesh(headGeometry, invisibleOcclusionMaterial);
scene.add(headOccluder);

const anchorDebugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false })
);
anchorDebugSphere.renderOrder = 999;
anchorDebugSphere.visible = false;
scene.add(anchorDebugSphere);

// Create 33 debug spheres for all MediaPipe Landmarks
const landmarksGroup = new THREE.Group();
scene.add(landmarksGroup);
const landmarkSpheres = [];
for (let i = 0; i < 33; i++) {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
    );
    landmarksGroup.add(sphere);
    landmarkSpheres.push(sphere);
}
landmarksGroup.visible = false;

// ============================================================================
// 3.6 MOUSE SCROLL SCALING (Tyler's Idea!)
// ============================================================================
// Enable mouse interactions on the canvas
renderer.domElement.style.pointerEvents = 'auto'; 

renderer.domElement.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.shiftKey) {
        event.preventDefault(); // Stop page scrolling
        // Scroll up = larger, Scroll down = smaller
        devControls.scale += event.deltaY * -0.001; 
        if (devControls.scale < 0.01) devControls.scale = 0.01;
        
        // Visually update the slider in the GUI
        developerGui.controllersRecursive().forEach(c => {
            if (c.property === 'scale') c.updateDisplay();
        });
    }
});

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

// Expanded configuration to lock in the exact slider values for each asset.
const MODEL_CONFIGS = {
    "top_hat.glb": {
        scale: 0.63,
        anchor: 'ears',
        offsetX: 0.00, offsetY: 1.05, offsetZ: 0.35,
        rotX: 0.45, rotY: 0.00, rotZ: 0.00,
        mirrorOffset: Math.PI,  // webcam mirror compensation
        occluderRadius: 0.60, occluderOffsetY: 0.50, occluderOffsetZ: 0.00,
        showOccluder: false
    },
    "raybanglasses.glb": {
        scale: 0.63, anchor: 'ears',
        offsetX: 0.00, offsetY: 0.00, offsetZ: 0.45,
        rotX: 0.00, rotY: 0.00, rotZ: 0.00,
        mirrorOffset: Math.PI,  // webcam mirror compensation
        occluderRadius: 0.40, occluderOffsetY: -0.20, occluderOffsetZ: -0.30,
        showOccluder: false
    },

    "female_beach_hat.glb": {
        scale: 0.60, anchor: 'ears',
        offsetX: 0.00, offsetY: 0.95, offsetZ: -1.00,
        rotX: 0.50, rotY: 0.00, rotZ: 0.00,
        mirrorOffset: Math.PI,  // webcam mirror compensation
        occluderRadius: 0.75, occluderOffsetY: 0.55, occluderOffsetZ: -0.75,
        showOccluder: false
    },

    // Watch: no webcam mirror compensation needed (body-space asset)
    "handwatch.glb": {
        scale: 0.20,
        previewScale: 0.60,  // dedicated UI preview scale
        anchor: 'wrist',
        offsetX: 0.00, offsetY: 0.00, offsetZ: 0.00,
        rotX: 0.00, rotY: 0.00, rotZ: 0.00,
        mirrorOffset: 0,     // no mirror flip for wrist-space geometry
        occluderRadius: 0.40, occluderOffsetY: 0.00, occluderOffsetZ: 0.00,
        showOccluder: false
    }
};

// ============================================================================
// 4B. PRIMARY AR MODEL LOADER
// ============================================================================
/**
 * Loads a selected asset into the live AR scene and syncs the Developer GUI.
 *
 * @param {string} modelFile
 */
function loadARModel(modelFile) {
    if (assetLoadingMessage) assetLoadingMessage.style.display = "block";
    
    if (currentModel) scene.remove(currentModel);

    // I accidentally deleted this loader wrapper in the last step!
    loader.load(
        `models/${modelFile}`,
        function (gltf) {
            console.log(`Renderer: ${modelFile} loaded successfully.`);
            currentModel = gltf.scene;
            
            // SAVE THE 3D ARTIST'S NATIVE ROTATION BEFORE APPLYING CONFIGS
            const nativeRotX = currentModel.rotation.x;
            const nativeRotY = currentModel.rotation.y;
            const nativeRotZ = currentModel.rotation.z;

            // Load the specific configuration or use defaults
            const config = MODEL_CONFIGS[modelFile] || { 
                scale: 0.6, anchor: 'nose', 
                offsetX: 0.0, offsetY: 0.0, offsetZ: 0.0, 
                rotX: 0.0, rotY: 0.0, rotZ: 0.0,
                occluderRadius: 0.6, occluderOffsetY: -0.8, occluderOffsetZ: 0.0, 
                showOccluder: false 
            };

            // Sync the active item's config to the GUI sliders
            devControls.scale = config.scale;
            devControls.anchor = config.anchor;
            devControls.offsetX = config.offsetX;
            devControls.offsetY = config.offsetY;
            devControls.offsetZ = config.offsetZ;
            devControls.rotX = config.rotX;
            devControls.rotY = config.rotY;
            devControls.rotZ = config.rotZ;
            devControls.mirrorOffset = (config.mirrorOffset !== undefined) ? config.mirrorOffset : Math.PI;
            devControls.occluderRadius = config.occluderRadius;
            devControls.occluderOffsetY = config.occluderOffsetY;
            devControls.occluderOffsetZ = config.occluderOffsetZ;
            debugSettings.showOccluder = config.showOccluder;

            // Visually update the sliders on screen
            if (developerGui) {
                developerGui.controllersRecursive().forEach(c => c.updateDisplay());
            }

            currentModel.scale.set(config.scale, config.scale, config.scale);
            currentModel.userData = config; 
            
            // STORE THE NATIVE ROTATION SAFELY IN USERDATA
            currentModel.userData.nativeRotX = nativeRotX;
            currentModel.userData.nativeRotY = nativeRotY;
            currentModel.userData.nativeRotZ = nativeRotZ;
            
            currentModel.visible = false;

            scene.add(currentModel);

            if (assetLoadingMessage) assetLoadingMessage.style.display = "none";
        },
        undefined,
        function (error) {
            console.error("Renderer Error: Failed to load the 3D model.", error);
            if (assetLoadingMessage) {
                assetLoadingMessage.innerText = "Asset Load Failed";
                assetLoadingMessage.style.color = "#ff4444";
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
let previewLoadId = 0;

// ============================================================================
// 4D. PREVIEW MODEL LOADER
// ============================================================================

/**
 * Loads the rotating model preview.
 *
 * @param {string} modelFile
 */

function loadPreviewModel(modelFile) {

    previewLoadId++;

    const loadId =
        previewLoadId;

    if (previewModel) {

        previewScene.remove(
            previewModel
        );

        previewModel = null;
    }

    loader.load(

        `models/${modelFile}`,

        function (gltf) {

            if (loadId !== previewLoadId) {
                return;
            }

            previewModel =
                gltf.scene;

            const config =
                MODEL_CONFIGS[modelFile] ||
                { scale: 0.6 };

            // Use previewScale if it exists, otherwise fall back to the standard AR scale
            const finalPreviewScale = config.previewScale || config.scale;

            previewModel.scale.set(
                finalPreviewScale,
                finalPreviewScale,
                finalPreviewScale
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

const vFov = camera.fov * Math.PI / 180;
const planeHeight = 2 * Math.tan(vFov / 2) * camera.position.z;
const planeWidth = planeHeight * camera.aspect;

// Updated to accept the full array, tilt angle, and dynamic face width
window.updateModelPosition = (landmarks, headTiltAngle, faceWidth, faceLandmarks) => {
    if (!currentModel || !landmarks) return;

    if (!firstPoseDetected) {
        console.log("Renderer: First pose detection received.");
        firstPoseDetected = true;
    }

    currentModel.visible = true;

    // A) Dynamic Scale based on distance
    // Baseline calibrated for Face Mesh inter-temple distance in normalized coords (~0.30).
    // Clamped to [0.5, 2.0] to prevent runaway scaling from tracking noise.
    const baselineWidth = 0.30;
    let scaleMultiplier = (faceWidth !== undefined && faceWidth > 0) ? (faceWidth / baselineWidth) : 1.0;
    scaleMultiplier = Math.max(0.5, Math.min(2.0, scaleMultiplier));
    const finalScale = devControls.scale * scaleMultiplier;
    

    // B) Calculate Anchor Position
    // Face anchors ('ears', 'nose') use Face Mesh landmarks for precision.
    // Body anchors ('chest', 'wrist') use Pose landmarks.
    let anchorX = 0, anchorY = 0, anchorRotation = 0;

    if (devControls.anchor === 'ears') {
        if (faceLandmarks && faceLandmarks[234] && faceLandmarks[454]) {
            // Face Mesh: 234 = left temple, 454 = right temple.
            // These track the skull surface and barely slip during head turns.
            anchorX = (faceLandmarks[234].x + faceLandmarks[454].x) / 2;
            anchorY = (faceLandmarks[234].y + faceLandmarks[454].y) / 2;
            anchorRotation = headTiltAngle !== undefined ? headTiltAngle : 0;
        } else if (landmarks[7] && landmarks[8]) {
            // Fallback: Pose ears while Face Mesh warms up
            anchorX = (landmarks[7].x + landmarks[8].x) / 2;
            anchorY = (landmarks[7].y + landmarks[8].y) / 2;
            anchorRotation = headTiltAngle !== undefined ? headTiltAngle : 0;
        }
    } else if (devControls.anchor === 'chest' && landmarks[11] && landmarks[12]) {
        anchorX = (landmarks[11].x + landmarks[12].x) / 2;
        anchorY = (landmarks[11].y + landmarks[12].y) / 2;
        anchorRotation = Math.atan2(landmarks[12].y - landmarks[11].y, landmarks[12].x - landmarks[11].x);
    } else if (devControls.anchor === 'wrist') {
        // Best-visibility wrist selection: pick whichever wrist MediaPipe is most
        // confident about in the current frame. Enables both left and right wrist.
        const leftWrist  = landmarks[15];
        const rightWrist = landmarks[16];
        let wristLandmark = null;
        let elbowLandmark = null;

        if (leftWrist && rightWrist) {
            if ((leftWrist.visibility || 0) >= (rightWrist.visibility || 0)) {
                wristLandmark = leftWrist;
                elbowLandmark = landmarks[13]; // left elbow
            } else {
                wristLandmark = rightWrist;
                elbowLandmark = landmarks[14]; // right elbow
            }
        } else if (leftWrist) {
            wristLandmark = leftWrist;
            elbowLandmark = landmarks[13];
        } else if (rightWrist) {
            wristLandmark = rightWrist;
            elbowLandmark = landmarks[14];
        }

        if (wristLandmark) {
            anchorX = wristLandmark.x;
            anchorY = wristLandmark.y;
            anchorRotation = elbowLandmark
                ? Math.atan2(wristLandmark.y - elbowLandmark.y, wristLandmark.x - elbowLandmark.x)
                : 0;
        }
    } else {
        // Default: nose anchor
        if (faceLandmarks && faceLandmarks[1]) {
            // Face Mesh landmark 1 = nose tip (more stable than Pose landmark 0)
            anchorX = faceLandmarks[1].x;
            anchorY = faceLandmarks[1].y;
        } else {
            anchorX = landmarks[0].x;
            anchorY = landmarks[0].y;
        }
        anchorRotation = headTiltAngle !== undefined ? headTiltAngle : 0;
    }

    // --- LERP SMOOTHING (SPLIT SPEEDS) ---
    // Rotation must be fast so the asset feels glued to the face during head tilts.
    // Position can afford slight smoothing for a grounded, natural feel.
    // Scale is slowest to absorb tracking noise without jarring size pops.
    const LERP_POSITION = 0.25;
    const LERP_ROTATION = 0.50;
    const LERP_SCALE    = 0.15;

// 1. Smooth Scale
const targetScale = new THREE.Vector3(
    finalScale,
    finalScale,
    finalScale
);
currentModel.scale.lerp(targetScale, LERP_SCALE);

// 2. Smooth Position
const targetPosition = new THREE.Vector3(
    (anchorX - 0.5) * planeWidth + devControls.offsetX,
    -(anchorY - 0.5) * planeHeight + devControls.offsetY,
    devControls.offsetZ
);
currentModel.position.lerp(targetPosition, LERP_POSITION);

// 3. Smooth Rotation
// mirrorOffset is per-model (Math.PI for webcam-mirrored face assets, 0 for watch).
// Using devControls.mirrorOffset instead of a hardcoded constant lets each model
// carry its own flip compensation without affecting other assets.

const targetEuler = new THREE.Euler(
    currentModel.userData.nativeRotX + devControls.rotX,
    currentModel.userData.nativeRotY + devControls.rotY,
    currentModel.userData.nativeRotZ - anchorRotation + devControls.mirrorOffset + devControls.rotZ
);

const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);

currentModel.quaternion.slerp(
    targetQuaternion,
    LERP_ROTATION
);

    // D) Sync Anchor Debug Sphere
    anchorDebugSphere.position.set(
        (anchorX - 0.5) * planeWidth,
        -(anchorY - 0.5) * planeHeight,
        0 
    );

    // E) Sync Head Occluder 
    if (debugSettings.showOccluder) {
        headOccluder.visible = true;
        headOccluder.geometry.dispose();
        headOccluder.geometry = new THREE.SphereGeometry(devControls.occluderRadius, 32, 32);
        
        let occX = (landmarks[7] && landmarks[8]) ? (landmarks[7].x + landmarks[8].x) / 2 : anchorX;
        let occY = (landmarks[7] && landmarks[8]) ? (landmarks[7].y + landmarks[8].y) / 2 : anchorY;
        
        headOccluder.position.x = (occX - 0.5) * planeWidth;
        headOccluder.position.y = -(occY - 0.5) * planeHeight + devControls.occluderOffsetY;
        headOccluder.position.z = devControls.occluderOffsetZ;
        headOccluder.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
    } else {
        headOccluder.visible = false;
    }

    // F) Draw 33 Debug Landmarks
    if (debugSettings.showLandmarks) {
        landmarksGroup.visible = true;
        for (let i = 0; i < 33; i++) {
            if (landmarks[i] && landmarkSpheres[i]) {
                landmarkSpheres[i].position.x = (landmarks[i].x - 0.5) * planeWidth;
                landmarkSpheres[i].position.y = -(landmarks[i].y - 0.5) * planeHeight;
            }
        }
    } else {
        landmarksGroup.visible = false;
    }
};

// ============================================================================
// 5A. PRODUCT SELECTION EVENTS
// ============================================================================

document.querySelectorAll(".asset-card").forEach(card => {
    card.addEventListener("click", () => {
        document.querySelectorAll(".asset-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const modelFile = card.dataset.model;
        loadARModel(modelFile);
        loadPreviewModel(modelFile);
    });
});

window.hideModel = () => {
    if (currentModel) {
        currentModel.visible = false;
    }
};

// ============================================================================
// 6. THE RENDER LOOP (ANIMATION PIPELINE)
// ============================================================================

function animate() {
    requestAnimationFrame(animate);

    if (previewModel) {
        previewModel.rotation.y += 0.01;
    }
    
    // Toggle Occluder to visible material for debugging
    headOccluder.material = debugSettings.showOccluder 
        ? visibleOcclusionMaterial 
        : invisibleOcclusionMaterial;
    
    anchorDebugSphere.visible = debugSettings.showAnchor;

    renderer.render(scene, camera);
    previewRenderer.render(previewScene, previewCamera);
}

// Kick off the render pipeline.
animate();

// Initialize the new dev tools
initializeDeveloperTools();
