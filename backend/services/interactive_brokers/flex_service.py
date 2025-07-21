import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from loguru import logger
import xml.etree.ElementTree as ET


class IBKRFlexService:
    """Service for integrating with Interactive Brokers Flex Web Service"""
    
    def __init__(self):
        self.base_url = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService"
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def generate_report(self, token: str, query_id: str) -> Dict[str, Any]:
        """
        Generate a Flex Query report using the Flex Web Service
        
        Args:
            token: Flex Query Token from IBKR Account Management
            query_id: Flex Query ID from IBKR Account Management
            
        Returns:
            Dict containing the report generation result or error information
        """
        try:
            # Step 1: Send request to generate report
            send_request_data = {
                "t": token,
                "q": query_id,
                "v": "3"
            }
            
            logger.info(f"Generating Flex Web Service report with query ID: {query_id}")
            
            response = await self.client.post(
                f"{self.base_url}/SendRequest",
                data=send_request_data
            )
            response.raise_for_status()
            
            # Parse the response
            root = ET.fromstring(response.text)
            
            # Check for errors
            error_elem = root.find("ErrorCode")
            if error_elem is not None and error_elem.text != "0":
                error_msg = root.find("ErrorMessage")
                error_message = error_msg.text if error_msg is not None else "Unknown error"
                logger.error(f"Flex Web Service error: {error_message}")
                return {
                    "success": False,
                    "error": error_message,
                    "error_code": error_elem.text
                }
            
            # Get the reference code for retrieving the report
            ref_elem = root.find("ReferenceCode")
            if ref_elem is None:
                return {
                    "success": False,
                    "error": "No reference code received from Flex Web Service"
                }
            
            reference_code = ref_elem.text
            logger.info(f"Report generation initiated. Reference code: {reference_code}")
            
            return {
                "success": True,
                "reference_code": reference_code,
                "message": "Report generation initiated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error generating Flex Web Service report: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def retrieve_report(self, token: str, reference_code: str) -> Dict[str, Any]:
        """
        Retrieve a generated Flex Query report
        
        Args:
            token: Flex Query Token from IBKR Account Management
            reference_code: Reference code received from generate_report
            
        Returns:
            Dict containing the report data or error information
        """
        try:
            get_statement_data = {
                "t": token,
                "q": reference_code,
                "v": "3"
            }
            
            logger.info(f"Retrieving Flex Web Service report with reference code: {reference_code}")
            
            # Try to retrieve the report (may need multiple attempts)
            max_attempts = 5
            for attempt in range(max_attempts):
                try:
                    response = await self.client.post(
                        f"{self.base_url}/GetStatement",
                        data=get_statement_data
                    )
                    response.raise_for_status()
                    
                    # Parse the report
                    report_data = await self._parse_flex_report(response.text)
                    
                    if report_data:
                        logger.info(f"Successfully retrieved report on attempt {attempt + 1}")
                        return {
                            "success": True,
                            "data": report_data,
                            "reference_code": reference_code
                        }
                    
                    # If no data yet, wait and try again
                    if attempt < max_attempts - 1:
                        logger.info(f"Report not ready yet, waiting 3 seconds before attempt {attempt + 2}")
                        await asyncio.sleep(3)
                        
                except Exception as e:
                    logger.warning(f"Attempt {attempt + 1} failed to retrieve report: {e}")
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(3)
            
            return {
                "success": False,
                "error": "Failed to retrieve report after multiple attempts"
            }
            
        except Exception as e:
            logger.error(f"Error retrieving Flex Web Service report: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_and_retrieve_report(self, token: str, query_id: str) -> Dict[str, Any]:
        """
        Generate and retrieve a Flex Query report in one operation
        
        Args:
            token: Flex Query Token from IBKR Account Management
            query_id: Flex Query ID from IBKR Account Management
            
        Returns:
            Dict containing the report data or error information
        """
        try:
            # Step 1: Generate the report
            generate_result = await self.generate_report(token, query_id)
            
            if not generate_result["success"]:
                return generate_result
            
            reference_code = generate_result["reference_code"]
            
            # Step 2: Wait a moment for the report to be generated
            logger.info("Waiting for report to be generated...")
            await asyncio.sleep(2)
            
            # Step 3: Retrieve the report
            retrieve_result = await self.retrieve_report(token, reference_code)
            
            return retrieve_result
            
        except Exception as e:
            logger.error(f"Error in generate_and_retrieve_report: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _parse_flex_report(self, xml_content: str) -> Optional[Dict[str, Any]]:
        """
        Parse the Flex Query report XML and extract relevant data
        
        Args:
            xml_content: XML content from the Flex Web Service
            
        Returns:
            Parsed report data or None if parsing fails
        """
        try:
            root = ET.fromstring(xml_content)
            
            # Check for errors
            error_elem = root.find("ErrorCode")
            if error_elem is not None and error_elem.text != "0":
                error_msg = root.find("ErrorMessage")
                error_message = error_msg.text if error_msg is not None else "Unknown error"
                logger.error(f"Flex report error: {error_message}")
                return None
            
            # Extract account information
            accounts = []
            
            # Look for FlexQueryResponse/FlexStatements/FlexStatement
            statement_elements = root.findall(".//FlexStatement")
            logger.info(f"Found {len(statement_elements)} FlexStatement elements")
            
            for statement_elem in statement_elements:
                account_data = self._parse_flex_statement_element(statement_elem)
                if account_data:
                    accounts.append(account_data)
                    logger.info(f"Successfully parsed FlexStatement for account {account_data.get('account_id', 'unknown')}")
            
            # If no statements found, try alternative paths for backward compatibility
            if not accounts:
                logger.info("No FlexStatement elements found, trying legacy Account elements")
                for account_elem in root.findall(".//Account"):
                    account_data = self._parse_account_element(account_elem)
                    if account_data:
                        accounts.append(account_data)
            
            if not accounts:
                logger.info("No Account elements found, trying AccountInformation elements")
                for account_elem in root.findall(".//AccountInformation"):
                    account_data = self._parse_account_element(account_elem)
                    if account_data:
                        accounts.append(account_data)
            
            logger.info(f"Total accounts parsed: {len(accounts)}")
            
            return {
                "accounts": accounts,
                "generated_at": datetime.now().isoformat(),
                "raw_xml": xml_content[:1000] + "..." if len(xml_content) > 1000 else xml_content
            }
            
        except Exception as e:
            logger.error(f"Error parsing Flex report XML: {e}")
            return None
    
    def _parse_flex_statement_element(self, statement_elem) -> Optional[Dict[str, Any]]:
        """Parse individual FlexStatement element from Flex report"""
        try:
            account_data = {
                "account_id": "",
                "account_name": "",
                "currency": "USD",
                "cash_balances": {},
                "positions": [],
                "total_value": 0.0
            }
            
            # Extract account ID from FlexStatement attributes
            account_id = statement_elem.get("accountId")
            if account_id:
                account_data["account_id"] = account_id
                account_data["account_name"] = f"IBKR Account {account_id}"
            
            # Extract positions from OpenPositions
            open_positions_elem = statement_elem.find("OpenPositions")
            if open_positions_elem is not None:
                position_elements = open_positions_elem.findall("OpenPosition")
                logger.info(f"Found {len(position_elements)} OpenPosition elements")
                
                for i, position_elem in enumerate(position_elements):
                    logger.info(f"Processing position {i+1}: {position_elem.get('symbol', 'unknown')} - {position_elem.get('position', 'unknown')} units")
                    position_data = self._parse_open_position_element(position_elem)
                    if position_data:
                        account_data["positions"].append(position_data)
                        logger.info(f"✓ Successfully parsed position {i+1}: {position_data.get('symbol', 'unknown')} - {position_data.get('units', 0)} units - ${position_data.get('market_value', 0)}")
                    else:
                        logger.warning(f"✗ Failed to parse position {i+1}: {position_elem.get('symbol', 'unknown')}")
                
                logger.info(f"Final result: {len(account_data['positions'])} positions parsed out of {len(position_elements)} elements")
                logger.info(f"Position symbols: {[p.get('symbol', 'unknown') for p in account_data['positions']]}")
            else:
                logger.warning("No OpenPositions element found in FlexStatement")
            
            # Calculate total value
            total_value = 0.0
            for position in account_data["positions"]:
                total_value += position.get("market_value", 0)
            
            # Add cash balances to total
            for currency, balance in account_data["cash_balances"].items():
                if currency == account_data["currency"]:
                    total_value += balance
            
            account_data["total_value"] = total_value
            
            return account_data
            
        except Exception as e:
            logger.error(f"Error parsing FlexStatement element: {e}")
            return None

    def _parse_account_element(self, account_elem) -> Optional[Dict[str, Any]]:
        """Parse individual account element from Flex report (legacy format)"""
        try:
            account_data = {
                "account_id": "",
                "account_name": "",
                "currency": "USD",
                "cash_balances": {},
                "positions": [],
                "total_value": 0.0
            }
            
            # Extract account ID
            account_id_elem = account_elem.find("accountId")
            if account_id_elem is not None:
                account_data["account_id"] = account_id_elem.text
            
            # Extract account name
            account_name_elem = account_elem.find("name")
            if account_name_elem is not None:
                account_data["account_name"] = account_name_elem.text
            
            # Extract currency
            currency_elem = account_elem.find("currency")
            if currency_elem is not None:
                account_data["currency"] = currency_elem.text
            
            # Extract cash balances
            for cash_elem in account_elem.findall(".//CashBalance"):
                currency = cash_elem.find("currency")
                balance = cash_elem.find("balance")
                if currency is not None and balance is not None:
                    try:
                        account_data["cash_balances"][currency.text] = float(balance.text)
                    except (ValueError, TypeError):
                        pass
            
            # Extract positions
            for position_elem in account_elem.findall(".//OpenPosition"):
                position_data = self._parse_position_element(position_elem)
                if position_data:
                    account_data["positions"].append(position_data)
            
            # Calculate total value
            total_value = 0.0
            for position in account_data["positions"]:
                total_value += position.get("market_value", 0)
            
            # Add cash balances to total
            for currency, balance in account_data["cash_balances"].items():
                if currency == account_data["currency"]:
                    total_value += balance
            
            account_data["total_value"] = total_value
            
            return account_data
            
        except Exception as e:
            logger.error(f"Error parsing account element: {e}")
            return None
    
    def _parse_open_position_element(self, position_elem) -> Optional[Dict[str, Any]]:
        """Parse individual OpenPosition element from Flex report"""
        try:
            # Debug: Log all attributes for first few positions
            if position_elem.get("symbol") in ["AAPL", "GOOG", "NVDA"]:  # Log for common symbols
                logger.debug(f"Raw position attributes: {dict(position_elem.attrib)}")
            
            position_data = {
                "symbol": "",
                "units": 0.0,
                "market_value": 0.0,
                "currency": "USD",
                "security_type": "STK",
                "description": "",
                "conid": "",
                "cost_basis": 0.0,
                "unrealized_pnl": 0.0
            }
            
            # Extract symbol from attributes
            symbol = position_elem.get("symbol")
            if symbol:
                position_data["symbol"] = symbol
            
            # Extract position size from attributes
            position = position_elem.get("position")
            if position:
                try:
                    position_data["units"] = float(position)
                except (ValueError, TypeError):
                    pass
            
            # Extract market value from attributes
            position_value = position_elem.get("positionValue")
            if position_value:
                try:
                    position_data["market_value"] = float(position_value)
                except (ValueError, TypeError):
                    pass
            
            # Extract currency from attributes
            currency = position_elem.get("currency")
            if currency:
                position_data["currency"] = currency
            
            # Extract security type from attributes
            asset_category = position_elem.get("assetCategory")
            if asset_category:
                position_data["security_type"] = asset_category
            
            # Extract description from attributes
            description = position_elem.get("description")
            if description:
                position_data["description"] = description
            
            # Extract conid from attributes
            conid = position_elem.get("conid")
            if conid:
                position_data["conid"] = conid
            
            # Extract cost basis from attributes
            cost_basis_money = position_elem.get("costBasisMoney")
            if cost_basis_money:
                try:
                    position_data["cost_basis"] = float(cost_basis_money)
                except (ValueError, TypeError):
                    pass
            
            # Extract unrealized P&L from attributes
            fifo_pnl_unrealized = position_elem.get("fifoPnlUnrealized")
            if fifo_pnl_unrealized:
                try:
                    position_data["unrealized_pnl"] = float(fifo_pnl_unrealized)
                except (ValueError, TypeError):
                    pass
            
            # Only return positions with actual holdings
            if position_data["units"] != 0:
                logger.debug(f"Valid position: {position_data['symbol']} - {position_data['units']} units - ${position_data['market_value']}")
                return position_data
            else:
                logger.debug(f"Skipping position with 0 units: {position_data['symbol']} (raw position value: {position_elem.get('position', 'N/A')})")
            
            return None
            
        except Exception as e:
            logger.error(f"Error parsing OpenPosition element: {e}")
            return None

    def _parse_position_element(self, position_elem) -> Optional[Dict[str, Any]]:
        """Parse individual position element from Flex report (legacy format)"""
        try:
            position_data = {
                "symbol": "",
                "units": 0.0,
                "market_value": 0.0,
                "currency": "USD",
                "security_type": "STK"
            }
            
            # Extract symbol
            symbol_elem = position_elem.find("symbol")
            if symbol_elem is not None:
                position_data["symbol"] = symbol_elem.text
            
            # Extract position size
            position_elem_val = position_elem.find("position")
            if position_elem_val is not None:
                try:
                    position_data["units"] = float(position_elem_val.text)
                except (ValueError, TypeError):
                    pass
            
            # Extract market value
            market_value_elem = position_elem.find("marketValue")
            if market_value_elem is not None:
                try:
                    position_data["market_value"] = float(market_value_elem.text)
                except (ValueError, TypeError):
                    pass
            
            # Extract currency
            currency_elem = position_elem.find("currency")
            if currency_elem is not None:
                position_data["currency"] = currency_elem.text
            
            # Extract security type
            security_type_elem = position_elem.find("securityType")
            if security_type_elem is not None:
                position_data["security_type"] = security_type_elem.text
            
            # Only return positions with actual holdings
            if position_data["units"] != 0:
                return position_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error parsing position element: {e}")
            return None
    
    async def test_connection(self, token: str, query_id: str) -> Dict[str, Any]:
        """
        Test the connection to IBKR Flex Web Service
        
        Args:
            token: Flex Query Token
            query_id: Flex Query ID
            
        Returns:
            Test result with success status and details
        """
        try:
            result = await self.generate_and_retrieve_report(token, query_id)
            
            if result["success"]:
                data = result["data"]
                accounts_count = len(data.get("accounts", []))
                total_positions = sum(len(acc.get("positions", [])) for acc in data.get("accounts", []))
                
                return {
                    "success": True,
                    "accounts_found": accounts_count,
                    "total_positions": total_positions,
                    "message": f"Successfully connected. Found {accounts_count} accounts with {total_positions} positions."
                }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "Unknown error"),
                    "message": f"Connection failed: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            logger.error(f"Error testing Flex Web Service connection: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"Connection test failed: {str(e)}"
            } 