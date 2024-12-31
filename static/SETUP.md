# Setup Guide for Finn Hawthorne Development

## Prerequisites
- Python 3.10 or newer
- Git
- Windsurf IDE (VS Code fork)
- Conda

## Environment Setup

1. **Clone the Repository**
   ```bash
   git clone [repository-url]
   cd finn_hawthorne
   ```

2. **Create and Activate Conda Environment**
   ```bash
   # Create a new conda environment with Python 3.10
   conda create -n finn python=3.10
   # Activate the environment
   conda activate finn
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**
   - Create a `.env` file in the project root
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

5. **Windsurf IDE Setup**
   - Install Python and Pylance extensions
   - Set Python interpreter to the Conda environment
   - Enable formatting with Black
   - Enable linting with flake8

## Windows-Specific Setup

1. **Install PyAudio**
   ```bash
   # Install PyAudio using pipwin (handles Windows binaries)
   pip install pipwin
   pipwin install pyaudio
   ```

2. **Install Microsoft Visual C++ Redistributable**
   - Download and install the latest [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)
   - This is required for some audio processing features

## Verify Installation

1. Run the test script:
   ```bash
   python src/test_gemini.py
   ```

## Running Finn

1. **Launch the Application**
   ```bash
   # From the project root directory
   python main.py
   ```

2. **Alternative Test Mode**
   ```bash
   # To run in test mode (checks API integration)
   python run_finn.py
   ```

3. **Expected Output**
   - The GUI should launch with Finn's interface
   - Status messages will appear in the console
   - Any errors will be logged with detailed information

## Troubleshooting

### Common Issues

1. **ImportError: No module named 'google.generativeai'**
   - Ensure you've activated the Conda environment
   - Run `pip install -U google-generativeai`

2. **API Key Issues**
   - Verify `.env` file exists in project root
   - Check API key is correctly formatted
   - Ensure no extra spaces or quotes in the `.env` file

3. **Python Version Conflicts**
   - Run `python --version` to verify Python 3.10+ is installed
   - Create a new Conda environment if needed

For additional help, please refer to the project documentation or raise an issue on the repository.
