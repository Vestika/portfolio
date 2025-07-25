import logging
import math
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Any, Optional, List
from dateutil.relativedelta import relativedelta

from fastapi import FastAPI, Query, Depends, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import yaml

from core import feature_generator
from core.database import db_manager
from models import User, Product, UserPreferences, Symbol, TagDefinition, TagValue, HoldingTags, TagLibrary, TagType, ScalarDataType, DEFAULT_TAG_TEMPLATES
from models.portfolio import Portfolio
from models.security_type import SecurityType
from portfolio_calculator import PortfolioCalculator
from utils import filter_security
from services.closing_price.service import get_global_service
from services.closing_price.price_manager import PriceManager
from services.closing_price.stock_fetcher import fetch_quotes
from core.auth import get_current_user
from core.firebase import FirebaseAuthMiddleware
from core.ai_analyst import ai_analyst
from core.portfolio_analyzer import portfolio_analyzer
from core.chat_manager import chat_manager
import yfinance as yf
from pymaya.maya import Maya
from datetime import date
from core.tag_service import TagService

logger = logging.Logger(__name__)

# Get the global closing price service
closing_price_service = get_global_service()

# Create FastAPI app
app = FastAPI(
    title="Portfolio API",
    description="API for managing investment portfolios",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://app.vestika.io"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Firebase authentication middleware
app.add_middleware(
    FirebaseAuthMiddleware,
    exclude_paths=["/docs", "/openapi.json", "/redoc"]
)


@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    try:
        logger.info("Starting up Portfolio API...")

        # Try to initialize the closing price service (optional)
        try:
            await closing_price_service.initialize()
            logger.info("Closing price service initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize closing price service: {e}")

        # Try to connect to database (optional)
        try:
            await db_manager.connect("vestika")
            logger.info("Database connected successfully")

            # Register feature models only if database is available
            models_to_register = [User, Product, UserPreferences, Symbol]
            for model_class in models_to_register:
                router = feature_generator.register_feature(model_class)
                app.include_router(router, prefix="/api/v1")
        except Exception as e:
            logger.warning(f"Failed to connect to database: {e}")

        logger.info("Portfolio API startup completed successfully")

    except Exception as e:
        logger.error(f"Failed to start Portfolio API: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on application shutdown"""
    try:
        logger.info("Shutting down Portfolio API...")
        # Clean up the closing price service
        await closing_price_service.cleanup()
        logger.info("Portfolio API shutdown completed successfully")
    except Exception as e:
        logger.warning(f"Error during shutdown: {e}")


# Cache for calculator instances to maintain cache across requests
calculator_cache = {}


# Predefined charts with their aggregation keys
CHARTS: list[dict[str, Any]] = [
    {
        "title": "Account Size Overview",
        "aggregation_key": None,
        "account_filter": None,
        "security_filter": None,
        "ignore_missing_key": False,
    },
    {
        "title": "Holdings Aggregation By Symbol",
        "aggregation_key": filter_security.by_symbol,
        "account_filter": None,
        "security_filter": None,
        "ignore_missing_key": False,
    },
    {
        "title": "Geographical Distribution of Stocks",
        "aggregation_key": filter_security.by_tag("geographical"),
        "account_filter": None,
        "security_filter": None,
        "ignore_missing_key": True,
    },
    {
        "title": "Breakdown By Asset Type",
        "aggregation_key": filter_security.by_type,
        "account_filter": None,
        "security_filter": None,
        "ignore_missing_key": False,
    },
]

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
        logger.info(f"Created new calculator for {portfolio_id}")
    else:
        logger.debug(f"Reusing cached calculator for {portfolio_id}")

    return calculator_cache[cache_key]


@app.get("/portfolios")
async def list_portfolios(user=Depends(get_current_user)) -> list[dict[str, str]]:
    """
    Returns a list of all portfolios in the database.
    """
    collection = db_manager.get_collection("portfolios")
    portfolios_cursor = collection.find({"user_id": user.id}, {"_id": 1, "portfolio_name": 1})
    portfolios = []
    async for doc in portfolios_cursor:
        portfolios.append({
            "portfolio_id": str(doc["_id"]),
            "portfolio_name": doc["portfolio_name"],
            "display_name": doc["portfolio_name"].title()
        })

    return portfolios



@app.get("/portfolio")
async def get_portfolio_metadata(portfolio_id: str = "demo", user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Endpoint to return portfolio metadata, config and account data from MongoDB by portfolio_id.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            # Check if user has any portfolios at all
            user_portfolio_count = await collection.count_documents({"user_id": user.id})
            if user_portfolio_count == 0:
                # User has no portfolios, suggest creating one
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": "No portfolios found",
                        "message": "You don't have any portfolios yet. Please create your first portfolio to get started.",
                        "action": "create_portfolio",
                        "user_has_portfolios": False
                    }
                )
            else:
                # User has portfolios but this specific one doesn't exist
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": f"Portfolio {portfolio_id} not found",
                        "message": "The requested portfolio doesn't exist. Please select a different portfolio.",
                        "action": "select_different_portfolio",
                        "user_has_portfolios": True
                    }
                )

        portfolio = Portfolio.from_dict(doc)
        calculator = get_or_create_calculator(portfolio_id, portfolio)
        result = {
            "base_currency": portfolio.base_currency,
            "user_name": portfolio.user_name,
            "accounts": [],
        }
        for account in portfolio.accounts:
            account_data = {
                "account_name": account.name,
                "account_total": sum(
                    calculator.calc_holding_value(portfolio.securities[holding.symbol], holding.units)["total"]
                    for holding in account.holdings
                ),
                "account_properties": account.properties,
                "account_cash": {},
                "account_type": account.properties.get("type", "bank-account"),
                "owners": account.properties.get("owners", ["me"]),
                "holdings": [
                    {
                        "symbol": holding.symbol,
                        "units": holding.units
                    }
                    for holding in account.holdings
                ]
            }
            if hasattr(account, "rsu_plans") and account.rsu_plans is not None:
                account_data["rsu_plans"] = account.rsu_plans
            if hasattr(account, "espp_plans") and account.espp_plans is not None:
                account_data["espp_plans"] = account.espp_plans
            for holding in account.holdings:
                if portfolio.securities[holding.symbol].security_type == SecurityType.CASH:
                    account_data["account_cash"][holding.symbol] = holding.units
            result["accounts"].append(account_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BreakdownRequest:
    def __init__(
        self,
        account_names: Optional[list[str]] = Query(default=None, title="account_names"),
    ):
        self.account_names = account_names


@app.get("/portfolio/breakdown")
async def get_portfolio_aggregations(
    request: BreakdownRequest = Depends(BreakdownRequest), portfolio_id: str = "demo", user=Depends(get_current_user)
) -> list[dict[str, Any]]:
    """
    Endpoint to calculate all predefined portfolio aggregations on the requested accounts.
    if account_names is None, all accounts will be returned (typical first/default API request).
    The structure of the response array is as follows:
    [
        {
            "chart_title": "Aggregation of Holdings By Symbol",
            "chart_total": 10222,
            "chart_data": [
                {
                    "label": "VTI",
                    "value": 5111,
                    "percentage": 50.0
                },
                ...
            ]
        }
    ]
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        portfolio = Portfolio.from_dict(doc)
        calculator = get_or_create_calculator(portfolio_id, portfolio)

        # Calculate all holding values once
        holding_values = {}
        filtered_accounts = []

        for account in portfolio.accounts:
            if request.account_names and account.name not in request.account_names:
                continue
            filtered_accounts.append(account)

            for holding in account.holdings:
                security = portfolio.securities[holding.symbol]
                holding_key = f"{account.name}:{holding.symbol}"
                holding_values[holding_key] = {
                    "account": account,
                    "holding": holding,
                    "security": security,
                    "value_info": calculator.calc_holding_value(security, holding.units)
                }

        result = []
        for chart_config in CHARTS:
            # Aggregate holdings based on chart configuration
            aggregated_values: dict[str, float] = {}
            total_value = 0.0

            for holding_key, holding_data in holding_values.items():
                account = holding_data["account"]
                holding = holding_data["holding"]
                security = holding_data["security"]
                holding_value = holding_data["value_info"]["total"]

                # Apply security filter if specified
                if chart_config.get("security_filter") and not chart_config["security_filter"](security):
                    continue

                total_value += holding_value

                # Determine aggregation key
                aggregation_key = chart_config.get("aggregation_key")
                if aggregation_key is None:
                    # Account-level aggregation
                    key = account.name
                else:
                    # Custom aggregation
                    try:
                        key = aggregation_key(security)
                    except Exception as e:
                        if chart_config.get("ignore_missing_key"):
                            continue
                        else:
                            raise e

                # Handle different key types
                if isinstance(key, dict):
                    # For dictionary tags, aggregate by each key with weighted values
                    for sub_key, sub_value in key.items():
                        weighted_value = holding_value * sub_value
                        aggregated_values[sub_key] = aggregated_values.get(sub_key, 0.0) + weighted_value
                elif isinstance(key, list):
                    # For list of keys, aggregate for each key
                    for sub_key in key:
                        aggregated_values[sub_key] = aggregated_values.get(sub_key, 0.0) + holding_value
                else:
                    # Handle simple keys (strings, numbers, etc.)
                    if key is None:
                        key = "_Unknown"

                    key_str = str(key)  # Convert to string to ensure it's hashable
                    aggregated_values[key_str] = aggregated_values.get(key_str, 0.0) + holding_value

            # Convert to aggregation dict format
            aggregation_data = {
                "aggregated_values": aggregated_values,
                "total_value": total_value,
                "base_currency": calculator.base_currency,
            }
            aggregation_dict = calculator.get_aggregation_dict(aggregation_data)

            result.append(
                {
                    "chart_title": chart_config["title"],
                    "chart_total": aggregation_dict["total"],
                    "chart_data": aggregation_dict["breakdown"],
                },
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/portfolio/holdings")
async def get_holdings_table(
    request: BreakdownRequest = Depends(BreakdownRequest), portfolio_id: str = "demo", user=Depends(get_current_user)
) -> dict[str, Any]:
    """
    Endpoint to return detailed holdings information for the selected accounts.
    Returns aggregated holdings with security details and historical prices.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        portfolio = Portfolio.from_dict(doc)
        calculator = get_or_create_calculator(portfolio_id, portfolio)

        holdings_aggregation: dict[str, dict] = {}
        maya = Maya()
        today = date.today()
        seven_days_ago = today - timedelta(days=7)

        for account in portfolio.accounts:
            if request.account_names and account.name not in request.account_names:
                continue

            for holding in account.holdings:
                security = portfolio.securities[holding.symbol]
                symbol = holding.symbol

                if symbol not in holdings_aggregation:
                    pricing_info = calculator.calc_holding_value(security, 1)
                    original_price = pricing_info["unit_price"]
                    historical_prices = []
                    try:
                        if symbol == 'USD':
                            # Handle currency holdings
                            from_currency = symbol
                            to_currency = str(portfolio.base_currency)
                            if from_currency == to_currency:
                                # No conversion needed, always 1
                                for i in range(7, 0, -1):
                                    day = today - timedelta(days=i)
                                    historical_prices.append({
                                        "date": day.strftime("%Y-%m-%d"),
                                        "price": 1.0
                                    })
                            else:
                                # Construct yfinance ticker for currency pair
                                ticker = f"{from_currency}{to_currency}=X"
                                logger.info(f"Fetching 7d FX trend for {from_currency} to {to_currency} using yfinance ticker {ticker}")
                                data = yf.download(ticker, start=seven_days_ago, end=today + timedelta(days=1), progress=False)
                                if not data.empty:
                                    prices = data["Close"].dropna().round(6).to_dict().get(ticker)
                                    for dt, price in prices.items():
                                        historical_prices.append({
                                            "date": dt,
                                            "price": float(price)
                                        })
                                else:
                                    logger.warning(f"No yfinance FX data for ticker: {ticker}, falling back to mock.")
                        elif symbol.isdigit():
                            logger.info(f"Fetching 7d trend for TASE symbol (numeric): {symbol} using pymaya")
                            tase_id = getattr(security, 'tase_id', None) or symbol
                            price_history = list(maya.get_price_history(security_id=str(tase_id), from_data=seven_days_ago))
                            for entry in reversed(price_history):
                                if entry.get('TradeDate') and entry.get('SellPrice'):
                                    historical_prices.append({
                                        "date": entry.get('TradeDate'),
                                        "price": float(entry.get('SellPrice')) / 100
                                    })
                            if not historical_prices:
                                logger.warning(f"No pymaya data for TASE symbol: {symbol}, falling back to mock.")
                        else:
                            logger.info(f"Fetching 7d trend for non-numeric symbol: {symbol} using yfinance")
                            data = yf.download(symbol, start=seven_days_ago, end=today + timedelta(days=1), progress=False)
                            if not data.empty:
                                prices = data["Close"].dropna().round(2)
                                prices = prices.to_dict().get(symbol)
                                for dt, price in prices.items():
                                    historical_prices.append({
                                        "date": dt.strftime("%Y-%m-%d"),
                                        "price": float(price)
                                    })
                            else:
                                logger.warning(f"No yfinance data for symbol: {symbol}, falling back to mock.")
                    except Exception as e:
                        logger.warning(f"Failed to fetch real historical prices for {symbol}: {e}. Using mock data.")

                    holdings_aggregation[symbol] = {
                        "symbol": symbol,
                        "security_type": security.security_type.value,
                        "name": security.name,
                        "tags": security.tags,
                        "total_units": 0,
                        "original_price": original_price,
                        "original_currency": security.currency,
                        "value_per_unit": pricing_info["value"],
                        "currency": portfolio.base_currency,
                        "price_source": pricing_info["price_source"],
                        "historical_prices": historical_prices,
                        "account_breakdown": []  # Add account breakdown array
                    }

                # Add account information to the breakdown
                account_holding_value = calculator.calc_holding_value(security, holding.units)
                holdings_aggregation[symbol]["account_breakdown"].append({
                    "account_name": account.name,
                    "account_type": account.properties.get("type", "bank-account"),
                    "units": holding.units,
                    "value": account_holding_value["total"],
                    "owners": account.properties.get("owners", ["me"])
                })
                holdings_aggregation[symbol]["total_units"] += holding.units

        holdings = []
        for holding_data in holdings_aggregation.values():
            holding_data["total_value"] = holding_data["value_per_unit"] * holding_data["total_units"]
            # Sort account breakdown by value descending
            holding_data["account_breakdown"].sort(key=lambda x: x["value"], reverse=True)
            holdings.append(holding_data)

        return {
            "base_currency": portfolio.base_currency,
            "holdings": sorted(holdings, key=lambda x: x["total_value"], reverse=True),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@app.post("/portfolio")
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


@app.post("/portfolio/{portfolio_id}/accounts")
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


@app.delete("/portfolio/{portfolio_id}")
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


@app.delete("/portfolio/{portfolio_id}/accounts/{account_name}")
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


@app.put("/portfolio/{portfolio_id}/accounts/{account_name}")
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


# Add a root endpoint
@app.get("/")
async def root(user=Depends(get_current_user)):
    """Root endpoint with service information"""
    return {
        "service": "Portfolio API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "user": user.email
    }

@app.get("/ai/status")
async def get_ai_status(user=Depends(get_current_user)):
    """Check AI service availability status"""
    return {
        "available": ai_analyst.is_available,
        "error_message": ai_analyst.error_message if not ai_analyst.is_available else None,
        "features": {
            "portfolio_analysis": ai_analyst.is_available,
            "ai_chat": ai_analyst.is_available
        }
    }

@app.post("/onboarding/demo-portfolio")
async def create_demo_portfolio_endpoint(user=Depends(get_current_user)):
    """Create a demo portfolio for new users"""
    try:
        from core.auth import create_demo_portfolio
        
        # Check if user already has portfolios
        collection = db_manager.get_collection("portfolios")
        existing_portfolios = await collection.count_documents({"user_id": user.id})
        
        if existing_portfolios > 0:
            return {"message": "User already has portfolios", "portfolios_count": existing_portfolios}
        
        # Create demo portfolio
        await create_demo_portfolio(db_manager.database, user.id)
        
        return {"message": "Demo portfolio created successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create demo portfolio: {str(e)}")

@app.get("/onboarding/status")
async def get_onboarding_status(user=Depends(get_current_user)):
    """Check if user needs onboarding (i.e., has no portfolios)"""
    try:
        collection = db_manager.get_collection("portfolios")
        portfolio_count = await collection.count_documents({"user_id": user.id})
        
        return {
            "needs_onboarding": portfolio_count == 0,
            "portfolio_count": portfolio_count,
            "user_id": user.id,
            "user_name": user.name,
            "user_email": user.email
        }
        
    except Exception as e:
        return {
            "needs_onboarding": True,
            "portfolio_count": 0,
            "error": str(e)
        }


def invalidate_portfolio_cache(portfolio_id: str):
    """Invalidate calculator cache for a given portfolio_id"""
    # Clear calculator cache entries for this portfolio_id
    keys_to_remove = [key for key in calculator_cache.keys() if key.startswith(f"{portfolio_id}:")]
    for key in keys_to_remove:
        del calculator_cache[key]
        logger.info(f"Invalidated calculator cache for key {key}")


@app.get("/portfolio/raw")
async def download_portfolio_raw(portfolio_id: str, user=Depends(get_current_user)):
    """
    Download the raw portfolio document as YAML.
    """
    collection = db_manager.get_collection("portfolios")
    doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    doc["_id"] = str(doc["_id"])
    yaml_str = yaml.dump(doc, allow_unicode=True)
    return Response(content=yaml_str, media_type="application/x-yaml")

@app.post("/portfolio/upload")
async def upload_portfolio(file: UploadFile = File(...), user=Depends(get_current_user)):
    """
    Upload a new portfolio as a YAML file.
    """
    try:
        content = await file.read()
        data = content.decode()
        try:
            portfolio_yaml = yaml.safe_load(data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")
        collection = db_manager.get_collection("portfolios")
        # Remove _id if present
        portfolio_yaml.pop("_id", None)
        portfolio_yaml.pop("user_id", None)
        portfolio_yaml["user_id"] = user.id
        result = await collection.insert_one(portfolio_yaml)
        return {"portfolio_id": str(result.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/market-status")
async def get_market_status(user=Depends(get_current_user)):
    """Return both US and TASE market open/closed status."""
    manager = PriceManager()
    return await manager.get_market_status()


@app.get("/quotes")
async def get_quotes(symbols: str = Query(..., description="Comma-separated list of symbols"), user=Depends(get_current_user)):
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    return await fetch_quotes(symbol_list)


@app.get("/symbols/autocomplete")
async def get_symbol_autocomplete(q: str = Query(..., min_length=2, max_length=50)) -> list[dict]:
    """
    Get autocomplete suggestions for symbols based on search query.
    Searches by symbol, name, or search terms.
    """
    try:
        collection = db_manager.get_collection("symbols")

        # Use MongoDB text search for better performance and relevance
        query = {
            "$and": [
                {"is_active": True},
                {"$text": {"$search": q}}
            ]
        }

        # First try text search, then fall back to manual filtering if needed
        cursor = collection.find(query).limit(20)
        results = []

        # Collect results from text search
        async for doc in cursor:
            results.append({
                "symbol": doc["symbol"],
                "name": doc["name"],
                "symbol_type": doc["symbol_type"],
                "currency": doc["currency"],
                "short_name": doc.get("short_name", ""),
                "market": doc.get("market", ""),
                "sector": doc.get("sector", "")
            })

        # If text search returns few results, supplement with manual filtering
        if len(results) < 10:
            q_lower = q.lower()

            # Check if query is numeric (for Israeli securities)
            is_numeric = q.isdigit()
            
            # Create multiple search conditions for better coverage
            manual_query_conditions = [
                {"symbol": {"$regex": q_lower, "$options": "i"}},
                {"name": {"$regex": q_lower, "$options": "i"}},
                {"short_name": {"$regex": q_lower, "$options": "i"}},
                {"search_terms": q_lower}  # Exact match in array
            ]

            # Add search terms with regex for partial matches
            # Check for each array element individually
            search_terms_regex_conditions = []
            for term_regex in [q_lower, q_lower.replace(":", ""), q_lower.replace("nasdaq:", ""), q_lower.replace("nyse:", "")]:
                if term_regex:
                    search_terms_regex_conditions.append({"search_terms": {"$regex": term_regex, "$options": "i"}})

            if search_terms_regex_conditions:
                manual_query_conditions.extend(search_terms_regex_conditions)

            # Add simple fuzzy matching for common cases
            if len(q_lower) >= 3:
                # For queries like "msf" -> also search for "msft"
                fuzzy_variants = []

                # Add one character at the end (most common typo)
                for char in 'abcdefghijklmnopqrstuvwxyz':
                    fuzzy_variant = q_lower + char
                    if len(fuzzy_variant) <= 6:
                        fuzzy_variants.append(fuzzy_variant)

                # Remove last character (if query might be too long)
                if len(q_lower) > 3:
                    fuzzy_variants.append(q_lower[:-1])

                # Add fuzzy conditions for the most likely variants
                for variant in fuzzy_variants[:5]:  # Limit to top 5 variants
                    manual_query_conditions.extend([
                        {"search_terms": variant},
                        {"symbol": {"$regex": f":{variant}$", "$options": "i"}}
                    ])

            # Add numeric search for Israeli securities if query is numeric
            if is_numeric:
                manual_query_conditions.extend([
                    {"numeric_id": q},
                    {"tase_id": q}
                ])

            manual_query = {
                "$and": [
                    {"is_active": True},
                    {"$or": manual_query_conditions}
                ]
            }

            manual_cursor = collection.find(manual_query).limit(100)

            manual_results = []
            async for doc in manual_cursor:
                # Skip if we already have this result
                if any(r["symbol"] == doc["symbol"] for r in results):
                    continue

                manual_results.append({
                    "symbol": doc["symbol"],
                    "name": doc["name"],
                    "symbol_type": doc["symbol_type"],
                    "currency": doc["currency"],
                    "short_name": doc.get("short_name", ""),
                    "market": doc.get("market", ""),
                    "sector": doc.get("sector", "")
                })

            # Add manual results to main results
            results.extend(manual_results)

        # Sort results by relevance - exact symbol matches first
        def sort_key(item):
            symbol_lower = item["symbol"].lower()
            name_lower = item["name"].lower()
            q_lower = q.lower()

            # Extract base symbol for comparison (remove prefixes/suffixes)
            base_symbol = symbol_lower.replace("nyse:", "").replace("nasdaq:", "").replace(".ta", "")

            # Calculate edit distance for fuzzy matching
            def edit_distance(s1, s2):
                if len(s1) > len(s2):
                    s1, s2 = s2, s1
                distances = list(range(len(s1) + 1))
                for i2, c2 in enumerate(s2):
                    distances_ = [i2 + 1]
                    for i1, c1 in enumerate(s1):
                        if c1 == c2:
                            distances_.append(distances[i1])
                        else:
                            distances_.append(1 + min((distances[i1], distances[i1 + 1], distances_[-1])))
                    distances = distances_
                return distances[-1]

            # Calculate similarity scores
            base_edit_distance = edit_distance(q_lower, base_symbol)
            symbol_edit_distance = edit_distance(q_lower, symbol_lower)

            # Priority scoring with fuzzy matching
            if symbol_lower == q_lower:
                return (0, 0, symbol_lower)  # Exact symbol match
            elif base_symbol == q_lower:
                return (1, 0, symbol_lower)  # Base symbol exact match
            elif symbol_lower.startswith(q_lower):
                return (2, 0, symbol_lower)  # Symbol starts with query
            elif base_symbol.startswith(q_lower):
                return (3, 0, symbol_lower)  # Base symbol starts with query
            elif name_lower.startswith(q_lower):
                return (4, 0, name_lower)  # Name starts with query
            elif q_lower in base_symbol:
                return (5, 0, symbol_lower)  # Base symbol contains query
            elif q_lower in symbol_lower:
                return (6, 0, symbol_lower)  # Symbol contains query
            elif q_lower in name_lower:
                return (7, 0, name_lower)  # Name contains query
            elif base_edit_distance <= 2:  # Fuzzy match on base symbol (up to 2 edits)
                return (8, base_edit_distance, symbol_lower)  # Fuzzy match on base symbol
            elif symbol_edit_distance <= 2:  # Fuzzy match on full symbol (up to 2 edits)
                return (9, symbol_edit_distance, symbol_lower)  # Fuzzy match on symbol
            else:
                return (10, symbol_edit_distance, name_lower)  # Fallback with edit distance
        
        results.sort(key=sort_key)

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/symbols/populate")
async def populate_symbols_api(
    force: bool = Query(False, description="Force update all symbols, bypassing checksum validation"),
    symbol_types: Optional[List[str]] = Query(None, description="Specific symbol types to update (US, TASE, CURRENCY, CRYPTO)")
) -> dict[str, Any]:
    """
    API endpoint to populate the symbols collection using live APIs.
    - Uses Finnhub.io API for NYSE and NASDAQ securities
    - Uses PyMaya API for TASE securities
    - Includes currencies and crypto
    - Supports checksum-based incremental updates
    """
    try:
        # Import the consolidated populate_symbols function
        from populate_symbols import populate_symbols

        # Call the consolidated function
        result = await populate_symbols(force=force, symbol_types=symbol_types)

        # Get sample symbols for response
        sample_symbols = []
        if result["total_symbols"] > 0:
            collection = db_manager.get_collection("symbols")
            sample_cursor = collection.find({"is_active": True}).limit(5)
            async for doc in sample_cursor:
                sample_symbols.append({
                    "symbol": doc["symbol"],
                    "name": doc["name"],
                    "symbol_type": doc["symbol_type"],
                    "currency": doc["currency"],
                    "market": doc.get("market", ""),
                    "search_terms": doc.get("search_terms", [])[:3]  # Limit to first 3 terms
                })
        
        return {
            "success": True,
            "message": f"Symbols population completed. Updated: {result['updated_types']}, Skipped: {result['skipped_types']}",
            "stats": {
                "total_symbols": result["total_symbols"],
                "updated_types": result["updated_types"],
                "skipped_types": result["skipped_types"],
                "error_types": result["error_types"]
            },
            "details": result["details"],
            "sample_symbols": sample_symbols
        }

    except Exception as e:
        logger.error(f"Error populating symbols via API: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to populate symbols: {str(e)}")


class DefaultPortfolioRequest(BaseModel):
    portfolio_id: str


@app.get("/default-portfolio")
async def get_default_portfolio(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Get the default portfolio for the authenticated user.
    """
    try:
        collection = db_manager.get_collection("user_preferences")
        preferences = await collection.find_one({"user_id": user.id})
        
        if not preferences:
            return {"default_portfolio_id": None}
        
        return {
            "default_portfolio_id": preferences.get("default_portfolio_id")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/default-portfolio")
async def set_default_portfolio(request: DefaultPortfolioRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Set the default portfolio for the authenticated user.
    """
    try:
        # Validate that the portfolio exists and belongs to the user
        portfolios_collection = db_manager.get_collection("portfolios")
        portfolio_exists = await portfolios_collection.find_one({"_id": ObjectId(request.portfolio_id), "user_id": user.id})
        if not portfolio_exists:
            raise HTTPException(status_code=404, detail=f"Portfolio {request.portfolio_id} not found")
        
        # Update or create user preferences
        preferences_collection = db_manager.get_collection("user_preferences")
        
        # Try to update existing preferences
        result = await preferences_collection.update_one(
            {"user_id": user.id},
            {
                "$set": {
                    "default_portfolio_id": request.portfolio_id,
                    "updated_at": datetime.now()
                }
            },
            upsert=True
        )
        
        return {
            "message": "Default portfolio set successfully",
            "portfolio_id": request.portfolio_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# AI Financial Analyst Endpoints

class ChatMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    tagged_entities: Optional[list[dict[str, Any]]] = None


class ChatSessionResponse(BaseModel):
    session_id: str
    messages: list[dict[str, Any]]


@app.post("/portfolio/{portfolio_id}/analyze")
async def analyze_portfolio_ai(portfolio_id: str, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Perform comprehensive AI analysis of a portfolio.
    """
    try:
        # Check if AI service is available
        if not ai_analyst.is_available:
            raise HTTPException(
                status_code=503, 
                detail=f"AI analysis service is currently unavailable: {ai_analyst.error_message}"
            )
        
        # Get portfolio data
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        
        portfolio = Portfolio.from_dict(doc)
        calculator = get_or_create_calculator(portfolio_id, portfolio)
        
        # Analyze portfolio for AI
        portfolio_data = portfolio_analyzer.analyze_portfolio_for_ai(portfolio, calculator)
        
        # Perform AI analysis
        analysis_result = await ai_analyst.analyze_portfolio(portfolio_data)
        
        return {
            "portfolio_id": portfolio_id,
            "analysis": analysis_result["analysis"],
            "timestamp": analysis_result["timestamp"],
            "model_used": analysis_result["model_used"],
            "portfolio_summary": analysis_result["portfolio_summary"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI portfolio analysis: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@app.post("/chat")
async def chat_with_ai_analyst(request: ChatMessageRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Interactive chat with AI financial analyst about portfolios.
    """
    try:
        # Check if AI service is available
        if not ai_analyst.is_available:
            raise HTTPException(
                status_code=503, 
                detail=f"AI chat service is currently unavailable: {ai_analyst.error_message}"
            )
        
        # Get user's portfolios for context
        collection = db_manager.get_collection("portfolios")
        user_portfolios = []
        all_portfolio_data = {}
        
        async for doc in collection.find({"user_id": user.id}):
            portfolio = Portfolio.from_dict(doc)
            portfolio_id = str(doc["_id"])
            
            # Create portfolio data for AI analysis
            calculator = get_or_create_calculator(portfolio_id, portfolio)
            portfolio_data = portfolio_analyzer.analyze_portfolio_for_ai(portfolio, calculator)
            
            user_portfolios.append({
                "id": portfolio_id,
                "name": portfolio.portfolio_name,
                "data": portfolio_data
            })
            
            # Store portfolio data for tag validation
            all_portfolio_data[portfolio_id] = {
                "config": {"portfolio_name": portfolio.portfolio_name},
                "accounts": [{"name": acc.name} for acc in portfolio.accounts],
                "securities": portfolio.securities
            }
        
        if not user_portfolios:
            raise HTTPException(status_code=404, detail="No portfolios found for user")
        
        # Determine portfolio context from tagged entities or use default
        portfolio_context = None
        if request.tagged_entities:
            # Extract portfolio IDs from tagged entities
            portfolio_ids = set()
            for entity in request.tagged_entities:
                if entity.get('type') == 'portfolio':
                    portfolio_ids.add(entity['id'])
                elif entity.get('type') == 'account':
                    # Account tag: portfolio_id:account_name
                    portfolio_ids.add(entity['id'].split(':')[0])
            
            # Use tagged portfolios as context
            portfolio_context = [p for p in user_portfolios if p["id"] in portfolio_ids]
        
        # If no tagged portfolios, use default (first portfolio)
        if not portfolio_context:
            portfolio_context = [user_portfolios[0]]
        
        # Convert tagged entities to TaggedEntity objects for AI
        validated_tags = []
        if request.tagged_entities:
            for entity in request.tagged_entities:
                from core.tag_parser import TaggedEntity
                tag = TaggedEntity(
                    tag_type='@' if entity['type'] in ['portfolio', 'account'] else '$',
                    tag_value=entity['name'],
                    start_pos=0,  # Not needed for backend processing
                    end_pos=0,    # Not needed for backend processing
                    entity_id=entity['id'],
                    entity_name=entity['name']
                )
                validated_tags.append(tag)
        
        # Handle chat session (use first portfolio as session context)
        session_id = request.session_id
        conversation_history = []
        session_portfolio_id = portfolio_context[0]["id"]
        
        if session_id:
            # Get existing session
            session = await chat_manager.get_chat_session(session_id, user.id)
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found")
            
            # Get conversation history
            conversation_history = await chat_manager.get_session_messages(session_id, user.id)
        else:
            # Create new session
            session_id = await chat_manager.create_chat_session(user.id, session_portfolio_id)
        
        # Add user message to session
        await chat_manager.add_message_to_session(session_id, user.id, "user", request.message)
        
        # Get AI response with enhanced context from tags and multiple portfolios
        ai_response = await ai_analyst.chat_with_analyst_multi_portfolio(
            portfolio_context, 
            request.message, 
            conversation_history, 
            validated_tags
        )
        
        # Add AI response to session
        await chat_manager.add_message_to_session(session_id, user.id, "assistant", ai_response["response"])
        
        return {
            "session_id": session_id,
            "response": ai_response["response"],
            "timestamp": ai_response["timestamp"],
            "model_used": ai_response["model_used"],
            "question": ai_response["question"],
            "portfolio_context": [p["id"] for p in portfolio_context]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI chat: {e}")
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")


@app.get("/chat/sessions")
async def get_chat_sessions(user=Depends(get_current_user)) -> list[dict[str, Any]]:
    """
    Get all chat sessions for a user.
    """
    try:
        sessions = await chat_manager.get_user_chat_sessions(user.id)
        return sessions
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat sessions: {str(e)}")


@app.get("/chat/sessions/{session_id}")
async def get_chat_session_messages(session_id: str, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Get messages from a specific chat session.
    """
    try:
        session = await chat_manager.get_chat_session(session_id, user.id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        messages = await chat_manager.get_session_messages(session_id, user.id)
        
        return {
            "session_id": session_id,
            "portfolio_id": session.get("portfolio_id", "unknown"),
            "messages": messages,
            "created_at": session["created_at"],
            "last_activity": session["last_activity"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat session messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat session messages: {str(e)}")


@app.delete("/chat/sessions/{session_id}")
async def close_chat_session(session_id: str, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Close a chat session.
    """
    try:
        success = await chat_manager.close_chat_session(session_id, user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        return {"message": "Chat session closed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close chat session: {str(e)}")


@app.get("/chat/search")
async def search_chat_history(query: str = Query(..., description="Search query"), user=Depends(get_current_user)) -> list[dict[str, Any]]:
    """
    Search chat history for a user.
    """
    try:
        results = await chat_manager.search_chat_history(user.id, query)
        return results
    except Exception as e:
        logger.error(f"Error searching chat history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search chat history: {str(e)}")


@app.get("/chat/autocomplete")
async def get_chat_autocomplete(
    query: str = Query(..., description="Autocomplete query"), 
    tag_type: str = Query(..., description="Tag type (@ or $)"),
    user=Depends(get_current_user)
) -> list[dict[str, Any]]:
    """
    Get autocomplete suggestions for chat tags across all user portfolios.
    """
    try:
        if tag_type == '@':
            # Get all user portfolios and accounts for @ tags
            collection = db_manager.get_collection("portfolios")
            suggestions = []
            
            async for doc in collection.find({"user_id": user.id}):
                portfolio = Portfolio.from_dict(doc)
                portfolio_name = portfolio.portfolio_name
                portfolio_id = str(doc["_id"])
                
                # Add portfolio suggestion if it matches query
                if query.lower() in portfolio_name.lower():
                    suggestions.append({
                        "id": portfolio_id,
                        "name": portfolio_name,
                        "type": "portfolio",
                        "symbol": None
                    })
                
                # Add account suggestions if they match query
                for i, account in enumerate(portfolio.accounts):
                    account_name = account.name
                    if query.lower() in account_name.lower():
                        # Check if there are multiple accounts with same name
                        same_name_accounts = [acc for acc in portfolio.accounts if acc.name == account_name]
                        if len(same_name_accounts) > 1:
                            # Add indexed version
                            suggestions.append({
                                "id": f"{portfolio_id}:{account_name}[{i}]",
                                "name": f"{portfolio_name}({account_name}[{i}])",
                                "type": "account",
                                "symbol": None
                            })
                        else:
                            # Add simple version
                            suggestions.append({
                                "id": f"{portfolio_id}:{account_name}",
                                "name": f"{portfolio_name}({account_name})",
                                "type": "account",
                                "symbol": None
                            })
            
            return suggestions[:20]  # Limit to 20 suggestions
            
        elif tag_type == '$':
            # Get all symbols across all user portfolios for $ tags
            collection = db_manager.get_collection("portfolios")
            all_symbols = set()
            
            async for doc in collection.find({"user_id": user.id}):
                portfolio = Portfolio.from_dict(doc)
                for symbol in portfolio.securities.keys():
                    if query.upper() in symbol.upper():
                        all_symbols.add(symbol)
            
            suggestions = []
            for symbol in sorted(all_symbols):
                suggestions.append({
                    "id": symbol,
                    "name": symbol,
                    "type": "symbol",
                    "symbol": symbol
                })
            
            return suggestions[:20]  # Limit to 20 suggestions
        
        return []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat autocomplete: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get autocomplete suggestions: {str(e)}")


@app.get("/portfolio/{portfolio_id}/accounts/{account_name}/rsu-vesting")
async def get_rsu_vesting(
    portfolio_id: str,
    account_name: str,
    user=Depends(get_current_user)
):
    """
    Return RSU vesting progress and schedule for each RSU plan in the account.
    """
    from datetime import datetime, timedelta
    import math
    from services.closing_price.price_manager import PriceManager

    collection = db_manager.get_collection("portfolios")
    doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    account = next((a for a in doc.get("accounts", []) if a["name"] == account_name), None)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
    portfolio = Portfolio.from_dict(doc)
    calculator = get_or_create_calculator(portfolio_id, portfolio)

    rsu_plans = account.get("rsu_plans", [])
    now = datetime.now().date()
    results = []
    price_manager = PriceManager()
    for plan in rsu_plans:
        grant_date = datetime.strptime(plan["grant_date"], "%Y-%m-%d").date()
        if plan.get('left_company'):
            left_company_date = datetime.strptime(plan["left_company_date"], "%Y-%m-%d").date()
        cliff_months = plan.get("cliff_duration_months") if plan.get("has_cliff") else 0
        vesting_years = plan["vesting_period_years"]
        vesting_frequency = plan["vesting_frequency"]  # 'monthly', 'quarterly', 'annually'
        total_units = plan["units"]
        # Calculate periods in cliff correctly
        if vesting_frequency == "monthly":
            period_months = 1
        elif vesting_frequency == "quarterly":
            period_months = 3
        elif vesting_frequency == "annually":
            period_months = 12
        else:
            period_months = 1
        periods = vesting_years * (12 // period_months)
        delta = relativedelta(months=period_months)
        cliff_periods = cliff_months // period_months if period_months else 0
        # Calculate units per period
        units_per_period = total_units / periods
        vested_units = 0
        next_vest_date = None
        next_vest_units = 0
        schedule = []
        cliff_date = grant_date + relativedelta(months=cliff_months) if cliff_months else grant_date
        # Add cliff lump sum if applicable
        periods_vested = 0
        for i in range(periods):
            vest_date = grant_date + delta * i
            if vest_date < cliff_date:
                continue  # skip periods before cliff
            if cliff_months and vest_date == cliff_date:
                # Lump sum for all periods in cliff
                cliff_units = units_per_period * cliff_periods
                schedule.append({"date": vest_date.isoformat(), "units": cliff_units})
                if vest_date <= now:
                    vested_units += cliff_units
                elif not next_vest_date:
                    next_vest_date = vest_date
                    next_vest_units = cliff_units
                periods_vested = cliff_periods
                break
        # Continue with regular vesting after cliff
        for i in range(periods_vested + 1, periods):
            vest_date = cliff_date + delta * (i - periods_vested)
            if plan.get('left_company') and vest_date > left_company_date:
                total_units = vested_units
                break
            schedule.append({"date": vest_date.isoformat(), "units": units_per_period})
            if vest_date <= now:
                vested_units += units_per_period
            elif not next_vest_date:
                next_vest_date = vest_date
                next_vest_units = units_per_period
        # Clamp vested units to total
        vested_units = min(vested_units, total_units)
        # Fetch current price for the symbol
        symbol = plan["symbol"]
        price_data = closing_price_service.get_price_sync(symbol)
        price = price_data.get('price',  0.0)
        price_currency = price_data.get('currency')
        total_value = round(total_units * price, 2)
        vested_value = round(vested_units * price, 2)
        unvested_value = round((total_units - vested_units) * price, 2)
        exchange_value = calculator.get_exchange_rate(price_data['currency'], portfolio.base_currency.value)
        results.append({
            "id": plan["id"],
            "symbol": symbol,
            "total_units": total_units,
            "vested_units": round(vested_units, 2),
            "next_vest_date": next_vest_date.isoformat() if next_vest_date else None,
            "next_vest_units": round(next_vest_units, 2) if next_vest_units else 0,
            "schedule": schedule,
            "grant_date": plan["grant_date"],
            "cliff_months": cliff_months,
            "vesting_period_years": vesting_years,
            "vesting_frequency": vesting_frequency,
            "price": price,
            "price_currency": price_currency,
            "total_value": total_value * exchange_value,
            "vested_value": vested_value * exchange_value,
            "unvested_value": unvested_value * exchange_value
        })

    # --- Update holdings in DB with vested units ---
    # Build a dict: symbol -> vested_units (rounded up)
    symbol_to_vested = {}
    for plan_result in results:
        symbol = plan_result["symbol"]
        vested = plan_result["vested_units"]
        symbol_to_vested[symbol] = symbol_to_vested.get(symbol, 0) + math.ceil(vested)
    # Update the holdings array for the account
    new_holdings = [
        {"symbol": symbol, "units": units}
        for symbol, units in symbol_to_vested.items()
    ]
    # Update the account in the doc
    updated = False
    for acc in doc["accounts"]:
        if acc["name"] == account_name:
            acc["holdings"] = new_holdings
            updated = True
            break
    if updated:
        await collection.replace_one({"_id": doc["_id"]}, doc)
        invalidate_portfolio_cache(portfolio_id)
    # --- End update holdings ---
    return {"plans": results}


@app.post("/portfolio/{portfolio_id}/accounts/{account_name}/options-exercise")
async def exercise_options(
    portfolio_id: str,
    account_name: str,
    request: dict,
    user=Depends(get_current_user)
):
    """
    Exercise options and create an exercise plan.
    """
    from core.options_exercise import OptionsExercise

    collection = db_manager.get_collection("portfolios")
    doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    account = next((a for a in doc.get("accounts", []) if a["name"] == account_name), None)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")

    # Extract request parameters
    plan_id = request.get("plan_id")
    units_to_exercise = request.get("units_to_exercise")
    exercise_date = request.get("exercise_date", datetime.now().strftime("%Y-%m-%d"))
    current_valuation = request.get("current_valuation")

    if not plan_id or not units_to_exercise:
        raise HTTPException(status_code=400, detail="plan_id and units_to_exercise are required")

    # Find the options plan
    options_plans = account.get("options_plans", [])
    plan = next((p for p in options_plans if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Options plan {plan_id} not found")

    try:
        # Create exercise plan
        exercise_plan = OptionsExercise.create_exercise_plan(
            options_plan=plan,
            units_to_exercise=units_to_exercise,
            exercise_date=exercise_date,
            current_valuation=current_valuation
        )

        # Update the options plan to reflect the exercise
        plan["units"] = exercise_plan["remaining_units"]

        # Add exercise history to the plan
        if "exercise_history" not in plan:
            plan["exercise_history"] = []

        plan["exercise_history"].append({
            "exercise_date": exercise_date,
            "units_exercised": units_to_exercise,
            "exercise_cost": exercise_plan["total_cash_outlay"],
            "net_value": exercise_plan["net_after_tax_value"]
        })

        # Update the database
        await collection.replace_one({"_id": doc["_id"]}, doc)
        invalidate_portfolio_cache(portfolio_id)

        return {
            "message": "Options exercised successfully",
            "exercise_plan": exercise_plan
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error exercising options: {e}")
        raise HTTPException(status_code=500, detail="Failed to exercise options")


@app.get("/portfolio/{portfolio_id}/accounts/{account_name}/options-vesting")
async def get_options_vesting(
    portfolio_id: str,
    account_name: str,
    user=Depends(get_current_user)
):
    """
    Return options vesting progress and schedule for each options plan in the account.
    """
    from datetime import datetime, timedelta
    import math
    from core.options_calculator import OptionsCalculator

    collection = db_manager.get_collection("portfolios")
    doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    account = next((a for a in doc.get("accounts", []) if a["name"] == account_name), None)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
    portfolio = Portfolio.from_dict(doc)
    calculator = get_or_create_calculator(portfolio_id, portfolio)

    options_plans = account.get("options_plans", [])
    now = datetime.now().date()
    results = []

    for plan in options_plans:
        # Calculate vesting schedule
        vesting_calc = OptionsCalculator.calculate_vesting_schedule(
            grant_date=plan["grant_date"],
            total_units=plan["units"],
            vesting_period_years=plan["vesting_period_years"],
            vesting_frequency=plan["vesting_frequency"],
            has_cliff=plan.get("has_cliff", False),
            cliff_months=plan.get("cliff_duration_months", 0) if plan.get("has_cliff") else 0,
            left_company=plan.get("left_company", False),
            left_company_date=plan.get("left_company_date")
        )

        # Calculate options value
        value_calc = OptionsCalculator.calculate_options_value(
            vested_units=vesting_calc["vested_units"],
            exercise_price=plan["exercise_price"],
            strike_price=plan["strike_price"],
            company_valuation=plan.get("company_valuation"),
            option_type=plan.get("option_type", "iso")
        )

        # Calculate time to expiry
        expiration_date = datetime.strptime(plan["expiration_date"], "%Y-%m-%d").date()
        time_to_expiry = (expiration_date - now).days / 365.25

        # Calculate exchange rate for value conversion
        exchange_value = 1.0  # Default to 1 if no conversion needed
        if value_calc["current_valuation_per_share"] > 0:
            # For private companies, we might need to convert from USD to base currency
            # This is simplified - in reality you'd have proper currency conversion
            exchange_value = calculator.get_exchange_rate("USD", portfolio.base_currency.value)

        results.append({
            "id": plan["id"],
            "symbol": plan["symbol"],
            "total_units": plan["units"],
            "vested_units": vesting_calc["vested_units"],
            "next_vest_date": vesting_calc["next_vest_date"],
            "next_vest_units": vesting_calc["next_vest_units"],
            "schedule": vesting_calc["schedule"],
            "grant_date": plan["grant_date"],
            "expiration_date": plan["expiration_date"],
            "exercise_price": plan["exercise_price"],
            "strike_price": plan["strike_price"],
            "option_type": plan.get("option_type", "iso"),
            "company_valuation": plan.get("company_valuation"),
            "cliff_months": vesting_calc["cliff_months"],
            "vesting_period_years": vesting_calc["vesting_period_years"],
            "vesting_frequency": vesting_calc["vesting_frequency"],
            "time_to_expiry_years": round(time_to_expiry, 2),
            "current_valuation_per_share": value_calc["current_valuation_per_share"],
            "intrinsic_value_per_share": value_calc["intrinsic_value_per_share"],
            "total_intrinsic_value": value_calc["total_intrinsic_value"] * exchange_value,
            "time_value_per_share": value_calc["time_value_per_share"],
            "total_time_value": value_calc["total_time_value"] * exchange_value,
            "total_value": value_calc["total_value"] * exchange_value
        })

    # --- Update holdings in DB with vested units ---
    # Build a dict: symbol -> vested_units (rounded up)
    symbol_to_vested = {}
    for plan_result in results:
        symbol = plan_result["symbol"]
        vested = plan_result["vested_units"]
        symbol_to_vested[symbol] = symbol_to_vested.get(symbol, 0) + math.ceil(vested)

    # Update the holdings array for the account
    new_holdings = [
        {"symbol": symbol, "units": units}
        for symbol, units in symbol_to_vested.items()
    ]

    # Update the account in the doc
    updated = False
    for acc in doc["accounts"]:
        if acc["name"] == account_name:
            acc["holdings"] = new_holdings
            updated = True
            break
    if updated:
        await collection.replace_one({"_id": doc["_id"]}, doc)
        invalidate_portfolio_cache(portfolio_id)
    # --- End update holdings ---

    return {"plans": results}


# =============================================================================
# TAG MANAGEMENT API ENDPOINTS
# =============================================================================

async def get_tag_service() -> TagService:
    """Dependency to get tag service"""
    if db_manager.database is None:
        await db_manager.connect()
    return TagService(db_manager.database)

# Tag Library Management
@app.get("/tags/library")
async def get_user_tag_library(
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get user's tag library with all tag definitions"""
    user_id = current_user.firebase_uid
    library = await tag_service.get_user_tag_library(user_id)
    return library.dict()

@app.post("/tags/definitions")
async def create_tag_definition(
    tag_definition: TagDefinition,
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Create or update a tag definition"""
    user_id = current_user.firebase_uid
    result = await tag_service.add_tag_definition(user_id, tag_definition)
    return result.dict()

@app.delete("/tags/definitions/{tag_name}")
async def delete_tag_definition(
    tag_name: str,
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Delete a tag definition and all associated values"""
    user_id = current_user.firebase_uid
    success = await tag_service.delete_tag_definition(user_id, tag_name)
    if not success:
        raise HTTPException(status_code=404, detail="Tag definition not found")
    return {"message": f"Tag definition '{tag_name}' deleted successfully"}

@app.post("/tags/adopt-template/{template_name}")
async def adopt_template_tag(
    template_name: str,
    custom_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Adopt a template tag as a custom tag definition"""
    user_id = current_user.firebase_uid
    try:
        result = await tag_service.adopt_template_tag(user_id, template_name, custom_name)
        return result.dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Holding Tags Management
@app.get("/holdings/{symbol}/tags")
async def get_holding_tags(
    symbol: str,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get all tags for a specific holding"""
    user_id = current_user.firebase_uid
    holding_tags = await tag_service.get_holding_tags(user_id, symbol, portfolio_id)
    return holding_tags.dict()

@app.put("/holdings/{symbol}/tags/{tag_name}")
async def set_holding_tag(
    symbol: str,
    tag_name: str,
    tag_value: TagValue,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Set a tag value for a holding"""
    user_id = current_user.firebase_uid
    try:
        result = await tag_service.set_holding_tag(user_id, symbol, tag_name, tag_value, portfolio_id)
        return result.dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/holdings/{symbol}/tags/{tag_name}")
async def remove_holding_tag(
    symbol: str,
    tag_name: str,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Remove a tag from a holding"""
    user_id = current_user.firebase_uid
    success = await tag_service.remove_holding_tag(user_id, symbol, tag_name, portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found for this holding")
    return {"message": f"Tag '{tag_name}' removed from {symbol}"}

@app.get("/holdings/tags")
async def get_all_holding_tags(
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get tags for all holdings"""
    user_id = current_user.firebase_uid
    all_tags = await tag_service.get_all_holding_tags(user_id, portfolio_id)
    return [tags.dict() for tags in all_tags]

# Tag Search and Aggregation
@app.get("/holdings/search")
async def search_holdings_by_tags(
    tag_filters: str = Query(..., description="JSON string of tag filters"),
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Search holdings by tag criteria"""
    import json
    user_id = current_user.firebase_uid

    try:
        filters = json.loads(tag_filters)
        symbols = await tag_service.search_holdings_by_tags(user_id, filters, portfolio_id)
        return {"symbols": symbols, "filters_used": filters}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in tag_filters parameter")

@app.get("/tags/{tag_name}/aggregation")
async def get_tag_aggregation(
    tag_name: str,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get aggregation data for a specific tag across all holdings"""
    user_id = current_user.firebase_uid
    aggregation = await tag_service.get_tag_aggregations(user_id, tag_name, portfolio_id)
    return aggregation

# Template Tags
@app.get("/tags/templates")
async def get_template_tags():
    """Get all available template tags"""
    return {
        "templates": {name: template.dict() for name, template in DEFAULT_TAG_TEMPLATES.items()}
    }

