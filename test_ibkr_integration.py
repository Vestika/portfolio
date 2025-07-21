#!/usr/bin/env python3
"""
Test script for IBKR Flex Web Service integration
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from services.interactive_brokers.flex_service import IBKRFlexService
from core.ibkr_flex_service import IBKRFlexServiceManager
from models.ibkr_account import IBKRAccountConfig


async def test_flex_service():
    """Test the Flex Web Service directly"""
    print("Testing IBKR Flex Web Service...")
    
    # Test with dummy credentials (will fail but should handle gracefully)
    flex_service = IBKRFlexService()
    
    try:
        async with flex_service:
            result = await flex_service.test_connection("dummy_token", "dummy_query_id")
            print(f"Test result: {result}")
    except Exception as e:
        print(f"Expected error (dummy credentials): {e}")


async def test_flex_manager():
    """Test the Flex Service Manager"""
    print("\nTesting IBKR Flex Service Manager...")
    
    manager = IBKRFlexServiceManager()
    
    try:
        result = await manager.test_connection("dummy_token", "dummy_query_id")
        print(f"Manager test result: {result}")
    except Exception as e:
        print(f"Expected error (dummy credentials): {e}")


async def test_account_config():
    """Test the IBKR Account Config model"""
    print("\nTesting IBKR Account Config model...")
    
    # Test creating config from dict
    config_data = {
        "flex_query_token": "test_token",
        "flex_query_id": "test_query_id",
        "sync_status": "idle"
    }
    
    config = IBKRAccountConfig.from_dict(config_data)
    print(f"Created config: {config}")
    
    # Test converting back to dict
    config_dict = config.to_dict()
    print(f"Config dict: {config_dict}")


async def main():
    """Run all tests"""
    print("=== IBKR Flex Web Service Integration Tests ===\n")
    
    await test_account_config()
    await test_flex_service()
    await test_flex_manager()
    
    print("\n=== Tests completed ===")
    print("Note: These tests use dummy credentials and will fail as expected.")
    print("To test with real credentials, update the token and query_id values.")


if __name__ == "__main__":
    asyncio.run(main()) 