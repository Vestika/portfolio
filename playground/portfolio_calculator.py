import functools
import json
import os
from datetime import datetime
from typing import Optional, Any

# Remove yfinance import and add our new price fetcher
from playground.utils.price_fetchers import get_price_fetcher

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
        alpha_vantage_api_key: Optional[str] = None,
    ):
        """
        Initialize calculator with conversion parameters

        :param base_currency: Base currency for calculations
        :param exchange_rates: Dictionary of exchange rates
        :param unit_prices: Dictionary of predefined unit prices
        :param alpha_vantage_api_key: Optional Alpha Vantage API key for better price fetching
        """
        self.base_currency = base_currency
        self.exchange_rates = exchange_rates
        self.unit_prices = unit_prices
        self.real_prices = {}
        self.tase_id_to_symbol = {}
        self.price_fetcher = get_price_fetcher(alpha_vantage_api_key)
        self._prices_fetched_this_session = False  # Track if we've already fetched prices
        self.load_latest_prices()

    @staticmethod
    def _get_latest_prices_filename():
        return f"playground/data/prices-{datetime.today().strftime('%Y-%m-%d')}.json"

    def fetch_latest_prices(self, portfolio: Portfolio) -> None:
        """
        Fetch latest prices for portfolio securities (only once per session).
        """
        # If we've already fetched prices this session, don't fetch again
        if self._prices_fetched_this_session:
            return
            
        symbols_to_fetch = []
        ils_symbols_to_fetch = []
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                symbol = holding.symbol
                security = portfolio.securities[symbol]
                if security.security_type == SecurityType.CASH:
                    continue  # Skip cash holdings
                    
                # Check if we already have this price (either predefined or cached)
                if symbol in self.unit_prices or symbol in self.real_prices:
                    continue
                    
                if symbol in self.tase_id_to_symbol:
                    tase_symbol = self.tase_id_to_symbol[symbol]
                    print(f"🔄 TASE mapping: {symbol} -> {tase_symbol}")
                    if tase_symbol not in self.real_prices:
                        ils_symbols_to_fetch.append(tase_symbol)
                elif security.currency == Currency.USD:
                    symbols_to_fetch.append(symbol)
                elif symbol.isdigit():
                    # This is likely a TASE symbol but not in our mapping
                    print(f"⚠️  TASE symbol {symbol} not found in mapping file (loaded {len(self.tase_id_to_symbol)} mappings)")

        # Remove duplicates
        symbols_to_fetch = list(set(symbols_to_fetch))
        ils_symbols_to_fetch = list(set(ils_symbols_to_fetch))
        
        if not symbols_to_fetch and not ils_symbols_to_fetch:
            print("✅ All required prices are already available (cached or predefined)")
            self._prices_fetched_this_session = True
            return

        print(f"📊 Fetching {len(symbols_to_fetch + ils_symbols_to_fetch)} missing prices...")
        print(f"   USD symbols: {symbols_to_fetch}")
        print(f"   ILS symbols: {ils_symbols_to_fetch}")
        
        # Use the new multi-provider fetcher
        all_symbols = symbols_to_fetch + ils_symbols_to_fetch
        fetched_prices, provider_used = self.price_fetcher.fetch_prices(all_symbols)
        
        print(f"✅ Fetched {len(fetched_prices)} prices using {provider_used}")
        
        # Process fetched prices
        closing_prices = {}
        for symbol in symbols_to_fetch:
            if symbol in fetched_prices:
                closing_prices[symbol] = fetched_prices[symbol]

        # For TASE symbols, divide by 100 (they're in agorot)
        for symbol in ils_symbols_to_fetch:
            if symbol in fetched_prices:
                closing_prices[symbol] = fetched_prices[symbol] / 100

        self.real_prices.update({k: v for k, v in closing_prices.items() if v > 0})
        
        if closing_prices:
            self.save_latest_prices()
        
        # Mark that we've fetched prices for this session
        self._prices_fetched_this_session = True

    def save_latest_prices(self) -> None:
        filename = self._get_latest_prices_filename()

        # Ensure directory exists
        os.makedirs(os.path.dirname(filename), exist_ok=True)

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
            print(f"📄 No existing price cache found at {filename}")
        else:
            with open(filename, "rt") as file:
                self.real_prices = json.load(file)
            print(f"📄 Loaded {len(self.real_prices)} cached prices from {filename}")
        
        tase_file = "playground/data/tase_securities.json"
        if os.path.exists(tase_file):
            with open(tase_file, "rt") as tase_securities_file:
                tase_data = json.load(tase_securities_file)
                self.tase_id_to_symbol = {s["tase_id"]: s["symbol"] for s in tase_data}
            print(f"📄 Loaded {len(self.tase_id_to_symbol)} TASE symbol mappings")
        else:
            print(f"⚠️  TASE securities file not found at {tase_file}")
            self.tase_id_to_symbol = {}

    def calc_holding_value(self, security: Security, units: int, portfolio: Portfolio = None) -> dict[str, Any]:
        """
        Convert holding to base currency with detailed pricing information

        :param security: Security details
        :param units: Number of units of the provided Security
        :param portfolio: Portfolio object (needed for price fetching)
        :return: Dictionary with conversion details
        """
        # Extract unit-price and identify its source
        if unit_price := self.unit_prices.get(security.symbol):
            price_source = "predefined"
        elif unit_price := self.get_price(security.symbol):
            price_source = "real-data"
        else:
            # If no price available and we have a portfolio, try fetching
            if portfolio is not None:
                print(f"🔍 Price not found for {security.symbol}, attempting to fetch...")
                self.fetch_latest_prices(portfolio)
                # Try again after fetching
                if unit_price := self.get_price(security.symbol):
                    price_source = "real-data"
                else:
                    # For TASE securities, provide a more helpful error
                    if security.symbol in self.tase_id_to_symbol:
                        yahoo_symbol = self.tase_id_to_symbol[security.symbol]
                        print(f"⚠️  TASE symbol {security.symbol} maps to {yahoo_symbol} but price unavailable")
                    elif security.symbol.isdigit():
                        print(f"⚠️  TASE symbol {security.symbol} not found in mapping file")
                    
                    # Instead of crashing, use a fallback price of 0 and warn
                    print(f"⚠️  Using fallback price of 0 for {security.symbol} ({security.name})")
                    unit_price = 0.0
                    price_source = "unavailable"
            else:
                print(f"⚠️  Using fallback price of 0 for {security.symbol} ({security.name})")
                unit_price = 0.0
                price_source = "unavailable"

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
                conversion_result = self.calc_holding_value(security, holding.units, portfolio)
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

    def get_price(self, symbol: str) -> Optional[float]:
        """Get price for a symbol, returns None if not found."""
        if symbol in self.tase_id_to_symbol:
            symbol = self.tase_id_to_symbol[symbol]
        return self.real_prices.get(symbol)  # Returns None if missing instead of raising exception
