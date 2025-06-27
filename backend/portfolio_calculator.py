import functools
import json
import os
from datetime import datetime
from typing import Optional, Any

from loguru import logger

from backend.models.account import Account
from backend.models.currency import Currency
from backend.models.portfolio import Portfolio
from backend.models.security import Security
from backend.models.security_type import SecurityType
from backend.utils.filters import AggregationKeyFunc, Filter
from backend.services.closing_price import ClosingPriceService
from backend.services.closing_price.service import get_global_service


class PortfolioCalculator:
    def __init__(
        self,
        base_currency: Currency,
        exchange_rates: dict[Currency, float],
        unit_prices: dict[str, float],
        closing_price_service: Optional[ClosingPriceService] = None,
        use_real_time_rates: bool = True,
    ):
        """
        Initialize the portfolio calculator.
        
        Args:
            base_currency: The base currency for calculations
            exchange_rates: Static exchange rates as fallback
            unit_prices: Static unit prices as fallback
            closing_price_service: Service for fetching real-time data
            use_real_time_rates: Whether to fetch real-time exchange rates
        """
        self.base_currency = base_currency
        self.static_exchange_rates = exchange_rates
        self.unit_prices = unit_prices
        self.closing_price_service = closing_price_service or get_global_service()
        self.use_real_time_rates = use_real_time_rates
        
        # Cache for real-time exchange rates to avoid repeated API calls
        self._exchange_rate_cache = {}

    def get_exchange_rate(self, from_currency: Currency, to_currency: Currency) -> float:
        """
        Get exchange rate from one currency to another.
        Uses real-time rates when available, falls back to static rates.
        
        Args:
            from_currency: Source currency
            to_currency: Target currency
            
        Returns:
            Exchange rate
        """
        # Same currency
        if from_currency == to_currency:
            logger.debug(f"Same currency {from_currency} = {to_currency}, returning 1.0")
            return 1.0
        
        # Check cache first
        cache_key = f"{from_currency}_{to_currency}"
        if cache_key in self._exchange_rate_cache:
            cached_rate = self._exchange_rate_cache[cache_key]
            logger.debug(f"Using cached exchange rate for {from_currency}/{to_currency}: {cached_rate}")
            return cached_rate
        
        # Try real-time rates if enabled
        if self.use_real_time_rates:
            try:
                logger.debug(f"Fetching real-time rate for {from_currency}/{to_currency}")
                real_time_rate = self.closing_price_service.get_exchange_rate_sync(
                    from_currency.value, to_currency.value
                )
                if real_time_rate is not None:
                    logger.info(f"Using real-time exchange rate {from_currency}/{to_currency}: {real_time_rate}")
                    self._exchange_rate_cache[cache_key] = real_time_rate
                    return real_time_rate
                else:
                    logger.warning(f"Real-time rate not available for {from_currency}/{to_currency}, using static rate")
            except Exception as e:
                logger.warning(f"Failed to fetch real-time rate for {from_currency}/{to_currency}: {e}")
        
        # Fallback to static rates
        logger.debug(f"Checking static rates for {from_currency}: {list(self.static_exchange_rates.keys())}")
        if from_currency in self.static_exchange_rates:
            static_rate = self.static_exchange_rates[from_currency]
            logger.info(f"Using static exchange rate {from_currency}/{to_currency}: {static_rate}")
            self._exchange_rate_cache[cache_key] = static_rate
            return static_rate
        
        # If no rate found, log error and return 1 (no conversion)
        logger.error(f"No exchange rate available for {from_currency} to {to_currency}")
        return 1.0

    def calc_holding_value(self, security: Security, units: float) -> dict[str, Any]:
        """
        Calculate the value of a holding in the base currency.
        Prioritizes real-time prices over static prices.
        
        Args:
            security: The security
            units: Number of units held
            
        Returns:
            Dictionary with value calculation details
        """
        price_source = "predefined"  # Default
        unit_price = None
        
        # Handle cash securities specially - they always have unit price of 1.0 in their own currency
        if security.security_type == SecurityType.CASH:
            unit_price = 1.0
            price_source = "cash"
            logger.debug(f"Cash security {security.symbol}: unit price = 1.0 {security.currency}")
        else:
            # Try to get real-time price first for non-cash securities
            try:
                logger.debug(f"Attempting to fetch real-time price for {security.symbol}")
                price_data = self.closing_price_service.get_price_sync(security.symbol)
                if price_data:
                    unit_price = price_data["price"]
                    price_source = "real-time"
                    logger.debug(f"Using real-time price for {security.symbol}: {unit_price} {price_data['currency']}")
                else:
                    logger.debug(f"No real-time price data available for {security.symbol}")
            except Exception as e:
                logger.warning(f"Failed to get real-time price for {security.symbol}: {e}")
            
            # Fallback to static price for non-cash securities
            if unit_price is None:
                if security.symbol in self.unit_prices:
                    unit_price = self.unit_prices[security.symbol]
                    logger.debug(f"Using static price for {security.symbol}: {unit_price}")
                else:
                    logger.error(f"No price available for {security.symbol}")
                    unit_price = 0.0
        
        # Convert to base currency if needed
        logger.debug(f"Converting {security.symbol}: {security.currency} ({type(security.currency)}) -> {self.base_currency} ({type(self.base_currency)})")
        exchange_rate = self.get_exchange_rate(security.currency, self.base_currency)
        value_in_base = unit_price * exchange_rate
        total_value = value_in_base * units
        
        logger.debug(f"Conversion for {security.symbol}: {unit_price} {security.currency} * {exchange_rate} = {value_in_base} {self.base_currency} (total: {total_value} for {units} units)")
        
        return {
            "unit_price": unit_price,  # Price in original currency
            "value": value_in_base,    # Value per unit in base currency
            "total": total_value,      # Total value in base currency
            "units": units,
            "currency": security.currency,
            "base_currency": self.base_currency,
            "exchange_rate": exchange_rate,
            "price_source": price_source,
        }

    def aggregate_holdings(
        self,
        portfolio: Portfolio,
        aggregation_key: Optional[AggregationKeyFunc] = None,
        account_filter: Optional[Filter[Account]] = None,
        security_filter: Optional[Filter[Security]] = None,
        ignore_missing_key: bool = False,
    ) -> dict[str, Any]:
        """Aggregate portfolio holdings by a given key function."""
        
        aggregated_values: dict[str, float] = {}
        total_value = 0.0

        for account in portfolio.accounts:
            if account_filter and not account_filter(account):
                continue

            for holding in account.holdings:
                security = portfolio.securities[holding.symbol]
                
                if security_filter and not security_filter(security):
                    continue
                
                holding_value_info = self.calc_holding_value(security, holding.units)
                holding_value = holding_value_info["total"]
                total_value += holding_value

                if aggregation_key is None:
                    # Account-level aggregation
                    key = account.name
                else:
                    # Custom aggregation
                    try:
                        key = aggregation_key(security)
                    except Exception as e:
                        if ignore_missing_key:
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

        return {
            "aggregated_values": aggregated_values,
            "total_value": total_value,
            "base_currency": self.base_currency,
        }

    def get_aggregation_dict(self, aggregation_data: dict[str, Any]) -> dict[str, Any]:
        """Convert aggregation data to a dictionary format suitable for JSON responses."""
        
        breakdown = []
        total_value = aggregation_data["total_value"]
        
        for label, value in aggregation_data["aggregated_values"].items():
            percentage = (value / total_value * 100) if total_value > 0 else 0
            breakdown.append({
                "label": str(label),
                "value": round(value, 2),
                "percentage": round(percentage, 2)
            })
        
        # Sort by value (descending)
        breakdown.sort(key=lambda x: x["value"], reverse=True)
        
        return {
            "total": round(total_value, 2),
            "base_currency": aggregation_data["base_currency"].value,
            "breakdown": breakdown,
        }
    
    def clear_exchange_rate_cache(self):
        """Clear the exchange rate cache to force fresh fetches."""
        self._exchange_rate_cache.clear()
        logger.info("Exchange rate cache cleared")
