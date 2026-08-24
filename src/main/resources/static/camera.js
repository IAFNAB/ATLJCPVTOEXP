/*
========================================================================
File: camera.js
Description: The logic layer for the Camera App interface.
Overview: This script leverages the browser's native MediaDevices API
to request hardware access. It demonstrates DOM manipulation, asynchronous
hardware requests, and canvas-based image processing. It is isolated from
the API and Tracking logic to maintain a clean separation of concerns.
========================================================================
*/

// ==========================================
// 1. DOM Element Mapping
// Grabbing the HTML objects so we can manipulate them in JavaScript
// ==========================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photo = document.getElementById('photo');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const captureBtn = document.getElementById('captureBtn');
const offlineMessage = document.getElementById('offlineMessage');

// Global state variable to track the active camera stream
let currentStream = null;

// ==========================================
// DEBUGGING HELPERS
// Added to improve troubleshooting across
// browsers, devices, and QA environments.
// ==========================================
function stopCurrentStream() {
    if (currentStream) {
        console.log("Cleaning up active camera stream...");

        currentStream.getTracks().forEach(track => {
            console.log(
                `Stopping track: ${track.kind} | ReadyState=${track.readyState}`
            );
            track.stop();
        });

        currentStream = null;
    }
}

// ==========================================
// PAGE CLEANUP
// Ensures camera resources are released if
// the user refreshes, closes, or leaves page.
// ==========================================
window.addEventListener('beforeunload', () => {
    console.log("Page unloading. Releasing camera resources...");
    stopCurrentStream();
});

// ==========================================
// VISIBILITY DEBUGGING
// Helps determine if browser tab switching
// causes camera or tracking issues.
// ==========================================
document.addEventListener('visibilitychange', () => {
    console.log(
        `Visibility Changed: ${document.visibilityState}`
    );
});

// ==========================================
// 2. Hardware Access & UI Toggle Logic
// ==========================================

// --- TOGGLE BUTTON LOGIC ---
toggleCamBtn.addEventListener('click', async () => {

    console.log("Toggle camera button clicked.");

    // If stream exists, the camera is currently ON, so we stop it
    if (currentStream) {

        console.log("Stopping camera...");

        // To properly turn off the webcam (and kill the hardware light),
        // we must explicitly stop the individual hardware tracks.
        stopCurrentStream();

        // Clear the video element and reset our global state variable
        video.srcObject = null;

        // UI Update: Reset button, remove active class, and show the offline placeholder
        toggleCamBtn.innerHTML = '▶️ Start Camera';
        toggleCamBtn.classList.remove('camera-running');
        offlineMessage.style.display = 'flex';

        if (window.hideModel) window.hideModel(); // Hide the 3D asset

        console.log("Camera stopped successfully.");
    }

    // If no stream exists, the camera is OFF, so we start it
    else {

        try {

            console.log("Requesting getUserMedia...");

            // DEBUG: List available devices
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();

                console.log("Detected media devices:");

                devices.forEach(device => {
                    console.log({
                        kind: device.kind,
                        label: device.label || "(label unavailable until permission granted)",
                        deviceId: device.deviceId
                    });
                });

            } catch (deviceErr) {

                console.warn(
                    "Unable to enumerate media devices.",
                    deviceErr
                );
            }

            // We use async/await because requesting hardware access takes an unknown amount of time.
            // This prompts the OS/browser permission pop-up for the webcam.
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: true
            });

            console.log("Stream successfully acquired.");

            const tracks = currentStream.getTracks();

            tracks.forEach(track => {
                console.log(
                    `Camera Track Acquired:
                    Kind=${track.kind}
                    Label=${track.label}
                    ReadyState=${track.readyState}`
                );
            });

            // Route the active stream to our HTML <video> element's source object
            video.srcObject = currentStream;

            // IMPORTANT:
            // Wait until the browser fully initializes the video stream
            // before starting MediaPipe tracking.
            video.onloadedmetadata = () => {

                console.log("Video metadata loaded.");
                console.log(
                    `Resolution: ${video.videoWidth} x ${video.videoHeight}`
                );

                if (window.startTrackingLoop) {

                    console.log(
                        "Starting MediaPipe tracking loop..."
                    );

                    window.startTrackingLoop();
                } else {

                    console.warn(
                        "startTrackingLoop() was not found."
                    );
                }
            };

            console.log("Video stream assigned to video element.");

            // UI Update: Update button text, add active class, and hide the offline placeholder
            toggleCamBtn.innerHTML = '⏹ Stop Camera';
            toggleCamBtn.classList.add('camera-running');
            offlineMessage.style.display = 'none';

        }

        catch (err) {

            // This catches scenarios where the user clicks "Block" on the permission prompt
            // or if the device simply does not have a webcam.

            console.error("Hardware access denied, unavailable, or failed.");

            console.error("Error Name:", err.name);
