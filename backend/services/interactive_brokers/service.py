import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from loguru import logger
from urllib.parse import urljoin

from config import settings
from models.account import AccountConnection, AccountProvider


class InteractiveBrokersService:
    """Service for integrating with Interactive Brokers Web API"""
    
    def __init__(self, base_url: str = "https://localhost:5000/v1/api"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(verify=False)  # For local CP Gateway
        self.session_authenticated = False
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def authenticate_session(self, username: str, password: str) -> bool:
        """
        Authenticate with Interactive Brokers.
        For individual users using Client Portal Gateway.
        """
        try:
            # Check current authentication status
            auth_status = await self._check_auth_status()
            if auth_status.get("authenticated", False):
                logger.info("Already authenticated with IBKR")
                self.session_authenticated = True
                return True
            
            # For Client Portal Gateway, user needs to authenticate through browser
            # We can only check status, not programmatically authenticate
            logger.warning("IBKR authentication required. Please log in through Client Portal Gateway at https://localhost:5000")
            return False
            
        except Exception as e:
            logger.error(f"Error during IBKR authentication: {e}")
            return False
    
    async def _check_auth_status(self) -> Dict[str, Any]:
        """Check current authentication status"""
        try:
            response = await self.client.get(
                urljoin(self.base_url, "/iserver/auth/status"),
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to check auth status: {e}")
            return {}
    
    async def get_accounts(self) -> List[Dict[str, Any]]:
        """Get list of available accounts from IBKR"""
        try:
            response = await self.client.get(
                urljoin(self.base_url, "/portfolio/accounts"),
                timeout=10.0
            )
            response.raise_for_status()
            accounts = response.json()
            logger.info(f"Retrieved {len(accounts)} IBKR accounts")
            return accounts
        except Exception as e:
            logger.error(f"Failed to get IBKR accounts: {e}")
            return []
    
    async def get_account_positions(self, account_id: str) -> List[Dict[str, Any]]:
        """Get positions for a specific account"""
        try:
            # First call the required endpoint to initialize
            await self.client.get(
                urljoin(self.base_url, "/portfolio/accounts"),
                timeout=10.0
            )
            
            # Get positions
            response = await self.client.get(
                urljoin(self.base_url, f"/portfolio/{account_id}/positions/0"),
                timeout=10.0
            )
            response.raise_for_status()
            positions = response.json()
            logger.info(f"Retrieved {len(positions)} positions for account {account_id}")
            return positions
        except Exception as e:
            logger.error(f"Failed to get positions for account {account_id}: {e}")
            return []
    
    async def get_account_summary(self, account_id: str) -> Dict[str, Any]:
        """Get account summary including cash balances"""
        try:
            response = await self.client.get(
                urljoin(self.base_url, f"/portfolio/{account_id}/summary"),
                timeout=10.0
            )
            response.raise_for_status()
            summary = response.json()
            logger.info(f"Retrieved account summary for {account_id}")
            return summary
        except Exception as e:
            logger.error(f"Failed to get account summary for {account_id}: {e}")
            return {}
    
    def convert_ibkr_positions_to_holdings(self, positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert IBKR positions format to our internal holdings format"""
        holdings = []
        
        for position in positions:
            try:
                # Extract relevant fields from IBKR position
                symbol = position.get("ticker", position.get("conid", "UNKNOWN"))
                units = float(position.get("position", 0))
                
                # Skip positions with zero units
                if units == 0:
                    continue
                
                holding = {
                    "symbol": symbol,
                    "units": units,
                    # Additional metadata from IBKR
                    "market_value": position.get("mktValue", 0),
                    "avg_cost": position.get("avgCost", 0),
                    "conid": position.get("conid"),
                    "exchange": position.get("listingExchange"),
                    "currency": position.get("currency", "USD"),
                }
                holdings.append(holding)
                
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping invalid position data: {position}, error: {e}")
                continue
        
        return holdings
    
    async def sync_account_holdings(self, connection: AccountConnection) -> List[Dict[str, Any]]:
        """
        Synchronize holdings for an account connected to Interactive Brokers
        """
        if not connection.account_id:
            raise ValueError("Account ID is required for IBKR synchronization")
        
        if not self.session_authenticated:
            logger.error("IBKR session not authenticated")
            return []
        
        try:
            # Get current positions from IBKR
            positions = await self.get_account_positions(connection.account_id)
            
            # Convert to our holdings format
            holdings = self.convert_ibkr_positions_to_holdings(positions)
            
            logger.info(f"Synchronized {len(holdings)} holdings for IBKR account {connection.account_id}")
            return holdings
            
        except Exception as e:
            logger.error(f"Failed to sync holdings for IBKR account {connection.account_id}: {e}")
            return []
    
    async def test_connection(self, username: str = None, account_id: str = None) -> Dict[str, Any]:
        """Test the connection to Interactive Brokers"""
        result = {
            "success": False,
            "authenticated": False,
            "accounts_accessible": False,
            "positions_accessible": False,
            "error": None
        }
        
        try:
            # Check authentication
            auth_status = await self._check_auth_status()
            result["authenticated"] = auth_status.get("authenticated", False)
            
            if not result["authenticated"]:
                result["error"] = "Not authenticated with IBKR. Please log in through Client Portal Gateway."
                return result
            
            # Test account access
            accounts = await self.get_accounts()
            result["accounts_accessible"] = len(accounts) > 0
            
            if account_id and result["accounts_accessible"]:
                # Test positions access for specific account
                positions = await self.get_account_positions(account_id)
                result["positions_accessible"] = True
                result["positions_count"] = len(positions)
            
            result["success"] = result["authenticated"] and result["accounts_accessible"]
            result["accounts_found"] = len(accounts)
            
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"IBKR connection test failed: {e}")
        
        return result 