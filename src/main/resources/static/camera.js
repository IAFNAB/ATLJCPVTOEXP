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
// DEBUGGING HELPER
// ==========================================
function stopCurrentStream() {

    if (!currentStream) {
        return;
    }

    console.log("Cleaning up active camera stream...");

    const tracks = currentStream.getTracks();

    tracks.forEach(track => {

        console.log(
            `Stopping track:
             Kind=${track.kind}
             Label=${track.label}
             ReadyState=${track.readyState}`
        );

        track.stop();
    });

    currentStream = null;
}

// ==========================================
// PAGE CLEANUP
// Releases webcam if user refreshes,
// closes tab, or leaves page.
// ==========================================
window.addEventListener('beforeunload', () => {

    console.log("Page unloading. Releasing camera resources...");

    stopCurrentStream();

});

// ==========================================
// VISIBILITY DEBUGGING
// Useful for reproducing browser issues
// involving tab switches.
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

        stopCurrentStream();

        // Clear the video element and reset our global state variable
        video.srcObject = null;

        // UI Update: Reset button, remove active class, and show the offline placeholder
        toggleCamBtn.innerHTML = '▶️ Start Camera';
        toggleCamBtn.classList.remove('camera-running');
        offlineMessage.style.display = 'flex';

        if (window.hideModel) {
            window.hideModel();
        }

        console.log("Camera stopped successfully.");

    }

    // If no stream exists, the camera is OFF, so we start it
    else {

        try {

            console.log("Requesting getUserMedia...");

            const devices = await navigator.mediaDevices.enumerateDevices();

            console.log("Detected Media Devices:");

            devices.forEach(device => {

                console.log({
                    kind: device.kind,
                    label: device.label || "(label unavailable)",
                    deviceId: device.deviceId
                });

            });

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

            // Leave tracking startup exactly where it was previously
            // because it was working before.
            if (window.startTrackingLoop) {

                console.log(
                    "Starting MediaPipe tracking loop..."
                );

                window.startTrackingLoop();
            }

            console.log("Video stream assigned to video element.");

            // UI Update: Update button text, add active class, and hide the offline placeholder
            toggleCamBtn.innerHTML = '⏹ Stop Camera';
            toggleCamBtn.classList.add('camera-running');
            offlineMessage.style.display = 'none';

        }

        catch (err) {

            console.error(
                "Hardware access denied, unavailable, or failed:"
            );

            console.error("Error Name:", err.name);
            console.error("Error Message:", err.message);
            console.error("Full Error Object:", err);

            /*
             Common Errors

             NotAllowedError
                User denied permissions

             NotReadableError
                Camera already in use

             NotFoundError
                No webcam found

             SecurityError
                Browser security restriction

             AbortError
                Camera initialization interrupted
            */

            if (currentStream) {
                stopCurrentStream();
            }

            // Reset state and UI just to be safe
            currentStream = null;
            video.srcObject = null;

            toggleCamBtn.innerHTML = '▶️ Start Camera';
            toggleCamBtn.classList.remove('camera-running');
            offlineMessage.style.display = 'flex';

            alert(
                `Could not access the camera.\n\n` +
                `Error: ${err.name}\n\n` +
                `Check browser permissions or verify another application is not using the webcam.`
            );

        }

    }

});

// ==========================================
// 3. Image Capture Logic
// ==========================================

captureBtn.addEventListener('click', () => {

    // Guard clause: Prevent errors if the user clicks capture while the camera is off
    if (!currentStream) {

        alert(
            "Please start the camera before capturing an image."
        );

        return;
    }

    // Initialize the 2D rendering context on our hidden canvas buffer
    const context = canvas.getContext('2d');

    // Dynamically match the canvas resolution to whatever the current webcam resolution is
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log(
        `Capturing frame at ${canvas.width} x ${canvas.height}`
    );

    // The core capture method: "draw" the exact current video frame onto the canvas
    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Convert the drawn canvas data into a base64 encoded PNG string.
    // This string is what we will eventually send to the Java backend via api.js.
    const imageDataUrl = canvas.toDataURL('image/png');

    console.log(
        "Image successfully converted to PNG base64 string."
    );

    // Inject the base64 string directly into the HTML <img> tag to display the static photo
    photo.setAttribute('src', imageDataUrl);

});
