/*
=========================================================================================
File: tracking.js
Description: Computer Vision & Spatial Tracking Layer (Google MediaPipe)
Project: JCPenney Virtual Try-On Experience (Hackathon Prototype)
Team: Not a Bug, It's a Feature

Overview:
This module ingests the raw HTML5 video feed and processes it through Google's
MediaPipe Pose ML model. It runs entirely client-side to maintain rapid inference 
times and strict enterprise privacy standards. The extracted coordinate landmarks 
(e.g., the nose for hats/glasses, shoulders for purses) are normalized and broadcast 
to the WebGL renderer.
=========================================================================================
*/

const videoElement = document.getElementById('video');

// ============================================================================
// 1. ML TRACKING PIPELINE (RESULTS HANDLER)
// ============================================================================
/**
 * Callback function triggered every time the Pose model processes a video frame.
 * @param {Object} results - The output payload from MediaPipe containing spatial landmarks.
 */
function onResults(results) {
    // Guard clause: If the ML model cannot detect a human in the frame,
    // we instruct the renderer to hide the active 3D model.
    if (!results.poseLandmarks) {
        if (window.hideModel) window.hideModel();
        return;
    }

    // MediaPipe Pose returns an array of 33 3D bodily landmarks.
    // We grab the ears to calculate the head tilt (Roll) and face width.
    const leftEar  = results.poseLandmarks[7];
    const rightEar = results.poseLandmarks[8];

    // Calculate the angle between the ears in radians (Z-Tilt / Roll)
    const deltaY = rightEar.y - leftEar.y;
    const deltaX = rightEar.x - leftEar.x;
    const headTiltAngle = Math.atan2(deltaY, deltaX);

    // Calculate face width for dynamic distance scaling
    const faceWidth = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));

    // Estimate head yaw (Y-axis rotation) from ear DEPTH difference.
    // When facing the camera both ears are at roughly the same Z depth (yaw = 0).
    // As the user turns, the near ear comes forward (lower Z) and the far ear
    // pushes back (higher Z). This is symmetric — unlike the nose-offset method,
    // it doesn't matter which ear MediaPipe occludes because the depth gap
    // grows equally in both directions.
    const earDeltaZ    = leftEar.z - rightEar.z;
    const headYawAngle = Math.atan2(earDeltaZ, faceWidth);

    // Broadcast the ENTIRE landmark array, plus our calculated tilt, width, and yaw
    // to our WebGL rendering engine.
    if (window.updateModelPosition) {
        window.updateModelPosition(results.poseLandmarks, headTiltAngle, faceWidth, headYawAngle);
    }
}

// ============================================================================
// 2. MEDIAPIPE POSE TRACKER CONFIGURATION
// ============================================================================
// Initialize the Pose tracker and dynamically load the required WASM binaries via CDN.
const poseTracker = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});

// Configure the AI model parameters for a balance of performance and accuracy.
poseTracker.setOptions({
    modelComplexity: 1,           // 0=Fastest/Less Accurate, 1=Balanced, 2=Slowest/Highly Accurate
    smoothLandmarks: true,        // Applies jitter-reduction filters to the spatial data
    minDetectionConfidence: 0.5,  // Minimum confidence threshold to initially detect a person
    minTrackingConfidence: 0.5    // Minimum confidence threshold to maintain tracking frame-to-frame
});

// Bind our custom results handler to the model's output pipeline.
poseTracker.onResults(onResults);

// ============================================================================
// 3. HARDWARE STREAM BINDING
// ============================================================================
// Utilize the MediaPipe Camera utility to optimize the ingestion of the video stream.
// This utility automatically feeds raw frames into the ML model at the correct resolution.
const mlCamera = new Camera(videoElement, {
    onFrame: async () => {
        await poseTracker.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// ============================================================================
// 4. PUBLIC API EXPORTS
// ============================================================================
/**
 * Public Method: startTrackingLoop
 * Invoked by camera.js immediately after the hardware webcam stream is successfully authorized.
 */
window.startTrackingLoop = () => {
    console.log("Tracking Layer: Starting MediaPipe ML spatial tracking loop...");
    mlCamera.start();
};
