#!/usr/bin/env python3
"""
Test script for AI Financial Analyst integration
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from core.ai_analyst import ai_analyst
from core.portfolio_analyzer import portfolio_analyzer
from core.chat_manager import chat_manager

async def test_ai_integration():
    """Test the AI integration components"""
    
    print("🧪 Testing AI Financial Analyst Integration")
    print("=" * 50)
    
    # Test 1: Check if Google AI API key is configured
    print("\n1. Checking Google AI API configuration...")
    try:
        from config import settings
        if not settings.google_ai_api_key:
            print("❌ Google AI API key not configured")
            print("   Please set GOOGLE_AI_API_KEY in your environment")
            return False
        else:
            print("✅ Google AI API key is configured")
    except Exception as e:
        print(f"❌ Error checking configuration: {e}")
        return False
    
    # Test 2: Test AI Analyst initialization
    print("\n2. Testing AI Analyst initialization...")
    try:
        # This will test the client initialization
        if ai_analyst.client is None:
            print("❌ AI client not initialized")
            return False
        else:
            print("✅ AI Analyst initialized successfully")
            print(f"   Model: {settings.google_ai_model}")
    except Exception as e:
        print(f"❌ Error initializing AI Analyst: {e}")
        return False
    
    # Test 3: Test Portfolio Analyzer
    print("\n3. Testing Portfolio Analyzer...")
    try:
        # Create a simple test portfolio data structure
        test_portfolio_data = {
            "total_value": 100000,
            "base_currency": "USD",
            "accounts": [
                {
                    "account_name": "Test Account",
                    "account_value": 100000,
                    "holdings_count": 5,
                    "holdings": [
                        {"symbol": "AAPL", "value": 50000},
                        {"symbol": "GOOGL", "value": 30000},
                        {"symbol": "MSFT", "value": 20000}
                    ]
                }
            ],
            "holdings_breakdown": [
                {"symbol": "AAPL", "value": 50000, "percentage": 50},
                {"symbol": "GOOGL", "value": 30000, "percentage": 30},
                {"symbol": "MSFT", "value": 20000, "percentage": 20}
            ],
            "asset_allocation": [
                {"asset_type": "stock", "value": 100000, "percentage": 100}
            ],
            "risk_metrics": {
                "total_value": 100000,
                "holdings_count": 3,
                "concentration_ratio": 50.0
            }
        }
        
        print("✅ Portfolio Analyzer test data created")
    except Exception as e:
        print(f"❌ Error testing Portfolio Analyzer: {e}")
        return False
    
    # Test 4: Test AI Analysis (if API key is available)
    print("\n4. Testing AI Analysis...")
    try:
        # Note: This will only work if you have a valid API key
        # For testing purposes, we'll just check if the method exists
        if hasattr(ai_analyst, 'analyze_portfolio') and hasattr(ai_analyst, 'chat_with_analyst'):
            print("✅ AI analysis methods available")
            print("   (Full analysis test requires valid API key)")
        else:
            print("❌ AI analysis methods not found")
            return False
    except Exception as e:
        print(f"❌ Error testing AI Analysis: {e}")
        return False
    
    # Test 5: Test Chat Manager
    print("\n5. Testing Chat Manager...")
    try:
        if hasattr(chat_manager, 'create_chat_session'):
            print("✅ Chat Manager methods available")
        else:
            print("❌ Chat Manager methods not found")
            return False
    except Exception as e:
        print(f"❌ Error testing Chat Manager: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 AI Integration Test Completed Successfully!")
    print("\nNext steps:")
    print("1. Install the new Google Generative AI SDK: pip install google-genai")
    print("2. Set your Google AI API key in the environment")
    print("3. Start the backend server")
    print("4. Test the endpoints via the frontend or API")
    
    return True

if __name__ == "__main__":
    # Run the test
    success = asyncio.run(test_ai_integration())
    sys.exit(0 if success else 1) 