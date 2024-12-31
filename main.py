import asyncio
import json
import ssl
import time
import logging
import base64
import io
from enum import Enum
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass
from uuid import uuid4
from http import HTTPStatus
import pathlib
import mimetypes
import websockets
from websockets.legacy.protocol import WebSocketCommonProtocol
from websockets.legacy.server import WebSocketServerProtocol
from asyncio import sleep
from PIL import Image
from aiohttp import web
from websockets.exceptions import ConnectionClosedError

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
HOST = "us-central1-aiplatform.googleapis.com"
API_VERSION = "v1alpha"
MODEL_NAME = ("projects/impactful-arbor-399011/locations/us-central1/"
              "publishers/google/models/gemini-2.0-flash-exp")
SERVICE_URL = (f"wss://{HOST}/ws/google.cloud.aiplatform.v1beta1."
               "LlmBidiService/BidiGenerateContent")
DEBUG = True


class ResponseModality(Enum):
    TEXT = "TEXT"
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"
    IMAGE = "IMAGE"


DEFAULT_CONFIG = {
    "generation_config": {
        "temperature": 0.7,
        "candidate_count": 1,
        "max_output_tokens": 1024,
        "response_modalities": ["TEXT", "AUDIO"]
    },
    "tools": [
        {
            "function_declarations": [
                {
                    "name": "search",
                    "description": "Search the web for information",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query",
                            }
                        },
                        "required": ["query"],
                    },
                }
            ]
        }
    ],
}

# Media handling configurations
SUPPORTED_IMAGE_FORMATS = {"image/jpeg", "image/png",
                           "image/gif", "image/webp"}
SUPPORTED_AUDIO_FORMATS = {"audio/wav", "audio/webm", "audio/ogg"}
SUPPORTED_VIDEO_FORMATS = {"video/webm", "video/mp4"}
MAX_IMAGE_SIZE = 4 * 1024 * 1024  # 4MB
MAX_AUDIO_CHUNK_SIZE = 64 * 1024  # 64KB
MAX_VIDEO_CHUNK_SIZE = 256 * 1024  # 256KB


@dataclass
class ConnectionInfo:
    websocket: WebSocketCommonProtocol
    last_active: float
    client_id: str
    config: Dict[str, Any]
    active_stream: bool = False
    media_buffer: List[Dict[str, Any]] = None


class GeminiError(Exception):
    """Base exception for Gemini-related errors."""
    pass


class GeminiAuthenticationError(GeminiError):
    """Authentication-related errors."""
    pass


class GeminiValidationError(GeminiError):
    """Validation-related errors."""
    pass


class GeminiConnectionError(GeminiError):
    """Connection-related errors."""
    pass


class GeminiMediaError(GeminiError):
    """Media processing errors."""
    pass


class StaticFileHandler:
    def __init__(self, static_dir: str = "static"):
        self.static_dir = pathlib.Path(static_dir)
        self.cache: Dict[str, tuple] = {}
        self.cache_max_size = 100

    async def handle_request(self, path: str) -> tuple:
        """Handle HTTP request for static files."""
        try:
            path = path.replace("\\", "/").lstrip("/")
            if path in self.cache:
                return self.cache[path]

            file_path = self.static_dir / path
            try:
                file_path = file_path.resolve()
                if not str(file_path).startswith(
                        str(self.static_dir.resolve())):
                    logger.warning(f"Attempted path traversal: {path}")
                    return (HTTPStatus.FORBIDDEN, [], b"403 Forbidden")
            except Exception:
                return (HTTPStatus.FORBIDDEN, [], b"403 Forbidden")

            if not file_path.exists() or not file_path.is_file():
                logger.error(f"File not found: {file_path}")
                return (HTTPStatus.NOT_FOUND, [], b"404 Not Found")

            content_type, _ = mimetypes.guess_type(str(file_path))
            if not content_type:
                content_type = "application/octet-stream"

            headers = [
                ("Content-Type", content_type),
                ("Cache-Control", "public, max-age=3600"),
                ("X-Content-Type-Options", "nosniff"),
            ]

            with open(file_path, "rb") as f:
                content = f.read()
                response = (HTTPStatus.OK, headers, content)
                if len(content) < 1024 * 1024:  # 1MB
                    if len(self.cache) >= self.cache_max_size:
                        self.cache.pop(next(iter(self.cache)))
                    self.cache[path] = response
                return response

        except Exception as e:
            logger.error(f"Error serving static file: {e}")
            return (HTTPStatus.INTERNAL_SERVER_ERROR, [],
                    b"500 Internal Server Error")


class MediaProcessor:
    """Handles media processing for different modalities."""

    @staticmethod
    async def process_image(data: Union[str, bytes],
                            mime_type: str) -> Dict[str, Any]:
        """Process and validate image data."""
        try:
            if isinstance(data, str):
                image_data = base64.b64decode(data)
            else:
                image_data = data

            if len(image_data) > MAX_IMAGE_SIZE:
                raise GeminiMediaError("Image size exceeds maximum limit")

            with Image.open(io.BytesIO(image_data)) as img:
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")

                max_dim = 2048
                if max(img.size) > max_dim:
                    ratio = max_dim / max(img.size)
                    new_size = tuple(int(dim * ratio) for dim in img.size)
                    img = img.resize(new_size, Image.Resampling.LANCZOS)

                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr,
                         format=mime_type.split("/")[-1].upper())
                processed_data = base64.b64encode(
                    img_byte_arr.getvalue()).decode("utf-8")

            return {"inline_data": {"mime_type": mime_type,
                                    "data": processed_data}}
        except Exception as e:
            raise GeminiMediaError(f"Image processing error: {str(e)}")

    @staticmethod
    async def process_audio(data: Union[str, bytes],
                            mime_type: str) -> Dict[str, Any]:
        """Process and validate audio data."""
        try:
            if isinstance(data, str):
                audio_data = base64.b64decode(data)
            else:
                audio_data = data

            if len(audio_data) > MAX_AUDIO_CHUNK_SIZE:
                raise GeminiMediaError("Audio chunk size exceeds maximum limit")

            return {
                "audio_chunk": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(audio_data).decode("utf-8"),
                }
            }
        except Exception as e:
            raise GeminiMediaError(f"Audio processing error: {str(e)}")

    @staticmethod
    async def process_video(data: Union[str, bytes],
                            mime_type: str) -> Dict[str, Any]:
        """Process and validate video data."""
        try:
            if isinstance(data, str):
                video_data = base64.b64decode(data)
            else:
                video_data = data

            if len(video_data) > MAX_VIDEO_CHUNK_SIZE:
                raise GeminiMediaError("Video chunk size exceeds maximum limit")

            return {
                "video_chunk": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(video_data).decode("utf-8"),
                }
            }
        except Exception as e:
            raise GeminiMediaError(f"Video processing error: {str(e)}")

    @classmethod
    async def process_media_chunk(cls, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """Process different types of media chunks."""
        mime_type = chunk.get("mime_type", "")
        data = chunk.get("data", "")

        if not mime_type or not data:
            raise GeminiValidationError("Invalid media chunk format")

        if mime_type in SUPPORTED_IMAGE_FORMATS:
            return await cls.process_image(data, mime_type)
        elif mime_type in SUPPORTED_AUDIO_FORMATS:
            return await cls.process_audio(data, mime_type)
        elif mime_type in SUPPORTED_VIDEO_FORMATS:
            return await cls.process_video(data, mime_type)
        else:
            raise GeminiValidationError(f"Unsupported media type: {mime_type}")


class GeminiProxy:
    def __init__(self):
        self.ssl_context = ssl.create_default_context()
        self.active_connections: Dict[str, ConnectionInfo] = {}
        self.connection_limit = 100
        self.rate_limit = 10
        self.last_request_time = 0
        self.retry_count = 3
        self.retry_delay = 1
        self.metrics = {
            "total_requests": 0,
            "failed_requests": 0,
            "active_connections": 0,
            "total_messages_processed": 0,
        }

    def validate_message_format(
        self, message: Dict[str, Any], is_client_to_server: bool
    ) -> bool:
        """Validates message format according to Gemini API specifications."""
        try:
            if is_client_to_server:
                if "client_content" in message:
                    content = message["client_content"]
                    if not isinstance(content.get("turns"), list):
                        return False
                    for turn in content["turns"]:
                        if not isinstance(turn.get("parts"), list):
                            return False
                elif "realtime_input" in message:
                    input_data = message["realtime_input"]
                    if not isinstance(input_data.get("media_chunks"), list):
                        return False
                elif "tool_response" in message:
                    if not isinstance(message.get("tool_response"), dict):
                        return False
                else:
                    return False
            else:
                if ("serverContent" not in message and "toolCall" not in message
                        and "toolCallCancellation" not in message):
                    return False
                if ("serverContent" in message and
                        "modelTurn" not in message["serverContent"]):
                    return False
            return True
        except Exception as e:
            logger.error(f"Message validation error: {e}")
            return False

    async def create_server_connection(
        self, bearer_token: str, config: Optional[Dict[str, Any]] = None
    ) -> WebSocketCommonProtocol:
        """Creates a connection to the Gemini server."""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {bearer_token}",
            }

            async with asyncio.timeout(15):  # Increase timeout
                connection = await websockets.connect(
                    SERVICE_URL,
                    additional_headers=headers,
                    ssl=self.ssl_context,
                    ping_interval=30,
                    ping_timeout=10,
                    close_timeout=5,
                )

                # Send initial setup message
                setup_message = {
                    "model": MODEL_NAME,
                    "generation_config": config.get(
                        "generation_config",
                        DEFAULT_CONFIG["generation_config"]),
                    "tools": config.get("tools", DEFAULT_CONFIG["tools"]),
                }
                
                setup_message_wrapper = {
                    "setup": setup_message
                }
                
                await connection.send(json.dumps(setup_message_wrapper))

                # Wait for setup acknowledgment
                response = await asyncio.wait_for(connection.recv(),
                                                  timeout=10.0)
                response_data = json.loads(response)
                
                if not response_data.get("success"):
                    raise GeminiConnectionError(
                        f"Setup failed: {response_data.get('error')}")

                return connection

        except asyncio.TimeoutError as e:
            raise GeminiConnectionError("Connection timeout") from e
        except Exception as e:
            raise GeminiConnectionError(
                f"Failed to connect to Gemini server: {e}") from e

    async def send_with_retry(
        self,
        websocket: WebSocketCommonProtocol,
        message: str,
        retry_count: Optional[int] = None,
    ) -> None:
        """Send message with retry logic."""
        retries = retry_count if retry_count is not None else self.retry_count
        last_error = None

        for attempt in range(retries):
            try:
                current_time = time.time()
                time_diff = current_time - self.last_request_time
                if time_diff < 1.0 / self.rate_limit:
                    await sleep((1.0 / self.rate_limit) - time_diff)

                await websocket.send(message)
                self.last_request_time = time.time()
                self.metrics["total_messages_processed"] += 1
                return
            except Exception as e:
                last_error = e
                self.metrics["failed_requests"] += 1
                if attempt < retries - 1:
                    await sleep(self.retry_delay * (attempt + 1))
                    continue
                raise GeminiConnectionError(
                    f"Failed after {retries} attempts: {str(last_error)}"
                ) from last_error

    async def proxy_messages(
        self,
        source: WebSocketCommonProtocol,
        destination: WebSocketCommonProtocol,
        is_client_to_server: bool = True,
    ) -> None:
        """Proxies messages between websocket connections."""
        try:
            async for message in source:
                try:
                    data = json.loads(message)
                    if DEBUG:
                        direction = ("client → server" if is_client_to_server
                                     else "server → client")
                        logger.debug(f"{direction}: {data}")

                    # Handle ping/pong
                    if data.get("type") == "ping":
                        await destination.send(json.dumps({"type": "pong"}))
                        continue

                    # Validate message format
                    if not self.validate_message_format(
                            data, is_client_to_server):
                        logger.error(f"Invalid message format: {data}")
                        if is_client_to_server:
                            await self.send_error(source,
                                                  "Invalid message format")
                        continue
                    
                    if is_client_to_server:
                        if "client_content" in data:
                            await destination.send(json.dumps(data))
                        elif "realtime_input" in data:
                            await destination.send(json.dumps(data))
                        elif "tool_response" in data:
                            await destination.send(json.dumps(data))
                        else:
                            logger.error(f"Unknown client message type: {data}")
                            await self.send_error(source,
                                                  "Unknown client message type")
                    else:
                        if "serverContent" in data:
                            await destination.send(json.dumps(data))
                        elif "toolCall" in data:
                            await destination.send(json.dumps(data))
                        elif "toolCallCancellation" in data:
                            await destination.send(json.dumps(data))
                        else:
                            logger.error(f"Unknown server message type: {data}")
                            await self.send_error(source,
                                                  "Unknown server message type")

                    # Update metrics
                    self.metrics["total_messages_processed"] += 1

                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding JSON message: {e}")
                    if is_client_to_server:
                        await self.send_error(source, "Invalid JSON message")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    if is_client_to_server:
                        await self.send_error(source,
                                              "Failed to process message")

        except websockets.exceptions.ConnectionClosedError as e:
            logger.info(f"Connection closed normally: {e}")
        except Exception as e:
            logger.error(f"Error in proxy_messages: {e}")
        finally:
            try:
                await destination.close()
            except Exception as e:
                logger.error(f"Error closing websocket: {e}")

    async def handle_client(self, websocket: WebSocketCommonProtocol) -> None:
        """Handles a client connection."""
        client_id = str(uuid4())
        server_websocket = None

        try:
            logger.info(f"New client connection: {client_id}")
            
            # Handle authentication with longer timeout
            auth_message = await asyncio.wait_for(websocket.recv(),
                                                  timeout=15.0)
            auth_data = json.loads(auth_message)
            logger.debug(f"Received auth message: {auth_data}")

            bearer_token = auth_data.get("bearer_token")
            if not bearer_token:
                await websocket.send(json.dumps({
                    "error": "Bearer token missing",
                    "code": "AUTHENTICATION_ERROR"
                }))
                return
            
            # config = auth_data.get("config", {})
            # if not self.validate_setup_config({"setup": config}):
            #     await websocket.send(json.dumps({
            #         "error": "Invalid setup config",
            #         "code": "INVALID_CONFIG"
            #     }))
            #     return

            # Create server connection
            logger.info("Creating server connection...")
            server_websocket = await self.create_server_connection(
                bearer_token,
                {} # config
            )
            logger.info("Server connection established")

            # Send success response with DEFAULT_CONFIG
            success_response = {
                "type": "connection_success",
                "client_id": client_id,
                "config": DEFAULT_CONFIG
            }
            await websocket.send(json.dumps(success_response))

            # Start message proxying
            await asyncio.gather(
                self.proxy_messages(websocket, server_websocket, True),
                self.proxy_messages(server_websocket, websocket, False),
            )

        except asyncio.TimeoutError as e:
            logger.error(f"Timeout error: {e}")
            await self.send_error(websocket, "Connection timeout")
        except ConnectionClosedError as e:
            logger.error(f"Connection closed error: {e}")
            await self.send_error(websocket, "Connection closed")
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error handling client: {error_message}")
            await self.send_error(websocket, f"Error: {e}", 1011)
        finally:
            logger.info(f"Cleaning up connection: {client_id}")
            if server_websocket:
                try:
                    await server_websocket.close()
                except Exception as e:
                    logger.error(f"Error closing server websocket: {e}")

    async def send_error(
        self, websocket: WebSocketCommonProtocol, message: str, code: int = 1008
    ) -> None:
        """Sends an error message to the client and closes the connection."""
        error_response = {"error": {"code": "SERVER_ERROR", "message": message}}
        try:
            await websocket.send(json.dumps(error_response))
            await websocket.close(code, message)
        except Exception as e:
            logger.error(f"Error sending error message: {e}")

    async def cleanup_connections(self):
        """Cleanup stale connections periodically."""
        while True:
            try:
                current_time = time.time()
                stale_connections = [
                    conn_id
                    for conn_id, conn_info in self.active_connections.items()
                    if current_time - conn_info.last_active > 300
                ]

                for conn_id in stale_connections:
                    conn_info = self.active_connections[conn_id]
                    await conn_info.websocket.close()
                    del self.active_connections[conn_id]
                    self.metrics["active_connections"] -= 1
                    logger.info(f"Cleaned up stale connection: {conn_id}")

            except Exception as e:
                logger.error(f"Error in cleanup: {e}")
            await sleep(60)

    async def start_metrics_reporter(self):
        """Reports metrics periodically."""
        while True:
            logger.info(f"Metrics: {self.metrics}")
            await sleep(300)


class WebServer:
    def __init__(self, static_dir: str = "static"):
        self.static_dir = pathlib.Path(static_dir)
        self.app = web.Application()
        self.setup_routes()

    def setup_routes(self):
        # Serve static files from /static directory
        self.app.router.add_static("/static", self.static_dir)
        # Serve favicon.ico
        self.app.router.add_get("/favicon.ico", self.handle_favicon)
        # Serve index.html at root
        self.app.router.add_get("/", self.handle_index)
        # Handle other static files
        self.app.router.add_get("/{filename}", self.handle_static)

    async def handle_favicon(self, request):
        try:
            favicon_path = self.static_dir / "favicon.ico"
            if not favicon_path.exists():
                raise web.HTTPNotFound()
            
            return web.FileResponse(
                favicon_path,
                headers={"Content-Type": "image/x-icon"}
            )
        except Exception as e:
            logger.error(f"Error serving favicon: {e}")
            raise web.HTTPInternalServerError()

    async def handle_index(self, request):
        try:
            index_path = self.static_dir / "index.html"
            if not index_path.exists():
                raise web.HTTPNotFound()
            
            return web.FileResponse(
                index_path, 
                headers={"Content-Type": "text/html"}
            )
        except Exception as e:
            logger.error(f"Error serving index file: {e}")
            raise web.HTTPInternalServerError()

    async def handle_static(self, request, filename=None):
        if filename is None:
            filename = request.match_info["filename"]

        try:
            file_path = self.static_dir / filename
            
            # Security check for path traversal
            if not str(file_path.resolve()).startswith(
                    str(self.static_dir.resolve())):
                raise web.HTTPForbidden()

            if not file_path.exists():
                raise web.HTTPNotFound()

            content_type, _ = mimetypes.guess_type(str(file_path))
            if not content_type:
                content_type = "application/octet-stream"

            return web.FileResponse(
                file_path, 
                headers={"Content-Type": content_type}
            )
        except web.HTTPError:
            raise
        except Exception as e:
            logger.error(f"Error serving static file: {e}")
            raise web.HTTPInternalServerError()


class WebSocketServer:
    def __init__(self):
        self.proxy = GeminiProxy()

    async def handle_client(self, websocket: WebSocketServerProtocol) -> None:
        try:
            await self.proxy.handle_client(websocket)
        except websockets.exceptions.ConnectionClosedError:
            logger.info("Client connection closed")
        except Exception as e:
            logger.error(f"Error handling WebSocket client: {e}")
            try:
                await websocket.close(1011, "Internal Server Error")
            except Exception as e:
                logger.error(f"Error closing websocket: {e}")


async def main():
    # Initialize servers
    http_server = WebServer()
    ws_server = WebSocketServer()

    try:
        # Start HTTP server
        runner = web.AppRunner(http_server.app)
        await runner.setup()
        http_site = web.TCPSite(runner, "localhost", 8082)
        await http_site.start()
        logger.info("HTTP server running on http://localhost:8082")

        # Start WebSocket server
        server = await websockets.serve(
            ws_server.handle_client,
            "localhost",
            8080,
        )
        logger.info("WebSocket server running on ws://localhost:8080")

        # Keep the server running
        await asyncio.Future()

    except Exception as e:
        logger.error(f"Server error: {e}")
    finally:
        try:
            await runner.cleanup()
            if 'server' in locals():
                server.close()
                await server.wait_closed()
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
