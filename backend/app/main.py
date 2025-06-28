import logging
import math
import glob
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yaml

from models.portfolio import Portfolio
from models.security_type import SecurityType
from portfolio_calculator import PortfolioCalculator
from utils import filter_security, filter_account
from services.closing_price.service import get_global_service

logger = logging.Logger(__name__)

# Get the playground directory path
PLAYGROUND_DIR = Path(__file__).parent.parent  # Go up from app/ to playground/

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
    allow_origins=["http://localhost:5173"],  # Vite default port
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


portfolios = {}

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


def resolve_yaml_path(filename: str) -> Path:
    """Resolve YAML file path relative to playground directory"""
    return PLAYGROUND_DIR / filename


def create_calculator(portfolio: Portfolio) -> PortfolioCalculator:
    """Create a PortfolioCalculator with the global closing price service"""
    return PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
        closing_price_service=closing_price_service,
        use_real_time_rates=True,  # Enable real-time exchange rates
    )


def display_aggregation(title: str, aggregation_data: dict[str, Any]) -> None:
    aggregation_data = calculator.get_aggregation_dict(aggregation_data)

    print()
    print(f"{title}:")
    print("-" * 40)
    print(f"Total Value: {aggregation_data['total']:,.0f} {aggregation_data['base_currency']}")
    print("-" * 40)

    for item in aggregation_data["breakdown"]:
        print(
            f"{item['label'].upper():<15}: "
            f"{item['value']:>10,.0f} {aggregation_data['base_currency']} "
            f"({item['percentage']:>6.2f}%)"
        )


# Initialize demo portfolio on startup
portfolios["demo.yaml"] = Portfolio.from_yaml(resolve_yaml_path("demo.yaml"))
portfolio = portfolios["demo.yaml"]

calculator = create_calculator(portfolio)


@app.get("/portfolio/files")
async def get_available_files() -> list[dict[str, str]]:
    """
    Returns a list of available YAML files in the playground directory.
    """
    yaml_files = glob.glob(str(PLAYGROUND_DIR / "*.yaml"))
    return [{"filename": Path(file).name, "display_name": Path(file).stem.title()} for file in yaml_files]


@app.get("/portfolio")
async def get_portfolio_metadata(file: str = "demo.yaml") -> dict[str, Any]:
    """
    Endpoint to return portfolio metadata, config and account data with the following structure:
    {
        "base_currency": "ILS",
        "user_name": "Michael",
        "accounts": [
            {
                "account_name": "OneZero Account",
                "account_total": 10333,
                "account_properties": {
                    # content of this dictionary is dynamic and based on .yaml data
                    # it can be empty if not properties are defined.
                    "owners": ["me", "wife"],
                    "type": "investment-account"
                    ...
                },
                "account_cash": {
                    "ILS": 333,
                    "USD": 222
                }
            }
        ]
    }
    """
    try:
        if file not in portfolios:
            portfolios[file] = Portfolio.from_yaml(resolve_yaml_path(file))
        portfolio = portfolios[file]
        calculator = create_calculator(portfolio)

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
                # Add missing fields needed for editing
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
            
            # Calculate cash holdings
            for holding in account.holdings:
                if portfolio.securities[holding.symbol].security_type == SecurityType.CASH:
                    account_data["account_cash"][holding.symbol] = holding.units
            
            result["accounts"].append(account_data)

        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
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
    request: BreakdownRequest = Depends(BreakdownRequest), file: str = "demo.yaml"
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
        if file not in portfolios:
            portfolios[file] = Portfolio.from_yaml(resolve_yaml_path(file))
        portfolio = portfolios[file]
        calculator = create_calculator(portfolio)

        result = []
        for chart_config in CHARTS:
            aggregation_data = calculator.aggregate_holdings(
                portfolio=portfolio,
                aggregation_key=chart_config.get("aggregation_key"),
                account_filter=filter_account.by_names(request.account_names),
                security_filter=chart_config.get("security_filter"),
                ignore_missing_key=bool(chart_config.get("ignore_missing_key")),
            )
            aggregation_dict = calculator.get_aggregation_dict(aggregation_data)

            result.append(
                {
                    "chart_title": chart_config["title"],
                    "chart_total": aggregation_dict["total"],
                    "chart_data": aggregation_dict["breakdown"],
                },
            )
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/portfolio/holdings")
async def get_holdings_table(
    request: BreakdownRequest = Depends(BreakdownRequest), file: str = "demo.yaml"
) -> dict[str, Any]:
    """
    Endpoint to return detailed holdings information for the selected accounts.
    Returns aggregated holdings with security details and historical prices.
    """
    try:
        if file not in portfolios:
            portfolios[file] = Portfolio.from_yaml(resolve_yaml_path(file))
        portfolio = portfolios[file]
        calculator = create_calculator(portfolio)

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

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
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
    Create a new portfolio YAML file with basic structure.
    """
    try:
        # Sanitize the portfolio name to create a safe filename
        safe_name = request.portfolio_name.lower().replace(' ', '-').replace('_', '-')
        filename = f"{safe_name}.yaml"
        
        file_path = resolve_yaml_path(filename)
        if file_path.exists():
            raise HTTPException(status_code=409, detail=f"Portfolio '{request.portfolio_name}' already exists")
        
        # Create basic portfolio structure
        portfolio_data = {
            "config": {
                "user_name": request.portfolio_name,
                "base_currency": request.base_currency,
                "exchange_rates": {
                    "USD": 3.56,
                    "EUR": 3.95
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
        
        # Write the file
        with open(file_path, 'w') as f:
            yaml.dump(portfolio_data, f, default_flow_style=False, sort_keys=False)
        
        # Clear portfolios cache to force reload
        if filename in portfolios:
            del portfolios[filename]
            
        return {"message": f"Portfolio '{request.portfolio_name}' created successfully", "filename": filename}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/portfolio/{file}/accounts")
async def add_account_to_portfolio(file: str, request: CreateAccountRequest) -> dict[str, str]:
    """
    Add a new account to an existing portfolio file.
    """
    try:
        file_path = resolve_yaml_path(file)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Portfolio file {file} not found")
        
        # Load existing portfolio data
        with open(file_path, 'r') as f:
            portfolio_data = yaml.safe_load(f)
        
        # Check if account already exists
        existing_accounts = [acc['name'] for acc in portfolio_data.get('accounts', [])]
        if request.account_name in existing_accounts:
            raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
        
        # Auto-create securities for new symbols
        if 'securities' not in portfolio_data:
            portfolio_data['securities'] = {}
        
        for holding in request.holdings:
            symbol = holding.get('symbol')
            if symbol and symbol not in portfolio_data['securities']:
                # Create a basic security entry
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': 'stock',  # Default type
                    'currency': 'USD'  # Default currency
                }
                
                # Add to unit_prices with default value
                if 'config' not in portfolio_data:
                    portfolio_data['config'] = {}
                if 'unit_prices' not in portfolio_data['config']:
                    portfolio_data['config']['unit_prices'] = {}
        
        # Add new account
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
        
        # Write back to file
        with open(file_path, 'w') as f:
            yaml.dump(portfolio_data, f, default_flow_style=False, sort_keys=False)
        
        # Clear portfolios cache to force reload
        if file in portfolios:
            del portfolios[file]
            
        return {"message": f"Account '{request.account_name}' added to {file} successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/portfolio/{file}")
async def delete_portfolio(file: str) -> dict[str, str]:
    """
    Delete an entire portfolio YAML file.
    """
    try:
        file_path = resolve_yaml_path(file)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Portfolio file {file} not found")
        
        # Check if this is the only portfolio file
        yaml_files = glob.glob(str(PLAYGROUND_DIR / "*.yaml"))
        if len(yaml_files) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining portfolio")
        
        # Delete the file
        file_path.unlink()
        
        # Clear from portfolios cache
        if file in portfolios:
            del portfolios[file]
            
        return {"message": f"Portfolio {file} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/portfolio/{file}/accounts/{account_name}")
async def delete_account_from_portfolio(file: str, account_name: str) -> dict[str, str]:
    """
    Delete a specific account from a portfolio file.
    """
    try:
        file_path = resolve_yaml_path(file)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Portfolio file {file} not found")
        
        # Load existing portfolio data
        with open(file_path, 'r') as f:
            portfolio_data = yaml.safe_load(f)
        
        # Check if account exists
        accounts = portfolio_data.get('accounts', [])
        account_names = [acc['name'] for acc in accounts]
        
        if account_name not in account_names:
            raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
        
        # Check if this is the last account
        if len(accounts) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining account")
        
        # Remove the account
        portfolio_data['accounts'] = [acc for acc in accounts if acc['name'] != account_name]
        
        # Write back to file
        with open(file_path, 'w') as f:
            yaml.dump(portfolio_data, f, default_flow_style=False, sort_keys=False)
        
        # Clear portfolios cache to force reload
        if file in portfolios:
            del portfolios[file]
            
        return {"message": f"Account '{account_name}' deleted from {file} successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/portfolio/{file}/accounts/{account_name}")
async def update_account_in_portfolio(file: str, account_name: str, request: CreateAccountRequest) -> dict[str, str]:
    """
    Update an existing account in a portfolio file.
    """
    try:
        file_path = resolve_yaml_path(file)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Portfolio file {file} not found")
        
        # Load existing portfolio data
        with open(file_path, 'r') as f:
            portfolio_data = yaml.safe_load(f)
        
        # Check if account exists
        accounts = portfolio_data.get('accounts', [])
        account_index = None
        for i, acc in enumerate(accounts):
            if acc['name'] == account_name:
                account_index = i
                break
        
        if account_index is None:
            raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
        
        # Check if new account name conflicts with existing accounts (unless it's the same account)
        if request.account_name != account_name:
            existing_accounts = [acc['name'] for acc in accounts]
            if request.account_name in existing_accounts:
                raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
        
        # Auto-create securities for new symbols
        if 'securities' not in portfolio_data:
            portfolio_data['securities'] = {}
        
        for holding in request.holdings:
            symbol = holding.get('symbol')
            if symbol and symbol not in portfolio_data['securities']:
                # Create a basic security entry
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': 'stock',  # Default type
                    'currency': 'USD'  # Default currency
                }
                
                # Add to unit_prices with default value
                if 'config' not in portfolio_data:
                    portfolio_data['config'] = {}
                if 'unit_prices' not in portfolio_data['config']:
                    portfolio_data['config']['unit_prices'] = {}
        
        # Update the account
        updated_account = {
            "name": request.account_name,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings
        }
        
        accounts[account_index] = updated_account
        
        # Write back to file
        with open(file_path, 'w') as f:
            yaml.dump(portfolio_data, f, default_flow_style=False, sort_keys=False)
        
        # Clear portfolios cache to force reload
        if file in portfolios:
            del portfolios[file]
            
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