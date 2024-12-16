class GeminiClient {
    constructor(wsUrl = "ws://localhost:8080", httpUrl = "http://localhost:8082") {
        this.wsUrl = wsUrl;
        this.httpUrl = httpUrl;
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 2000;
        this.connectionTimeout = 30000;  // Increase to 30 seconds
        this.messageTimeout = 60000;     // Increase to 60 seconds
        this.setupTimeout = 15000;       // Add setup timeout
        this.currentMessageTimer = null;
        this.setupTimer = null;
        this.pingInterval = null;
        this.debug = true;  // Enable debug logging
        this.handlers = {
            onMessage: () => {},
            onStatusChange: () => {},
            onError: () => {}
        };
        this.errorElement = document.getElementById('error-message');
        this.statusElement = document.getElementById('connection-status');
        this.loadingElement = document.getElementById('loading-indicator');
        this.lastConfig = null;          // Store last successful config
        this.authTimeout = 10000;     // 10 second auth timeout
        this.setupTimeout = 15000;    // 15 second setup timeout
        this.messageTimeout = 30000;  // 30 second message timeout
        this.authInProgress = false;
        this.setupInProgress = false;
        this.defaultConfig = null;
        this.videoStream = null;
        this.videoCanvas = document.getElementById('video-canvas');
        this.videoContext = this.videoCanvas.getContext('2d');
        this.isCameraActive = false;
        
        // Initialize UI elements
        this.initializeUI();
    }

    initializeUI() {
        // Create error message element if it doesn't exist
        if (!this.errorElement) {
            this.errorElement = document.createElement('div');
            this.errorElement.id = 'error-message';
            this.errorElement.className = 'error-message';
            document.body.appendChild(this.errorElement);
        }

        // Create status element if it doesn't exist
        if (!this.statusElement) {
            this.statusElement = document.createElement('div');
            this.statusElement.id = 'connection-status';
            this.statusElement.className = 'connection-status';
            document.querySelector('.chakra-header .chakra-container').appendChild(this.statusElement);
        }

        // Create loading indicator if it doesn't exist
        if (!this.loadingElement) {
            this.loadingElement = document.createElement('div');
            this.loadingElement.id = 'loading-indicator';
            this.loadingElement.className = 'chakra-spinner';
            document.body.appendChild(this.loadingElement);
        }
    }

    setHandlers({ onMessage, onStatusChange, onError }) {
        this.handlers = {
            onMessage: onMessage || this.handlers.onMessage,
            onStatusChange: onStatusChange || this.handlers.onStatusChange,
            onError: onError || this.handlers.onError
        };
    }

    log(message, data = null) {
        if (this.debug) {
            console.log(`[GeminiClient] ${message}`, data || '');
        }
    }

    async connect(apiKey, modelId, temperature) {
        if (!apiKey) {
            throw new Error("API key is required");
        }

        this.log('Attempting connection...');
        
        // Clear any existing connection
        this.disconnect();
        
        this.updateConnectionStatus(false);
        this.updateStatus("Connecting...");

        try {
            this.ws = new WebSocket(this.wsUrl);
            
            await new Promise((resolve, reject) => {
                const connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        this.log('Connection timeout');
                        reject(new Error("WebSocket connection timeout"));
                        this.disconnect();
                    }
                }, this.connectionTimeout);

                this.ws.onopen = () => {
                    this.log('WebSocket connected');
                    clearTimeout(connectionTimeout);
                    
                    // Send auth message
                    this.ws.send(JSON.stringify({ bearer_token: apiKey }));
                    this.log('Sent auth message', { bearer_token: apiKey });

                    // Send setup message
                    const setupMessage = {
                        setup: {
                            model: modelId,
                            generation_config: {
                                temperature: temperature,
                                response_modalities: ["TEXT", "AUDIO"],
                                candidate_count: 1,
                                max_output_tokens: 1024,
                                ...this.defaultConfig?.generation_config
                            }
                        }
                    };
                    
                    this.ws.send(JSON.stringify(setupMessage));
                    this.log('Sent setup message', setupMessage);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.log('Received message', data);

                        if (data.type === "connection_success") {
                            this.isConnected = true;
                            this.reconnectAttempts = 0;
                            this.updateConnectionStatus(true);
                            this.updateStatus("Connected");
                            this.startPingInterval();
                            this.defaultConfig = data.config;
                            this.log('Received config', this.defaultConfig);
                            resolve();
                        } else if (data.error) {
                            reject(new Error(data.error));
                            this.disconnect();
                        }
                    } catch (error) {
                        reject(error);
                    }
                };

                this.ws.onclose = this.handleClose.bind(this);
                this.ws.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    this.log('WebSocket error', error);
                    reject(error);
                };
            });

        } catch (error) {
            this.handleError("Connection failed", error);
            throw error;
        }
    }

    async sendAuthMessage(apiKey) {
        this.authInProgress = true;
        const authMessage = {
            bearer_token: apiKey
        };

        return new Promise((resolve, reject) => {
            const authTimeout = setTimeout(() => {
                reject(new Error("Authentication timeout"));
            }, this.authTimeout);

            this.sendMessage(authMessage, () => {
                clearTimeout(authTimeout);
                this.authInProgress = false;
                resolve();
            });
        });
    }

    async sendSetupMessage(modelId, temperature) {
        this.setupInProgress = true;
        const setupMessage = {
            setup: {
                model: modelId,
                generation_config: {
                    response_modalities: ["TEXT", "AUDIO", "VIDEO"],
                    temperature: temperature,
                    candidate_count: 1,
                    max_output_tokens: 2048,
                    top_p: 0.8,
                    top_k: 40,
                }
            }
        };

        return new Promise((resolve, reject) => {
            const setupTimeout = setTimeout(() => {
                reject(new Error("Setup timeout"));
            }, this.setupTimeout);

            this.sendMessage(setupMessage, () => {
                clearTimeout(setupTimeout);
                this.setupInProgress = false;
                resolve();
            });
        });
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.log('Received message', data);

            // Handle auth/setup responses
            if (this.authInProgress || this.setupInProgress) {
                if (data.error) {
                    this.handleError(data.error.message, new Error(data.error.message));
                    return;
                }
                return; // Skip normal message handling during auth/setup
            }

            // Handle normal messages
            if (data.type === "pong") {
                this.log('Received pong');
                return;
            }
            
            if (data.type === "connection_success") {
                this.log('Received connection success');
                return;
            }

            if (data.error) {
                this.handleError("Server error", new Error(data.error.message));
                return;
            }

            this.handleServerMessage(data);
        } catch (error) {
            this.handleError("Failed to parse message", error);
        }
    }

    sendMessage(message) {
        if (!this.isConnected || !this.ws) {
            this.log('Attempted to send message while disconnected');
            this.handleError("Not connected", new Error("WebSocket is not connected"));
            return false;
        }

        try {
            this.log('Sending message', message);
            
            // Clear any existing message timer
            if (this.currentMessageTimer) {
                clearTimeout(this.currentMessageTimer);
            }

            // Set message timeout
            this.currentMessageTimer = setTimeout(() => {
                this.log('Message timeout occurred');
                this.handleError("Message timeout", new Error("Server response timeout"));
                this.disconnect();
            }, this.messageTimeout);

            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            this.log('Failed to send message', error);
            this.handleError("Failed to send message", error);
            return false;
        }
    }

    sendPing() {
        const pingMessage = { type: "ping" };
        try {
            this.ws.send(JSON.stringify(pingMessage));
        } catch (error) {
            this.handleError("Failed to send ping", error);
            this.disconnect();
        }
    }

    handleClose(event) {
        clearInterval(this.pingInterval);
        if (this.currentMessageTimer) {
            clearTimeout(this.currentMessageTimer);
        }
        
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.updateStatus("Disconnected");

        // Attempt reconnection if not a clean close
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
            this.updateStatus(`Reconnecting (attempt ${this.reconnectAttempts})...`);
            
            setTimeout(() => {
                if (this.lastConfig) {
                    this.connect(
                        this.lastConfig.apiKey,
                        this.lastConfig.modelId,
                        this.lastConfig.temperature
                    ).catch(error => {
                        this.handleError("Reconnection failed", error);
                    });
                }
            }, delay);
        }
    }

    setupWebSocketHandlers(apiKey, modelId, temperature) {
        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateStatus("Connected");
            this.sendInitialSetup(apiKey, modelId, temperature);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (error) {
                this.handleError("Failed to parse server message", error);
            }
        };

        this.ws.onclose = (event) => {
            this.isConnected = false;
            this.updateStatus("Disconnected");
            
            if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => {
                    this.connect(apiKey, modelId, temperature);
                }, this.reconnectDelay * this.reconnectAttempts);
            }
        };

        this.ws.onerror = (error) => {
            this.handleError("WebSocket error", error);
        };
    }

    sendUserMessage(text, mediaChunks = []) {
        const message = {
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [
                            { text: text },
                            ...mediaChunks
                        ]
                    }
                ],
                turn_complete: true
            }
        };

        this.sendMessage(message);
    }

    captureVideoFrame() {
        if (!this.isCameraActive || !this.videoStream) {
            return null;
        }

        this.videoCanvas.width = this.videoStream.getVideoTracks()[0].getSettings().width;
        this.videoCanvas.height = this.videoStream.getVideoTracks()[0].getSettings().height;
        this.videoContext.drawImage(document.getElementById('video-preview'), 0, 0, this.videoCanvas.width, this.videoCanvas.height);
        return this.videoCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }

    async startCamera() {
        try {
            this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: { max: 640 }, height: { max: 480 } } });
            document.getElementById('video-preview').srcObject = this.videoStream;
            this.isCameraActive = true;
        } catch (error) {
            this.handleError("Error accessing camera", error);
        }
    }

    stopCamera() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            document.getElementById('video-preview').srcObject = null;
            this.videoStream = null;
            this.isCameraActive = false;
        }
    }

    handleServerMessage(data) {
        if (data.error) {
            this.handleError("Server error", new Error(data.error.message));
            return;
        }

        if (data.serverContent) {
            const { modelTurn } = data.serverContent;
            if (modelTurn && modelTurn.parts) {
                this.handlers.onMessage(modelTurn.parts);
            }
        }
    }
    
    sendMediaMessage(mediaChunks) {
        const message = {
            realtime_input: {
                media_chunks: mediaChunks
            }
        };
        this.sendMessage(message);
    }

    updateStatus(status) {
        this.handlers.onStatusChange(status);
    }

    handleError(context, error) {
        const errorMessage = `[${context}] ${error.message}`;
        this.handlers.onError(errorMessage);
        console.error(errorMessage, error);
    }

    disconnect() {
        this.log('Disconnecting...');
        clearInterval(this.pingInterval);
        clearTimeout(this.currentMessageTimer);
        clearTimeout(this.setupTimer);
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus(false);
    }

    showError(message) {
        if (this.errorElement) {
            this.errorElement.textContent = message;
            this.errorElement.style.display = 'block';
            setTimeout(() => {
                this.errorElement.style.display = 'none';
            }, 5000);
        }
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        if (this.statusElement) {
            this.statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            this.statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendPing();
            }
        }, 30000);
    }
}

// Initialize the client
const geminiClient = new GeminiClient("ws://localhost:8080", "http://localhost:8082");

// Set up event handlers
geminiClient.setHandlers({
    onMessage: (parts) => {
        parts.forEach(part => {
            if (part.text) {
                displayMessage("GEMINI: " + part.text, false);
            }
            if (part.inlineData) {
                handleMediaResponse(part.inlineData);
            }
        });
    },
    onStatusChange: (status) => {
        updateConnectionStatus(status);
    },
    onError: (error) => {
        showError(error);
    }
});

// Event listeners
document.getElementById("connect-btn").addEventListener("click", async () => {
    let apiKey = document.getElementById("token").value;
    const modelId = document.getElementById("model-id").value;
    const temperature = parseFloat(document.getElementById("temperature").value);
    
    // Check for API key in .env or environment variables
    const envApiKey =  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (envApiKey) {
        apiKey = envApiKey;
    }

    try {
        await geminiClient.connect(apiKey, modelId, temperature);
    } catch (error) {
        showError(error.message);
    }
});

document.getElementById("send-btn").addEventListener("click", () => {
    const input = document.getElementById("message-input");
    const messageText = input.value.trim();

    if (messageText) {
        geminiClient.sendUserMessage(messageText);
        displayMessage("USER: " + messageText, true);
        input.value = '';
    }
});

// Helper functions (keep your existing ones)
function updateConnectionStatus(message) {
    const statusDiv = document.getElementById("connection-status");
    statusDiv.textContent = message;
    statusDiv.className = message.includes("Connected") ? 
        "connection-status connected" : "connection-status disconnected";
}

function showError(message) {
    const errorDiv = document.getElementById("error-message");
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    setTimeout(() => {
        errorDiv.style.display = "none";
    }, 5000);
}

function displayMessage(message, isUser) {
    const chatLog = document.getElementById("chat-log");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? 'user-message' : 'gemini-message'}`;
    messageDiv.textContent = message;
    chatLog.appendChild(messageDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function handleMediaResponse(inlineData) {
    const { mime_type, data } = inlineData;
    
    if (mime_type.startsWith('audio/')) {
        playAudio(data);
    } else if (mime_type.startsWith('video/')) {
        playVideo(data);
    } else if (mime_type.startsWith('image/')) {
        displayImage(data);
    }
}

// Export for use in other modules
window.GeminiClient = geminiClient;
