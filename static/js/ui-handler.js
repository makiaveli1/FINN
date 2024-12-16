// UI event handlers and state management
let isConnected = false;

document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize UI handlers
    initializeEventListeners();
    initializeMediaHandlers();
});

function initializeEventListeners() {
    // Connect button handler
    document.getElementById("connect-btn").addEventListener("click", async () => {
        const apiKey = document.getElementById("token").value;
        const modelId = document.getElementById("model-id").value;
        const temperature = parseFloat(document.getElementById("temperature").value);

        try {
            await geminiClient.connect(apiKey, modelId, temperature);
            isConnected = true;
        } catch (error) {
            showError(error.message);
        }
    });

    // Message input handlers
    const messageInput = document.getElementById("message-input");
    messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            document.getElementById("send-btn").click();
        }
    });

    // Audio button handler
    const audioBtn = document.getElementById("audio-btn");
    if (audioBtn) {
        audioBtn.addEventListener("click", () => {
            if (!isRecording) {
                startAudioInput();
                audioBtn.classList.add("recording");
                audioBtn.innerHTML = `<svg class="chakra-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
            } else {
                stopAudioInput();
                audioBtn.classList.remove("recording");
                audioBtn.innerHTML = `<svg class="chakra-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
            }
        });
    }

    // Camera button handler
    const cameraBtn = document.getElementById('camera-btn');
    if (cameraBtn) {
        cameraBtn.addEventListener('click', async () => {
            if (!geminiClient.isCameraActive) {
                await geminiClient.startCamera();
                cameraBtn.classList.add('active');
            } else {
                geminiClient.stopCamera();
                cameraBtn.classList.remove('active');
            }
        });
    }
}

function initializeMediaHandlers() {
    // Media display functions
    window.displayImage = function(base64Image) {
        const img = new Image();
        img.src = `data:image/png;base64,${base64Image}`;
        const chatLog = document.getElementById("chat-log");
        const messageDiv = document.createElement("div");
        messageDiv.className = "message gemini-message";
        messageDiv.appendChild(img);
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    };

    window.playVideo = function(base64Video) {
        const video = document.createElement("video");
        video.src = `data:video/mp4;base64,${base64Video}`;
        video.controls = true;
        const chatLog = document.getElementById("chat-log");
        const messageDiv = document.createElement("div");
        messageDiv.className = "message gemini-message";
        messageDiv.appendChild(video);
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    };
}
