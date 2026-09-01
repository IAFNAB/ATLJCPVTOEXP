/*
=========================================================================================
File: tracking.js
Description: Computer Vision & Spatial Tracking Layer (Google MediaPipe Holistic)
Project: JCPenney Virtual Try-On Experience (Hackathon Prototype)
Team: Not a Bug, It's a Feature

Overview:
This module ingests the raw HTML5 video feed and processes it through Google's
MediaPipe Holistic model. Holistic is a unified solution that delivers:

  - 33 pose landmarks  (body, wrist, chest — same layout as the Pose model)
  - 468 face landmarks (precise facial geometry for hats and glasses)
  - 21 hand landmarks  (left and right, available for future use)

Using a single Holistic model eliminates the WASM namespace conflict that occurs
when Pose and Face Mesh are loaded as two separate models simultaneously.
All results arrive in one callback, in lockstep with the camera feed.
=========================================================================================
*/

const videoElement = document.getElementById('video');

// ============================================================================
// 1. ML TRACKING PIPELINE (RESULTS HANDLER)
// ============================================================================
/**
 * Callback triggered every time the Holistic model processes a video frame.
 * Receives pose landmarks AND face mesh landmarks in a single results object.
 *
 * @param {Object} results - MediaPipe Holistic output payload.
 *   results.poseLandmarks   — 33 body landmarks (same as standalone Pose)
 *   results.faceLandmarks   — 468 face mesh landmarks (same as standalone Face Mesh)
 */
function onResults(results) {
    // Guard clause: no person detected — hide the active 3D model.
    if (!results.poseLandmarks) {
        if (window.hideModel) window.hideModel();
        return;
    }

    // Holistic delivers face landmarks alongside pose in the same frame.
    const faceLandmarks = results.faceLandmarks || null;

    let headTiltAngle = 0;
    let faceWidth = 0.30; // default fallback in normalized Face Mesh coordinates

    if (faceLandmarks && faceLandmarks[234] && faceLandmarks[454]) {
        // Face Mesh temples give a stable, precise inter-ear span.
        // Landmark 234 = left temple, 454 = right temple.
        const leftTemple  = faceLandmarks[234];
        const rightTemple = faceLandmarks[454];
        const deltaX = rightTemple.x - leftTemple.x;
        const deltaY = rightTemple.y - leftTemple.y;
        headTiltAngle = Math.atan2(deltaY, deltaX);
        faceWidth = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    } else {
        // Fallback: Pose ear landmarks during the first few frames before
        // Holistic's face sub-model has warmed up.
        const leftEar  = results.poseLandmarks[7];
        const rightEar = results.poseLandmarks[8];
        const deltaX = rightEar.x - leftEar.x;
        const deltaY = rightEar.y - leftEar.y;
        headTiltAngle = Math.atan2(deltaY, deltaX);
        faceWidth = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    // Broadcast pose landmarks, head tilt, face width, and face mesh landmarks
    // to the WebGL rendering engine.
    if (window.updateModelPosition) {
        window.updateModelPosition(
            results.poseLandmarks,
            headTiltAngle,
            faceWidth,
            faceLandmarks   // precise 468-landmark face geometry
        );
    }
}

// ============================================================================
// 2. MEDIAPIPE HOLISTIC TRACKER CONFIGURATION
// ============================================================================
// A single Holistic model replaces the separate Pose + Face Mesh setup.
// This eliminates the WASM global namespace collision that crashes both models.

const holisticTracker = new Holistic({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    }
});

holisticTracker.setOptions({
    modelComplexity: 1,           // 0=Fastest, 1=Balanced, 2=Most Accurate
    smoothLandmarks: true,        // Jitter-reduction on pose landmarks
    enableSegmentation: false,    // Not needed — saves processing time
    smoothSegmentation: false,
    refineFaceLandmarks: false,   // false = faster; sufficient for anchoring
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

holisticTracker.onResults(onResults);

// ============================================================================
// 3. HARDWARE STREAM BINDING
// ============================================================================
// The MediaPipe Camera utility feeds raw frames into the Holistic model.
// One model, one send per frame — no concurrent WASM conflicts.

const mlCamera = new Camera(videoElement, {
    onFrame: async () => {
        await holisticTracker.send({image: videoElement});
    },
    width: 640,
    height: 480
});

// ============================================================================
// 4. PUBLIC API EXPORTS
// ============================================================================
/**
 * Public Method: startTrackingLoop
 * Invoked by camera.js immediately after the hardware webcam stream is authorized.
 */
window.startTrackingLoop = () => {
    console.log("Tracking Layer: Starting MediaPipe Holistic spatial tracking loop...");
    mlCamera.start();
};
