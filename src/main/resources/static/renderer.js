/*
=========================================================================================
File: renderer.js
Description: Three.js 3D Rendering Engine & Spatial Tracking Layer
Project: JCPenney Virtual Try-On Experience (Hackathon Prototype)
Team: Not a Bug, It's a Feature

Overview:
This module initializes the WebGL environment and acts as the bridge between 
the 2D video feed and the 3D augmented reality models. It creates a transparent 
overlay canvas, dynamically scales/loads .glb files, and continuously repaints 
the screen at 60 FPS. Furthermore, it exposes public methods allowing the ML 
tracker to update the spatial coordinates of the loaded merchandise in real-time.
=========================================================================================
*/

// ============================================================================
// 1. SCENE AND CAMERA CONFIGURATION
// ============================================================================
// The Scene is the 3D virtual environment where our models and lights exist.
const scene = new THREE.Scene();

// The PerspectiveCamera simulates a standard human eye view.
// Parameters: Field of View (45 deg), Aspect Ratio (640/480), Near Plane (0.1), Far Plane (1000).
const camera = new THREE.PerspectiveCamera(45, 640 / 480, 0.1, 1000);
camera.position.z = 5; // Move the camera back on the Z-axis so the models are in view.

// ============================================================================
// 2. WEBGL RENDERER INITIALIZATION
// ============================================================================
// 'alpha: true' allows the background to be transparent, revealing the HTML <video> behind it.
// 'antialias: true' smooths out jagged pixel edges on the 3D models.
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(640, 480);

// Style the generated <canvas> to sit absolutely positioned over the video stream.
// 'pointerEvents: none' ensures user clicks pass through the 3D layer to the UI buttons underneath.
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.pointerEvents = 'none'; 

// Inject the newly created 3D canvas into our existing video container div.
document.querySelector('.video-frame').appendChild(renderer.domElement);

// ============================================================================
// 3. SCENE LIGHTING
// ============================================================================
// AmbientLight provides base illumination everywhere, preventing pitch-black shadows.
// Set to a high intensity (2.5) to ensure dark models like a black top hat are visible.
const ambientLight = new THREE.AmbientLight(0xffffff, 2.5); 
scene.add(ambientLight);

// DirectionalLight mimics sunlight, providing highlights, depth, and material reflections.
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 2, 2);
scene.add(directionalLight);

// ============================================================================
// 4. ASSET LOADING AND INITIALIZATION
// ============================================================================
let currentModel; // Global reference to our active merchandise model
const loader = new THREE.GLTFLoader();

// Load the initial test asset: the top hat.
loader.load('models/top_hat.glb', function (gltf) {
    currentModel = gltf.scene;
    
    // Scale the model down to fit proportionately within the camera frame.
    // INCREASED to 0.6 so the hat renders larger on the head.
    currentModel.scale.set(0.6, 0.6, 0.6); 
    
    // Keep the model hidden upon initialization. 
    // It will only become visible when the tracking algorithm detects a face.
    currentModel.visible = false; 
    
    // Add the fully loaded and configured model to our 3D environment.
    scene.add(currentModel);
}, undefined, function (error) {
    console.error("Renderer Error: Failed to load the 3D model.", error);
});

// ============================================================================
// 5. SPATIAL TRACKING MAPPING (2D TO 3D CONVERSION)
// ============================================================================
// To accurately place 3D objects, we must calculate the exact width and height
// of the visible 3D plane at the depth (Z) where our model sits.
const vFov = camera.fov * Math.PI / 180;
const planeHeight = 2 * Math.tan(vFov / 2) * camera.position.z;
const planeWidth = planeHeight * camera.aspect;

/**
 * Public Method: updateModelPosition
 * Invoked by tracking.js when MediaPipe successfully detects facial landmarks.
 * @param {number} x - The normalized X coordinate (0.0 to 1.0) from the ML model.
 * @param {number} y - The normalized Y coordinate (0.0 to 1.0) from the ML model.
 */
window.updateModelPosition = (x, y) => {
    // Guard clause: ensure the model has finished downloading before trying to move it.
    if (!currentModel) return;
    
    // Toggle visibility on since the camera stream is active and tracking.
    currentModel.visible = true; 

    // Translate normalized ML coordinates (0 to 1) into WebGL spatial coordinates (-width to +width).
    // Note: If the 3D model moves opposite to your actual movement, swap to (0.5 - x).
    currentModel.position.x = (x - 0.5) * planeWidth;
    
    // The Y-axis is inverted in WebGL compared to browser DOM coordinates, so we negate it.
    currentModel.position.y = -(y - 0.5) * planeHeight;
    
    // Add a vertical offset to push the pivot point up.
    // INCREASED to 1.5 to push the hat higher onto the crown of the head, off the forehead.
    currentModel.position.y += 1.5; 
};

/**
 * Public Method: hideModel
 * Invoked by camera.js when the webcam is toggled off, or by tracking.js when the user leaves the frame.
 */
window.hideModel = () => {
    if (currentModel) currentModel.visible = false;
};

// ============================================================================
// 6. THE RENDER LOOP (ANIMATION PIPELINE)
// ============================================================================
/**
 * The core graphics loop. requestAnimationFrame ensures this function runs 
 * efficiently in sync with the browser's refresh rate (typically 60 FPS).
 */
function animate() {
    requestAnimationFrame(animate);
    
    // Paint the current state of the scene and camera to the canvas.
    renderer.render(scene, camera);
}

// Kick off the rendering pipeline.
animate();