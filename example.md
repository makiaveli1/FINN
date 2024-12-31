## Index.html

```html
<html>
  <head>
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
    />
    <link
      rel="stylesheet"
      href="https://code.getmdl.io/1.3.0/material.indigo-pink.min.css"
    />
    <script defer src="https://code.getmdl.io/1.3.0/material.min.js"></script>

    <style>
      #videoElement {
        width: 320px;
        height: 240px;
        border-radius: 20px;
      }

      #canvasElement {
        display: none;
      }

      .demo-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      /* Styling for button group */
      .button-group {
        margin-bottom: 20px;
      }
    </style>
  </head>

  <body>
    <div class="mdl-layout mdl-js-layout mdl-layout--fixed-header">
      <header class="mdl-layout__header">
        <div class="mdl-layout__header-row">
          <!-- Title -->
          <span class="mdl-layout-title">Demo</span>
        </div>
      </header>
      <main class="mdl-layout__content">
        <div class="page-content">
          <div class="demo-content">
            <!-- Connect Button -->
            <div class="mdl-textfield mdl-js-textfield">
              <input class="mdl-textfield__input" type="text" id="token" />
              <label class="mdl-textfield__label" for="input"
                >Access Token...</label
              >
            </div>
            <div class="mdl-textfield mdl-js-textfield">
              <input class="mdl-textfield__input" type="text" id="model" value="projects/YOUR-PROJECT-ID/locations/us-central1/publishers/google/models/gemini-2.0-flash-exp" />
              <label class="mdl-textfield__label" for="input"
                >Model ID</label
              >
            </div>
            <button
              onclick="connect()"
              class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored"
            >
              Connect
            </button>

            <!-- Button Group -->
            <div class="button-group">
              <!-- Text Input Field -->
              <div class="mdl-textfield mdl-js-textfield">
                <input class="mdl-textfield__input" type="text" id="input" />
                <label class="mdl-textfield__label" for="input"
                  >Enter text message...</label
                >
              </div>

              <!-- Send Message Button -->
              <button
                onclick="sendUserMessage()"
                class="mdl-button mdl-js-button mdl-button--icon"
              >
                <i class="material-icons">send</i>
              </button>
            </div>

            <!-- Voice Control Buttons -->
            <div class="button-group">
              <button
                onclick="startAudioInput()"
                class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-button--colored"
              >
                <i class="material-icons">mic</i>
              </button>
              <button
                onclick="stopAudioInput()"
                class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab"
              >
                <i class="material-icons">mic_off</i>
              </button>
            </div>

            <!-- Video Element -->
            <video id="videoElement" autoplay></video>

            <!-- Hidden Canvas -->
            <canvas id="canvasElement"></canvas>
            <div id="chatLog"></div>
          </div>
        </div>
      </main>
    </div>

    <script defer>
      const URL = "ws://localhost:8080";
      const video = document.getElementById("videoElement");
      const canvas = document.getElementById("canvasElement");
      const context = canvas.getContext("2d");
      const accessTokenInput = document.getElementById("token");
      const modelIdInput = document.getElementById("model");
      let stream = null; // Store the MediaStream object globally

      let currentFrameB64;
      // Function to start the webcam
      async function startWebcam() {
        try {
          const constraints = {
            video: {
              width: { max: 640 },
              height: { max: 480 },
            },
          };

          stream = await navigator.mediaDevices.getUserMedia(constraints);
          video.srcObject = stream;
        } catch (err) {
          console.error("Error accessing the webcam: ", err);
        }
      }

      // Function to capture an image and convert it to base64
      function captureImage() {
        if (stream) {
          // Check if the stream is available
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL("image/jpeg").split(",")[1].trim();
          currentFrameB64 = imageData;
        }
      }

      window.addEventListener("load", startWebcam);
      setInterval(captureImage, 1000);

      let webSocket = null;

      function connect() {
        console.log("connecting: ", URL);

        webSocket = new WebSocket(URL);

        webSocket.onclose = (event) => {
          console.log("websocket closed: ", event);
          alert("Connection closed");
        };

        webSocket.onerror = (event) => {
          console.log("websocket error: ", event);
        };

        webSocket.onopen = (event) => {
          console.log("websocket open: ", event);
          sendInitialSetupMessage();
        };

        webSocket.onmessage = receiveMessage;
      }

      function sendInitialSetupMessage() {
        console.log("sending auth message");

        const accessToken = accessTokenInput.value;
        const modelId = modelIdInput.value;

        auth_message = {
          bearer_token: accessToken,
        };
        webSocket.send(JSON.stringify(auth_message));

        console.log("sending setup message");
        setup_client_message = {
          setup: {
            model: modelId,
            generation_config: { response_modalities: ["AUDIO"] },
          },
        };

        webSocket.send(JSON.stringify(setup_client_message));
      }

      function sendMessage(message) {
        if (webSocket == null) {
          console.log("websocket not initilised");
          return;
        }

        payload = {
          client_content: {
            turns: [
              {
                role: "user",
                parts: [{ text: message }],
              },
            ],
            turn_complete: true,
          },
        };

        webSocket.send(JSON.stringify(payload));
        console.log("sent: ", payload);
        displayMessage("USER: " + message);
      }

      function sendVoiceMessage(b64PCM) {
        if (webSocket == null) {
          console.log("websocket not initialized");
          return;
        }

        payload = {
          realtime_input: {
            media_chunks: [
              {
                mime_type: "audio/pcm",
                data: b64PCM,
                // will_continue: false,
              },
              {
                mime_type: "image/jpeg",
                data: currentFrameB64,
                // will_continue: false,
              },
            ],
          },
        };

        webSocket.send(JSON.stringify(payload));
        console.log("sent: ", payload);
      }

      function sendUserMessage() {
        const messageText = document.getElementById("input").value;
        console.log("user message: ", messageText);
        sendMessage(messageText);
      }

      let current_message = "";

      function receiveMessage(event) {
        const messageData = JSON.parse(event.data);
        console.log("messageData: ", messageData);
        const response = new Response(messageData);
        console.log("receiveMessage ", response);

        current_message = current_message + response.data;

        injestAudioChuckToPlay(response.data);

        if (response.endOfTurn) {
          // displayMessage("GEMINI: 🔊");
          // current_message = "";
        }
      }

      let audioInputContext;
      let workletNode;
      let initialized = false;

      async function initializeAudioContext() {
        if (initialized) return;

        audioInputContext = new (window.AudioContext ||
          window.webkitAudioContext)({ sampleRate: 24000 });
        await audioInputContext.audioWorklet.addModule("pcm-processor.js");
        workletNode = new AudioWorkletNode(audioInputContext, "pcm-processor");
        workletNode.connect(audioInputContext.destination);
        initialized = true;
      }

      function base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }

      function convertPCM16LEToFloat32(pcmData) {
        const inputArray = new Int16Array(pcmData);
        const float32Array = new Float32Array(inputArray.length);

        for (let i = 0; i < inputArray.length; i++) {
          float32Array[i] = inputArray[i] / 32768;
        }

        return float32Array;
      }

      async function injestAudioChuckToPlay(base64AudioChunk) {
        try {
          if (!initialized) {
            await initializeAudioContext();
          }

          if (audioInputContext.state === "suspended") {
            await audioInputContext.resume();
          }

          const arrayBuffer = base64ToArrayBuffer(base64AudioChunk);
          const float32Data = convertPCM16LEToFloat32(arrayBuffer);

          workletNode.port.postMessage(float32Data);
        } catch (error) {
          console.error("Error processing audio chunk:", error);
        }
      }

      let audioContext;
      let mediaRecorder;
      let processor;
      let pcmData = [];

      let interval = null;

      function recordChunk() {
        // Convert to base64
        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        pcmData.forEach((value, index) => {
          view.setInt16(index * 2, value, true);
        });

        const base64 = btoa(
          String.fromCharCode.apply(null, new Uint8Array(buffer))
        );

        // document.getElementById("output").textContent = base64;

        sendVoiceMessage(base64);

        pcmData = [];
      }

      async function startAudioInput() {
        audioContext = new AudioContext({
          sampleRate: 16000,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
          },
        });

        const source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert float32 to int16
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = inputData[i] * 0x7fff;
          }
          pcmData.push(...pcm16);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        interval = setInterval(recordChunk, 1000);
      }

      function stopAudioInput() {
        processor.disconnect();
        audioContext.close();
        clearInterval(interval);
      }

      function displayMessage(message) {
        console.log(message);
        // const newMessage = message.message
        addParagraphToDiv("chatLog", message);
      }

      function addParagraphToDiv(divId, text) {
        const newParagraph = document.createElement("p");
        newParagraph.textContent = text;
        const div = document.getElementById(divId);
        div.appendChild(newParagraph);
      }

      class Response {
        constructor(data) {
          this.data = "";
          this.endOfTurn = data?.serverContent?.turnComplete;

          if (data?.serverContent?.modelTurn?.parts) {
            this.data = data?.serverContent?.modelTurn?.parts[0]?.text;
          }

          if (data?.serverContent?.modelTurn?.parts[0]?.inlineData) {
            this.data =
              data?.serverContent?.modelTurn?.parts[0]?.inlineData.data;
          }
        }
      }
    </script>
  </body>
</html>
```

## pcm-processor.js

```js
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array();

        // Correct way to handle messages in AudioWorklet
        this.port.onmessage = (e) => {
            const newData = e.data;
            const newBuffer = new Float32Array(this.buffer.length + newData.length);
            newBuffer.set(this.buffer);
            newBuffer.set(newData, this.buffer.length);
            this.buffer = newBuffer;
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channelData = output[0];

        if (this.buffer.length >= channelData.length) {
            channelData.set(this.buffer.slice(0, channelData.length));
            this.buffer = this.buffer.slice(channelData.length);
            return true;
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
```

## main.py

```python
import asyncio
import json

import websockets
from websockets.legacy.protocol import WebSocketCommonProtocol
from websockets.legacy.server import WebSocketServerProtocol

HOST = "us-central1-aiplatform.googleapis.com"
SERVICE_URL = f"wss://{HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent"

DEBUG = False


async def proxy_task(
    client_websocket: WebSocketCommonProtocol, server_websocket: WebSocketCommonProtocol
) -> None:
    """
    Forwards messages from one WebSocket connection to another.

    Args:
        client_websocket: The WebSocket connection from which to receive messages.
        server_websocket: The WebSocket connection to which to send messages.
    """
    async for message in client_websocket:
        try:
            data = json.loads(message)
            if DEBUG:
                print("proxying: ", data)
            await server_websocket.send(json.dumps(data))
        except Exception as e:
            print(f"Error processing message: {e}")

    await server_websocket.close()


async def create_proxy(
    client_websocket: WebSocketCommonProtocol, bearer_token: str
) -> None:
    """
    Establishes a WebSocket connection to the server and creates two tasks for
    bidirectional message forwarding between the client and the server.

    Args:
        client_websocket: The WebSocket connection of the client.
        bearer_token: The bearer token for authentication with the server.
    """

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {bearer_token}",
    }

    async with websockets.connect(
        SERVICE_URL, additional_headers=headers
    ) as server_websocket:
        client_to_server_task = asyncio.create_task(
            proxy_task(client_websocket, server_websocket)
        )
        server_to_client_task = asyncio.create_task(
            proxy_task(server_websocket, client_websocket)
        )
        await asyncio.gather(client_to_server_task, server_to_client_task)


async def handle_client(client_websocket: WebSocketServerProtocol) -> None:
    """
    Handles a new client connection, expecting the first message to contain a bearer token.
    Establishes a proxy connection to the server upon successful authentication.

    Args:
        client_websocket: The WebSocket connection of the client.
    """
    print("New connection...")
    # Wait for the first message from the client
    auth_message = await asyncio.wait_for(client_websocket.recv(), timeout=5.0)
    auth_data = json.loads(auth_message)

    if "bearer_token" in auth_data:
        bearer_token = auth_data["bearer_token"]
    else:
        print("Error: Bearer token not found in the first message.")
        await client_websocket.close(code=1008, reason="Bearer token missing")
        return

    await create_proxy(client_websocket, bearer_token)


async def main() -> None:
    """
    Starts the WebSocket server and listens for incoming client connections.
    """
    async with websockets.serve(handle_client, "localhost", 8080):
        print("Running websocket server localhost:8080...")
        # Run forever
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
```