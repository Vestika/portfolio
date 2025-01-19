import logging
import math
import threading
import webbrowser
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
import glob
from pathlib import Path
from fastapi import HTTPException
from playground.models.portfolio import Portfolio
from playground.models.security_type import SecurityType
from playground.portfolio_calculator import PortfolioCalculator
from playground.utils import filter_security, filter_account

logger = logging.Logger(__name__)

fast_api_app = FastAPI()
fast_api_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

portfolios = {}


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


portfolios["demo.yaml"] = Portfolio.from_yaml(Path("demo.yaml"))
portfolio = portfolios["demo.yaml"]

calculator = PortfolioCalculator(
    base_currency=portfolio.base_currency,
    exchange_rates=portfolio.exchange_rates,
    unit_prices=portfolio.unit_prices,
)

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


@fast_api_app.get("/portfolio/files")
async def get_available_files() -> list[dict[str, str]]:
    """
    Returns a list of available YAML files in the directory.
    """
    yaml_files = glob.glob("*.yaml")
    return [{"filename": file, "display_name": Path(file).stem.title()} for file in yaml_files]


@fast_api_app.get("/portfolio")
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
            portfolios[file] = Portfolio.from_yaml(Path(file))
        portfolio = portfolios[file]
        calculator = PortfolioCalculator(
            base_currency=portfolio.base_currency,
            exchange_rates=portfolio.exchange_rates,
            unit_prices=portfolio.unit_prices,
        )

        result = {
            "base_currency": portfolio.base_currency,
            "user_name": portfolio.user_name,
            "accounts": [],
        }
        for account in portfolio.accounts:
            result["accounts"].append(
                {
                    "account_name": account.name,
                    "account_total": sum(
                        calculator.calc_holding_value(portfolio.securities[holding.symbol], holding.units)["value"]
                        for holding in account.holdings
                    ),
                    "account_properties": account.properties,
                    "account_cash": {},
                }
            )
            for holding in account.holdings:
                if portfolio.securities[holding.symbol].security_type == SecurityType.CASH:
                    result["accounts"][-1]["account_cash"][holding.symbol] = holding.units

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


@fast_api_app.get("/portfolio/breakdown")
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
            portfolios[file] = Portfolio.from_yaml(Path(file))
        portfolio = portfolios[file]
        calculator = PortfolioCalculator(
            base_currency=portfolio.base_currency,
            exchange_rates=portfolio.exchange_rates,
            unit_prices=portfolio.unit_prices,
        )

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


@fast_api_app.get("/portfolio/holdings")
async def get_holdings_table(
    request: BreakdownRequest = Depends(BreakdownRequest), file: str = "demo.yaml"
) -> dict[str, Any]:
    """
    Endpoint to return detailed holdings information for the selected accounts.
    Returns aggregated holdings with security details and historical prices.
    """
    try:
        if file not in portfolios:
            portfolios[file] = Portfolio.from_yaml(Path(file))
        portfolio = portfolios[file]
        calculator = PortfolioCalculator(
            base_currency=portfolio.base_currency,
            exchange_rates=portfolio.exchange_rates,
            unit_prices=portfolio.unit_prices,
        )

        # Create a dictionary to aggregate holdings across selected accounts
        holdings_aggregation: dict[str, dict] = {}

        for account in portfolio.accounts:
            if request.account_names and account.name not in request.account_names:
                continue

            for holding in account.holdings:
                security = portfolio.securities[holding.symbol]

                if holding.symbol not in holdings_aggregation:
                    holdings_aggregation[holding.symbol] = {
                        "symbol": holding.symbol,
                        "security_type": security.security_type.value,
                        "name": security.name,
                        "tags": security.tags,
                        "total_units": 0,
                        "value_per_unit": calculator.calc_holding_value(security, 1)["value"],
                        "currency": security.currency,
                        # Generate mock historical prices for the last 30 days
                        "historical_prices": [
                            {
                                "date": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d"),
                                "price": calculator.calc_holding_value(security, 1)["value"]
                                * (1 + 0.1 * math.sin(i / 5)),  # Generate sine wave pattern
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


# Add a run function for the FastAPI server
def run_fastapi_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """
    Run the FastAPI server.

    Args:
        host (str, optional): Host to bind the server. Defaults to '0.0.0.0'.
        port (int, optional): Port to run the server on. Defaults to 8000.
    """
    uvicorn.run(fast_api_app, host=host, port=port)


def open_browser():
    webbrowser.open("http://localhost:5173")


def main():
    for chart_config in CHARTS:
        aggregation_data = calculator.aggregate_holdings(
            portfolio=portfolio, **{k: v for k, v in chart_config.items() if k != "title"}
        )
        display_aggregation(chart_config["title"], aggregation_data)

    threading.Thread(target=open_browser, daemon=True).start()
    run_fastapi_server()


if __name__ == "__main__":
    main()
