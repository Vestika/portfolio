#!/usr/bin/env python3
"""
Script to populate the symbols collection with securities from live APIs.
- Uses Finnhub.io API for NYSE securities
- Uses PyMaya API for TASE securities  
- Includes currencies and crypto
"""

import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime

import finnhub
from pymaya.maya import Maya

from core.database import db_manager
from models.symbol import Symbol, SymbolType
from services.closing_price.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Currencies and crypto - keep these hardcoded as they're standards
CURRENCIES = [
    {"symbol": "USD", "name": "United States Dollar", "search_terms": ["dollar", "usd", "us dollar"]},
    {"symbol": "ILS", "name": "Israeli New Shekel", "search_terms": ["shekel", "nis", "israeli shekel"]},
    {"symbol": "EUR", "name": "Euro", "search_terms": ["euro", "eur", "european euro"]},
    {"symbol": "GBP", "name": "British Pound Sterling", "search_terms": ["pound", "sterling", "british pound"]},
    {"symbol": "JPY", "name": "Japanese Yen", "search_terms": ["yen", "japanese yen"]},
    {"symbol": "CAD", "name": "Canadian Dollar", "search_terms": ["canadian dollar", "cad"]},
    {"symbol": "AUD", "name": "Australian Dollar", "search_terms": ["australian dollar", "aud"]},
    {"symbol": "CHF", "name": "Swiss Franc", "search_terms": ["swiss franc", "chf"]},
    {"symbol": "CNY", "name": "Chinese Yuan", "search_terms": ["yuan", "chinese yuan", "renminbi"]},
    {"symbol": "BTC", "name": "Bitcoin", "search_terms": ["bitcoin", "btc", "crypto"]},
    {"symbol": "ETH", "name": "Ethereum", "search_terms": ["ethereum", "eth", "crypto"]},
    {"symbol": "ADA", "name": "Cardano", "search_terms": ["cardano", "ada", "crypto"]},
    {"symbol": "SOL", "name": "Solana", "search_terms": ["solana", "sol", "crypto"]},
]

async def fetch_nyse_securities() -> List[Dict[str, Any]]:
    """Fetch NYSE securities from Finnhub API."""
    logger.info("Fetching NYSE securities from Finnhub...")
    
    if not settings.finnhub_api_key:
        logger.error("FINNHUB_API_KEY not found in environment variables")
        return []
    
    try:
        # Initialize Finnhub client
        finnhub_client = finnhub.Client(api_key=settings.finnhub_api_key)
        
        # Get all US stock symbols
        us_stocks = finnhub_client.stock_symbols('US')
        logger.info(f"Found {len(us_stocks)} US stocks from Finnhub")
        
        nyse_securities = []
        
        for stock in us_stocks:
            # Filter for NYSE stocks only (you could also include NASDAQ if desired)
            if not stock.get('mic') or stock['mic'] not in ['XNYS', 'ARCX']:  # NYSE, NYSE Arca
                continue
                
            symbol = stock.get('symbol', '')
            description = stock.get('description', stock.get('displaySymbol', ''))
            
            # Skip symbols that look invalid or are test symbols
            if not symbol or len(symbol) > 10 or '.' in symbol or symbol.startswith('TEST'):
                continue
                
            # Determine sector (Finnhub doesn't provide this in stock_symbols, so we'll leave it empty)
            sector = ""
            
            nyse_securities.append({
                "symbol": symbol,
                "name": description,
                "sector": sector,
                "currency": "USD",
                "figi": stock.get('figi', ''),
                "mic": stock.get('mic', ''),
                "type": stock.get('type', '')
            })
        
        logger.info(f"Processed {len(nyse_securities)} NYSE securities")
        return nyse_securities
        
    except Exception as e:
        logger.error(f"Error fetching NYSE securities from Finnhub: {e}")
        return []

async def fetch_tase_securities() -> List[Dict[str, Any]]:
    """Fetch TASE securities from PyMaya API."""
    logger.info("Fetching TASE securities from PyMaya...")
    
    try:
        # Initialize Maya client
        maya = Maya()
        
        # Get all securities
        all_securities = maya.get_all_securities()
        logger.info(f"Found {len(all_securities)} securities from PyMaya")
        
        tase_securities = []
        
        for security in all_securities:
            # Extract relevant information from PyMaya response
            # PyMaya returns: {'Id': '2442', 'Name': 'ABOU FAMILY', 'Smb': None, 'ISIN': None, 'Type': 5, 'SubType': '1', 'SubTypeDesc': 'Company', 'SubId': '01209790', 'ETFType': None}
            security_id = security.get('Id', '')
            name = security.get('Name', '')
            symbol = security.get('Smb', '') or security.get('SubId', '')  # Use SubId if Smb is None
            
            # Skip if essential data is missing
            if not security_id or not name:
                continue
                
            # Filter to only include relevant security types (stocks, bonds, etc.)
            # Type 5 seems to be companies, we might want to filter by type
            security_type = security.get('Type', 0)
            if security_type not in [1, 2, 3, 4, 5, 6]:  # Adjust based on what types we want
                continue
            
            # Create symbol in TASE format
            if symbol and not symbol.endswith('.TA'):
                formatted_symbol = f"{symbol}.TA"
            else:
                formatted_symbol = f"{security_id}.TA"
                
            # Extract numeric ID for search purposes (Israeli securities can be searched by number)
            numeric_id = str(security_id) if security_id else ""
            
            # Create search terms including numeric ID, name, and symbol variations
            search_terms = [
                name.lower(),
                numeric_id,
                formatted_symbol.lower(),
                formatted_symbol.replace('.TA', '').lower(),
                symbol.lower() if symbol else ""
            ]
            
            # Remove empty search terms and duplicates
            search_terms = list(set([term for term in search_terms if term]))
            
            tase_securities.append({
                "security_id": security_id,
                "symbol": formatted_symbol,
                "name": name,
                "numeric_id": numeric_id,
                "search_terms": search_terms,
                "original_symbol": symbol,
                "security_type": security_type,
                "subtype_desc": security.get('SubTypeDesc', '')
            })
        
        logger.info(f"Processed {len(tase_securities)} TASE securities")
        return tase_securities
        
    except Exception as e:
        logger.error(f"Error fetching TASE securities from PyMaya: {e}")
        # Fallback to existing JSON file if PyMaya fails
        logger.info("Falling back to existing TASE JSON file...")
        return await load_tase_from_json()

async def load_tase_from_json() -> List[Dict[str, Any]]:
    """Fallback: Load TASE symbols from the existing JSON file."""
    from pathlib import Path
    import json
    
    tase_file = Path(__file__).parent / "data" / "tase_securities.json"
    
    if not tase_file.exists():
        logger.warning(f"TASE securities file not found at {tase_file}")
        return []
    
    try:
        with open(tase_file, 'r', encoding='utf-8') as f:
            tase_data = json.load(f)
        
        logger.info(f"Loaded {len(tase_data)} TASE securities from JSON fallback")
        
        # Convert to the format expected by populate_symbols
        converted_securities = []
        for tase_symbol in tase_data:
            converted_securities.append({
                "security_id": tase_symbol["tase_id"],
                "symbol": tase_symbol["symbol"],
                "name": tase_symbol["short_name"],
                "numeric_id": tase_symbol["tase_id"],
                "search_terms": [
                    tase_symbol["short_name"].lower(),
                    tase_symbol["tase_id"],
                    tase_symbol["symbol"].lower(),
                    tase_symbol["symbol"].replace(".TA", "").lower()
                ]
            })
            
        return converted_securities
        
    except Exception as e:
        logger.error(f"Error loading TASE securities from JSON: {e}")
        return []

async def populate_symbols():
    """Populate the symbols collection with all symbol data from APIs."""
    try:
        # Connect to database
        await db_manager.connect("vestika")
        collection = db_manager.get_collection("symbols")
        
        # Clear existing data
        await collection.delete_many({})
        logger.info("Cleared existing symbols collection")
        
        symbols_to_insert = []
        
        # Fetch data from APIs
        nyse_securities = await fetch_nyse_securities()
        tase_securities = await fetch_tase_securities()
        
        # Add NYSE symbols
        for nyse_symbol in nyse_securities:
            display_symbol = f"NYSE:{nyse_symbol['symbol']}"
            symbol_doc = {
                "symbol": display_symbol,
                "name": nyse_symbol["name"],
                "symbol_type": SymbolType.NYSE.value,
                "currency": "USD",
                "search_terms": [
                    nyse_symbol["name"].lower(),
                    nyse_symbol["symbol"].lower(),
                    display_symbol.lower()
                ],
                "market": "NYSE",
                "sector": nyse_symbol.get("sector", ""),
                "figi": nyse_symbol.get("figi", ""),
                "mic": nyse_symbol.get("mic", ""),
                "security_type": nyse_symbol.get("type", ""),
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            symbols_to_insert.append(symbol_doc)
        
        # Add TASE symbols
        for tase_symbol in tase_securities:
            symbol_doc = {
                "symbol": tase_symbol["symbol"],
                "name": tase_symbol["name"],
                "symbol_type": SymbolType.TASE.value,
                "currency": "ILS",
                "search_terms": tase_symbol["search_terms"],
                "tase_id": tase_symbol["security_id"],
                "numeric_id": tase_symbol["numeric_id"],  # For numeric search
                "short_name": tase_symbol["name"],
                "market": "TASE",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            symbols_to_insert.append(symbol_doc)
        
        # Add currencies and crypto
        for currency in CURRENCIES:
            symbol_type = SymbolType.CRYPTO if any("crypto" in term for term in currency["search_terms"]) else SymbolType.CURRENCY
            
            symbol_doc = {
                "symbol": currency["symbol"],
                "name": currency["name"],
                "symbol_type": symbol_type.value,
                "currency": currency["symbol"],
                "search_terms": currency["search_terms"],
                "market": "CURRENCY" if symbol_type == SymbolType.CURRENCY else "CRYPTO",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            symbols_to_insert.append(symbol_doc)
        
        # Insert all symbols
        if symbols_to_insert:
            result = await collection.insert_many(symbols_to_insert)
            logger.info(f"Inserted {len(result.inserted_ids)} symbols")
            
            # Create indexes for better search performance
            await collection.create_index("symbol")
            await collection.create_index("name")
            await collection.create_index("symbol_type")
            await collection.create_index("search_terms")
            await collection.create_index("numeric_id")  # For Israeli numeric search
            await collection.create_index([("symbol", "text"), ("name", "text"), ("search_terms", "text")])
            logger.info("Created search indexes")
            
            # Print summary
            nyse_count = len(nyse_securities)
            tase_count = len(tase_securities)
            currency_count = len(CURRENCIES)
            
            logger.info(f"Population completed successfully:")
            logger.info(f"  NYSE securities: {nyse_count}")
            logger.info(f"  TASE securities: {tase_count}")
            logger.info(f"  Currencies/Crypto: {currency_count}")
            logger.info(f"  Total: {len(symbols_to_insert)}")
        else:
            logger.warning("No symbols to insert")
        
    except Exception as e:
        logger.error(f"Error populating symbols: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(populate_symbols()) 