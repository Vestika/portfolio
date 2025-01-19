import functools
import json
import os
from datetime import datetime
from typing import Optional, Any

import yfinance as yf

from playground.models.account import Account
from playground.models.currency import Currency
from playground.models.portfolio import Portfolio
from playground.models.security import Security
from playground.models.security_type import SecurityType
from playground.utils.filters import AggregationKeyFunc, Filter


class PortfolioCalculator:
    def __init__(
        self,
        base_currency: Currency,
        exchange_rates: dict[Currency, float],
        unit_prices: dict[str, float],
    ):
        """
        Initialize calculator with conversion parameters

        :param base_currency: Base currency for calculations
        :param exchange_rates: Dictionary of exchange rates
        :param unit_prices: Dictionary of predefined unit prices
        """
        self.base_currency = base_currency
        self.exchange_rates = exchange_rates
        self.unit_prices = unit_prices
        self.real_prices = {}
        self.tase_id_to_symbol = {}
        self.load_latest_prices()

    @staticmethod
    def _get_latest_prices_filename():
        return f"data/prices-{datetime.today().strftime('%Y-%m-%d')}.json"

    @functools.lru_cache(maxsize=1)
    def fetch_latest_prices(self, portfolio: Portfolio) -> None:
        symbols = []
        ils_symbols = []
        for account in portfolio.accounts:
            for holding in account.holdings:
                symbol = holding.symbol
                security = portfolio.securities[symbol]
                if security.security_type == SecurityType.CASH:
                    continue  # TODO
                if symbol in self.tase_id_to_symbol:
                    symbol = self.tase_id_to_symbol[symbol]
                    if symbol not in self.real_prices:
                        ils_symbols.append(symbol)
                        continue
                elif security.currency != Currency.USD:
                    continue
                if symbol not in self.real_prices:
                    symbols.append(symbol)

        if not symbols and not ils_symbols:
            return
        data = yf.download(symbols + ils_symbols, period="5d", group_by="ticker", rounding=True)
        if data.empty:
            return
        closing_prices = {}

        def get_last_valid_close(data, symbol):
            if symbol in data and not data[symbol].empty:
                return float(data[symbol]["Close"].dropna().iloc[-1])
            return None

        for s in symbols:
            if last_close := get_last_valid_close(data, s):
                closing_prices[s] = last_close

        for s in ils_symbols:
            if last_close := get_last_valid_close(data, s):
                closing_prices[s] = last_close / 100

        self.real_prices.update({k: v for k, v in closing_prices.items() if v > 0})
        self.save_latest_prices()

    def save_latest_prices(self) -> None:
        filename = self._get_latest_prices_filename()

        # Load existing data if the file exists
        existing_data = {}
        if os.path.exists(filename):
            with open(filename, "rt") as file:
                existing_data = json.load(file)

        existing_data.update(self.real_prices)

        # Save updated data back to the file
        with open(filename, "wt") as file:
            json.dump(existing_data, file, indent=4)

    def load_latest_prices(self) -> None:
        filename = self._get_latest_prices_filename()

        # If the file exists, load its data into self.real_prices
        if not os.path.exists(filename):
            return

        with open(filename, "rt") as file:
            self.real_prices = json.load(file)
        with open("data/tase_securities.json", "rt") as tase_securities_file:
            self.tase_id_to_symbol = {s["tase_id"]: s["symbol"] for s in json.load(tase_securities_file)}

    def calc_holding_value(self, security: Security, units: int) -> dict[str, Any]:
        """
        Convert holding to base currency with detailed pricing information

        :param security: Security details
        :param units: Number of units of the provided Security
        :return: Dictionary with conversion details
        """
        # Extract unit-price and identify its source
        if unit_price := self.unit_prices.get(security.symbol):
            price_source = "predefined"
        elif unit_price := self.get_price(security.symbol):
            price_source = "real-data"
        else:
            raise ValueError(f"No price available for security: {security.symbol}")

        # Extract conversion rate
        if security.currency != self.base_currency and security.currency not in self.exchange_rates:
            raise ValueError(f"No exchange rate found for {security.currency}")
        conversion_rate = self.exchange_rates.get(security.currency, 1.0)

        return {
            "symbol": security.symbol,
            "unit_price": unit_price,
            "price_source": price_source,
            "currency_conversion_rate": conversion_rate,
            "value": units * unit_price * conversion_rate,
        }

    def aggregate_holdings(
        self,
        *,
        portfolio: Portfolio,
        aggregation_key: AggregationKeyFunc | None,
        account_filter: Optional[Filter[Account]],
        security_filter: Optional[Filter[Security]],
        ignore_missing_key: bool = False,
    ) -> dict[str, float]:
        """
        Flexible holdings aggregation with optional filtering

        :param portfolio: the portfolio on which to aggregate holdings
        :param aggregation_key: Function to extract aggregation key, or None to aggregate by account
        :param account_filter: Optional filter for accounts
        :param security_filter: Optional filter for securities
        :param ignore_missing_key: Whether to ignore securities without an aggregation key
        :return: Aggregated holdings
        """
        self.fetch_latest_prices(portfolio)

        aggregations: dict[str, float] = {}

        # Default filters if not provided
        account_filter = account_filter or (lambda _: True)
        security_filter = security_filter or (lambda _: True)

        for account in portfolio.accounts:
            # Skip accounts that don't match filter
            if not account_filter(account):
                continue

            for holding in account.holdings:
                security = portfolio.securities[holding.symbol]

                # Skip securities that don't match filter
                if not security_filter(security):
                    continue

                # Get aggregation key
                key = aggregation_key(security) if aggregation_key else account.name

                # Skip if key is None and ignore_missing_key is True
                if key is None and ignore_missing_key:
                    continue

                # Convert to base currency
                conversion_result = self.calc_holding_value(security, holding.units)
                value = conversion_result["value"]

                # Handle different key types
                if isinstance(key, dict):
                    # For dictionary tags, aggregate by each key
                    for sub_key, sub_value in key.items():
                        weighted_value = value * sub_value
                        aggregations[sub_key] = aggregations.get(sub_key, 0.0) + weighted_value
                elif isinstance(key, list):
                    # For list of keys, aggregate for each key
                    for sub_key in key:
                        aggregations[sub_key] = aggregations.get(sub_key, 0.0) + value
                else:
                    if key is None:
                        key = "_Unknown"
                    aggregations[key] = aggregations.get(key, 0.0) + value

        return aggregations

    def get_aggregation_dict(self, aggregations: dict[str, float]) -> dict[str, Any]:
        """
        Return detailed aggregation suitable for API/charting
        """
        return {
            "total": sum(aggregations.values()),
            "base_currency": self.base_currency,
            "breakdown": [
                {
                    "label": key,
                    "value": value,
                    "percentage": (value / sum(aggregations.values())) * 100,
                }
                for key, value in sorted(aggregations.items(), key=lambda x: x[1], reverse=True)
            ],
        }

    def get_price(self, symbol: str) -> float:
        if symbol in self.tase_id_to_symbol:
            symbol = self.tase_id_to_symbol[symbol]
        return self.real_prices[symbol]  # will raise an exception if missing
