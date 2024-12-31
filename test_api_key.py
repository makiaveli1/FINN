import google.generativeai as genai
import os
import sys
from dotenv import load_dotenv

def test_api_key(api_key):
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content("Hello, Gemini!")
        print("API key is valid. Response:")
        print(response.text)
    except Exception as e:
        print(f"API key is invalid. Error: {e}")

if __name__ == "__main__":
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        if len(sys.argv) > 1:
            api_key = sys.argv[1]
        else:
            print("Please provide the API key as a command-line argument or set the GEMINI_API_KEY or GOOGLE_API_KEY in a .env file or as an environment variable.")
            sys.exit(1)
    test_api_key(api_key)
