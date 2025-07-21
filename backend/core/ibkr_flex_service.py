import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime, timedelta
import time

from services.interactive_brokers.flex_service import IBKRFlexService
from models.ibkr_account import IBKRAccountConfig, IBKRAccountData, IBKRPosition
from models.holding import Holding


class IBKRFlexServiceManager:
    """Manager for IBKR Flex Web Service operations"""
    
    def __init__(self):
        self.flex_service = IBKRFlexService()
        self._sync_tasks = {}  # Track running sync tasks
    
    async def test_connection(self, token: str, query_id: str) -> Dict[str, Any]:
        """
        Test connection to IBKR Flex Web Service
        
        Args:
            token: Flex Query Token
            query_id: Flex Query ID
            
        Returns:
            Test result with success status and details
        """
        try:
            async with self.flex_service:
                result = await self.flex_service.test_connection(token, query_id)
                return result
        except Exception as e:
            logger.error(f"Error testing IBKR Flex Web Service connection: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"Connection test failed: {str(e)}"
            }
    
    async def sync_account_holdings(self, ibkr_config: IBKRAccountConfig, max_retries: int = 3) -> Dict[str, Any]:
        """
        Synchronize holdings from IBKR Flex Web Service with retry logic
        
        Args:
            ibkr_config: IBKR account configuration
            max_retries: Maximum number of retry attempts
            
        Returns:
            Sync result with holdings data or error information
        """
        for attempt in range(max_retries):
            try:
                # Update sync status
                ibkr_config.sync_status = "syncing"
                ibkr_config.sync_error = None
                
                async with self.flex_service:
                    # Generate and retrieve report from Flex Web Service
                    result = await self.flex_service.generate_and_retrieve_report(
                        ibkr_config.flex_query_token,
                        ibkr_config.flex_query_id
                    )
                    
                    if not result["success"]:
                        error_msg = result.get("error", "Unknown error")
                        logger.warning(f"Sync attempt {attempt + 1} failed: {error_msg}")
                        
                        if attempt < max_retries - 1:
                            # Wait before retry (exponential backoff)
                            wait_time = 2 ** attempt
                            logger.info(f"Retrying in {wait_time} seconds...")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            ibkr_config.sync_status = "error"
                            ibkr_config.sync_error = error_msg
                            return {
                                "success": False,
                                "error": error_msg,
                                "holdings": [],
                                "attempts": attempt + 1
                            }
                    
                    # Parse the report data
                    report_data = result["data"]
                    accounts = report_data.get("accounts", [])
                    
                    if not accounts:
                        ibkr_config.sync_status = "error"
                        ibkr_config.sync_error = "No accounts found in Flex report"
                        return {
                            "success": False,
                            "error": "No accounts found in Flex report",
                            "holdings": [],
                            "attempts": attempt + 1
                        }
                    
                    # Use the first account (or find by account_id if specified)
                    target_account = accounts[0]
                    if ibkr_config.account_id:
                        for account in accounts:
                            if account.get("account_id") == ibkr_config.account_id:
                                target_account = account
                                break
                    
                    # Update account information
                    ibkr_config.account_id = target_account.get("account_id", "")
                    ibkr_config.account_name = target_account.get("account_name", "")
                    
                    # Convert positions to holdings format
                    positions = target_account.get("positions", [])
                    logger.info(f"Converting {len(positions)} positions to holdings")
                    logger.info(f"Position details: {[(p.get('symbol', 'unknown'), p.get('units', 0)) for p in positions]}")
                    
                    holdings = self._convert_positions_to_holdings(positions)
                    logger.info(f"Converted to {len(holdings)} holdings")
                    
                    # Log all holdings for debugging
                    for i, holding in enumerate(holdings):
                        logger.info(f"Holding {i+1}: {holding.get('symbol', 'unknown')} - {holding.get('units', 0)} units - ${holding.get('market_value', 0)}")
                    
                    # Validate holdings data
                    validation_result = self._validate_holdings_data(holdings)
                    if not validation_result["valid"]:
                        ibkr_config.sync_status = "error"
                        ibkr_config.sync_error = validation_result["error"]
                        return {
                            "success": False,
                            "error": validation_result["error"],
                            "holdings": [],
                            "attempts": attempt + 1
                        }
                    
                    # Update sync status
                    ibkr_config.sync_status = "success"
                    ibkr_config.last_sync = datetime.now()
                    
                    return {
                        "success": True,
                        "holdings": holdings,
                        "account_data": target_account,
                        "total_value": target_account.get("total_value", 0),
                        "currency": target_account.get("currency", "USD"),
                        "attempts": attempt + 1
                    }
                    
            except Exception as e:
                logger.error(f"Error syncing IBKR account holdings (attempt {attempt + 1}): {e}")
                
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    ibkr_config.sync_status = "error"
                    ibkr_config.sync_error = str(e)
                    return {
                        "success": False,
                        "error": str(e),
                        "holdings": [],
                        "attempts": attempt + 1
                    }
    
    def _validate_holdings_data(self, holdings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate holdings data for consistency and completeness
        
        Args:
            holdings: List of holdings to validate
            
        Returns:
            Validation result with success status and any errors
        """
        try:
            for i, holding in enumerate(holdings):
                # Check required fields
                if not holding.get("symbol"):
                    return {
                        "valid": False,
                        "error": f"Holding {i + 1} missing symbol"
                    }
                
                if holding.get("units", 0) < 0:
                    return {
                        "valid": False,
                        "error": f"Holding {i + 1} has negative units"
                    }
                
                if holding.get("market_value", 0) < 0:
                    return {
                        "valid": False,
                        "error": f"Holding {i + 1} has negative market value"
                    }
                
                # Check for duplicate symbols
                symbols = [h.get("symbol") for h in holdings]
                if len(symbols) != len(set(symbols)):
                    return {
                        "valid": False,
                        "error": "Duplicate symbols found in holdings"
                    }
            
            return {"valid": True}
            
        except Exception as e:
            return {
                "valid": False,
                "error": f"Validation error: {str(e)}"
            }
    
    def _convert_positions_to_holdings(self, positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert IBKR positions to internal holdings format
        
        Args:
            positions: List of position data from IBKR
            
        Returns:
            List of holdings in internal format
        """
        holdings = []
        
        logger.info(f"Starting conversion of {len(positions)} positions")
        
        for i, position in enumerate(positions):
            try:
                logger.debug(f"Processing position {i+1}: {position.get('symbol', 'unknown')} - {position.get('units', 0)} units")
                
                # Create holding in internal format
                holding = {
                    "symbol": position.get("symbol", ""),
                    "units": position.get("units", 0),
                    # Additional metadata from IBKR
                    "market_value": position.get("market_value", 0),
                    "currency": position.get("currency", "USD"),
                    "security_type": position.get("security_type", "STK")
                }
                
                # Only include holdings with actual units
                if holding["units"] != 0:
                    holdings.append(holding)
                    logger.debug(f"Added holding: {holding['symbol']} - {holding['units']} units")
                else:
                    logger.debug(f"Skipped position with 0 units: {position.get('symbol', 'unknown')}")
                    
            except Exception as e:
                logger.warning(f"Error converting position {i+1} to holding: {e}")
                continue
        
        logger.info(f"Conversion complete: {len(holdings)} holdings created")
        return holdings
    
    async def get_account_summary(self, ibkr_config: IBKRAccountConfig) -> Dict[str, Any]:
        """
        Get account summary from IBKR Flex Web Service
        
        Args:
            ibkr_config: IBKR account configuration
            
        Returns:
            Account summary with balances and metadata
        """
        try:
            async with self.flex_service:
                result = await self.flex_service.generate_and_retrieve_report(
                    ibkr_config.flex_query_token,
                    ibkr_config.flex_query_id
                )
                
                if not result["success"]:
                    return {
                        "success": False,
                        "error": result.get("error", "Unknown error")
                    }
                
                report_data = result["data"]
                accounts = report_data.get("accounts", [])
                
                if not accounts:
                    return {
                        "success": False,
                        "error": "No accounts found in Flex report"
                    }
                
                # Use the first account or find by account_id
                target_account = accounts[0]
                if ibkr_config.account_id:
                    for account in accounts:
                        if account.get("account_id") == ibkr_config.account_id:
                            target_account = account
                            break
                
                return {
                    "success": True,
                    "account_id": target_account.get("account_id", ""),
                    "account_name": target_account.get("account_name", ""),
                    "total_value": target_account.get("total_value", 0),
                    "currency": target_account.get("currency", "USD"),
                    "cash_balances": target_account.get("cash_balances", {}),
                    "positions_count": len(target_account.get("positions", [])),
                    "last_updated": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error getting IBKR account summary: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def start_periodic_sync(self, ibkr_config: IBKRAccountConfig, interval_minutes: int = 60) -> str:
        """
        Start periodic synchronization for an IBKR account
        
        Args:
            ibkr_config: IBKR account configuration
            interval_minutes: Sync interval in minutes
            
        Returns:
            Task ID for the periodic sync
        """
        task_id = f"ibkr_sync_{ibkr_config.account_id or 'default'}_{int(time.time())}"
        
        async def periodic_sync_task():
            while True:
                try:
                    logger.info(f"Starting periodic sync for account {ibkr_config.account_id}")
                    await self.sync_account_holdings(ibkr_config)
                    
                    # Wait for next sync
                    await asyncio.sleep(interval_minutes * 60)
                    
                except asyncio.CancelledError:
                    logger.info(f"Periodic sync cancelled for account {ibkr_config.account_id}")
                    break
                except Exception as e:
                    logger.error(f"Error in periodic sync for account {ibkr_config.account_id}: {e}")
                    # Wait before retrying
                    await asyncio.sleep(60)
        
        # Start the periodic sync task
        task = asyncio.create_task(periodic_sync_task())
        self._sync_tasks[task_id] = task
        
        logger.info(f"Started periodic sync for account {ibkr_config.account_id} with interval {interval_minutes} minutes")
        return task_id
    
    def stop_periodic_sync(self, task_id: str) -> bool:
        """
        Stop periodic synchronization
        
        Args:
            task_id: Task ID returned from start_periodic_sync
            
        Returns:
            True if task was stopped, False if not found
        """
        if task_id in self._sync_tasks:
            task = self._sync_tasks[task_id]
            task.cancel()
            del self._sync_tasks[task_id]
            logger.info(f"Stopped periodic sync task {task_id}")
            return True
        
        return False
    
    def get_sync_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get status of periodic sync task
        
        Args:
            task_id: Task ID returned from start_periodic_sync
            
        Returns:
            Task status information
        """
        if task_id in self._sync_tasks:
            task = self._sync_tasks[task_id]
            return {
                "running": not task.done(),
                "cancelled": task.cancelled(),
                "exception": str(task.exception()) if task.exception() else None
            }
        
        return {
            "running": False,
            "cancelled": False,
            "exception": "Task not found"
        }
    
    async def disconnect_account(self, ibkr_config: IBKRAccountConfig) -> Dict[str, Any]:
        """
        Disconnect IBKR account and clean up resources
        
        Args:
            ibkr_config: IBKR account configuration
            
        Returns:
            Disconnection result
        """
        try:
            # Stop any running periodic sync tasks
            task_ids_to_remove = []
            for task_id, task in self._sync_tasks.items():
                if ibkr_config.account_id in task_id:
                    task.cancel()
                    task_ids_to_remove.append(task_id)
            
            for task_id in task_ids_to_remove:
                del self._sync_tasks[task_id]
            
            # Clear sync status
            ibkr_config.sync_status = "idle"
            ibkr_config.sync_error = None
            ibkr_config.last_sync = None
            
            logger.info(f"Disconnected IBKR account {ibkr_config.account_id}")
            
            return {
                "success": True,
                "message": f"Successfully disconnected account {ibkr_config.account_id}",
                "stopped_tasks": len(task_ids_to_remove)
            }
            
        except Exception as e:
            logger.error(f"Error disconnecting IBKR account: {e}")
            return {
                "success": False,
                "error": str(e)
            } 