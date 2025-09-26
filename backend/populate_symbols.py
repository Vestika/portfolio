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

# Initialize Maya client
maya = Maya()

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


async def symbols_collection_exists() -> bool:
    """Check if symbols collection has any data"""
    try:
        collection = db_manager.get_collection("symbols")
        count = await collection.count_documents({"is_active": True}, limit=1)
        return count > 0
    except Exception as e:
        logger.warning(f"Error checking symbols collection: {e}")
        return False


async def is_symbols_data_stale(max_age_days: int = 30) -> bool:
    """
    Check if symbols data is older than the specified number of days.
    Returns True if data needs to be updated, False if data is fresh.
    """
    try:
        # First check if any symbols exist at all
        if not await symbols_collection_exists():
            logger.info("No symbols found in database, population needed")
            return True
        
        metadata = await get_or_create_metadata()
        last_updated_dict = metadata.get("last_updated", {})
        
        if not last_updated_dict:
            logger.info("No symbols metadata found, population needed")
            return True
        
        # Check the most recent update across all symbol types
        most_recent_update = None
        for symbol_type, last_updated in last_updated_dict.items():
            if last_updated:
                if most_recent_update is None or last_updated > most_recent_update:
                    most_recent_update = last_updated
        
        if not most_recent_update:
            logger.info("No valid last_updated timestamps found, population needed")
            return True
        
        # Calculate age in days
        now = datetime.now()
        age_delta = now - most_recent_update
        age_days = age_delta.total_seconds() / (24 * 3600)
        
        is_stale = age_days > max_age_days
        
        if is_stale:
            logger.info(f"Symbols data is {age_days:.1f} days old (max age: {max_age_days} days), population needed")
        else:
            logger.info(f"Symbols data is {age_days:.1f} days old, still fresh (max age: {max_age_days} days)")
        
        return is_stale
        
    except Exception as e:
        logger.warning(f"Error checking symbols data age: {e}, assuming stale")
        return True

async def clear_symbol_type(symbol_type: str) -> int:
    """Clear all symbols of a specific type"""
    collection = db_manager.get_collection("symbols")
    
    # Simple, consistent clearing by symbol_type
    if symbol_type == "US":
        # Clear NYSE and NASDAQ (stored as separate types)
        nyse_result = await collection.delete_many({"symbol_type": "nyse"})
        nasdaq_result = await collection.delete_many({"symbol_type": "nasdaq"})
        total_deleted = nyse_result.deleted_count + nasdaq_result.deleted_count
    else:
        # Use lowercase symbol_type for consistency
        result = await collection.delete_many({"symbol_type": symbol_type.lower()})
        total_deleted = result.deleted_count
    
    logger.info(f"Cleared {total_deleted} existing {symbol_type} symbols")
    return total_deleted

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
        # Get all securities
        all_securities = maya.get_all_securities()
        logger.info(f"Found {len(all_securities)} securities from PyMaya")
        
        # Use dictionaries to track securities and handle both short/long ID variations
        securities_by_id = {}
        securities_by_name_type = {}  # To catch same stock with different IDs
        
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
            
            # Normalize security_id to remove leading zeros for consistency
            normalized_security_id = str(int(security_id)) if str(security_id).isdigit() else str(security_id)
            
            # Create a key for detecting same stock with different representations
            # Use just the name to catch all variations of the same stock
            stock_key = name.strip().upper()
            
            # Determine the canonical ID - prefer longer numeric IDs 
            canonical_id = normalized_security_id
            
            # Check if we already have this stock with a different ID representation
            existing_stock = None
            if stock_key in securities_by_name_type:
                existing_stock = securities_by_name_type[stock_key]
                existing_id = existing_stock["security_id"]
                
                # Always prefer the longer numeric ID for better specificity
                if existing_id.isdigit() and normalized_security_id.isdigit():
                    if len(normalized_security_id) > len(existing_id):
                        canonical_id = normalized_security_id
                        # Remove old entry and use new canonical ID
                        if existing_id in securities_by_id:
                            del securities_by_id[existing_id]
                    else:
                        canonical_id = existing_id
                        continue  # Skip this entry, use the existing longer ID
                else:
                    # If one is numeric and the other isn't, prefer numeric
                    if normalized_security_id.isdigit() and not existing_id.isdigit():
                        canonical_id = normalized_security_id
                        if existing_id in securities_by_id:
                            del securities_by_id[existing_id]
                    else:
                        canonical_id = existing_id
                        continue  # Skip this entry, already processed
            
            # Always prefer the numeric ID format for the symbol
            formatted_symbol = f"{canonical_id}.TA"
                
            # Create comprehensive search terms
            search_terms = []
            
            # Add name variations
            if name:
                search_terms.extend([name.lower(), name.upper()])
            
            # Add the canonical security ID
            search_terms.append(canonical_id)
            
            # Add symbol variations 
            search_terms.append(formatted_symbol.lower())
            search_terms.append(canonical_id)
            
            # Add original symbol if different from canonical ID and not just leading zeros
            if symbol:
                # Remove leading zeros from symbol for comparison
                symbol_normalized = str(int(symbol)) if symbol.isdigit() else symbol
                if symbol_normalized != canonical_id:
                    # Only add the normalized version without leading zeros
                    search_terms.append(symbol_normalized.lower())
                    search_terms.append(f"{symbol_normalized}.TA".lower())
            
            # Remove empty terms, duplicates, and overly short numeric prefixes (less than 4 chars)
            # Also filter out terms that are just leading zero versions of the canonical ID
            canonical_id_int = int(canonical_id) if canonical_id.isdigit() else None
            search_terms = list(set([
                term for term in search_terms 
                if term and (
                    not term.replace('.ta', '').isdigit() or 
                    len(term.replace('.ta', '')) >= 4
                ) and (
                    # Filter out leading zero versions of the canonical ID
                    canonical_id_int is None or 
                    not term.replace('.ta', '').isdigit() or
                    int(term.replace('.ta', '')) != canonical_id_int or
                    term.replace('.ta', '') == canonical_id
                )
            ]))
            
            # Store the canonical entry
            securities_by_id[canonical_id] = {
                "security_id": canonical_id,  
                "symbol": formatted_symbol,  # Always use numeric format
                "name": name,
                "search_terms": search_terms,
                "original_symbol": symbol,
                "security_type": security_type,
                "subtype_desc": security.get('SubTypeDesc', '')
            }
            
            # Track by name+type for deduplication
            securities_by_name_type[stock_key] = securities_by_id[canonical_id]
        
        tase_securities = list(securities_by_id.values())
        logger.info(f"Processed {len(tase_securities)} unique TASE securities (removed duplicates)")
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
        
        # Convert to the format expected by populate_symbols with same logic as API fetch
        securities_by_id = {}
        
        for tase_symbol in tase_data:
            tase_id = tase_symbol["tase_id"]
            
            # Normalize security_id to remove leading zeros 
            normalized_security_id = str(int(tase_id)) if str(tase_id).isdigit() else str(tase_id)
            
            # Always use numeric format for consistency
            formatted_symbol = f"{normalized_security_id}.TA"
            name = tase_symbol["short_name"]
            original_symbol = tase_symbol["symbol"].replace(".TA", "")
            
            # Create comprehensive search terms
            search_terms = []
            
            # Add name variations
            if name:
                search_terms.extend([name.lower(), name.upper()])
            
            # Add the normalized security ID
            search_terms.append(normalized_security_id)
            
            # Add symbol variations
            search_terms.append(formatted_symbol.lower())
            search_terms.append(normalized_security_id)
            
            # Add original symbol if different from numeric
            if original_symbol and original_symbol != normalized_security_id:
                search_terms.append(original_symbol.lower())
                search_terms.append(f"{original_symbol}.TA".lower())
            
            # Remove empty terms, duplicates, and overly short numeric prefixes
            search_terms = list(set([
                term for term in search_terms 
                if term and len(term) >= 3  # Filter out short prefixes like "629"
            ]))
            
            securities_by_id[normalized_security_id] = {
                "security_id": normalized_security_id,
                "symbol": formatted_symbol,  # Always use numeric format
                "name": name,
                "search_terms": search_terms,
                "original_symbol": original_symbol,
            }
            
        converted_securities = list(securities_by_id.values())
        logger.info(f"Processed {len(converted_securities)} unique TASE securities from JSON (removed duplicates)")
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
                    "tase_id": tase_symbol["security_id"],  # Keep only tase_id, removed numeric_id
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

async def cleanup_duplicate_symbols() -> Dict[str, int]:
    """
    Comprehensive cleanup of duplicate symbols in the database.
    Use this to fix data quality issues caused by incomplete clearing.
    """
    logger.info("Starting comprehensive symbol cleanup...")
    collection = db_manager.get_collection("symbols")
    
    cleanup_stats = {
        "total_before": 0,
        "duplicates_removed": 0,
        "final_count": 0
    }
    
    try:
        # Count total symbols before cleanup
        cleanup_stats["total_before"] = await collection.count_documents({})
        
        # Remove symbols with empty or invalid data
        invalid_result = await collection.delete_many({
            "$or": [
                {"symbol": {"$in": ["", None]}},
                {"name": {"$in": ["", None]}},
                {"symbol_type": {"$in": ["", None]}},
                {"is_active": {"$ne": True}}
            ]
        })
        logger.info(f"Removed {invalid_result.deleted_count} invalid symbols")
        
        # Remove duplicate TASE symbols - keep only one per symbol+name combination
        pipeline = [
            {"$match": {"symbol_type": {"$in": ["TASE", "tase"]}}},
            {"$group": {
                "_id": {"symbol": "$symbol", "name": "$name"},
                "docs": {"$push": "$$ROOT"},
                "count": {"$sum": 1}
            }},
            {"$match": {"count": {"$gt": 1}}}
        ]
        
        duplicates_cursor = collection.aggregate(pipeline)
        duplicates_removed = 0
        
        async for duplicate_group in duplicates_cursor:
            docs = duplicate_group["docs"]
            # Keep the first document, remove the rest
            for doc_to_remove in docs[1:]:
                await collection.delete_one({"_id": doc_to_remove["_id"]})
                duplicates_removed += 1
        
        cleanup_stats["duplicates_removed"] = duplicates_removed + invalid_result.deleted_count
        cleanup_stats["final_count"] = await collection.count_documents({})
        
        logger.info(f"Cleanup completed: {cleanup_stats['total_before']} → {cleanup_stats['final_count']} symbols (removed {cleanup_stats['duplicates_removed']} duplicates)")
        
        return cleanup_stats
        
    except Exception as e:
        logger.error(f"Error during symbol cleanup: {e}")
        raise


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