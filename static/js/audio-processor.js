let audioContext;
let audioWorkletNode;
let recordingInterval = null;
let isRecording = false;

async function startAudioInput() {
    if (!isConnected) {
        showError("Please connect first.");
        return;
    }

    if (isRecording) {
        console.log("Already recording.");
        return;
    }

    isRecording = true;
    audioContext = new AudioContext({ sampleRate: 16000 });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (window.AudioWorkletProcessor) {
            await audioContext.audioWorklet.addModule('/static/js/audio-processor.js');
            audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(audioWorkletNode);
            audioWorkletNode.connect(audioContext.destination);

            recordingInterval = setInterval(() => {
                audioWorkletNode.port.postMessage(new Float32Array(0));
            }, 1000);

            audioWorkletNode.port.onmessage = (e) => {
                if (e.data && e.data.length > 0) {
                    const buffer = new ArrayBuffer(e.data.length * 2);
                    const view = new DataView(buffer);
                    for (let i = 0; i < e.data.length; i++) {
                        view.setInt16(i * 2, e.data[i] * 0x7fff, true);
                    }
                    const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
                    geminiClient.sendMediaMessage([{
                        mime_type: "audio/pcm",
                        data: base64,
                        sample_rate: 16000,
                        channels: 1,
                    }]);
                }
            };
        } else {
            console.warn("AudioWorkletProcessor is not supported in this browser.");
            showError("AudioWorkletProcessor is not supported in this browser.");
            isRecording = false;
            return;
        }


        console.log("Audio recording started.");
    } catch (error) {
        console.error("Error starting audio:", error);
        showError("Failed to start audio: " + error.message);
        isRecording = false;
    }
}

function stopAudioInput() {
    if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode.port.postMessage(null);
        audioWorkletNode = null;
    }
    if (audioContext) {
        audioContext.close();
    }
    if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
    }
    isRecording = false;
    console.log("Audio recording stopped.");
}

function sendVoiceMessage(b64PCM) {
    geminiClient.sendMediaMessage([{
        mime_type: "audio/pcm",
        data: b64PCM,
        sample_rate: 16000,
        channels: 1,
    }]);
    console.log("Voice message sent.");
}

function playAudio(base64AudioChunk) {
    const audioContext = new AudioContext();
    const audioBuffer = base64ToArrayBuffer(base64AudioChunk);
    audioContext.decodeAudioData(audioBuffer, (buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
    });
}

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
