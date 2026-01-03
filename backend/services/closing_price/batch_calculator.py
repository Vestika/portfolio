"""
Batch calculator for efficient portfolio price calculations using numpy.

This module provides vectorized operations for:
1. Batch price fetching (single DB query)
2. Batch exchange rate lookup
3. Vectorized currency conversion using numpy

Performance: O(1) DB queries instead of O(N) for N symbols
"""

import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from loguru import logger

from .price_manager import PriceManager
from .currency_service import currency_service


class BatchCalculator:
    """
    Efficient batch calculator for portfolio holdings using numpy.
    
    Usage:
        calculator = BatchCalculator(base_currency="ILS")
        await calculator.initialize(symbols, currencies)
        results = calculator.calculate_values(holdings_data)
    """
    
    def __init__(self, base_currency: str = "ILS"):
        self.base_currency = base_currency.upper()
        self.price_manager = PriceManager()
        
        # Cached data after initialization
        self._prices: Dict[str, float] = {}
        self._currencies: Dict[str, str] = {}  # symbol -> currency
        self._exchange_rates: Dict[str, float] = {}  # currency -> rate to base
        self._initialized = False
    
    async def initialize(
        self, 
        symbols: List[str],
        symbol_currencies: Dict[str, str],
        fallback_prices: Dict[str, float] = None
    ) -> None:
        """
        Initialize the calculator with batch-fetched data.
        
        Args:
            symbols: List of all symbols to calculate
            symbol_currencies: Mapping of symbol -> currency (e.g., {"AAPL": "USD"})
            fallback_prices: Optional static fallback prices
        """
        start_time = datetime.utcnow()
        
        # Step 1: Batch fetch all prices (single DB query)
        logger.info(f"[BATCH CALC] Fetching prices for {len(symbols)} symbols")
        price_data = await self.price_manager.get_batch_prices(symbols)
        
        for symbol in symbols:
            if symbol in price_data:
                self._prices[symbol] = float(price_data[symbol].get("price", 0))
                self._currencies[symbol] = price_data[symbol].get("currency", "USD")
            elif fallback_prices and symbol in fallback_prices:
                self._prices[symbol] = fallback_prices[symbol]
                self._currencies[symbol] = symbol_currencies.get(symbol, "USD")
            else:
                # Use provided currency from securities
                self._currencies[symbol] = symbol_currencies.get(symbol, "USD")
        
        # Step 2: Determine unique currencies that need conversion
        unique_currencies = set(self._currencies.values())
        unique_currencies.discard(self.base_currency)  # No conversion needed for base
        
        logger.info(f"[BATCH CALC] Need exchange rates for {len(unique_currencies)} currencies")
        
        # Step 3: Batch fetch exchange rates
        if unique_currencies:
            currency_pairs = [(curr, self.base_currency) for curr in unique_currencies]
            rates = await currency_service.get_batch_exchange_rates(currency_pairs)
            
            for curr in unique_currencies:
                key = f"{curr}/{self.base_currency}"
                if key in rates:
                    self._exchange_rates[curr] = rates[key]
                else:
                    logger.warning(f"[BATCH CALC] Missing rate for {curr}, using 1.0")
                    self._exchange_rates[curr] = 1.0
        
        # Base currency always has rate 1.0
        self._exchange_rates[self.base_currency] = 1.0
        
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        logger.info(
            f"[BATCH CALC] Initialized with {len(self._prices)} prices, "
            f"{len(self._exchange_rates)} exchange rates in {elapsed:.3f}s"
        )
        
        self._initialized = True
    
    def calculate_holding_values(
        self,
        holdings: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Calculate values for all holdings using vectorized numpy operations.
        
        Args:
            holdings: List of holdings, each with:
                - symbol: str
                - units: float
                - currency: str (optional, uses cached if not provided)
        
        Returns:
            List of results with calculated values in base currency
        """
        if not self._initialized:
            raise RuntimeError("BatchCalculator not initialized. Call initialize() first.")
        
        if not holdings:
            return []
        
        n = len(holdings)
        
        # Build numpy arrays for vectorized calculation
        prices = np.zeros(n, dtype=np.float64)
        units = np.zeros(n, dtype=np.float64)
        rates = np.zeros(n, dtype=np.float64)
        
        for i, holding in enumerate(holdings):
            symbol = holding.get("symbol", "")
            
            # Get price (cached)
            prices[i] = self._prices.get(symbol, 0.0)
            
            # Get units
            units[i] = float(holding.get("units", 0))
            
            # Get exchange rate for this symbol's currency
            currency = holding.get("currency") or self._currencies.get(symbol, self.base_currency)
            
            # FX symbols are already in base currency
            if symbol.startswith("FX:"):
                rates[i] = 1.0
            else:
                rates[i] = self._exchange_rates.get(currency.upper(), 1.0)
        
        # Vectorized calculations (FAST!)
        values_in_base = prices * rates  # Price per unit in base currency
        total_values = values_in_base * units  # Total value in base currency
        
        # Build results
        results = []
        for i, holding in enumerate(holdings):
            symbol = holding.get("symbol", "")
            currency = holding.get("currency") or self._currencies.get(symbol, self.base_currency)
            
            results.append({
                "symbol": symbol,
                "unit_price": float(prices[i]),
                "currency": currency,
                "exchange_rate": float(rates[i]),
                "value": float(values_in_base[i]),  # Per-unit value in base
                "units": float(units[i]),
                "total": float(total_values[i]),  # Total value in base
                "base_currency": self.base_currency,
            })
        
        return results
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics about the batch calculation"""
        return {
            "prices_cached": len(self._prices),
            "currencies_cached": len(set(self._currencies.values())),
            "exchange_rates_cached": len(self._exchange_rates),
            "base_currency": self.base_currency,
            "initialized": self._initialized
        }


async def batch_calculate_portfolio_values(
    securities: Dict[str, Any],
    holdings: List[Dict[str, Any]],
    base_currency: str = "ILS",
    fallback_prices: Dict[str, float] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    High-level function to calculate all holding values in a batch.
    
    This is the main entry point for batch portfolio calculations.
    
    Args:
        securities: Dictionary mapping symbol -> security data with currency info
        holdings: List of holdings with symbol and units
        base_currency: Target currency for all values
        fallback_prices: Optional static fallback prices
        
    Returns:
        Tuple of (calculated_holdings, summary_stats)
    """
    start_time = datetime.utcnow()
    
    # Extract symbols and their currencies from securities
    symbols = list(securities.keys())
    symbol_currencies = {
        symbol: sec.get("currency", "USD") if isinstance(sec, dict) else 
                (sec.currency.value if hasattr(sec.currency, 'value') else str(sec.currency))
        for symbol, sec in securities.items()
    }
    
    # Initialize batch calculator
    calculator = BatchCalculator(base_currency=base_currency)
    await calculator.initialize(symbols, symbol_currencies, fallback_prices)
    
    # Calculate all values (vectorized)
    results = calculator.calculate_holding_values(holdings)
    
    elapsed = (datetime.utcnow() - start_time).total_seconds()
    summary = calculator.get_summary()
    summary["calculation_time_seconds"] = elapsed
    summary["holdings_calculated"] = len(results)
    
    logger.info(
        f"[BATCH CALC] Calculated {len(results)} holdings in {elapsed:.3f}s "
        f"({len(results)/elapsed:.0f} holdings/sec)" if elapsed > 0 else
        f"[BATCH CALC] Calculated {len(results)} holdings"
    )
    
    return results, summary

