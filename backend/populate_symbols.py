#!/usr/bin/env python3
"""
Script to populate the symbols collection with securities from live APIs.
- Uses Finnhub.io API for NYSE and NASDAQ securities
- Uses PyMaya API for TASE securities  
- Includes currencies and crypto
- Implements checksum-based incremental updates
"""

import asyncio
import hashlib
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

import finnhub
from pymaya.maya import Maya

from core.database import db_manager
from models.symbol import Symbol, SymbolType
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Currencies and crypto - keep these hardcoded as they're standards
CURRENCIES = [
    {"symbol": "USD", "name": "United States Dollar", "search_terms": ["dollar", "usd", "us dollar"]},
    {"symbol": "ILS", "name": "Israeli New Shekel", "search_terms": ["shekel", "ils", "nis", "israeli shekel"]},
    {"symbol": "EUR", "name": "Euro", "search_terms": ["euro", "eur", "european euro"]},
    {"symbol": "GBP", "name": "British Pound Sterling", "search_terms": ["gbp", "pound", "sterling", "british pound"]},
    {"symbol": "JPY", "name": "Japanese Yen", "search_terms": ["yen", "japanese yen", "jpy"]},
    {"symbol": "CAD", "name": "Canadian Dollar", "search_terms": ["canadian dollar", "cad"]},
    {"symbol": "AUD", "name": "Australian Dollar", "search_terms": ["australian dollar", "aud"]},
    {"symbol": "CHF", "name": "Swiss Franc", "search_terms": ["swiss franc", "chf"]},
    {"symbol": "CNY", "name": "Chinese Yuan", "search_terms": ["yuan", "chinese yuan", "renminbi"]},
    {"symbol": "BTC", "name": "Bitcoin", "search_terms": ["bitcoin", "btc", "crypto"]},
    {"symbol": "ETH", "name": "Ethereum", "search_terms": ["ethereum", "eth", "crypto"]},
    {"symbol": "ADA", "name": "Cardano", "search_terms": ["cardano", "ada", "crypto"]},
    {"symbol": "SOL", "name": "Solana", "search_terms": ["solana", "sol", "crypto"]},
]

def calculate_checksum(data: List[Dict[str, Any]]) -> str:
    """Calculate SHA256 checksum for a list of data objects"""
    # Sort data by symbol to ensure consistent ordering
    sorted_data = sorted(data, key=lambda x: x.get('symbol', ''))
    # Create a stable string representation
    data_str = json.dumps(sorted_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

async def get_or_create_metadata() -> Dict[str, Any]:
    """Get or create the symbols metadata document"""
    collection = db_manager.get_collection("symbols_metadata")
    
    metadata = await collection.find_one({"_id": "symbols_metadata"})
    if not metadata:
        metadata = {
            "_id": "symbols_metadata",
            "checksums": {},
            "last_updated": {},
            "created_at": datetime.now()
        }
        await collection.insert_one(metadata)
        logger.info("Created new symbols metadata document")
    
    return metadata

async def update_metadata(symbol_type: str, checksum: str, count: int) -> None:
    """Update metadata for a specific symbol type"""
    collection = db_manager.get_collection("symbols_metadata")
    
    await collection.update_one(
        {"_id": "symbols_metadata"},
        {
            "$set": {
                f"checksums.{symbol_type}": checksum,
                f"last_updated.{symbol_type}": datetime.now(),
                f"counts.{symbol_type}": count
            }
        }
    )
    logger.info(f"Updated metadata for {symbol_type}: checksum={checksum[:8]}..., count={count}")

async def should_update_symbol_type(symbol_type: str, new_checksum: str) -> bool:
    """Check if a symbol type needs to be updated based on checksum"""
    metadata = await get_or_create_metadata()
    existing_checksum = metadata.get("checksums", {}).get(symbol_type)
    
    if not existing_checksum:
        logger.info(f"No existing checksum for {symbol_type}, will populate")
        return True
    
    if existing_checksum != new_checksum:
        logger.info(f"Checksum changed for {symbol_type}, will update")
        return True
    
    logger.info(f"Checksum unchanged for {symbol_type}, skipping")
    return False

async def clear_symbol_type(symbol_type: str) -> int:
    """Clear all symbols of a specific type"""
    collection = db_manager.get_collection("symbols")
    result = await collection.delete_many({"symbol_type": symbol_type})
    logger.info(f"Cleared {result.deleted_count} existing {symbol_type} symbols")
    return result.deleted_count

async def fetch_us_securities() -> List[Dict[str, Any]]:
    """Fetch US securities (NYSE and NASDAQ) from Finnhub API."""
    logger.info("Fetching US securities from Finnhub...")
    
    if not settings.finnhub_api_key:
        logger.error("FINNHUB_API_KEY not found in environment variables")
        return []
    
    try:
        # Initialize Finnhub client
        finnhub_client = finnhub.Client(api_key=settings.finnhub_api_key)
        
        # Get all US stock symbols
        us_stocks = finnhub_client.stock_symbols('US')
        logger.info(f"Found {len(us_stocks)} US stocks from Finnhub")
        
        us_securities = []
        
        for stock in us_stocks:
            # Include both NYSE and NASDAQ stocks
            mic = stock.get('mic', '')
            if not mic or mic not in ['XNYS', 'ARCX', 'XNAS']:  # NYSE, NYSE Arca, NASDAQ
                continue
                
            symbol = stock.get('symbol', '')
            description = stock.get('description', stock.get('displaySymbol', ''))
            
            # Skip symbols that look invalid or are test symbols
            if not symbol or len(symbol) > 10 or '.' in symbol or symbol.startswith('TEST'):
                continue
                
            # Determine market prefix
            market_prefix = "NYSE" if mic in ['XNYS', 'ARCX'] else "NASDAQ"
            
            us_securities.append({
                "symbol": symbol,
                "name": description,
                "currency": "USD",
                "figi": stock.get('figi', ''),
                "mic": mic,
                "type": stock.get('type', ''),
                "market_prefix": market_prefix
            })
        
        logger.info(f"Processed {len(us_securities)} US securities")
        return us_securities
        
    except Exception as e:
        logger.error(f"Error fetching US securities from Finnhub: {e}")
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
            security_id = security.get('Id', '')
            name = security.get('Name', '')
            symbol = security.get('Smb', '') or security.get('SubId', '')
            
            # Skip if essential data is missing
            if not security_id or not name:
                continue
                
            # Filter to only include relevant security types (stocks, bonds, etc.)
            security_type = security.get('Type', 0)
            if security_type not in [1, 2, 3, 4, 5, 6]:
                continue
            
            # Create symbol in TASE format
            if symbol and not symbol.endswith('.TA'):
                formatted_symbol = f"{symbol}.TA"
            else:
                formatted_symbol = f"{security_id}.TA"
                
            # Extract numeric ID for search purposes
            numeric_id = str(security_id) if security_id else ""
            
            # Create search terms including numeric ID, name, and symbol variations
            search_terms = [
                name.lower(),
                numeric_id,
                formatted_symbol.lower(),
                formatted_symbol.replace('.TA', '').lower(),
                symbol.lower() if symbol else "",
                security_id.lower() if security_id else ""
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

async def populate_symbol_type(symbol_type: str, force: bool = False) -> Dict[str, Any]:
    """Populate a specific symbol type with checksum-based updates"""
    result = {
        "symbol_type": symbol_type,
        "action": "skipped",
        "count": 0,
        "checksum": "",
        "error": None
    }
    
    try:
        # Fetch data based on symbol type
        if symbol_type == "US":
            raw_data = await fetch_us_securities()
        elif symbol_type == "TASE":
            raw_data = await fetch_tase_securities()
        elif symbol_type == "CURRENCY":
            raw_data = [c for c in CURRENCIES if not any("crypto" in term for term in c["search_terms"])]
        elif symbol_type == "CRYPTO":
            raw_data = [c for c in CURRENCIES if any("crypto" in term for term in c["search_terms"])]
        else:
            raise ValueError(f"Unknown symbol type: {symbol_type}")
        
        if not raw_data:
            logger.warning(f"No data fetched for {symbol_type}")
            return result
        
        # Calculate checksum
        checksum = calculate_checksum(raw_data)
        result["checksum"] = checksum
        
        # Check if update is needed
        if not force and not await should_update_symbol_type(symbol_type, checksum):
            result["action"] = "skipped"
            return result
        
        # Clear existing data for this symbol type
        _ = await clear_symbol_type(symbol_type)

        # Convert to symbol documents
        symbols_to_insert = []
        
        if symbol_type == "US":
            for us_symbol in raw_data:
                # Create separate documents for NYSE and NASDAQ
                display_symbol = f"{us_symbol['market_prefix']}:{us_symbol['symbol']}"
                symbol_doc = {
                    "symbol": display_symbol,
                    "name": us_symbol["name"],
                    "symbol_type": SymbolType.NYSE.value if us_symbol['market_prefix'] == "NYSE" else SymbolType.NASDAQ.value,
                    "currency": "USD",
                    "search_terms": [
                        us_symbol["name"].lower(),
                        us_symbol["symbol"].lower(),
                        display_symbol.lower()
                    ],
                    "market": us_symbol['market_prefix'],
                    "figi": us_symbol.get("figi", ""),
                    "mic": us_symbol.get("mic", ""),
                    "security_type": us_symbol.get("type", ""),
                    "is_active": True
                }
                symbols_to_insert.append(symbol_doc)
        
        elif symbol_type == "TASE":
            for tase_symbol in raw_data:
                symbol_doc = {
                    "symbol": tase_symbol["symbol"],
                    "name": tase_symbol["name"],
                    "symbol_type": SymbolType.TASE.value,
                    "currency": "ILS",
                    "search_terms": tase_symbol["search_terms"],
                    "tase_id": tase_symbol["security_id"],
                    "numeric_id": tase_symbol["numeric_id"],
                    "short_name": tase_symbol["name"],
                    "market": "TASE",
                    "is_active": True
                }
                symbols_to_insert.append(symbol_doc)
        
        elif symbol_type in ["CURRENCY", "CRYPTO"]:
            for currency_data in raw_data:
                target_symbol_type = SymbolType.CRYPTO if symbol_type == "CRYPTO" else SymbolType.CURRENCY
                
                symbol_doc = {
                    "symbol": currency_data["symbol"],
                    "name": currency_data["name"],
                    "symbol_type": target_symbol_type.value,
                    "currency": currency_data["symbol"],
                    "search_terms": currency_data["search_terms"],
                    "market": "CURRENCY" if symbol_type == "CURRENCY" else "CRYPTO",
                    "is_active": True
                }
                symbols_to_insert.append(symbol_doc)
        
        # Insert symbols
        if symbols_to_insert:
            collection = db_manager.get_collection("symbols")
            insert_result = await collection.insert_many(symbols_to_insert)
            result["count"] = len(insert_result.inserted_ids)
            result["action"] = "updated"
            
            # Update metadata
            await update_metadata(symbol_type, checksum, result["count"])
            
            logger.info(f"Successfully populated {result['count']} {symbol_type} symbols")
        
        return result
        
    except Exception as e:
        logger.error(f"Error populating {symbol_type} symbols: {e}")
        result["error"] = str(e)
        return result

async def ensure_indexes():
    """Ensure all necessary indexes exist"""
    collection = db_manager.get_collection("symbols")
    
    # Create indexes for better search performance
    await collection.create_index("symbol")
    await collection.create_index("name")
    await collection.create_index("symbol_type")
    await collection.create_index("search_terms")
    await collection.create_index("numeric_id")  # For Israeli numeric search
    await collection.create_index([("symbol", "text"), ("name", "text"), ("search_terms", "text")])
    logger.info("Ensured search indexes exist")

async def populate_symbols(force: bool = False, symbol_types: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Populate the symbols collection with symbol data from APIs.
    
    Args:
        force: If True, bypass checksum validation and force update
        symbol_types: List of symbol types to update (default: all)
    
    Returns:
        Dictionary with results for each symbol type
    """
    try:
        # Connect to database
        await db_manager.connect("vestika")
        
        # Determine which symbol types to process
        all_symbol_types = ["US", "TASE", "CURRENCY", "CRYPTO"]
        types_to_process = symbol_types if symbol_types else all_symbol_types
        
        results = {}
        
        # Process each symbol type
        for symbol_type in types_to_process:
            logger.info(f"Processing symbol type: {symbol_type}")
            result = await populate_symbol_type(symbol_type, force)
            results[symbol_type] = result
        
        # Ensure indexes exist
        await ensure_indexes()
        
        # Calculate summary statistics
        total_count = sum(r["count"] for r in results.values())
        updated_types = [k for k, v in results.items() if v["action"] == "updated"]
        skipped_types = [k for k, v in results.items() if v["action"] == "skipped"]
        error_types = [k for k, v in results.items() if v.get("error")]
        
        summary = {
            "total_symbols": total_count,
            "updated_types": updated_types,
            "skipped_types": skipped_types,
            "error_types": error_types,
            "details": results
        }
        
        logger.info(f"Population completed:")
        logger.info(f"  Total symbols: {total_count}")
        logger.info(f"  Updated types: {updated_types}")
        logger.info(f"  Skipped types: {skipped_types}")
        if error_types:
            logger.warning(f"  Error types: {error_types}")
        
        return summary
        
    except Exception as e:
        logger.error(f"Error populating symbols: {e}")
        raise

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate symbols from live APIs")
    parser.add_argument("--force", action="store_true", help="Force update all symbols")
    parser.add_argument("--types", nargs="+", choices=["US", "TASE", "CURRENCY", "CRYPTO"], 
                       help="Specific symbol types to update")
    
    args = parser.parse_args()
    
    asyncio.run(populate_symbols(force=args.force, symbol_types=args.types)) 