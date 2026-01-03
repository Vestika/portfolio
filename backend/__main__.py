import threading
import webbrowser
from pathlib import Path
import logging

import uvicorn
from loguru import logger
from models.portfolio import Portfolio
from portfolio_calculator import PortfolioCalculator
from utils import filter_security
from app.main import app


# Intercept uvicorn logs and redirect to loguru
class InterceptHandler(logging.Handler):
    def emit(self, record):
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


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
    Run the FastAPI server with loguru for all logs (including uvicorn access logs).

    Args:
        host (str, optional): Host to bind the server. Defaults to '0.0.0.0'.
        port (int, optional): Port to run the server on. Defaults to 8000.
    """
    # Intercept uvicorn logs and redirect to loguru
    logging.root.handlers = [InterceptHandler()]
    logging.root.setLevel(logging.INFO)
    
    # Remove default handlers and use our intercept handler for uvicorn
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        logging_logger = logging.getLogger(name)
        logging_logger.handlers = [InterceptHandler()]
        logging_logger.propagate = False
    
    # Configure loguru format (optional, already has good defaults)
    logger.add(
        lambda msg: print(msg, end=""),
        format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO",
    )
    
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
