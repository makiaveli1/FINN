# Finn Hawthorne - Your AI Co-Host

Finn is an AI co-host powered by Google's Gemini 2.0 Flash API. Designed to enhance your content creation and streaming experience, Finn can interact with you through text, voice, and screen capture.

## Features

- **Voice Interaction**: Natural conversations using speech recognition and text-to-speech
- **Visual Understanding**: Screen capture analysis for context-aware responses
- **Real-time Chat**: Modern, responsive chat interface
- **Gaming Knowledge**: Extensive knowledge of gaming and streaming
- **Personality**: Engaging, witty, and enthusiastic character

## Requirements

- Python 3.9 or later
- Windows OS (support for other platforms coming soon)
- Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/finn-hawthorne.git
cd finn-hawthorne
```

2. Run the start script:
```bash
start.bat
```

The script will:
- Create a virtual environment
- Install required dependencies
- Prompt for your Gemini API key
- Start Finn's interface

## Project Structure

```
finn-hawthorne/
├── src/                    # Source code
│   ├── gui/               # GUI components
│   │   ├── __init__.py
│   │   └── app_window.py  # Main application window
│   ├── __init__.py
│   ├── api_integration.py # Gemini API integration
│   ├── audio_manager.py   # Audio processing
│   └── screen_capture.py  # Screen capture utilities
├── tests/                 # Test suite
├── .env                   # Environment variables
├── main.py               # Entry point
├── setup.py              # Package configuration
├── requirements.txt      # Dependencies
└── start.bat            # Startup script
```

## Usage

1. Start Finn using `start.bat`
2. Use the chat interface to communicate with Finn
3. Click the microphone button () for voice interaction
4. Click the camera button () to share your screen
5. Press Enter to send messages, Shift+Enter for new lines

## Development

1. Install development dependencies:
```bash
pip install -e ".[dev]"
```

2. Run tests:
```bash
pytest tests/
```

3. Format code:
```bash
black src/ tests/
isort src/ tests/
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Powered by [Google's Gemini 2.0 Flash API](https://ai.google.dev/)
- Built with [CustomTkinter](https://github.com/TomSchimansky/CustomTkinter)
- Special thanks to the Codeium team for their support
