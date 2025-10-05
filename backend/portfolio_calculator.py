from typing import Optional, Any

from loguru import logger

from models.account import Account
from models.currency import Currency
from models.portfolio import Portfolio
from models.security import Security
from models.security_type import SecurityType
from utils.filters import AggregationKeyFunc, Filter
from services.closing_price import ClosingPriceService
from services.closing_price.service import get_global_service


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
        
        # Cache for holding value calculations to avoid redundant calculations
        self._holding_value_cache = {}

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
            logger.info(f"💾 [EXCHANGE RATE] Using cached rate for {from_currency}/{to_currency}: {cached_rate:.6f}")
            return cached_rate
        
        # Try real-time rates if enabled
        if self.use_real_time_rates:
            try:
                logger.info(f"🌐 [EXCHANGE RATE] Fetching real-time rate for {from_currency}/{to_currency} from Finnhub")
                real_time_rate = self.closing_price_service.get_exchange_rate_sync(
                    from_currency.value, to_currency.value
                )
                if real_time_rate is not None:
                    logger.info(f"✅ [EXCHANGE RATE] Got real-time rate {from_currency}/{to_currency}: {real_time_rate:.6f}")
                    self._exchange_rate_cache[cache_key] = real_time_rate
                    return real_time_rate
                else:
                    logger.warning(f"⚠️ [EXCHANGE RATE] Real-time rate not available for {from_currency}/{to_currency}, checking static rates")
            except Exception as e:
                logger.warning(f"❌ [EXCHANGE RATE] Failed to fetch real-time rate for {from_currency}/{to_currency}: {e}")
        
        # Fallback to static rates
        logger.info(f"📚 [EXCHANGE RATE] Checking static rates for {from_currency}, available: {list(self.static_exchange_rates.keys())}")
        if from_currency in self.static_exchange_rates:
            static_rate = self.static_exchange_rates[from_currency]
            logger.info(f"📖 [EXCHANGE RATE] Using static rate {from_currency}/{to_currency}: {static_rate:.6f}")
            self._exchange_rate_cache[cache_key] = static_rate
            return static_rate
        
        # If no rate found, log error and return 1 (no conversion)
        logger.error(f"❌ [EXCHANGE RATE] No rate available for {from_currency} to {to_currency} - returning 1.0 (NO CONVERSION)")
        return 1.0

    def calc_holding_value(self, security: Security, units: float) -> dict[str, Any]:
        """
        Calculate the value of a holding in the base currency.
        Prioritizes real-time prices over static prices.
        Uses caching to avoid redundant calculations.
        
        Args:
            security: The security
            units: Number of units held
            
        Returns:
            Dictionary with value calculation details
        """
        # Create cache key based on security symbol, units, and base currency
        cache_key = f"{security.symbol}:{units}:{self.base_currency.value}"
        
        # Check cache first
        if cache_key in self._holding_value_cache:
            cached_result = self._holding_value_cache[cache_key]
            logger.debug(f"Using cached value for {security.symbol}: {cached_result['total']} {self.base_currency} (for {units} units)")
            return cached_result
        
        price_source = "predefined"  # Default
        unit_price = None
        
        # Handle FX: forex symbols specially - use Finnhub via closing_price_service
        if security.symbol.startswith('FX:'):
            # For FX: symbols, the "price" is the exchange rate to base currency
            # Use closing_price_service (Finnhub) for current prices
            currency_code = security.symbol[3:]  # Remove FX: prefix
            logger.debug(f"FX symbol {security.symbol}: fetching exchange rate {currency_code} -> {self.base_currency} via closing_price_service")
            
            # Special case: currency matches base currency
            if currency_code == self.base_currency.value:
                unit_price = 1.0
                price_source = "fx_same_currency"
                logger.debug(f"FX symbol {security.symbol}: same as base currency = 1.0")
            else:
                # For ILS-based portfolio with non-USD currencies: fetch through USD
                if self.base_currency.value == 'ILS' and currency_code != 'USD':
                    # Get XXX→USD rate from Finnhub
                    logger.info(f"🔄 [CALC FX] Step 1: Fetching {security.currency} → USD rate from Finnhub")
                    xxxusd_rate = self.get_exchange_rate(security.currency, Currency.USD)
                    logger.info(f"📊 [CALC FX] Step 1 result: {security.currency} → USD = {xxxusd_rate:.6f}")
                    
                    # Get USD→ILS rate from Finnhub
                    logger.info(f"🔄 [CALC FX] Step 2: Fetching USD → {self.base_currency} rate from Finnhub")
                    usdils_rate = self.get_exchange_rate(Currency.USD, self.base_currency)
                    logger.info(f"📊 [CALC FX] Step 2 result: USD → {self.base_currency} = {usdils_rate:.6f}")
                    
                    # Multiply to get XXX→ILS
                    unit_price = xxxusd_rate * usdils_rate
                    price_source = "finnhub_fx_via_usd"
                    logger.info(f"✅ [CALC FX] FX {security.symbol}: {currency_code}→USD ({xxxusd_rate:.4f}) × USD→ILS ({usdils_rate:.4f}) = {unit_price:.4f} ILS")
                else:
                    # Direct exchange rate from Finnhub
                    logger.info(f"🔄 [CALC FX] Fetching direct rate for {security.symbol} from Finnhub")
                    unit_price = self.get_exchange_rate(security.currency, self.base_currency)
                    price_source = "finnhub_fx"
                    logger.info(f"✅ [CALC FX] FX {security.symbol}: exchange rate from Finnhub = {unit_price:.4f} {self.base_currency}")
        
        # Handle cash securities specially - they always have unit price of 1.0 in their own currency
        elif security.security_type == SecurityType.CASH:
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
        
        # Check if we got a valid price
        if unit_price is None:
            logger.error(f"❌ [CALC] Failed to get price for {security.symbol} - returning zero value")
            return {
                "unit_price": 0.0,
                "value": 0.0,
                "total": 0.0,
                "units": units,
                "currency": security.currency,
                "base_currency": self.base_currency,
                "exchange_rate": 0.0,
                "price_source": "error",
            }
        
        # Convert to base currency if needed
        # Special case: FX: symbols are already priced in base currency (no conversion needed)
        if security.symbol.startswith('FX:'):
            logger.debug(f"FX symbol {security.symbol}: price already in base currency, skipping conversion")
            exchange_rate = 1.0
            value_in_base = unit_price
            total_value = value_in_base * units
        else:
            logger.debug(f"Converting {security.symbol}: {security.currency} ({type(security.currency)}) -> {self.base_currency} ({type(self.base_currency)})")
            exchange_rate = self.get_exchange_rate(security.currency, self.base_currency)
            value_in_base = unit_price * exchange_rate
            total_value = value_in_base * units
        
        logger.debug(f"Conversion for {security.symbol}: {unit_price} {security.currency} * {exchange_rate} = {value_in_base} {self.base_currency} (total: {total_value} for {units} units)")
        
        result = {
            "unit_price": unit_price,  # Price in original currency
            "value": value_in_base,    # Value per unit in base currency
            "total": total_value,      # Total value in base currency
            "units": units,
            "currency": security.currency,
            "base_currency": self.base_currency,
            "exchange_rate": exchange_rate,
            "price_source": price_source,
        }
        
        # Cache the result
        self._holding_value_cache[cache_key] = result
        
        return result

    def calc_options_value(self, options_plan: dict[str, Any]) -> dict[str, Any]:
        """
        Calculate the value of options in a plan.
        
        Args:
            options_plan: Options plan dictionary with all plan details
            
        Returns:
            Dictionary with options value calculation details
        """
        from core.options_calculator import OptionsCalculator
        
        # Calculate vesting schedule
        vesting_calc = OptionsCalculator.calculate_vesting_schedule(
            grant_date=options_plan["grant_date"],
            total_units=options_plan["units"],
            vesting_period_years=options_plan["vesting_period_years"],
            vesting_frequency=options_plan["vesting_frequency"],
            cliff_months=options_plan.get("cliff_duration_months", 0) if options_plan.get("has_cliff") else 0,
            left_company=options_plan.get("left_company", False),
            left_company_date=options_plan.get("left_company_date")
        )
        
        # Calculate options value
        value_calc = OptionsCalculator.calculate_options_value(
            vested_units=vesting_calc["vested_units"],
            exercise_price=options_plan["exercise_price"],
            strike_price=options_plan["strike_price"],
            company_valuation=options_plan.get("company_valuation"),
            option_type=options_plan.get("option_type", "iso")
        )
        
        # Convert to base currency
        exchange_rate = self.get_exchange_rate(Currency("USD"), self.base_currency)
        
        return {
            "symbol": options_plan["symbol"],
            "total_units": options_plan["units"],
            "vested_units": vesting_calc["vested_units"],
            "unvested_units": options_plan["units"] - vesting_calc["vested_units"],
            "exercise_price": options_plan["exercise_price"],
            "strike_price": options_plan["strike_price"],
            "current_valuation_per_share": value_calc["current_valuation_per_share"],
            "intrinsic_value_per_share": value_calc["intrinsic_value_per_share"],
            "total_intrinsic_value": value_calc["total_intrinsic_value"] * exchange_rate,
            "time_value_per_share": value_calc["time_value_per_share"],
            "total_time_value": value_calc["total_time_value"] * exchange_rate,
            "total_value": value_calc["total_value"] * exchange_rate,
            "option_type": options_plan.get("option_type", "iso"),
            "grant_date": options_plan["grant_date"],
            "expiration_date": options_plan["expiration_date"],
            "vesting_schedule": vesting_calc["schedule"],
            "next_vest_date": vesting_calc["next_vest_date"],
            "next_vest_units": vesting_calc["next_vest_units"]
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
    
    def clear_holding_value_cache(self):
        """Clear the holding value cache to force fresh calculations."""
        self._holding_value_cache.clear()
        logger.info("Holding value cache cleared")
    
    def clear_all_caches(self):
        """Clear all caches to force fresh data."""
        self.clear_exchange_rate_cache()
        self.clear_holding_value_cache()
        logger.info("All caches cleared")
