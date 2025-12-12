"""
Shared yfinance lock module.

yfinance is NOT thread-safe - concurrent calls can cause data to get mixed 
between different symbols. This module provides a global asyncio lock that 
should be used to serialize ALL yfinance.download() calls across the application.

Usage:
    from services.closing_price.yfinance_lock import yfinance_lock
    
    async with yfinance_lock:
        data = yf.download(...)
"""
import asyncio

# Global lock to serialize yfinance calls
# This lock is shared across all modules that call yfinance
yfinance_lock = asyncio.Lock()

