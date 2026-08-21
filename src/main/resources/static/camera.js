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
        const tracks = currentStream.getTracks();
        tracks.forEach(track => track.stop());
        
        // Clear the video element and reset our global state variable
        video.srcObject = null;
        currentStream = null;
        
        // UI Update: Reset button, remove active class, and show the offline placeholder
        toggleCamBtn.innerHTML = '▶️ Start Camera';
        toggleCamBtn.classList.remove('camera-running');
        offlineMessage.style.display = 'flex';
        
        console.log("Camera stopped successfully.");
    } 
    // If no stream exists, the camera is OFF, so we start it
    else {
        try {
            console.log("Requesting getUserMedia...");
            // We use async/await because requesting hardware access takes an unknown amount of time.
            // This prompts the OS/browser permission pop-up for the webcam.
            currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            console.log("Stream successfully acquired.");
            
            // Route the active stream to our HTML <video> element's source object
            video.srcObject = currentStream;
            console.log("Video stream assigned to video element.");
            
            // UI Update: Update button text, add active class, and hide the offline placeholder
            toggleCamBtn.innerHTML = '⏹ Stop Camera';
            toggleCamBtn.classList.add('camera-running');
            offlineMessage.style.display = 'none';
            
        } catch (err) {
            // This catches scenarios where the user clicks "Block" on the permission prompt
            // or if the device simply does not have a webcam.
            console.error("Hardware access denied, unavailable, or failed: ", err);
            
            // Clean up any partially initialized stream
            if (currentStream) {
                const tracks = currentStream.getTracks();
                tracks.forEach(track => track.stop());
            }
            
            // Reset state and UI just to be safe
            currentStream = null;
            video.srcObject = null;
            toggleCamBtn.innerHTML = '▶️ Start Camera';
            toggleCamBtn.classList.remove('camera-running');
            offlineMessage.style.display = 'flex';
            
            alert("Could not access the camera. Check browser permissions.");
        }
    }
});

// ==========================================
// 3. Image Capture Logic
// ==========================================
captureBtn.addEventListener('click', () => {
    // Guard clause: Prevent errors if the user clicks capture while the camera is off
    if (!currentStream) {
        alert("Please start the camera before capturing an image.");
        return; 
    }

    // Initialize the 2D rendering context on our hidden canvas buffer
    const context = canvas.getContext('2d');
    
    // Dynamically match the canvas resolution to whatever the current webcam resolution is
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // The core capture method: "draw" the exact current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert the drawn canvas data into a base64 encoded PNG string.
    // This string is what we will eventually send to the Java backend via api.js.
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Inject the base64 string directly into the HTML <img> tag to display the static photo
    photo.setAttribute('src', imageDataUrl);
});