import logging
import math
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Any, Optional, List

from fastapi import FastAPI, Query, Depends, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import yaml

from core import feature_generator
from core.database import db_manager
from models import User, Product, UserPreferences, Symbol
from models.portfolio import Portfolio
from models.security_type import SecurityType
from portfolio_calculator import PortfolioCalculator
from utils import filter_security
from services.closing_price.service import get_global_service
from services.closing_price.price_manager import PriceManager
from services.closing_price.stock_fetcher import fetch_quotes
from core.auth import get_current_user
from core.firebase import FirebaseAuthMiddleware

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
        new_account = {
            "name": request.account_name,
            "user_id": user.id,
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
async def root(user=Depends(get_current_user)):
    """Root endpoint with service information"""
    return {
        "service": "Portfolio API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "user": user.email
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
    """Return the US market open/closed status."""
    manager = PriceManager()
    return await manager.get_us_market_status()


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
    user_name: str
    portfolio_id: str


@app.get("/user/{user_name}/default-portfolio")
async def get_default_portfolio(user_name: str, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Get the default portfolio for a specific user.
    """
    try:
        collection = db_manager.get_collection("user_preferences")
        preferences = await collection.find_one({"user_name": user_name, "user_id": user.id})
        
        if not preferences:
            return {"user_name": user_name, "default_portfolio_id": None}
        
        return {
            "user_name": user_name,
            "default_portfolio_id": preferences.get("default_portfolio_id")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user/{user_name}/default-portfolio")
async def set_default_portfolio(user_name: str, request: DefaultPortfolioRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Set the default portfolio for a specific user.
    """
    try:
        # Validate that the portfolio exists
        portfolios_collection = db_manager.get_collection("portfolios")
        portfolio_exists = await portfolios_collection.find_one({"_id": ObjectId(request.portfolio_id)})
        if not portfolio_exists:
            raise HTTPException(status_code=404, detail=f"Portfolio {request.portfolio_id} not found")
        
        # Update or create user preferences
        preferences_collection = db_manager.get_collection("user_preferences")
        
        # Try to update existing preferences
        result = await preferences_collection.update_one(
            {"user_name": user_name, "user_id": user.id},
            {
                "$set": {
                    "default_portfolio_id": request.portfolio_id,
                    "updated_at": datetime.now()
                }
            },
            upsert=True
        )
        
        return {
            "message": f"Default portfolio set successfully for user {user_name}",
            "portfolio_id": request.portfolio_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

