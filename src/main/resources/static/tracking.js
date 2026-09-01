/*
=========================================================================================
File: tracking.js
Description: Computer Vision & Spatial Tracking Layer (Google MediaPipe)
Project: JCPenney Virtual Try-On Experience (Hackathon Prototype)
Team: Not a Bug, It's a Feature

Overview:
This module ingests the raw HTML5 video feed and processes it through:
  1. Google MediaPipe Pose     — body anchors (wrist [15/16], chest [11/12])
  2. Google MediaPipe Face Mesh — face anchors (hats, glasses) with 468 landmarks

Both models run client-side, in parallel, on every video frame. The Pose model
handles body-scale tracking; Face Mesh provides sub-centimeter face geometry.
The renderer receives results from both on every tick.
=========================================================================================
*/

const videoElement = document.getElementById('video');

// ============================================================================
// 1. SHARED LANDMARK STATE
// ============================================================================
// Each ML model fires results asynchronously. We cache the latest result from
// each model and combine them when broadcasting to the renderer.

let latestFaceLandmarks = null;

// ============================================================================
// 2. FACE MESH TRACKER (Precise Face Anchors: Hats, Glasses)
// ============================================================================
// MediaPipe Face Mesh delivers 468 tightly-tracked facial landmarks.
// This replaces the coarse Pose ear estimates ([7]/[8]) which caused floating.
//
// Key landmarks used:
//   234  = left temple  (inter-ear midpoint anchor)
//   454  = right temple (inter-ear midpoint anchor)
//   1    = nose tip     (nose anchor fallback)

const faceMeshTracker = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMeshTracker.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,        // false = faster inference; sufficient for anchoring
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

faceMeshTracker.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        latestFaceLandmarks = results.multiFaceLandmarks[0];
    } else {
        latestFaceLandmarks = null;
    }
});

// ============================================================================
// 3. POSE TRACKER (Body Anchors: Wrist, Chest)
// ============================================================================
/**
 * Callback triggered every time the Pose model processes a video frame.
 * Combines Pose landmarks with the latest Face Mesh output before broadcasting
 * to the WebGL renderer.
 *
 * @param {Object} results - MediaPipe Pose output payload.
 */
function onResults(results) {
    // Guard clause: no person detected — hide the active 3D model.
    if (!results.poseLandmarks) {
        if (window.hideModel) window.hideModel();
        return;
    }

    let headTiltAngle = 0;
    let faceWidth = 0.30; // default fallback in normalized Face Mesh coordinates

    if (latestFaceLandmarks) {
        // Face Mesh temples give a stable, precise inter-ear span.
        // These landmarks barely move relative to the face even during head turns.
        const leftTemple  = latestFaceLandmarks[234];
        const rightTemple = latestFaceLandmarks[454];
        const deltaX = rightTemple.x - leftTemple.x;
        const deltaY = rightTemple.y - leftTemple.y;
        headTiltAngle = Math.atan2(deltaY, deltaX);
        faceWidth = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    } else {
        // Fallback: Pose ear landmarks while Face Mesh warms up (first ~2 frames).
        const leftEar  = results.poseLandmarks[7];
        const rightEar = results.poseLandmarks[8];
        const deltaX = rightEar.x - leftEar.x;
        const deltaY = rightEar.y - leftEar.y;
        headTiltAngle = Math.atan2(deltaY, deltaX);
        faceWidth = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    // Broadcast pose landmarks, head tilt, face width, and precise face landmarks
    // to the WebGL rendering engine.
    if (window.updateModelPosition) {
        window.updateModelPosition(
            results.poseLandmarks,
            headTiltAngle,
            faceWidth,
            latestFaceLandmarks   // precise 468-landmark face geometry
        );
    }
}

// ============================================================================
// 4. MEDIAPIPE POSE TRACKER CONFIGURATION
// ============================================================================
const poseTracker = new Pose({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

poseTracker.setOptions({
    modelComplexity: 1,           // 0=Fastest/Less Accurate, 1=Balanced, 2=Slowest/Highly Accurate
    smoothLandmarks: true,        // Applies jitter-reduction filters to the spatial data
    minDetectionConfidence: 0.5,  // Minimum confidence threshold to initially detect a person
    minTrackingConfidence: 0.5    // Minimum confidence threshold to maintain tracking frame-to-frame
});

poseTracker.onResults(onResults);

// ============================================================================
// 5. HARDWARE STREAM BINDING
// ============================================================================
// Send each video frame to BOTH trackers simultaneously via Promise.all.
// This keeps both models in lockstep with the camera feed.
const mlCamera = new Camera(videoElement, {
    onFrame: async () => {
        await Promise.all([
            poseTracker.send({image: videoElement}),
            faceMeshTracker.send({image: videoElement})
        ]);
    },
    width: 640,
    height: 480
});

// ============================================================================
// 6. PUBLIC API EXPORTS
// ============================================================================
/**
 * Public Method: startTrackingLoop
 * Invoked by camera.js immediately after the hardware webcam stream is authorized.
 */
window.startTrackingLoop = () => {
    console.log("Tracking Layer: Starting MediaPipe Pose + Face Mesh spatial tracking loop...");
    mlCamera.start();
};
