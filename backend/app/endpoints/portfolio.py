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
                historical_tasks.append(fetch_historical_prices(symbol, security, price_info["unit_price"], seven_days_ago, today))
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
        
        for symbol in tase_symbols + currency_symbols:
            security = symbol_lookup[symbol]
            price_info = first_calculator.calc_holding_value(security, 1)
            remaining_tasks.append(fetch_historical_prices(symbol, security, price_info["unit_price"], seven_days_ago, today))
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


async def fetch_historical_prices(symbol: str, security, original_price: float, seven_days_ago: date, today: date) -> list:
    """
    Fetch real 7-day historical prices for any symbol using the original logic.
    Handles currencies, TASE symbols, and regular stocks with proper fallbacks.
    """
    historical_prices = []
    
    try:
        from models.security_type import SecurityType
        
        if symbol == 'USD':
            # Handle USD currency holdings - always 1.0 in USD base currency
            for i in range(7, 0, -1):
                day = today - timedelta(days=i)
                historical_prices.append({
                    "date": day.strftime("%Y-%m-%d"),
                    "price": 1.0
                })
            logger.info(f"📈 [FETCH HISTORICAL] Generated USD currency data for {symbol}")
            
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
                        historical_prices.append({
                            "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                            "price": float(price)
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
                        historical_prices.append({
                            "date": dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt),
                            "price": float(price)
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
                portfolio_data['securities'][symbol] = {
                    'name': symbol,
                    'type': 'bond' if str.isnumeric(symbol) else 'stock',  # Default type
                    'currency': 'ILS' if str.isnumeric(symbol) else 'USD'  # Default currency
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
                doc['securities'][symbol] = {
                    'name': symbol,
                    'type': 'bond' if str.isnumeric(symbol) else 'stock',  # Default type
                    'currency': 'ILS' if str.isnumeric(symbol) else 'USD'  # Default currency
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