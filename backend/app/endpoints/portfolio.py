"""Portfolio management endpoints"""
from typing import Any, Optional
from datetime import datetime, date, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
import logging
import yfinance as yf
from pymaya.maya import Maya
import asyncio
import time
import pandas as pd

from core.auth import get_current_user
from core.database import db_manager
from models.portfolio import Portfolio
from portfolio_calculator import PortfolioCalculator
from core.rsu_calculator import create_rsu_calculator
from services.closing_price.service import get_global_service
from services.closing_price.price_manager import PriceManager
from core.options_calculator import OptionsCalculator
from services.earnings.service import get_earnings_service
from services.closing_price.price_manager import PriceManager

logger = logging.getLogger(__name__)

# Create router for this module
router = APIRouter()

# Get the global closing price service
closing_price_service = get_global_service()

# Cache for calculator instances to maintain cache across requests
calculator_cache = {}
maya = Maya()


def create_calculator(portfolio: Portfolio) -> PortfolioCalculator:
    """Create a PortfolioCalculator with the global closing price service"""
    return PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
        closing_price_service=closing_price_service,
        use_real_time_rates=True,  # Enable real-time exchange rates
    )

def get_or_create_calculator(portfolio_id: str, portfolio: Portfolio) -> PortfolioCalculator:
    """Get existing calculator from cache or create a new one"""
    # Create a cache key based on portfolio_id and portfolio configuration
    cache_key = f"{portfolio_id}:{portfolio.base_currency.value}:{hash(str(portfolio.exchange_rates))}"

    if cache_key not in calculator_cache:
        calculator_cache[cache_key] = create_calculator(portfolio)
    else:
        pass  # Reusing cached calculator

    return calculator_cache[cache_key]

def invalidate_portfolio_cache(portfolio_id: str):
    """Invalidate calculator cache for a given portfolio_id"""
    # Clear calculator cache entries for this portfolio_id
    keys_to_remove = [key for key in calculator_cache.keys() if key.startswith(f"{portfolio_id}:")]
    for key in keys_to_remove:
        del calculator_cache[key]

def determine_security_type_and_currency(symbol: str) -> tuple[str, str]:
    """
    Determine the security type and currency based on symbol format.
    
    Returns:
        tuple: (security_type, currency)
    
    Examples:
        FX:USD -> ('cash', 'USD')
        FX:GBP -> ('cash', 'GBP')
        BTC-USD -> ('crypto', 'USD')
        ETH-USD -> ('crypto', 'USD')
        629014 -> ('bond', 'ILS')  # TASE numeric
        AAPL -> ('stock', 'USD')
    """
    # Handle forex symbols (FX:XXX format)
    if symbol.startswith('FX:'):
        currency_code = symbol[3:]  # Extract currency after FX:
        return ('cash', currency_code)
    
    # Handle crypto symbols (XXX-USD format)
    if symbol.endswith('-USD') and not symbol.startswith('FX:'):
        return ('crypto', 'USD')
    
    # Handle TASE numeric symbols
    if symbol.isdigit() or (symbol.replace('.', '').replace('TA', '').isdigit()):
        return ('bond', 'ILS')
    
    # Default to stock with USD currency
    return ('stock', 'USD')

# Request/Response models
class BreakdownRequest:
    def __init__(
        self,
        account_names: Optional[list[str]] = Query(default=None, title="account_names"),
    ):
        self.account_names = account_names

class CreatePortfolioRequest(BaseModel):
    portfolio_name: str
    base_currency: str

class CreateAccountRequest(BaseModel):
    account_name: str
    account_type: str = "bank-account"
    owners: list[str] = ["me"]
    holdings: list[dict[str, Any]] = []
    rsu_plans: list[Any] = []
    espp_plans: list[Any] = []
    options_plans: list[Any] = []
    # Optional IBKR Flex credentials (saved only if provided)
    ibkr_flex: Optional[dict[str, str]] = None


async def process_portfolio_data(portfolio_docs: list, user) -> tuple:
    """
    Process all portfolio documents into structured data.
    Returns: (all_portfolios_data, global_securities, all_symbols)
    """
    start_time = time.time()
    all_portfolios_data = {}
    global_securities = {}
    all_symbols = set()
    
    # Import notification service for RSU event detection
    from core.notification_service import get_notification_service
    notification_service = get_notification_service()
    
    for doc in portfolio_docs:
        portfolio_id = str(doc["_id"])
        
        try:
            portfolio = Portfolio.from_dict(doc)
            calculator = get_or_create_calculator(portfolio_id, portfolio)
            rsu_calculator = create_rsu_calculator(portfolio, calculator)
            
            print(f"🏢 [PROCESS PORTFOLIOS] Processing portfolio: {portfolio.portfolio_name} ({portfolio_id})")
        except Exception as e:
            print(f"❌ [PROCESS PORTFOLIOS] Error initializing portfolio {portfolio_id}: {str(e)}")
            continue
        
        # Build accounts data
        complete_accounts = []
        
        for account in portfolio.accounts:
            try:
                holdings_with_values = []
                
                # Add regular holdings
                for holding in account.holdings:
                    # Validate holding symbol
                    if not hasattr(holding, 'symbol') or not holding.symbol:
                        print(f"⚠️ [PROCESS PORTFOLIOS] Skipping holding with missing symbol in account {account.name}")
                        continue
                        
                    if not isinstance(holding.symbol, str):
                        print(f"⚠️ [PROCESS PORTFOLIOS] Skipping holding with non-string symbol: {holding.symbol} (type: {type(holding.symbol)})")
                        continue
                    
                    if holding.symbol not in portfolio.securities:
                        continue
                        
                    security = portfolio.securities[holding.symbol]
                    all_symbols.add(holding.symbol)
                    
                    # Add to global securities with essential info only
                    global_securities[holding.symbol] = {
                        "symbol": holding.symbol,
                        "name": security.name,
                        "security_type": security.security_type.value,
                        "currency": security.currency.value
                    }
                    
                    holdings_with_values.append({
                        "symbol": holding.symbol,
                        "units": holding.units,
                        "original_currency": security.currency.value,
                        "security_type": security.security_type.value,
                        "security_name": security.name
                    })

                # Add RSU virtual holdings
                rsu_result = rsu_calculator.calculate_rsu_vesting_for_account({
                    "name": account.name,
                    "rsu_plans": account.rsu_plans or []
                })

                for virtual_holding in rsu_result["virtual_holdings"]:
                    # Validate virtual holding symbol
                    if not virtual_holding.get("symbol") or not isinstance(virtual_holding["symbol"], str):
                        print(f"⚠️ [PROCESS PORTFOLIOS] Skipping RSU virtual holding with invalid symbol: {virtual_holding.get('symbol')}")
                        continue

                    holdings_with_values.append({
                        "symbol": virtual_holding["symbol"],
                        "units": virtual_holding["units"],
                        "original_currency": virtual_holding.get("currency", "USD"),
                        "security_type": "rsu_virtual",
                        "security_name": virtual_holding.get("name", virtual_holding["symbol"])
                    })
                    all_symbols.add(virtual_holding["symbol"])

                complete_accounts.append({
                    "account_name": account.name,
                    "account_type": account.properties.get("type", "bank-account"),
                    "owners": account.properties.get("owners", ["me"]),
                    "holdings": holdings_with_values,
                    "rsu_plans": account.rsu_plans or [],
                    "espp_plans": account.espp_plans or [],
                    "options_plans": account.options_plans or [],
                    "rsu_vesting_data": rsu_result.get("vesting_data", []),
                    "account_cash": {},
                    "account_properties": account.properties
                })
                
                # Add cash holdings
                from models.security_type import SecurityType
                for holding in account.holdings:
                    if portfolio.securities[holding.symbol].security_type == SecurityType.CASH:
                        complete_accounts[-1]["account_cash"][holding.symbol] = holding.units
            
            except Exception as e:
                print(f"❌ [PROCESS PORTFOLIOS] Error processing account {account.name} in portfolio {portfolio.portfolio_name}: {str(e)}")
                continue

        # Store portfolio data (without prices - moved to global level)
        all_portfolios_data[portfolio_id] = {
            "portfolio_metadata": {
                "portfolio_id": portfolio_id,
                "portfolio_name": portfolio.portfolio_name,
                "base_currency": portfolio.base_currency.value,
                "user_name": portfolio.user_name
            },
            "accounts": complete_accounts,
            "computation_timestamp": datetime.utcnow().isoformat()
        }
        
        # Check for RSU vesting events and create notifications
        try:
            user_id = user.firebase_uid
            if user_id:
                notification_ids = await notification_service.check_rsu_vesting_events(
                    user_id, all_portfolios_data[portfolio_id]
                )
                if notification_ids:
                    print(f"🔔 [RSU EVENTS] Created {len(notification_ids)} RSU vesting notifications for user {user_id}")
        except Exception as e:
            print(f"⚠️ [RSU EVENTS] Failed to check RSU vesting events: {e}")

    duration = time.time() - start_time
    print(f"⏱️ [PROCESS PORTFOLIOS] Completed in {duration:.3f}s - {len(all_portfolios_data)} portfolios, {len(all_symbols)} symbols")
    return all_portfolios_data, global_securities, all_symbols


async def collect_global_prices(all_symbols: set, portfolio_docs: list) -> tuple:
    """
    Collect global current and historical prices for all symbols.
    Returns: (global_current_prices, global_historical_prices)
    """
    start_time = time.time()
    global_current_prices = {}
    global_historical_prices = {}
    
    print(f"📈 [COLLECT PRICES] Collecting global prices for {len(all_symbols)} unique symbols")
    
    # Date range for 7-day historical data
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    
    # Get the first available portfolio to use its calculator and securities
    first_portfolio = None
    first_calculator = None
    for doc in portfolio_docs:
        try:
            portfolio = Portfolio.from_dict(doc)
            calculator = get_or_create_calculator(str(doc["_id"]), portfolio)
            first_portfolio = portfolio
            first_calculator = calculator
            break
        except:
            continue
    
    if first_portfolio and first_calculator:
        # Step 1: Calculate current prices quickly (fast operation)
        current_prices_start = time.time()
        historical_tasks = []
        symbol_securities = {}
        
        for symbol in all_symbols:
            # Find the security from any portfolio that has it
            security = None
            for doc in portfolio_docs:
                try:
                    portfolio = Portfolio.from_dict(doc)
                    if symbol in portfolio.securities:
                        security = portfolio.securities[symbol]
                        break
                except:
                    continue
            
            if security:
                # Calculate current price (fast)
                price_info = first_calculator.calc_holding_value(security, 1)
                
                global_current_prices[symbol] = {
                    "price": price_info["value"],  # Price in base currency (converted)
                    "original_price": price_info["unit_price"],  # Price in original currency
                    "currency": security.currency.value,
                    "last_updated": datetime.utcnow().isoformat()
                }
                
                # Prepare historical price task (don't await yet!)
                # Pass the portfolio's base currency for forex lookups
                portfolio_base_currency = first_portfolio.base_currency.value if first_portfolio else 'ILS'
                historical_tasks.append(fetch_historical_prices(symbol, security, price_info["unit_price"], seven_days_ago, today, portfolio_base_currency))
                symbol_securities[symbol] = security
        
        current_prices_time = time.time() - current_prices_start
        print(f"⚡ [COLLECT PRICES] Current prices calculated in {current_prices_time:.3f}s for {len(global_current_prices)} symbols")
        
        # Step 2: Fetch historical prices with batched yfinance + parallel execution
        historical_start = time.time()
        print(f"🚀 [COLLECT PRICES] Starting BATCHED historical price fetching for {len(symbol_securities)} symbols")
        
        # Separate symbols by data source for batch optimization
        yfinance_symbols = []
        tase_symbols = []
        currency_symbols = []
        symbol_lookup = {}
        
        for symbol, security in symbol_securities.items():
            symbol_lookup[symbol] = security
            
            # Import SecurityType for proper type checking
            from models.security_type import SecurityType
            
            if symbol == 'USD':
                currency_symbols.append(symbol)
            elif symbol.startswith('FX:'):
                # FX: symbols are forex currencies - handle separately for proper yfinance lookup
                currency_symbols.append(symbol)
            elif hasattr(security, 'security_type') and security.security_type == SecurityType.CASH:
                currency_symbols.append(symbol)
            elif symbol.isdigit():
                tase_symbols.append(symbol)
            else:
                yfinance_symbols.append(symbol)
        
        print(f"📊 [COLLECT PRICES] Symbol distribution: {len(yfinance_symbols)} yfinance, {len(tase_symbols)} TASE, {len(currency_symbols)} currency")
        
        # Batch fetch yfinance symbols (MASSIVE TIME SAVER!)
        if yfinance_symbols:
            yf_start = time.time()
            global_historical_prices.update(await fetch_yfinance_batch(yfinance_symbols, seven_days_ago, today, global_current_prices))
            yf_time = time.time() - yf_start
            print(f"🚀 [COLLECT PRICES] BATCHED yfinance completed in {yf_time:.3f}s for {len(yfinance_symbols)} symbols")
        
        # Process TASE and currency symbols in parallel (still individual calls needed)
        remaining_tasks = []
        remaining_symbols = []
        
        portfolio_base_currency = first_portfolio.base_currency.value if first_portfolio else 'ILS'
        for symbol in tase_symbols + currency_symbols:
            security = symbol_lookup[symbol]
            price_info = first_calculator.calc_holding_value(security, 1)
            remaining_tasks.append(fetch_historical_prices(symbol, security, price_info["unit_price"], seven_days_ago, today, portfolio_base_currency))
            remaining_symbols.append(symbol)
        
        if remaining_tasks:
            remaining_start = time.time()
            remaining_results = await asyncio.gather(*remaining_tasks)
            for symbol, historical_data in zip(remaining_symbols, remaining_results):
                global_historical_prices[symbol] = historical_data
            remaining_time = time.time() - remaining_start
            print(f"⚡ [COLLECT PRICES] TASE/Currency parallel fetching completed in {remaining_time:.3f}s for {len(remaining_tasks)} symbols")
        
        historical_time = time.time() - historical_start
        print(f"🚀 [COLLECT PRICES] ALL historical fetching completed in {historical_time:.3f}s")
    
    duration = time.time() - start_time
    print(f"⏱️ [COLLECT PRICES] Completed in {duration:.3f}s - Generated price data for {len(global_current_prices)} symbols with {len(global_historical_prices)} historical series")
    return global_current_prices, global_historical_prices


async def collect_global_logos(all_symbols: set) -> dict:
    """
    Collect logos for all symbols globally (no duplication per holding).
    Returns: global_logos dict
    """
    start_time = time.time()
    print(f"🖼️ [COLLECT LOGOS] Collecting logos for {len(all_symbols)} symbols")
    global_logos = {}
    
    try:
        manager = PriceManager()
        
        # Collect logos for all symbols in parallel  
        logo_tasks = [manager.get_logo(symbol) for symbol in all_symbols]
        logo_results = await asyncio.gather(*logo_tasks, return_exceptions=True)
        
        for symbol, logo in zip(all_symbols, logo_results):
            if isinstance(logo, Exception):
                global_logos[symbol] = None
            else:
                global_logos[symbol] = logo
                
        successful_logos = sum(1 for logo in global_logos.values() if logo is not None)
        print(f"✅ [COLLECT LOGOS] Retrieved {successful_logos}/{len(all_symbols)} logos")
        
    except Exception as e:
        print(f"❌ [COLLECT LOGOS] Error collecting logos: {e}")
        global_logos = {}
    
    duration = time.time() - start_time
    print(f"⏱️ [COLLECT LOGOS] Completed in {duration:.3f}s - {len(global_logos)} logo entries")
    return global_logos


async def collect_earnings_data(all_symbols: set, global_securities: dict) -> dict:
    """
    Collect earnings calendar data for all stock/ETF symbols.
    Returns: global_earnings_data dict
    """
    start_time = time.time()
    print("📅 [COLLECT EARNINGS] Fetching earnings calendar data for stock/ETF symbols")
    global_earnings_data = {}
    
    try:
        earnings_service = get_earnings_service()
        
        # Filter to only stock/ETF symbols for earnings data
        stock_etf_symbols = [
            symbol for symbol in all_symbols 
            if symbol in global_securities and 
            global_securities[symbol]["security_type"].lower() in ['stock', 'etf']
        ]
        
        if stock_etf_symbols:
            print(f"📊 [COLLECT EARNINGS] Fetching earnings for {len(stock_etf_symbols)} stock/ETF symbols")
            
            # Get earnings data for all symbols at once
            earnings_data = await earnings_service.get_earnings_calendar(stock_etf_symbols)
            
            # Format the earnings data (1 upcoming + 3 previous per symbol)
            for symbol, raw_earnings in earnings_data.items():
                formatted_earnings = earnings_service.format_earnings_data(raw_earnings)
                global_earnings_data[symbol] = formatted_earnings
            
            total_earnings_records = sum(len(earnings) for earnings in global_earnings_data.values())
            print(f"✅ [COLLECT EARNINGS] Fetched {total_earnings_records} total earnings records for {len(global_earnings_data)} symbols")
        else:
            print("📭 [COLLECT EARNINGS] No stock/ETF symbols found for earnings data")
            
    except Exception as e:
        print(f"❌ [COLLECT EARNINGS] Error fetching earnings data: {e}")
        global_earnings_data = {}
    
    duration = time.time() - start_time
    print(f"⏱️ [COLLECT EARNINGS] Completed in {duration:.3f}s - {len(global_earnings_data)} earnings symbols")
    return global_earnings_data


async def collect_autocomplete_data() -> list[dict]:
    """
    Collect all autocomplete data for symbols from the database.
    This will be cached on the frontend for fast autocomplete.
    Returns: list of symbol dictionaries for autocomplete (deduplicated)
    """
    start_time = time.time()
    print("🔍 [COLLECT AUTOCOMPLETE] Fetching all active symbols for autocomplete")
    autocomplete_data = []
    
    try:
        collection = db_manager.get_collection("symbols")
        
        # Get all active symbols with only the fields needed for autocomplete
        cursor = collection.find(
            {"is_active": True},
            {
                "symbol": 1,
                "name": 1,
                "symbol_type": 1,
                "currency": 1,
                "short_name": 1,
                "market": 1,
                "sector": 1,
                "search_terms": 1,
                "_id": 0  # Exclude the MongoDB _id field
            }
        )
        
        # Convert cursor to list
        raw_data = await cursor.to_list(None)
        print(f"📊 [COLLECT AUTOCOMPLETE] Raw data fetched: {len(raw_data)} symbols")
        
        # Deduplicate and merge TASE symbols
        seen_keys = set()
        deduplicated_data = []
        tase_symbols_map = {}  # For merging TASE numeric and string versions
        
        # First pass: collect TASE symbols for merging
        for item in raw_data:
            if item.get('symbol_type') == 'tase':
                symbol = item.get('symbol', '')
                if '.' in symbol:
                    base_symbol = symbol.split('.')[0]  # Get part before .TA
                    if base_symbol.isdigit():
                        # This is a numeric TASE symbol (e.g., "006.TA")
                        if base_symbol not in tase_symbols_map:
                            tase_symbols_map[base_symbol] = {'numeric': item, 'string': None}
                        else:
                            tase_symbols_map[base_symbol]['numeric'] = item
                    else:
                        # This is a string TASE symbol (e.g., "TEVA.TA")
                        # Try to find corresponding numeric symbol with better matching logic
                        found_numeric = False
                        for num_key in tase_symbols_map:
                            if tase_symbols_map[num_key]['numeric']:
                                numeric_name = tase_symbols_map[num_key]['numeric'].get('name', '').upper()
                                string_symbol = base_symbol.upper()
                                
                                # Multiple matching strategies
                                if (numeric_name.startswith(string_symbol) or 
                                    string_symbol in numeric_name or
                                    # Try matching first 4 characters both ways
                                    (len(string_symbol) >= 4 and numeric_name.startswith(string_symbol[:4])) or
                                    (len(numeric_name) >= 4 and string_symbol.startswith(numeric_name[:4]))):
                                    # Found potential match, add string version
                                    tase_symbols_map[num_key]['string'] = item
                                    found_numeric = True
                                    break
                        
                        if not found_numeric:
                            # No numeric match found, create new entry for string-only symbol
                            if base_symbol not in tase_symbols_map:
                                tase_symbols_map[base_symbol] = {'numeric': None, 'string': item}
        
        # Second pass: process all symbols, merging TASE symbols
        for item in raw_data:
            symbol_type = item.get('symbol_type', '')
            symbol = item.get('symbol', '')
            
            if symbol_type == 'tase' and '.' in symbol:
                base_symbol = symbol.split('.')[0]
                
                # Skip if this is part of a TASE pair that should be merged
                if base_symbol in tase_symbols_map:
                    tase_pair = tase_symbols_map[base_symbol]
                    
                    # Process numeric symbol as primary (create merged entry)
                    if base_symbol.isdigit() and item == tase_pair['numeric']:
                        # Create merged entry
                        merged_item = dict(item)  # Start with numeric symbol data
                        
                        if tase_pair['string']:
                            # Enhance display with string symbol
                            string_base = tase_pair['string']['symbol'].split('.')[0]
                            merged_item['display_symbol'] = f"{base_symbol} {string_base}"
                            # Use the more descriptive name if available
                            if len(tase_pair['string']['name']) > len(item['name']):
                                merged_item['name'] = tase_pair['string']['name']
                            
                            # Enhance search terms to include both numeric and string identifiers
                            existing_terms = set(merged_item.get('search_terms', []))
                            existing_terms.add(base_symbol)  # Add numeric part
                            existing_terms.add(string_base.lower())  # Add string part
                            existing_terms.add(string_base.upper())  # Add uppercase string part
                            # Add string symbol's search terms if available
                            if tase_pair['string'].get('search_terms'):
                                existing_terms.update(tase_pair['string']['search_terms'])
                            merged_item['search_terms'] = list(existing_terms)
                        else:
                            merged_item['display_symbol'] = base_symbol
                        
                        # Create unique key for merged TASE symbol
                        key = f"{merged_item.get('symbol', '')}-{symbol_type}-{merged_item.get('currency', '')}"
                        
                        if key not in seen_keys:
                            seen_keys.add(key)
                            deduplicated_data.append(merged_item)
                    
                    # Process string-only TASE symbols that don't have numeric pairs
                    elif not base_symbol.isdigit() and item == tase_pair['string'] and not tase_pair['numeric']:
                        # This is a string-only TASE symbol with no numeric counterpart
                        string_item = dict(item)
                        string_item['display_symbol'] = base_symbol  # Just use the string part
                        
                        # Create unique key for string-only TASE symbol
                        key = f"{string_item.get('symbol', '')}-{symbol_type}-{string_item.get('currency', '')}"
                        
                        if key not in seen_keys:
                            seen_keys.add(key)
                            deduplicated_data.append(string_item)
                    
                    # Skip processed TASE symbols
                    continue
            
            # Regular deduplication for non-TASE symbols
            key = f"{symbol}-{symbol_type}-{item.get('currency', '')}"
            
            if key not in seen_keys:
                seen_keys.add(key)
                deduplicated_data.append(item)
        
        autocomplete_data = deduplicated_data
        duplicates_removed = len(raw_data) - len(deduplicated_data)
        
        # Debug TASE symbol merging
        tase_count = len([s for s in autocomplete_data if s.get('symbol_type') == 'tase'])
        merged_tase_count = len([s for s in autocomplete_data if s.get('symbol_type') == 'tase' and s.get('display_symbol')])
        
        print(f"✅ [COLLECT AUTOCOMPLETE] Deduplicated: {len(autocomplete_data)} symbols (removed {duplicates_removed} duplicates)")
        print(f"📊 [COLLECT AUTOCOMPLETE] TASE symbols: {tase_count} total, {merged_tase_count} merged")
        
        # Sample a few TASE symbols for debugging
        tase_samples = [s for s in autocomplete_data if s.get('symbol_type') == 'tase'][:3]
        for sample in tase_samples:
            print(f"🔍 [COLLECT AUTOCOMPLETE] TASE sample: {sample.get('symbol')} -> display: {sample.get('display_symbol', 'none')} -> terms: {sample.get('search_terms', [])[:3]}")
        
    except Exception as e:
        print(f"❌ [COLLECT AUTOCOMPLETE] Error collecting autocomplete data: {e}")
        autocomplete_data = []
    
    duration = time.time() - start_time
    print(f"⏱️ [COLLECT AUTOCOMPLETE] Completed in {duration:.3f}s - {len(autocomplete_data)} symbols")
    return autocomplete_data


async def collect_user_tags(user) -> tuple:
    """
    Collect user tag library and holding tags.
    Returns: (user_tag_library, all_holding_tags)
    """
    start_time = time.time()
    print("🏷️ [COLLECT TAGS] Fetching user tag library and holding tags")
    user_tag_library = {}
    all_holding_tags = {}
    
    try:
        # Determine correct user_id for tag operations
        holding_tags_collection = db_manager.get_collection("holding_tags")
        
        # Check MongoDB ObjectId first
        user_tags_count = await holding_tags_collection.count_documents({"user_id": user.id})
        
        # Check Firebase UID if available
        firebase_tags_count = 0
        if hasattr(user, 'firebase_uid') and user.firebase_uid:
            firebase_tags_count = await holding_tags_collection.count_documents({"user_id": user.firebase_uid})
        
        # Decide which user_id to use
        if user_tags_count > 0:
            search_user_id = user.id
        elif firebase_tags_count > 0:
            search_user_id = user.firebase_uid
        else:
            search_user_id = user.id  # fallback to default
        
        # Get user tag library
        from core.tag_service import TagService
        tag_service = TagService(db_manager.database)
        tag_library_result = await tag_service.get_user_tag_library(search_user_id)
        
        # Convert TagLibrary object to dict for JSON serialization
        if tag_library_result:
            user_tag_library = {
                "id": getattr(tag_library_result, 'id', None),
                "user_id": tag_library_result.user_id,
                "tag_definitions": tag_library_result.tag_definitions,
                "template_tags": tag_library_result.template_tags,
                "created_at": getattr(tag_library_result, 'created_at', None),
                "updated_at": getattr(tag_library_result, 'updated_at', None)
            }
        else:
            user_tag_library = {"tag_definitions": {}, "template_tags": {}}
        
        # Get all holding tags
        holding_tags_cursor = holding_tags_collection.find({"user_id": search_user_id})
        holding_tags_found = 0
        async for holding_tag_doc in holding_tags_cursor:
            holding_tags_found += 1
            symbol = holding_tag_doc["symbol"]
            tags_data = holding_tag_doc.get("tags", {})
            
            # Convert to dict format expected by frontend - preserve TagValue structure exactly
            all_holding_tags[symbol] = {
                "symbol": symbol,
                "user_id": holding_tag_doc["user_id"],
                "portfolio_id": holding_tag_doc.get("portfolio_id"),
                "tags": tags_data,  # Keep the TagValue structure exactly as stored
                "created_at": holding_tag_doc.get("created_at"),
                "updated_at": holding_tag_doc.get("updated_at")
            }
        
    except Exception as e:
        print(f"⚠️ [COLLECT TAGS] Error loading tags data: {e}")
        user_tag_library = {"tag_definitions": {}, "template_tags": {}}
        all_holding_tags = {}
    
    duration = time.time() - start_time
    print(f"⏱️ [COLLECT TAGS] Completed in {duration:.3f}s - {len(user_tag_library.get('tag_definitions', {}))} tag definitions, {len(all_holding_tags)} holding tags")
    return user_tag_library, all_holding_tags


async def collect_options_vesting(all_portfolios_data: dict) -> dict:
    """
    Collect options vesting data for all company custodian accounts.
    Returns: all_options_vesting
    """
    start_time = time.time()
    print("📊 [COLLECT OPTIONS] Fetching options vesting for all company custodian accounts")
    all_options_vesting = {}
    
    try:
        for portfolio_id, portfolio_data in all_portfolios_data.items():
            portfolio_options = {}
            company_accounts = [
                acc for acc in portfolio_data["accounts"] 
                if acc["account_type"] == "company-custodian-account"
            ]
            
            if company_accounts:
                for account in company_accounts:
                    try:
                        # Get options vesting for this account
                        options_plans = account.get("options_plans", [])
                        if options_plans:
                            vesting_data = []
                            for plan in options_plans:
                                try:
                                    plan_vesting = OptionsCalculator.calculate_vesting_schedule(
                                        grant_date=plan["grant_date"],
                                        total_units=plan["units"],
                                        vesting_period_years=plan["vesting_period_years"],
                                        vesting_frequency=plan["vesting_frequency"],
                                        has_cliff=plan.get("has_cliff", False),
                                        cliff_months=plan.get("cliff_duration_months", 0) if plan.get("has_cliff") else 0,
                                        left_company=plan.get("left_company", False),
                                        left_company_date=plan.get("left_company_date")
                                    )
                                    vesting_data.append({
                                        "id": plan["id"],
                                        "symbol": plan["symbol"],
                                        **plan_vesting
                                    })
                                except Exception as plan_error:
                                    print(f"⚠️ [COLLECT OPTIONS] Error calculating vesting for plan {plan.get('id', 'unknown')}: {plan_error}")
                            
                            portfolio_options[account["account_name"]] = {"plans": vesting_data}
                            
                    except Exception as acc_error:
                        print(f"⚠️ [COLLECT OPTIONS] Error processing options for account {account['account_name']}: {acc_error}")
                        portfolio_options[account["account_name"]] = {"plans": []}
            
            all_options_vesting[portfolio_id] = portfolio_options
            
    except Exception as e:
        print(f"❌ [COLLECT OPTIONS] Error loading options vesting: {e}")
        all_options_vesting = {}
    
    duration = time.time() - start_time
    print(f"⏱️ [COLLECT OPTIONS] Completed in {duration:.3f}s - Generated options data for {len(all_options_vesting)} portfolios")
    return all_options_vesting


async def fetch_yfinance_batch(symbols: list, seven_days_ago: date, today: date, current_prices: dict = None) -> dict:
    """
    Fetch historical prices for multiple yfinance symbols in a single API call.
    Returns: dict of {symbol: historical_prices_list}
    """
    historical_data = {}
    
    if not symbols:
        return historical_data
    
    try:
        print(f"📈 [YFINANCE BATCH] Fetching 7d trend for {len(symbols)} symbols in SINGLE batch call")
        
        # Single yfinance call for all symbols with timeout!
        def fetch_batch_sync():
            return yf.download(symbols, start=seven_days_ago, end=today + timedelta(days=1), progress=False, auto_adjust=True)
        
        loop = asyncio.get_event_loop()
        data = await asyncio.wait_for(
            loop.run_in_executor(None, fetch_batch_sync),
            timeout=5.0  # 5 second timeout for batch call
        )
        
        if not data.empty:
            # Handle both single symbol and multi-symbol data structures
            if len(symbols) == 1:
                # Single symbol returns simple DataFrame
                symbol = symbols[0]
                if 'Close' in data.columns:
                    prices = data["Close"].dropna().round(2)
                    historical_data[symbol] = []
                    for dt in prices.index:
                        price = prices.loc[dt]
                        historical_data[symbol].append({
                            "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                            "price": float(price.iloc[0]) if hasattr(price, 'iloc') else float(price)
                        })
            else:
                # Multiple symbols return MultiIndex DataFrame
                for symbol in symbols:
                    if ('Close', symbol) in data.columns:
                        prices = data[('Close', symbol)].dropna().round(2)
                        historical_data[symbol] = []
                        for dt in prices.index:
                            price = prices.loc[dt]
                            if not pd.isna(price):
                                historical_data[symbol].append({
                                    "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                                    "price": float(price.iloc[0]) if hasattr(price, 'iloc') else float(price)
                                })
                    else:
                        print(f"⚠️ [YFINANCE BATCH] No data for symbol: {symbol}")
                        # Create fallback data using current price
                        fallback_price = current_prices.get(symbol, {}).get('original_price', 100.0) if current_prices else 100.0
                        historical_data[symbol] = []
                        for i in range(7, 0, -1):
                            day = today - timedelta(days=i)
                            historical_data[symbol].append({
                                "date": day.strftime("%Y-%m-%d"),
                                "price": fallback_price
                            })
        
        print(f"✅ [YFINANCE BATCH] Completed batch fetch for {len(symbols)} symbols")
        
    except asyncio.TimeoutError:
        print(f"⏰ [YFINANCE BATCH] Timeout after 5s - using fallback data for all {len(symbols)} symbols")
        # Create fallback data for all symbols using current prices
        for symbol in symbols:
            fallback_price = current_prices.get(symbol, {}).get('original_price', 100.0) if current_prices else 100.0
            historical_data[symbol] = []
            for i in range(7, 0, -1):
                day = today - timedelta(days=i)
                historical_data[symbol].append({
                    "date": day.strftime("%Y-%m-%d"),
                    "price": fallback_price
                })
    except Exception as e:
        print(f"❌ [YFINANCE BATCH] Error in batch fetch: {e}")
        # Create fallback data for all symbols using current prices
        for symbol in symbols:
            fallback_price = current_prices.get(symbol, {}).get('original_price', 100.0) if current_prices else 100.0
            historical_data[symbol] = []
            for i in range(7, 0, -1):
                day = today - timedelta(days=i)
                historical_data[symbol].append({
                    "date": day.strftime("%Y-%m-%d"),
                    "price": fallback_price
                })
    
    return historical_data


async def fetch_historical_prices(symbol: str, security, original_price: float, seven_days_ago: date, today: date, base_currency: str = 'ILS') -> list:
    """
    Fetch real 7-day historical prices for any symbol using the original logic.
    Handles currencies, TASE symbols, and regular stocks with proper fallbacks.
    
    Args:
        base_currency: The portfolio's base currency (e.g., 'USD', 'ILS') for forex rate lookups
    """
    historical_prices = []
    
    try:
        from models.security_type import SecurityType
        
        if symbol == 'USD':
            # Handle USD currency holdings - fetch actual USD/ILS exchange rate history
            # This shows how USD strength changes relative to ILS over time
            logger.info(f"📈 [FETCH HISTORICAL] Fetching 7d USD/ILS exchange rate trend for {symbol}")
            
            def fetch_usd_ils_sync():
                """Synchronous USD/ILS FX fetching to run in thread pool for true parallelism"""
                return yf.download("USDILS=X", start=seven_days_ago, end=today + timedelta(days=1), progress=False, auto_adjust=True)
            
            # Run the blocking yfinance call in a separate thread with timeout
            loop = asyncio.get_event_loop()
            try:
                data = await asyncio.wait_for(
                    loop.run_in_executor(None, fetch_usd_ils_sync),
                    timeout=5.0  # 5 second timeout for FX calls
                )
            except asyncio.TimeoutError:
                logger.warning(f"⏰ [FETCH HISTORICAL] USD/ILS FX timeout after 5s - using fallback")
                data = None
            
            if not data.empty:
                prices = data["Close"].dropna().round(4)  # More precision for exchange rates
                # Handle yfinance DataFrame properly for FX data
                for dt in prices.index:
                    price = prices.loc[dt]
                    price_value = float(price.iloc[0]) if hasattr(price, 'iloc') else float(price)
                    historical_prices.append({
                        "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                        "price": price_value
                    })
                logger.info(f"✅ [FETCH HISTORICAL] Retrieved {len(historical_prices)} USD/ILS exchange rate points for {symbol}")
            else:
                logger.warning(f"⚠️ [FETCH HISTORICAL] No USD/ILS FX data available - using fallback")
                # Fallback to static rate if no historical data
                for i in range(7, 0, -1):
                    day = today - timedelta(days=i)
                    historical_prices.append({
                        "date": day.strftime("%Y-%m-%d"),
                        "price": original_price  # Use the current exchange rate as fallback
                    })
            
        elif symbol.startswith('FX:'):
            # Handle new FX: currency symbols with dynamic yfinance symbol lookup
            currency_code = symbol[3:]  # Remove FX: prefix
            logger.info(f"📈 [FETCH HISTORICAL] Fetching 7d FX trend for currency symbol: {symbol} ({currency_code})")
            
            # Special case: if currency matches base currency, return 1.0 (no conversion)
            if currency_code == base_currency:
                logger.info(f"📊 [FETCH HISTORICAL] Currency {currency_code} matches base currency, returning 1.0 for all dates")
                for i in range(7, 0, -1):
                    day = today - timedelta(days=i)
                    historical_prices.append({
                        "date": day.strftime("%Y-%m-%d"),
                        "price": 1.0
                    })
            else:
                # Determine the correct yfinance symbol based on portfolio's base currency
                try:
                    # For USD-based portfolios: directly fetch XXXUSD=X (e.g., GBPUSD=X)
                    if base_currency == 'USD':
                        yfinance_symbol = f"{currency_code}USD=X"
                        logger.info(f"📊 [FETCH HISTORICAL] USD-based portfolio: using {yfinance_symbol}")
                    
                    # For ILS-based portfolios: convert through USD (yfinance doesn't have XXXILS pairs)
                    elif base_currency == 'ILS':
                        # Special case for USD → ILS: direct pair exists
                        if currency_code == 'USD':
                            yfinance_symbol = "USDILS=X"
                            logger.info(f"📊 [FETCH HISTORICAL] ILS-based portfolio: fetching direct pair {yfinance_symbol}")
                        else:
                            # For other currencies: fetch XXX→USD, then multiply by USD→ILS
                            logger.info(f"📊 [FETCH HISTORICAL] ILS-based portfolio: converting {currency_code} through USD")
                            yfinance_symbol = f"{currency_code}USD=X"  # Will need USD→ILS separately
                    
                    # For other base currencies: try direct pair
                    else:
                        yfinance_symbol = f"{currency_code}{base_currency}=X"
                        logger.info(f"📊 [FETCH HISTORICAL] {base_currency}-based portfolio: using {yfinance_symbol}")
                    
                    def fetch_fx_sync():
                        """Synchronous FX fetching for new FX: symbols"""
                        return yf.download(yfinance_symbol, start=seven_days_ago, end=today + timedelta(days=1), progress=False, auto_adjust=True)
                    
                    loop = asyncio.get_event_loop()
                    try:
                        data = await asyncio.wait_for(
                            loop.run_in_executor(None, fetch_fx_sync),
                            timeout=5.0  # 5 second timeout for FX calls
                        )
                    except asyncio.TimeoutError:
                        logger.warning(f"⏰ [FETCH HISTORICAL] FX timeout after 5s for {yfinance_symbol} - using fallback")
                        data = None
                        
                    if data is not None and not data.empty:
                        prices = data["Close"].dropna().round(6)  # High precision for exchange rates
                        logger.info(f"📈 [FETCH HISTORICAL] Raw yfinance data shape: {data.shape}, Close prices: {len(prices)}")
                        
                        # For ILS-based portfolios with non-USD currencies, multiply by USD→ILS rate
                        if base_currency == 'ILS' and currency_code != 'USD':
                            logger.info(f"🔄 [FETCH HISTORICAL] Fetching USDILS=X to convert {currency_code}USD to {currency_code}ILS")
                            
                            def fetch_usdils_sync():
                                return yf.download("USDILS=X", start=seven_days_ago, end=today + timedelta(days=1), progress=False, auto_adjust=True)
                            
                            try:
                                usdils_data = await asyncio.wait_for(
                                    loop.run_in_executor(None, fetch_usdils_sync),
                                    timeout=5.0
                                )
                                
                                if usdils_data is not None and not usdils_data.empty:
                                    usdils_prices = usdils_data["Close"].dropna().round(6)
                                    logger.info(f"✅ [FETCH HISTORICAL] Got USDILS rates: {len(usdils_prices)} points")
                                    
                                    # Multiply XXX→USD by USD→ILS to get XXX→ILS
                                    for dt in prices.index:
                                        if dt in usdils_prices.index:
                                            xxxusd_price = prices.loc[dt]
                                            usdils_price = usdils_prices.loc[dt]
                                            xxxusd_rate = float(xxxusd_price.iloc[0]) if hasattr(xxxusd_price, 'iloc') else float(xxxusd_price)
                                            usdils_rate = float(usdils_price.iloc[0]) if hasattr(usdils_price, 'iloc') else float(usdils_price)
                                            xxxils_rate = xxxusd_rate * usdils_rate
                                            historical_prices.append({
                                                "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                                                "price": round(xxxils_rate, 4)
                                            })
                                    logger.info(f"✅ [FETCH HISTORICAL] Retrieved {len(historical_prices)} {currency_code}→ILS price points (via USD)")
                                else:
                                    logger.error(f"❌ [FETCH HISTORICAL] Could not fetch USDILS=X for conversion")
                            except Exception as usdils_error:
                                logger.error(f"❌ [FETCH HISTORICAL] Error fetching USDILS=X: {usdils_error}")
                        else:
                            # Direct rate (USD-based portfolio or USD→ILS direct)
                            for dt in prices.index:
                                price = prices.loc[dt]
                                price_value = float(price.iloc[0]) if hasattr(price, 'iloc') else float(price)
                                historical_prices.append({
                                    "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                                    "price": price_value
                                })
                            logger.info(f"✅ [FETCH HISTORICAL] Retrieved {len(historical_prices)} FX price points for {yfinance_symbol}")
                    else:
                        logger.error(f"❌ [FETCH HISTORICAL] No yfinance FX data for ticker: {yfinance_symbol}")
                        logger.error(f"   This usually means yfinance doesn't have this currency pair available")
                        
                except Exception as e:
                    logger.error(f"❌ [FETCH HISTORICAL] Error fetching FX data for {symbol}: {e}")
                
        elif security.security_type == SecurityType.CASH:
            # Handle other currency holdings using exchange rates
            from_currency = symbol
            to_currency = "USD"  # Convert to USD for base currency
            
            if from_currency == to_currency:
                # Same currency, no conversion needed
                for i in range(7, 0, -1):
                    day = today - timedelta(days=i)
                    historical_prices.append({
                        "date": day.strftime("%Y-%m-%d"),
                        "price": 1.0
                    })
            else:
                # Fetch FX data using yfinance - RUN IN THREAD for true parallelism
                ticker = f"{from_currency}{to_currency}=X"
                logger.info(f"📈 [FETCH HISTORICAL] Fetching 7d FX trend for {from_currency} to {to_currency} using yfinance ticker {ticker}")
                
                def fetch_fx_sync():
                    """Synchronous FX fetching to run in thread pool for true parallelism"""
                    return yf.download(ticker, start=seven_days_ago, end=today + timedelta(days=1), progress=False, auto_adjust=True)
                
                # Run the blocking yfinance call in a separate thread with timeout
                loop = asyncio.get_event_loop()
                try:
                    data = await asyncio.wait_for(
                        loop.run_in_executor(None, fetch_fx_sync),
                        timeout=5.0  # 5 second timeout for FX calls
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"⏰ [FETCH HISTORICAL] FX timeout after 5s for {ticker} - using fallback")
                    data = None
                
                if not data.empty:
                    prices = data["Close"].dropna().round(6)
                    # Handle yfinance DataFrame properly
                    for dt in prices.index:
                        price = prices.loc[dt]
                        price_value = float(price.iloc[0]) if hasattr(price, 'iloc') else float(price)
                        historical_prices.append({
                            "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                            "price": price_value
                        })
                    logger.info(f"✅ [FETCH HISTORICAL] Retrieved {len(historical_prices)} FX price points for {ticker}")
                else:
                    logger.warning(f"⚠️ [FETCH HISTORICAL] No yfinance FX data for ticker: {ticker}")
                    
        elif symbol.isdigit():
            # Handle TASE symbols (numeric) using pymaya
            logger.info(f"📈 [FETCH HISTORICAL] Fetching 7d trend for TASE symbol (numeric): {symbol} using pymaya")
            try:
                tase_id = getattr(security, 'tase_id', None) or symbol
                price_history = list(maya.get_price_history(security_id=str(tase_id), from_date=seven_days_ago))
                
                for entry in reversed(price_history):
                    if entry.get('TradeDate') and entry.get('SellPrice'):
                        historical_prices.append({
                            "date": entry.get('TradeDate'),
                            "price": float(entry.get('SellPrice')) / 100
                        })
                        
                if historical_prices:
                    logger.info(f"✅ [FETCH HISTORICAL] Retrieved {len(historical_prices)} TASE price points for {symbol}")
                else:
                    logger.warning(f"⚠️ [FETCH HISTORICAL] No pymaya data for TASE symbol: {symbol}")
            except Exception as e:
                logger.warning(f"⚠️ [FETCH HISTORICAL] Error fetching TASE data for {symbol}: {e}")
                
        else:
            # Handle regular stock symbols using yfinance
            logger.info(f"📈 [FETCH HISTORICAL] Fetching 7d trend for stock symbol: {symbol} using yfinance")
            try:
                data = yf.download(symbol, start=seven_days_ago, end=today + timedelta(days=1), progress=False)
                
                if not data.empty:
                    prices = data["Close"].dropna().round(2)
                    # Handle yfinance DataFrame properly for stock data
                    for dt in prices.index:
                        price = prices.loc[dt]
                        price_value = float(price.iloc[0]) if hasattr(price, 'iloc') else float(price)
                        historical_prices.append({
                            "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                            "price": price_value
                        })
                    logger.info(f"✅ [FETCH HISTORICAL] Retrieved {len(historical_prices)} stock price points for {symbol}")
                else:
                    logger.warning(f"⚠️ [FETCH HISTORICAL] No yfinance data for symbol: {symbol}")
            except Exception as e:
                logger.warning(f"⚠️ [FETCH HISTORICAL] Error fetching stock data for {symbol}: {e}")
                
    except Exception as e:
        logger.warning(f"❌ [FETCH HISTORICAL] Failed to fetch real historical prices for {symbol}: {e}")
    
    # Add fallback mock data only if no historical prices were fetched
    if not historical_prices:
        logger.info(f"📊 [FETCH HISTORICAL] Using fallback mock data for {symbol}")
        for i in range(7, 0, -1):
            day = today - timedelta(days=i)
            historical_prices.append({
                "date": day.strftime("%Y-%m-%d"),
                "price": original_price
            })
    
    logger.info(f"✅ [FETCH HISTORICAL] Returning {len(historical_prices)} historical price points for {symbol}")
    return historical_prices


# ============== Generic prices by dates ==============
class PricesByDatesRequest(BaseModel):
    symbol: str
    dates: list[str]


@router.post("/prices/by-dates")
async def get_prices_by_dates(request: PricesByDatesRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Return price for a symbol at specific dates.

    - Accepts: { "symbol": "AAPL" or "USDILS=X", "dates": ["YYYY-MM-DD", ...] }
    - Returns: { "symbol": "AAPL", "prices": { "YYYY-MM-DD": float | null } }

    Implementation details:
    - Performs a single batched yfinance download across min..max requested dates
    - Maps each requested date to the closest available market date (prefer same/previous day, otherwise closest)
    - On errors/timeouts, returns null for the affected dates
    - Supports both regular stocks (AAPL) and currency pairs (USDILS=X)
    """
    try:
        if not request.dates:
            raise HTTPException(status_code=400, detail="At least one date must be provided")
        
        if not request.symbol:
            raise HTTPException(status_code=400, detail="Symbol must be provided")

        # Parse and validate dates
        parsed_dates: list[date] = []
        for ds in request.dates:
            try:
                parsed_dates.append(datetime.strptime(ds, "%Y-%m-%d").date())
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid date format: {ds}. Use YYYY-MM-DD")

        min_day = min(parsed_dates)
        max_day = max(parsed_dates)

        # Add 1 day to end as yfinance end is exclusive
        end_inclusive_plus_one = max_day + timedelta(days=1)

        # Fetch price series once for the whole range
        def fetch_prices_sync():
            return yf.download(request.symbol, start=min_day, end=end_inclusive_plus_one, progress=False, auto_adjust=True)

        loop = asyncio.get_event_loop()
        try:
            data = await asyncio.wait_for(
                loop.run_in_executor(None, fetch_prices_sync),
                timeout=6.0,
            )
        except asyncio.TimeoutError:
            data = None

        # Build a map of available dates -> price
        available: dict[date, float] = {}
        if data is not None and not data.empty:
            try:
                prices = data["Close"].dropna()
                for dt in prices.index:
                    # dt might be pandas.Timestamp
                    d = dt.date() if hasattr(dt, "date") else datetime.strptime(str(dt), "%Y-%m-%d").date()
                    # Round to 4 decimal places for currencies, 2 for stocks
                    precision = 4 if "=" in request.symbol else 2
                    available[d] = float(round(prices.loc[dt], precision))
            except Exception:
                # If any unexpected structure, leave available empty to fall back to nulls
                available = {}

        # Pre-sort available dates for closest lookup
        available_days_sorted = sorted(available.keys())

        def find_price_for_day(target: date) -> float | None:
            if not available_days_sorted:
                return None
            # Exact match
            if target in available:
                return available[target]
            # Prefer closest previous trading day
            prev_days = [d for d in available_days_sorted if d <= target]
            if prev_days:
                return available[prev_days[-1]]
            # Otherwise take the earliest next available
            next_days = [d for d in available_days_sorted if d > target]
            if next_days:
                return available[next_days[0]]
            return None

        result_prices: dict[str, float | None] = {}
        for ds, d in zip(request.dates, parsed_dates):
            result_prices[ds] = find_price_for_day(d)

        # Determine currency info based on symbol
        if "=" in request.symbol:
            # Currency pair like USDILS=X
            base_currency = request.symbol.split("=")[0][:3]
            quote_currency = request.symbol.split("=")[0][3:]
        else:
            # Regular stock - we don't know the currency from yfinance alone
            base_currency = "USD"  # Default assumption
            quote_currency = None

        return {
            "symbol": request.symbol,
            "base_currency": base_currency,
            "quote_currency": quote_currency,
            "prices": result_prices,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Legacy USD/ILS endpoint for backward compatibility ==============
class USDILSByDatesRequest(BaseModel):
    dates: list[str]


@router.post("/fx/usd-ils-by-dates")
async def get_usd_ils_by_dates(request: USDILSByDatesRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Legacy endpoint for USD/ILS rates. Use /prices/by-dates instead.
    """
    # Delegate to the generic endpoint
    generic_request = PricesByDatesRequest(symbol="USDILS=X", dates=request.dates)
    return await get_prices_by_dates(generic_request, user)


@router.get("/portfolios/complete-data")
async def get_all_portfolios_complete_data(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Comprehensive endpoint that returns ALL portfolio data for the user at once.
    This enables instant portfolio switching without additional API calls.
    Returns:
    - All portfolios' complete data
    - Global securities data
    - Global quotes data
    - User preferences
    Note: Autocomplete data is now served via a separate /autocomplete endpoint
    """
    try:        
        start_time = time.time()
        print(f"🚀 [MAIN ENDPOINT] Starting complete data collection at {datetime.utcnow().isoformat()}")
        
        collection = db_manager.get_collection("portfolios")
        portfolio_docs = await collection.find({"user_id": user.id}).to_list(None)
        
        if not portfolio_docs:
            total_time = time.time() - start_time
            print(f"⚡ [MAIN ENDPOINT] Empty portfolios response completed in {total_time:.3f}s")
            return {
                "portfolios": {},
                "global_securities": {},
                "global_current_prices": {},
                "global_historical_prices": {},
                "global_logos": {},
                "global_earnings_data": {},
                "user_preferences": {
                    "preferred_currency": "USD",
                    "default_portfolio_id": None
                },
                "computation_timestamp": datetime.utcnow().isoformat()
            }

        print(f"📁 [MAIN ENDPOINT] Found {len(portfolio_docs)} portfolios to process")
        
        # Step 1: Process portfolios (sequential - provides dependencies)
        step1_start = time.time()
        all_portfolios_data, global_securities, all_symbols = await process_portfolio_data(portfolio_docs, user)
        step1_time = time.time() - step1_start
        print(f"🌐 [MAIN ENDPOINT] Step 1 completed in {step1_time:.3f}s - Processed {len(all_portfolios_data)} portfolios with {len(all_symbols)} total unique symbols")
        
        # Step 2: Run data collection in parallel for maximum performance (includes NEW features!)
        step2_start = time.time()
        print(f"⚡ [MAIN ENDPOINT] Step 2 starting - Running parallel data collection: prices, logos, earnings, tags, and options")
        
        (
            (global_current_prices, global_historical_prices),
            global_logos,
            global_earnings_data,
            (user_tag_library, all_holding_tags),
            all_options_vesting
        ) = await asyncio.gather(
            collect_global_prices(all_symbols, portfolio_docs),
            collect_global_logos(all_symbols),  # NEW: Logo collection in parallel
            collect_earnings_data(all_symbols, global_securities),  # NEW: Earnings collection in parallel
            collect_user_tags(user),
            collect_options_vesting(all_portfolios_data)
        )
        
        step2_time = time.time() - step2_start
        print(f"✅ [MAIN ENDPOINT] Step 2 completed in {step2_time:.3f}s - Parallel data collection finished")
        
        # Step 3: Final response building
        step3_start = time.time()
        
        # Get user preferences/default portfolio
        try:
            user_prefs_collection = db_manager.get_collection("user_preferences") 
            user_prefs_doc = await user_prefs_collection.find_one({"user_id": user.id})
            default_portfolio_id = user_prefs_doc.get("default_portfolio_id") if user_prefs_doc else None
        except:
            default_portfolio_id = None

        result = {
            "portfolios": all_portfolios_data,
            "global_securities": global_securities,
            "global_current_prices": global_current_prices,
            "global_historical_prices": global_historical_prices,
            "global_logos": global_logos,  # NEW: Global logos (no duplication)
            "global_earnings_data": global_earnings_data,  # NEW: Global earnings data
            "user_tag_library": user_tag_library,
            "all_holding_tags": all_holding_tags,
            "all_options_vesting": all_options_vesting,
            "user_preferences": {
                "preferred_currency": "USD",  # Could be customizable later
                "default_portfolio_id": default_portfolio_id
            },
            "computation_timestamp": datetime.utcnow().isoformat()
        }
        
        step3_time = time.time() - step3_start

        # Final timing and summary
        total_time = time.time() - start_time
        print(f"🎯 [MAIN ENDPOINT] Returning complete data for {len(all_portfolios_data)} portfolios: {list(all_portfolios_data.keys())}")
        print(f"📊 [MAIN ENDPOINT] Complete summary: {len(global_securities)} securities, {len(global_current_prices)} current prices, {len(global_historical_prices)} historical price series, {len(global_logos)} logos, {len(global_earnings_data)} earnings symbols, {len(all_holding_tags)} holding tags, {len(all_options_vesting)} portfolio options")
        print(f"⏱️ [MAIN ENDPOINT] TIMING BREAKDOWN:")
        print(f"   📁 Step 1 (Portfolio Processing): {step1_time:.3f}s")
        print(f"   ⚡ Step 2 (Parallel Collection): {step2_time:.3f}s")
        print(f"   📄 Step 3 (Response Building): {step3_time:.3f}s")
        print(f"🏁 [MAIN ENDPOINT] TOTAL COMPLETION TIME: {total_time:.3f}s (target: <2s)")
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [MAIN ENDPOINT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# NEW: Minimal raw portfolios endpoint for frontend-side calculation
@router.get("/portfolios/raw")
async def get_raw_portfolios(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Return raw portfolio documents for the authenticated user with minimal shaping:
    - portfolios: Record[portfolio_id, { portfolio_metadata, accounts }]
    - global_securities: flattened securities with minimal fields
    This avoids prices/historical/logos to let the frontend calculate.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        docs = await collection.find({"user_id": user.id}).to_list(None)

        portfolios: dict[str, Any] = {}
        global_securities: dict[str, Any] = {}

        for doc in docs or []:
            pid = str(doc.get("_id"))
            portfolio_name = doc.get("portfolio_name") or doc.get("config", {}).get("user_name", pid)
            base_currency = (doc.get("config", {}).get("base_currency") or "USD")
            user_name = doc.get("config", {}).get("user_name") or "User"

            # Accounts: pass through holdings minimally
            accounts = []
            for acc in (doc.get("accounts") or []):
                acc_name = acc.get("name") or acc.get("account_name") or ""
                props = acc.get("properties") or acc.get("account_properties") or {}
                owners = props.get("owners") or ["me"]
                acc_type = props.get("type") or "bank-account"
                holdings = [
                    {
                        "symbol": h.get("symbol"),
                        "units": h.get("units", 0),
                        "original_currency": None,
                        "security_type": None,
                        "security_name": h.get("symbol"),
                    }
                    for h in (acc.get("holdings") or [])
                    if h.get("symbol")
                ]

                accounts.append({
                    "account_name": acc_name,
                    "account_type": acc_type,
                    "owners": owners,
                    "holdings": holdings,
                    "rsu_plans": acc.get("rsu_plans", []),
                    "espp_plans": acc.get("espp_plans", []),
                    "options_plans": acc.get("options_plans", []),
                    "rsu_vesting_data": [],
                    "account_cash": {},
                    "account_properties": props,
                })

            # securities
            for sym, sec in (doc.get("securities") or {}).items():
                global_securities[sym] = {
                    "symbol": sym,
                    "name": sec.get("name", sym),
                    "security_type": (sec.get("type") or sec.get("security_type") or "stock"),
                    "currency": sec.get("currency", base_currency),
                }

            portfolios[pid] = {
                "portfolio_metadata": {
                    "portfolio_id": pid,
                    "portfolio_name": portfolio_name,
                    "base_currency": base_currency,
                    "user_name": user_name,
                },
                "accounts": accounts,
                "computation_timestamp": datetime.utcnow().isoformat(),
            }

        # default portfolio id
        default_portfolio_id = None
        try:
            user_prefs_collection = db_manager.get_collection("user_preferences")
            user_prefs_doc = await user_prefs_collection.find_one({"user_id": user.id})
            default_portfolio_id = user_prefs_doc.get("default_portfolio_id") if user_prefs_doc else None
        except Exception:
            default_portfolio_id = None

        return {
            "portfolios": portfolios,
            "global_securities": global_securities,
            "user_preferences": {
                "preferred_currency": "USD",
                "default_portfolio_id": default_portfolio_id,
            },
            "computation_timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NEW: Minimal batch prices endpoint to support frontend calculation
class BatchPricesRequest(BaseModel):
    symbols: list[str]
    base_currency: Optional[str] = "USD"
    fresh: Optional[bool] = False


@router.post("/prices/batch")
async def get_batch_prices(req: BatchPricesRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Return latest prices for a list of symbols. Also attempts to include original
    currency if known from `symbols` collection; falls back to USD.
    Response shape: { prices: { [symbol]: { price, currency } } }
    """
    try:
        symbols = [s.upper() for s in (req.symbols or []) if isinstance(s, str) and s]
        manager = PriceManager()
        results = await manager.get_prices(symbols, fresh=bool(req.fresh))

        # Resolve currencies from symbols collection where possible
        currency_by_symbol: dict[str, str] = {}
        try:
            sym_col = db_manager.get_collection("symbols")
            cursor = sym_col.find({"symbol": {"$in": symbols}}, {"symbol": 1, "currency": 1})
            async for row in cursor:
                currency_by_symbol[row.get("symbol")] = row.get("currency") or "USD"
        except Exception:
            pass

        prices: dict[str, Any] = {}
        for pr in results:
            sym = pr.symbol
            prices[sym] = {
                "price": pr.price,
                "currency": currency_by_symbol.get(sym, pr.currency or "USD"),
                "last_updated": (pr.fetched_at.isoformat() if hasattr(pr, "fetched_at") and pr.fetched_at else datetime.utcnow().isoformat())
            }

        return {"prices": prices, "base_currency": req.base_currency or "USD", "count": len(prices)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/autocomplete")
async def get_autocomplete_data(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Dedicated endpoint for autocomplete symbol data.
    Returns deduplicated autocomplete data for fast frontend caching.
    Can be cached separately from portfolio data.
    """
    try:
        start_time = time.time()
        print("🔍 [AUTOCOMPLETE ENDPOINT] Starting autocomplete data collection")
        
        # Collect autocomplete data (already includes deduplication)
        autocomplete_data = await collect_autocomplete_data()
        
        result = {
            "autocomplete_data": autocomplete_data,
            "total_symbols": len(autocomplete_data),
            "computation_timestamp": datetime.utcnow().isoformat()
        }
        
        duration = time.time() - start_time
        print(f"✅ [AUTOCOMPLETE ENDPOINT] Completed in {duration:.3f}s - {len(autocomplete_data)} symbols")
        
        return result
        
    except Exception as e:
        print(f"❌ [AUTOCOMPLETE ENDPOINT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolio")
async def create_portfolio(request: CreatePortfolioRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Create a new portfolio document in MongoDB with basic structure.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        existing = await collection.find_one({"portfolio_name": request.portfolio_name, "user_id": user.id})
        if existing:
            raise HTTPException(status_code=409, detail=f"Portfolio '{request.portfolio_name}' already exists")
        
        # Create portfolio with all required fields for Portfolio.from_dict
        portfolio_data = {
            "portfolio_name": request.portfolio_name,
            "user_id": user.id,
            "config": {
                "user_name": request.portfolio_name,
                "base_currency": request.base_currency,
                "exchange_rates": {
                    # Add default exchange rates - these can be updated later
                    "USD": 1.0,
                    "ILS": 3.5,  # Default USD to ILS rate
                    "EUR": 1.1   # Default USD to EUR rate
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
        
        # Insert portfolio and get the ObjectId
        result = await collection.insert_one(portfolio_data)
        portfolio_id = str(result.inserted_id)
        
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)

        return {
            "message": f"Portfolio '{request.portfolio_name}' created successfully", 
            "portfolio_id": portfolio_id  # Return the actual ObjectId, not the name
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portfolio/{portfolio_id}/accounts")
async def add_account_to_portfolio(portfolio_id: str, request: CreateAccountRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Add a new account to an existing portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        portfolio_data = doc
        existing_accounts = [acc['name'] for acc in portfolio_data.get('accounts', [])]
        if request.account_name in existing_accounts:
            raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
        if 'securities' not in portfolio_data:
            portfolio_data['securities'] = {}
        for holding in request.holdings:
            symbol = holding.get('symbol')
            if symbol and symbol not in portfolio_data['securities']:
                # Determine security type and currency based on symbol format
                security_type, currency = determine_security_type_and_currency(symbol)
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': security_type,
                    'currency': currency
                }

        # Add securities for options plans
        for plan in request.options_plans:
            symbol = plan.get('symbol')
            if symbol and symbol not in portfolio_data['securities']:
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': 'stock',  # Options are typically for stock
                    'currency': 'USD'  # Default currency for options
                }
        new_account = {
            "name": request.account_name,
            "user_id": user.id,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings,
            "rsu_plans": request.rsu_plans,
            "espp_plans": request.espp_plans,
            "options_plans": request.options_plans
        }
        # Save IBKR Flex credentials if provided
        if request.ibkr_flex:
            new_account["ibkr_flex"] = request.ibkr_flex
        if 'accounts' not in portfolio_data:
            portfolio_data['accounts'] = []
        portfolio_data['accounts'].append(new_account)
        await collection.replace_one({"_id": ObjectId(portfolio_id)}, portfolio_data)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)
        return {"message": f"Account '{request.account_name}' added to {portfolio_id} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Delete an entire portfolio document from MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        count = await collection.count_documents({"user_id": user.id})
        if count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining portfolio")
        result = await collection.delete_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        # Clear from portfolios cache
        invalidate_portfolio_cache(portfolio_id)

        return {"message": f"Portfolio {portfolio_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/portfolio/{portfolio_id}/accounts/{account_name}")
async def delete_account_from_portfolio(portfolio_id: str, account_name: str, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Delete a specific account from a portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        accounts = doc.get('accounts', [])
        account_names = [acc['name'] for acc in accounts]
        if account_name not in account_names:
            raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
        if len(accounts) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining account")
        doc['accounts'] = [acc for acc in accounts if acc['name'] != account_name]
        await collection.replace_one({"_id": ObjectId(portfolio_id)}, doc)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)

        return {"message": f"Account '{account_name}' deleted from {portfolio_id} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/portfolio/{portfolio_id}/accounts/{account_name}")
async def update_account_in_portfolio(portfolio_id: str, account_name: str, request: CreateAccountRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Update an existing account in a portfolio document in MongoDB.
    """
    try:
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        accounts = doc.get('accounts', [])
        account_index = None
        for i, acc in enumerate(accounts):
            if acc['name'] == account_name:
                account_index = i
                break
        if account_index is None:
            raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found")
        if request.account_name != account_name:
            existing_accounts = [acc['name'] for acc in accounts]
            if request.account_name in existing_accounts:
                raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
        if 'securities' not in doc:
            doc['securities'] = {}
        for holding in request.holdings:
            symbol = holding.get('symbol')
            if symbol and symbol not in doc['securities']:
                # Determine security type and currency based on symbol format
                security_type, currency = determine_security_type_and_currency(symbol)
                doc['securities'][symbol] = {
                    'name': symbol,
                    'type': security_type,
                    'currency': currency
                }

        # Add securities for options plans
        for plan in request.options_plans:
            symbol = plan.get('symbol')
            if symbol and symbol not in doc['securities']:
                doc['securities'][symbol] = {
                    'name': symbol,
                    'type': 'stock',  # Options are typically for stock
                    'currency': 'USD'  # Default currency for options
                }
        updated_account = {
            "name": request.account_name,
            "properties": {
                "owners": request.owners,
                "type": request.account_type
            },
            "holdings": request.holdings,
            "rsu_plans": request.rsu_plans,
            "espp_plans": request.espp_plans,
            "options_plans": request.options_plans
        }
        # Save or update IBKR Flex credentials if provided
        if request.ibkr_flex is not None:
            updated_account["ibkr_flex"] = request.ibkr_flex
        accounts[account_index] = updated_account
        doc['accounts'] = accounts
        await collection.replace_one({"_id": ObjectId(portfolio_id)}, doc)
        # Clear portfolios cache to force reload
        invalidate_portfolio_cache(portfolio_id)
        return {"message": f"Account '{account_name}' updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/earnings-calendar")
async def get_earnings_calendar(
    symbols: str = Query(..., description="Comma-separated list of stock symbols"),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    user=Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get earnings calendar data for specified symbols using Finnhub API
    
    Args:
        symbols: Comma-separated list of stock symbols (e.g., "AAPL,MSFT,GOOGL")
        from_date: Start date in YYYY-MM-DD format (optional, defaults to 1 year ago)
        to_date: End date in YYYY-MM-DD format (optional, defaults to 1 year from now)
        
    Returns:
        Dictionary mapping symbol to list of earnings data
    """
    try:
        # Parse symbols
        symbol_list = [symbol.strip().upper() for symbol in symbols.split(",") if symbol.strip()]
        
        if not symbol_list:
            raise HTTPException(status_code=400, detail="At least one symbol must be provided")
        
        # Parse dates if provided
        from_date_obj = None
        to_date_obj = None
        
        if from_date:
            try:
                from_date_obj = datetime.strptime(from_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid from_date format. Use YYYY-MM-DD")
        
        if to_date:
            try:
                to_date_obj = datetime.strptime(to_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid to_date format. Use YYYY-MM-DD")
        
        logger.info(f"📅 [EARNINGS API] Fetching earnings for symbols: {symbol_list}")
        
        # Get earnings service and fetch data
        earnings_service = get_earnings_service()
        earnings_data = await earnings_service.get_earnings_calendar(
            symbol_list, 
            from_date_obj, 
            to_date_obj
        )
        
        # Format the response
        formatted_response = {}
        total_records = 0
        
        for symbol, raw_earnings in earnings_data.items():
            formatted_earnings = earnings_service.format_earnings_data(raw_earnings)
            formatted_response[symbol] = formatted_earnings
            total_records += len(formatted_earnings)
            logger.info(f"📊 [EARNINGS API] {symbol}: {len(formatted_earnings)} earnings records (1 upcoming + 3 previous)")
        
        logger.info(f"✅ [EARNINGS API] Returning {total_records} total earnings records for {len(symbol_list)} symbols")
        
        return {
            "earnings_data": formatted_response,
            "symbols_requested": symbol_list,
            "symbols_found": list(formatted_response.keys()),
            "total_records": total_records,
            "from_date": from_date_obj.isoformat() if from_date_obj else None,
            "to_date": to_date_obj.isoformat() if to_date_obj else None,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [EARNINGS API] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))