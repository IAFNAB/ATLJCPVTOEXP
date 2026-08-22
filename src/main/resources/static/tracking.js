/*
========================================================================
File: tracking.js
Description: Google MediaPipe Pose Tracking Integration.
Overview: Ingests the raw video feed, runs it through the Pose ML model, 
and logs the spatial coordinates for our virtual try-on assets.
========================================================================
*/

const videoElement = document.getElementById('video');

// ==========================================
// 1. Handle the ML Tracking Results
// ==========================================
function onResults(results) {
    if (!results.poseLandmarks) {
        return; // No person detected in the frame
    }
    
    // Grab the specific body parts we need for our fashion show
    const nose = results.poseLandmarks[0];       // For the Hat and Glasses
    const leftShoulder = results.poseLandmarks[11]; // For the Purse
    
    // Log the coordinates so we know the AI is seeing us
    console.log(`Face (Nose) X: ${nose.x.toFixed(2)}, Y: ${nose.y.toFixed(2)}`);
    console.log(`Shoulder X: ${leftShoulder.x.toFixed(2)}, Y: ${leftShoulder.y.toFixed(2)}`);
    
    // In the next phase, renderer.js will use these variables to pin the 3D models to the screen!
}

// ==========================================
// 2. Initialize the MediaPipe Pose Tracker
// ==========================================
const poseTracker = new Pose({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

poseTracker.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

poseTracker.onResults(onResults);

// ==========================================
// 3. Connect Video Stream to the Tracker
// ==========================================
const mlCamera = new Camera(videoElement, {
    onFrame: async () => {
        await poseTracker.send({image: videoElement});
    },
    width: 640,
    height: 480
});

// Expose this function so camera.js can trigger it when the video turns on
window.startTrackingLoop = () => {
    console.log("Starting ML spatial tracking loop...");
    mlCamera.start();
};