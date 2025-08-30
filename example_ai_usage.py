#!/usr/bin/env python3
"""
Example usage of the AI Financial Analyst integration
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from core.ai_analyst import ai_analyst

async def example_usage():
    """Example of how to use the AI analyst"""
    
    print("🤖 AI Financial Analyst Example Usage")
    print("=" * 40)
    
    # Example portfolio data
    sample_portfolio = {
        "total_value": 150000,
        "base_currency": "USD",
        "accounts": [
            {
                "account_name": "Retirement Account",
                "account_value": 100000,
                "holdings_count": 8,
                "holdings": [
                    {"symbol": "VTI", "value": 40000},
                    {"symbol": "VXUS", "value": 30000},
                    {"symbol": "BND", "value": 30000}
                ]
            },
            {
                "account_name": "Brokerage Account", 
                "account_value": 50000,
                "holdings_count": 5,
                "holdings": [
                    {"symbol": "AAPL", "value": 20000},
                    {"symbol": "GOOGL", "value": 15000},
                    {"symbol": "MSFT", "value": 15000}
                ]
            }
        ],
        "holdings_breakdown": [
            {"symbol": "VTI", "value": 40000, "percentage": 26.7},
            {"symbol": "VXUS", "value": 30000, "percentage": 20.0},
            {"symbol": "BND", "value": 30000, "percentage": 20.0},
            {"symbol": "AAPL", "value": 20000, "percentage": 13.3},
            {"symbol": "GOOGL", "value": 15000, "percentage": 10.0},
            {"symbol": "MSFT", "value": 15000, "percentage": 10.0}
        ],
        "asset_allocation": [
            {"asset_type": "stock", "value": 120000, "percentage": 80.0},
            {"asset_type": "bond", "value": 30000, "percentage": 20.0}
        ],
        "risk_metrics": {
            "total_value": 150000,
            "holdings_count": 6,
            "concentration_ratio": 26.7
        }
    }
    
    try:
        # Example 1: Portfolio Analysis
        print("\n📊 Example 1: Portfolio Analysis")
        print("-" * 30)
        
        analysis_result = await ai_analyst.analyze_portfolio(sample_portfolio)
        print(f"✅ Analysis completed!")
        print(f"   Model used: {analysis_result['model_used']}")
        print(f"   Timestamp: {analysis_result['timestamp']}")
        print(f"   Analysis length: {len(analysis_result['analysis'])} characters")
        
        # Show first 200 characters of analysis
        preview = analysis_result['analysis'][:200] + "..." if len(analysis_result['analysis']) > 200 else analysis_result['analysis']
        print(f"   Preview: {preview}")
        
        # Example 2: Chat with AI
        print("\n💬 Example 2: Chat with AI")
        print("-" * 30)
        
        chat_result = await ai_analyst.chat_with_analyst(
            sample_portfolio, 
            "What are the main risks in this portfolio?"
        )
        print(f"✅ Chat response received!")
        print(f"   Question: {chat_result['question']}")
        print(f"   Response length: {len(chat_result['response'])} characters")
        
        # Show first 200 characters of response
        preview = chat_result['response'][:200] + "..." if len(chat_result['response']) > 200 else chat_result['response']
        print(f"   Preview: {preview}")
        
        print("\n🎉 All examples completed successfully!")
        
    except Exception as e:
        print(f"❌ Error in example: {e}")
        print("\nMake sure you have:")
        print("1. Set GOOGLE_AI_API_KEY environment variable")
        print("2. Installed google-genai package")
        print("3. Have a valid API key from Google AI Studio")

if __name__ == "__main__":
    asyncio.run(example_usage()) 