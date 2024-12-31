import os
import pathlib
import shutil
import requests

def setup_directory_structure():
    """Create the required directory structure if it doesn't exist."""
    base_dir = pathlib.Path(__file__).parent
    
    # Define required directories
    directories = [
        base_dir / "static",
        base_dir / "static" / "css",
        base_dir / "static" / "js",
    ]
    
    # Create directories if they don't exist
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        print(f"Created/verified directory: {directory}")
    
    # Download favicon if it doesn't exist
    favicon_path = base_dir / "static" / "favicon.ico"
    if not favicon_path.exists():
        favicon_url = "https://www.google.com/favicon.ico"  # Default favicon
        try:
            response = requests.get(favicon_url)
            favicon_path.write_bytes(response.content)
            print(f"Created favicon: {favicon_path}")
        except Exception as e:
            print(f"Error downloading favicon: {e}")
    
    # Verify required files exist
    required_files = [
        ("static/css/styles.css", "/* CSS styles */"),
        ("static/js/audio-processor.js", "// Audio processing logic"),
        ("static/js/gemini-client.js", "// Gemini client implementation"),
        ("static/js/ui-handler.js", "// UI handling logic"),
    ]
    
    for file_path, default_content in required_files:
        file = base_dir / file_path
        if not file.exists():
            file.write_text(default_content)
            print(f"Created file: {file}")
        else:
            print(f"Verified file exists: {file}")

def setup_environment():
    """Setup environment variables if .env file exists."""
    env_path = pathlib.Path(__file__).parent / '.env'
    if not env_path.exists():
        print("Creating .env file...")
        default_content = (
            "GEMINI_API_KEY=your_api_key_here\n"
            "GOOGLE_ACCESS_TOKEN=your_access_token_here\n"
        )
        env_path.write_text(default_content)
        print(f"Created .env file: {env_path}")
    else:
        print(f"Verified .env file exists: {env_path}")

if __name__ == "__main__":
    setup_directory_structure()
    setup_environment() 