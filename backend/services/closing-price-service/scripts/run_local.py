#!/usr/bin/env python3
"""
Local development runner for the closing price service.
"""

import os
import sys
import subprocess
from pathlib import Path


def main():
    """Main function to run the local development setup"""
    print("Starting Closing Price Service locally...")
    
    # Check if we have the .env file
    env_file = Path(__file__).parent.parent / ".env"
    if not env_file.exists():
        print("Creating .env file from example...")
        env_example = Path(__file__).parent.parent / "env.example"
        if env_example.exists():
            with open(env_example, 'r') as f:
                content = f.read()
            with open(env_file, 'w') as f:
                f.write(content)
            print("Please edit .env file with your Finnhub API key")
    
    # Change to the service directory
    service_dir = Path(__file__).parent.parent
    os.chdir(service_dir)
    
    # Run uvicorn
    cmd = [
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd)


if __name__ == "__main__":
    main() 