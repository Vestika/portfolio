import logging
import math
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import FastAPI, Query, Depends, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import yaml

from core import feature_generator
from core.database import db_manager
from models import User, Product
from models.portfolio import Portfolio
from models.security_type import SecurityType
from portfolio_calculator import PortfolioCalculator
from utils import filter_security
from services.closing_price.service import get_global_service
from services.closing_price.price_manager import PriceManager
from services.closing_price.stock_fetcher import fetch_quotes

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

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    try:
        logger.info("Starting up Portfolio API...")
        # Initialize the closing price service
        await closing_price_service.initialize()
        await db_manager.connect("vestika")

        logger.info("Portfolio API startup completed successfully")

        models_to_register = [User, Product]

        for model_class in models_to_register:
            router = feature_generator.register_feature(model_class)
            app.include_router(router, prefix="/api/v1")

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
async def list_portfolios() -> list[dict[str, str]]:
    """
    Returns a list of all portfolios in the database.
    """
    collection = db_manager.get_collection("portfolios")
    portfolios_cursor = collection.find({}, {"_id": 1, "portfolio_name": 1})
    portfolios = []
    async for doc in portfolios_cursor:
        portfolios.append({
            "portfolio_id": str(doc["_id"]),
            "portfolio_name": doc["portfolio_name"],
            "display_name": doc["portfolio_name"].title()
        })
    return portfolios



@app.get("/portfolio")
async def get_portfolio_metadata(portfolio_id: str = "demo") -> dict[str, Any]:
    """
    Endpoint to return portfolio metadata, config and account data from MongoDB by portfolio_id.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
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
    request: BreakdownRequest = Depends(BreakdownRequest), portfolio_id: str = "demo"
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
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
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
    request: BreakdownRequest = Depends(BreakdownRequest), portfolio_id: str = "demo"
) -> dict[str, Any]:
    """
    Endpoint to return detailed holdings information for the selected accounts.
    Returns aggregated holdings with security details and historical prices.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        portfolio = Portfolio.from_dict(doc)
        calculator = get_or_create_calculator(portfolio_id, portfolio)

        # Create a dictionary to aggregate holdings across selected accounts
        holdings_aggregation: dict[str, dict] = {}

        for account in portfolio.accounts:
            if request.account_names and account.name not in request.account_names:
                continue

            for holding in account.holdings:
                security = portfolio.securities[holding.symbol]

                if holding.symbol not in holdings_aggregation:
                    # Get detailed pricing information
                    pricing_info = calculator.calc_holding_value(security, 1)
                    
                    # Calculate original price (before currency conversion)
                    original_price = pricing_info["unit_price"]
                    
                    holdings_aggregation[holding.symbol] = {
                        "symbol": holding.symbol,
                        "security_type": security.security_type.value,
                        "name": security.name,
                        "tags": security.tags,
                        "total_units": 0,
                        "original_price": original_price,  # Price in original currency
                        "original_currency": security.currency,  # Original currency
                        "value_per_unit": pricing_info["value"],  # Converted to base currency
                        "currency": portfolio.base_currency,  # Base currency for display compatibility
                        "price_source": pricing_info["price_source"],  # real-time or predefined
                        # Generate mock historical prices for the last 30 days (in original currency)
                        "historical_prices": [
                            {
                                "date": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d"),
                                "price": original_price * (1 + 0.1 * math.sin(i / 5)),  # Generate sine wave pattern
                            }
                            for i in range(30)
                        ],
                    }

                holdings_aggregation[holding.symbol]["total_units"] += holding.units

        # Calculate total values and convert to list
        holdings = []
        for holding_data in holdings_aggregation.values():
            holding_data["total_value"] = holding_data["value_per_unit"] * holding_data["total_units"]
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


@app.post("/portfolio/create")
async def create_portfolio(request: CreatePortfolioRequest) -> dict[str, str]:
    """
    Create a new portfolio document in MongoDB with basic structure.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        existing = await collection.find_one({"portfolio_name": request.portfolio_name})
        if existing:
            raise HTTPException(status_code=409, detail=f"Portfolio '{request.portfolio_name}' already exists")
        portfolio_data = {
            "portfolio_name": request.portfolio_name,
            "config": {
                "user_name": request.portfolio_name,
                "base_currency": request.base_currency,
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
        await collection.insert_one(portfolio_data)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(request.portfolio_name)

        return {"message": f"Portfolio '{request.portfolio_name}' created successfully", "portfolio_id": request.portfolio_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/portfolio/{portfolio_id}/accounts")
async def add_account_to_portfolio(portfolio_id: str, request: CreateAccountRequest) -> dict[str, str]:
    """
    Add a new account to an existing portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
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
        new_account = {
            "name": request.account_name,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings
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
async def delete_portfolio(portfolio_id: str) -> dict[str, str]:
    """
    Delete an entire portfolio document from MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        count = await collection.count_documents({})
        if count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining portfolio")
        result = await collection.delete_one({"_id": ObjectId(portfolio_id)})
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
async def delete_account_from_portfolio(portfolio_id: str, account_name: str) -> dict[str, str]:
    """
    Delete a specific account from a portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
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
async def update_account_in_portfolio(portfolio_id: str, account_name: str, request: CreateAccountRequest) -> dict[str, str]:
    """
    Update an existing account in a portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
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
        updated_account = {
            "name": request.account_name,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings
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
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Portfolio API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs"
    }


def invalidate_portfolio_cache(portfolio_id: str):
    """Invalidate calculator cache for a given portfolio_id"""
    # Clear calculator cache entries for this portfolio_id
    keys_to_remove = [key for key in calculator_cache.keys() if key.startswith(f"{portfolio_id}:")]
    for key in keys_to_remove:
        del calculator_cache[key]
        logger.info(f"Invalidated calculator cache for key {key}")


@app.get("/portfolio/raw")
async def download_portfolio_raw(portfolio_id: str):
    """
    Download the raw portfolio document as YAML.
    """
    collection = db_manager.get_collection("portfolios")
    doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    doc["_id"] = str(doc["_id"])
    yaml_str = yaml.dump(doc, allow_unicode=True)
    return Response(content=yaml_str, media_type="application/x-yaml")

@app.post("/portfolio/upload")
async def upload_portfolio(file: UploadFile = File(...)):
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
        result = await collection.insert_one(portfolio_yaml)
        return {"portfolio_id": str(result.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/market-status")
async def get_market_status():
    """Return the US market open/closed status."""
    manager = PriceManager()
    return await manager.get_us_market_status()


@app.get("/quotes")
async def get_quotes(symbols: str = Query(..., description="Comma-separated list of symbols")):
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    return await fetch_quotes(symbol_list)

