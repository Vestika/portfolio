#!/bin/bash

echo "🚀 Setting up AI Financial Analyst Integration"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "backend/pyproject.toml" ]; then
    echo "❌ Error: Please run this script from the portfolio project root directory"
    exit 1
fi

# Navigate to backend directory
cd backend

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Error: Virtual environment not found. Please create it first:"
    echo "   python -m venv .venv"
    echo "   source .venv/bin/activate"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Install the new Google Generative AI SDK
echo "📦 Installing Google Generative AI SDK..."
pip install google-genai

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Google Generative AI SDK installed successfully"
else
    echo "❌ Failed to install Google Generative AI SDK"
    exit 1
fi

# Go back to root directory
cd ..

# Run the test script
echo "🧪 Testing AI integration..."
python test_ai_integration.py

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Set your Google AI API key:"
    echo "   export GOOGLE_AI_API_KEY=your_api_key_here"
    echo ""
    echo "2. Start the backend server:"
    echo "   cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload"
    echo ""
    echo "3. Test the AI endpoints:"
    echo "   - POST /portfolio/{portfolio_id}/analyze"
    echo "   - POST /portfolio/{portfolio_id}/chat"
else
    echo "❌ AI integration test failed. Please check the error messages above."
    exit 1
fi 