import threading
import webbrowser
from pathlib import Path

import uvicorn
from models.portfolio import Portfolio
from portfolio_calculator import PortfolioCalculator
from utils import filter_security, filter_account
from app.main import app


def display_aggregation(title: str, aggregation_data: dict[str, any]) -> None:
    """Display aggregation data in a formatted way"""
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


# Initialize demo portfolio
portfolios = {}
portfolios["demo.yaml"] = Portfolio.from_yaml(Path("demo.yaml"))
portfolio = portfolios["demo.yaml"]

calculator = PortfolioCalculator(
    base_currency=portfolio.base_currency,
    exchange_rates=portfolio.exchange_rates,
    unit_prices=portfolio.unit_prices,
    use_real_time_rates=True,  # Enable real-time exchange rates
)

# Predefined charts with their aggregation keys
CHARTS: list[dict[str, any]] = [
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


def run_fastapi_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """
    Run the FastAPI server.

    Args:
        host (str, optional): Host to bind the server. Defaults to '0.0.0.0'.
        port (int, optional): Port to run the server on. Defaults to 8000.
    """
    uvicorn.run(app, host=host, port=port)


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
