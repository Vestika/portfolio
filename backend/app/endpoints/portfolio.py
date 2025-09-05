"""Portfolio management endpoints"""
from typing import Any, Optional
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import get_current_user
from core.database import db_manager
from models.portfolio import Portfolio
from portfolio_calculator import PortfolioCalculator
from core.rsu_calculator import create_rsu_calculator
from services.closing_price.service import get_global_service
from core.options_calculator import OptionsCalculator

# Create router for this module
router = APIRouter()

# Get the global closing price service
closing_price_service = get_global_service()

# Cache for calculator instances to maintain cache across requests
calculator_cache = {}

def create_calculator(portfolio: Portfolio) -> PortfolioCalculator:
    """Create a PortfolioCalculator with the global closing price service"""
    return PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
        closing_price_service=closing_price_service,
        use_real_time_rates=True,  # Enable real-time exchange rates
    )

def get_or_create_calculator(portfolio_id: str, portfolio: Portfolio) -> PortfolioCalculator:
    """Get existing calculator from cache or create a new one"""
    # Create a cache key based on portfolio_id and portfolio configuration
    cache_key = f"{portfolio_id}:{portfolio.base_currency.value}:{hash(str(portfolio.exchange_rates))}"

    if cache_key not in calculator_cache:
        calculator_cache[cache_key] = create_calculator(portfolio)
    else:
        pass  # Reusing cached calculator

    return calculator_cache[cache_key]

def invalidate_portfolio_cache(portfolio_id: str):
    """Invalidate calculator cache for a given portfolio_id"""
    # Clear calculator cache entries for this portfolio_id
    keys_to_remove = [key for key in calculator_cache.keys() if key.startswith(f"{portfolio_id}:")]
    for key in keys_to_remove:
        del calculator_cache[key]

# Request/Response models
class BreakdownRequest:
    def __init__(
        self,
        account_names: Optional[list[str]] = Query(default=None, title="account_names"),
    ):
        self.account_names = account_names

class CreatePortfolioRequest(BaseModel):
    portfolio_name: str
    base_currency: str

class CreateAccountRequest(BaseModel):
    account_name: str
    account_type: str = "bank-account"
    owners: list[str] = ["me"]
    holdings: list[dict[str, Any]] = []
    rsu_plans: list[Any] = []
    espp_plans: list[Any] = []
    options_plans: list[Any] = []
    # Optional IBKR Flex credentials (saved only if provided)
    ibkr_flex: Optional[dict[str, str]] = None

@router.get("/portfolios/complete-data")
async def get_all_portfolios_complete_data(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Comprehensive endpoint that returns ALL portfolio data for the user at once.
    This enables instant portfolio switching without additional API calls.
    Returns:
    - All portfolios' complete data
    - Global securities data
    - Global quotes data
    - User preferences
    """
    try:
        print(f"🌍 [ALL PORTFOLIOS] Fetching complete data for ALL user portfolios")
        
        collection = db_manager.get_collection("portfolios")
        portfolio_docs = await collection.find({"user_id": user.id}).to_list(None)
        
        if not portfolio_docs:
            print(f"📋 [ALL PORTFOLIOS] No portfolios found for user")
            return {
                "portfolios": {},
                "global_securities": {},
                "global_quotes": {},
                "global_exchange_rates": {},
                "user_preferences": {
                    "preferred_currency": "USD",
                    "default_portfolio_id": None
                },
                "computation_timestamp": datetime.utcnow().isoformat()
            }

        print(f"📁 [ALL PORTFOLIOS] Found {len(portfolio_docs)} portfolios to process")
        
        all_portfolios_data = {}
        global_securities = {}
        all_symbols = set()
        global_exchange_rates = {}
        
        # Process each portfolio
        for doc in portfolio_docs:
            portfolio_id = str(doc["_id"])
            portfolio = Portfolio.from_dict(doc)
            calculator = get_or_create_calculator(portfolio_id, portfolio)
            rsu_calculator = create_rsu_calculator(portfolio, calculator)
            
            print(f"🏢 [ALL PORTFOLIOS] Processing portfolio: {portfolio.portfolio_name} ({portfolio_id})")
            
            # Build accounts data
            complete_accounts = []
            portfolio_symbols = set()
            
            for account in portfolio.accounts:
                holdings_with_values = []
                account_total = 0.0
                
                # Add regular holdings
                for holding in account.holdings:
                    if holding.symbol not in portfolio.securities:
                        continue
                        
                    security = portfolio.securities[holding.symbol]
                    holding_calc = calculator.calc_holding_value(security, holding.units)
                    account_total += holding_calc["total"]
                    all_symbols.add(holding.symbol)
                    portfolio_symbols.add(holding.symbol)
                    
                    # Add to global securities
                    global_securities[holding.symbol] = {
                        "symbol": holding.symbol,
                        "name": security.name,
                        "security_type": security.security_type.value,
                        "currency": security.currency.value,
                        "tags": security.tags,
                        "unit_price": security.unit_price
                    }
                    
                    holdings_with_values.append({
                        "symbol": holding.symbol,
                        "units": holding.units,
                        "value_per_unit": holding_calc["value"],
                        "total_value": holding_calc["total"],
                        "original_currency": security.currency.value,
                        "security_type": security.security_type.value,
                        "security_name": security.name
                    })

                # Add RSU virtual holdings
                rsu_result = rsu_calculator.calculate_rsu_vesting_for_account({
                    "name": account.name,
                    "rsu_plans": account.rsu_plans or []
                })
                
                for virtual_holding in rsu_result["virtual_holdings"]:
                    holdings_with_values.append({
                        "symbol": virtual_holding["symbol"],
                        "units": virtual_holding["units"],
                        "value_per_unit": virtual_holding.get("value_per_unit", 0),
                        "total_value": virtual_holding.get("total_value", 0),
                        "original_currency": virtual_holding.get("currency", "USD"),
                        "security_type": "rsu_virtual",
                        "security_name": virtual_holding.get("name", virtual_holding["symbol"]),
                        "is_virtual": True
                    })
                    account_total += virtual_holding.get("total_value", 0)
                    all_symbols.add(virtual_holding["symbol"])
                    portfolio_symbols.add(virtual_holding["symbol"])

                complete_accounts.append({
                    "account_name": account.name,
                    "account_type": account.properties.get("type", "bank-account"),
                    "owners": account.properties.get("owners", ["me"]),
                    "account_total": account_total,
                    "holdings": holdings_with_values,
                    "rsu_plans": account.rsu_plans or [],
                    "espp_plans": account.espp_plans or [],
                    "options_plans": account.options_plans or [],
                    "rsu_vesting_data": rsu_result.get("vesting_data", []),
                    "account_cash": {},
                    "account_properties": account.properties
                })
                
                # Add cash holdings
                from models.security_type import SecurityType
                for holding in account.holdings:
                    if portfolio.securities[holding.symbol].security_type == SecurityType.CASH:
                        complete_accounts[-1]["account_cash"][holding.symbol] = holding.units

            # Get current prices for this portfolio's symbols
            current_prices = {}
            for symbol in portfolio_symbols:
                if symbol in portfolio.securities:
                    security = portfolio.securities[symbol]
                    price_info = calculator.calc_holding_value(security, 1)
                    current_prices[symbol] = {
                        "price": price_info["value"],
                        "currency": security.currency.value,
                        "last_updated": datetime.utcnow().isoformat()
                    }
            
            # Add exchange rates to global rates
            for currency_key, rate in portfolio.exchange_rates.items():
                global_exchange_rates[currency_key.value] = rate

            # Store portfolio data
            total_portfolio_value = sum(acc["account_total"] for acc in complete_accounts)
            
            all_portfolios_data[portfolio_id] = {
                "portfolio_metadata": {
                    "portfolio_id": portfolio_id,
                    "portfolio_name": portfolio.portfolio_name,
                    "base_currency": portfolio.base_currency.value,
                    "user_name": portfolio.user_name,
                    "user_id": portfolio.user_id,
                    "total_value": round(total_portfolio_value, 2)
                },
                "accounts": complete_accounts,
                "current_prices": current_prices,
                "computation_timestamp": datetime.utcnow().isoformat()
            }

        print(f"🌐 [ALL PORTFOLIOS] Processed {len(all_portfolios_data)} portfolios with {len(all_symbols)} total unique symbols")
        
        # Get tags data for ALL portfolios
        print("🏷️ [ALL PORTFOLIOS] Fetching user tag library and holding tags")
        user_tag_library = {}
        all_holding_tags = {}
        
        try:
            # Get user tag library
            from core.tag_service import TagService
            tag_service = TagService(db_manager.get_database())
            tag_library_result = await tag_service.get_user_tag_library(user.id)
            
            # Convert TagLibrary object to dict for JSON serialization
            if tag_library_result:
                user_tag_library = {
                    "id": getattr(tag_library_result, 'id', None),
                    "user_id": tag_library_result.user_id,
                    "tag_definitions": tag_library_result.tag_definitions,
                    "template_tags": tag_library_result.template_tags,
                    "created_at": getattr(tag_library_result, 'created_at', None),
                    "updated_at": getattr(tag_library_result, 'updated_at', None)
                }
            else:
                user_tag_library = {"tag_definitions": {}, "template_tags": {}}
                
            print(f"✅ [ALL PORTFOLIOS] Loaded user tag library with {len(user_tag_library.get('tag_definitions', {}))} definitions")
            
            # Get all holding tags for all portfolios (direct query)
            holding_tags_collection = db_manager.get_collection("holding_tags")
            holding_tags_cursor = holding_tags_collection.find({"user_id": user.id})
            
            async for holding_tag_doc in holding_tags_cursor:
                symbol = holding_tag_doc["symbol"]
                # Convert to dict format expected by frontend
                all_holding_tags[symbol] = {
                    "symbol": symbol,
                    "user_id": holding_tag_doc["user_id"],
                    "portfolio_id": holding_tag_doc.get("portfolio_id"),
                    "tags": holding_tag_doc.get("tags", {}),
                    "created_at": holding_tag_doc.get("created_at"),
                    "updated_at": holding_tag_doc.get("updated_at")
                }
            
            print(f"✅ [ALL PORTFOLIOS] Loaded holding tags for {len(all_holding_tags)} symbols")
            
        except Exception as e:
            print(f"⚠️ [ALL PORTFOLIOS] Error loading tags data: {e}")
            user_tag_library = {"tag_definitions": {}, "template_tags": {}}
            all_holding_tags = {}
        
        # Get options vesting data for ALL company custodian accounts across portfolios
        print("📊 [ALL PORTFOLIOS] Fetching options vesting for all company custodian accounts")
        all_options_vesting = {}
        
        try:
            for portfolio_id, portfolio_data in all_portfolios_data.items():
                portfolio_options = {}
                company_accounts = [
                    acc for acc in portfolio_data["accounts"] 
                    if acc["account_type"] == "company-custodian-account"
                ]
                
                if company_accounts:
                    print(f"📊 [ALL PORTFOLIOS] Fetching options vesting for {len(company_accounts)} company accounts in portfolio {portfolio_id}")
                    
                    for account in company_accounts:
                        try:
                            # Get options vesting for this account
                            options_plans = account.get("options_plans", [])
                            if options_plans:
                                vesting_data = []
                                for plan in options_plans:
                                    try:
                                        plan_vesting = OptionsCalculator.calculate_vesting_schedule(
                                            grant_date=plan["grant_date"],
                                            total_units=plan["units"],
                                            vesting_period_years=plan["vesting_period_years"],
                                            vesting_frequency=plan["vesting_frequency"],
                                            has_cliff=plan.get("has_cliff", False),
                                            cliff_months=plan.get("cliff_duration_months", 0) if plan.get("has_cliff") else 0,
                                            left_company=plan.get("left_company", False),
                                            left_company_date=plan.get("left_company_date")
                                        )
                                        vesting_data.append({
                                            "id": plan["id"],
                                            "symbol": plan["symbol"],
                                            **plan_vesting
                                        })
                                    except Exception as plan_error:
                                        print(f"⚠️ [ALL PORTFOLIOS] Error calculating vesting for plan {plan.get('id', 'unknown')}: {plan_error}")
                                
                                portfolio_options[account["account_name"]] = {"plans": vesting_data}
                                
                        except Exception as acc_error:
                            print(f"⚠️ [ALL PORTFOLIOS] Error processing options for account {account['account_name']}: {acc_error}")
                            portfolio_options[account["account_name"]] = {"plans": []}
                
                all_options_vesting[portfolio_id] = portfolio_options
                
        except Exception as e:
            print(f"❌ [ALL PORTFOLIOS] Error loading options vesting: {e}")
            all_options_vesting = {}
        
        # Get live quotes for ALL symbols across all portfolios
        global_quotes = {}
        
        try:
            from services.closing_price.stock_fetcher import fetch_quotes
            stock_symbols = [
                symbol for symbol in all_symbols 
                if symbol in global_securities and global_securities[symbol]["security_type"].lower() in ['stock', 'etf']
            ]
            
            if stock_symbols:
                print(f"📈 [ALL PORTFOLIOS] Fetching live quotes for {len(stock_symbols)} global stock/ETF symbols")
                
                try:
                    quotes_response = await fetch_quotes(stock_symbols)
                    current_time = datetime.utcnow().isoformat()
                    
                    for symbol, quote_data in quotes_response.items():
                        if quote_data is not None and quote_data.get("current_price") is not None:
                            global_quotes[symbol] = {
                                "symbol": symbol,
                                "current_price": quote_data["current_price"],
                                "percent_change": quote_data.get("percent_change", 0.0),
                                "last_updated": current_time
                            }
                    
                    print(f"✅ [ALL PORTFOLIOS] Fetched {len(global_quotes)} global live quotes (out of {len(stock_symbols)} requested)")
                    
                except Exception as e:
                    print(f"⚠️ [ALL PORTFOLIOS] Global quotes fetch failed, creating fallbacks: {str(e)}")
                    current_time = datetime.utcnow().isoformat()
                    for symbol in stock_symbols:
                        global_quotes[symbol] = {
                            "symbol": symbol,
                            "current_price": 0.0,
                            "percent_change": 0.0,
                            "last_updated": current_time
                        }
                        
        except Exception as e:
            print(f"❌ [ALL PORTFOLIOS] Error creating global quotes: {str(e)}")
            global_quotes = {}

        # Get user preferences/default portfolio
        try:
            # Get default portfolio from user preferences or first portfolio
            user_prefs_collection = db_manager.get_collection("user_preferences") 
            user_prefs_doc = await user_prefs_collection.find_one({"user_id": user.id})
            default_portfolio_id = user_prefs_doc.get("default_portfolio_id") if user_prefs_doc else None
        except:
            default_portfolio_id = None

        result = {
            "portfolios": all_portfolios_data,
            "global_securities": global_securities,
            "global_quotes": global_quotes,
            "global_exchange_rates": global_exchange_rates,
            "user_tag_library": user_tag_library,
            "all_holding_tags": all_holding_tags,
            "all_options_vesting": all_options_vesting,
            "user_preferences": {
                "preferred_currency": "USD",  # Could be customizable later
                "default_portfolio_id": default_portfolio_id
            },
            "computation_timestamp": datetime.utcnow().isoformat()
        }

        print(f"🎯 [ALL PORTFOLIOS] Returning complete data for {len(all_portfolios_data)} portfolios: {list(all_portfolios_data.keys())}")
        print(f"📊 [ALL PORTFOLIOS] Complete summary: {len(global_securities)} securities, {len(global_quotes)} quotes, {len(all_holding_tags)} holding tags, {len(all_options_vesting)} portfolio options")
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [ALL PORTFOLIOS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portfolio")
async def create_portfolio(request: CreatePortfolioRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Create a new portfolio document in MongoDB with basic structure.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        existing = await collection.find_one({"portfolio_name": request.portfolio_name, "user_id": user.id})
        if existing:
            raise HTTPException(status_code=409, detail=f"Portfolio '{request.portfolio_name}' already exists")
        
        # Create portfolio with all required fields for Portfolio.from_dict
        portfolio_data = {
            "portfolio_name": request.portfolio_name,
            "user_id": user.id,
            "config": {
                "user_name": request.portfolio_name,
                "base_currency": request.base_currency,
                "exchange_rates": {
                    # Add default exchange rates - these can be updated later
                    "USD": 1.0,
                    "ILS": 3.5,  # Default USD to ILS rate
                    "EUR": 1.1   # Default USD to EUR rate
                },
                "unit_prices": {
                    "USD": 1.0,
                    "ILS": 1.0
                }
            },
            "securities": {
                "USD": {
                    "name": "USD",
                    "type": "cash",
                    "currency": "USD"
                },
                "ILS": {
                    "name": "ILS",
                    "type": "cash",
                    "currency": "ILS"
                }
            },
            "accounts": []
        }
        
        # Insert portfolio and get the ObjectId
        result = await collection.insert_one(portfolio_data)
        portfolio_id = str(result.inserted_id)
        
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)

        return {
            "message": f"Portfolio '{request.portfolio_name}' created successfully", 
            "portfolio_id": portfolio_id  # Return the actual ObjectId, not the name
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portfolio/{portfolio_id}/accounts")
async def add_account_to_portfolio(portfolio_id: str, request: CreateAccountRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Add a new account to an existing portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        portfolio_data = doc
        existing_accounts = [acc['name'] for acc in portfolio_data.get('accounts', [])]
        if request.account_name in existing_accounts:
            raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
        if 'securities' not in portfolio_data:
            portfolio_data['securities'] = {}
        for holding in request.holdings:
            symbol = holding.get('symbol')
            if symbol and symbol not in portfolio_data['securities']:
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': 'bond' if str.isnumeric(symbol) else 'stock',  # Default type
                    'currency': 'ILS' if str.isnumeric(symbol) else 'USD'  # Default currency
                }

        # Add securities for options plans
        for plan in request.options_plans:
            symbol = plan.get('symbol')
            if symbol and symbol not in portfolio_data['securities']:
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': 'stock',  # Options are typically for stock
                    'currency': 'USD'  # Default currency for options
                }
        new_account = {
            "name": request.account_name,
            "user_id": user.id,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings,
            "rsu_plans": request.rsu_plans,
            "espp_plans": request.espp_plans,
            "options_plans": request.options_plans
        }
        # Save IBKR Flex credentials if provided
        if request.ibkr_flex:
            new_account["ibkr_flex"] = request.ibkr_flex
        if 'accounts' not in portfolio_data:
            portfolio_data['accounts'] = []
        portfolio_data['accounts'].append(new_account)
        await collection.replace_one({"_id": ObjectId(portfolio_id)}, portfolio_data)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)
        return {"message": f"Account '{request.account_name}' added to {portfolio_id} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Delete an entire portfolio document from MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        count = await collection.count_documents({"user_id": user.id})
        if count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining portfolio")
        result = await collection.delete_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        # Clear from portfolios cache
        invalidate_portfolio_cache(portfolio_id)

        return {"message": f"Portfolio {portfolio_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/portfolio/{portfolio_id}/accounts/{account_name}")
async def delete_account_from_portfolio(portfolio_id: str, account_name: str, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Delete a specific account from a portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        accounts = doc.get('accounts', [])
        account_names = [acc['name'] for acc in accounts]
        if account_name not in account_names:
            raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
        if len(accounts) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining account")
        doc['accounts'] = [acc for acc in accounts if acc['name'] != account_name]
        await collection.replace_one({"_id": ObjectId(portfolio_id)}, doc)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)

        return {"message": f"Account '{account_name}' deleted from {portfolio_id} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/portfolio/{portfolio_id}/accounts/{account_name}")
async def update_account_in_portfolio(portfolio_id: str, account_name: str, request: CreateAccountRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Update an existing account in a portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        accounts = doc.get('accounts', [])
        account_index = None
        for i, acc in enumerate(accounts):
            if acc['name'] == account_name:
                account_index = i
                break
        if account_index is None:
            raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
        if request.account_name != account_name:
            existing_accounts = [acc['name'] for acc in accounts]
            if request.account_name in existing_accounts:
                raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
        if 'securities' not in doc:
            doc['securities'] = {}
        for holding in request.holdings:
            symbol = holding.get('symbol')
            if symbol and symbol not in doc['securities']:
                doc['securities'][symbol] = {
                    'name': symbol,
                    'type': 'bond' if str.isnumeric(symbol) else 'stock',  # Default type
                    'currency': 'ILS' if str.isnumeric(symbol) else 'USD'  # Default currency
                }

        # Add securities for options plans
        for plan in request.options_plans:
            symbol = plan.get('symbol')
            if symbol and symbol not in doc['securities']:
                doc['securities'][symbol] = {
                    'name': symbol,
                    'type': 'stock',  # Options are typically for stock
                    'currency': 'USD'  # Default currency for options
                }
        updated_account = {
            "name": request.account_name,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings,
            "rsu_plans": request.rsu_plans,
            "espp_plans": request.espp_plans,
            "options_plans": request.options_plans
        }
        # Save or update IBKR Flex credentials if provided
        if request.ibkr_flex is not None:
            updated_account["ibkr_flex"] = request.ibkr_flex
        accounts[account_index] = updated_account
        doc['accounts'] = accounts
        await collection.replace_one({"_id": ObjectId(portfolio_id)}, doc)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)
        return {"message": f"Account '{account_name}' updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))