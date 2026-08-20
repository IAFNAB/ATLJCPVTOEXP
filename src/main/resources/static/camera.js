/* 
========================================================================
File: camera.js
Description: The logic layer for the Camera App interface.

Overview:
This script leverages the browser's native MediaDevices API to request
hardware access. It demonstrates DOM manipulation, asynchronous hardware
requests, and canvas-based image processing. It is isolated from the API
and Tracking logic to maintain a clean separation of concerns.
======================================================================== 
*/

// ==========================================
// 1. DOM Element Mapping
// Grabbing the HTML objects so we can manipulate them in JavaScript
// ==========================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photo = document.getElementById('photo');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');

// Global state variable to track the active camera stream 
let currentStream = null;

// ==========================================
// 2. Hardware Access & UI Toggle Logic
// ==========================================

// --- START BUTTON LOGIC ---
startBtn.addEventListener('click', async () => {
    try {
        // We use async/await because requesting hardware access takes an unknown amount of time.
        // This prompts the OS/browser permission pop-up for the webcam.
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Route the active stream to our HTML <video> element's source object
        video.srcObject = currentStream;
        
        // UI Update: Hide the Start button and display the Stop button
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        
    } catch (err) {
        // This catches scenarios where the user clicks "Block" on the permission prompt
        // or if the device simply does not have a webcam.
        console.error("Hardware access denied or unavailable: ", err);
        alert("Could not access the camera. Check browser permissions.");
    }
});

// --- STOP BUTTON LOGIC ---
stopBtn.addEventListener('click', () => {
    // Only attempt to stop if a stream is actually running
    if (currentStream) {
        // To properly turn off the webcam (and kill the hardware light), 
        // we must explicitly stop the individual hardware tracks.
        const tracks = currentStream.getTracks();
        tracks.forEach(track => track.stop());
        
        // Clear the video element and reset our global state variable
        video.srcObject = null;
        currentStream = null;
        
        // UI Update: Hide the Stop button and display the Start button
        stopBtn.style.display = 'none';
        startBtn.style.display = 'inline-block';
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