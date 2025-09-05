"""Market data endpoints"""
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import get_current_user
from core.database import db_manager
from services.closing_price.price_manager import PriceManager

# Create router for this module
router = APIRouter()

logger = logging.Logger(__name__)

@router.get("/market-status")
async def get_market_status(user=Depends(get_current_user)):
    """Return both US and TASE market open/closed status."""
    manager = PriceManager()
    return await manager.get_market_status()

@router.get("/symbols/autocomplete")
async def get_symbol_autocomplete(q: str = Query(..., min_length=2, max_length=50)) -> list[dict]:
    """
    Get autocomplete suggestions for symbols based on search query.
    Searches by symbol, name, or search terms.
    """
    try:
        collection = db_manager.get_collection("symbols")

        # Use MongoDB text search for better performance and relevance
        query = {
            "$and": [
                {"is_active": True},
                {"$text": {"$search": q}}
            ]
        }

        # First try text search, then fall back to manual filtering if needed
        cursor = collection.find(query).limit(20)
        results = []

        # Collect results from text search
        async for doc in cursor:
            results.append({
                "symbol": doc["symbol"],
                "name": doc["name"],
                "symbol_type": doc["symbol_type"],
                "currency": doc["currency"],
                "short_name": doc.get("short_name", ""),
                "market": doc.get("market", ""),
                "sector": doc.get("sector", "")
            })

        # If text search returns few results, supplement with manual filtering
        if len(results) < 10:
            q_lower = q.lower()

            # Check if query is numeric (for Israeli securities)
            is_numeric = q.isdigit()
            
            # Create multiple search conditions for better coverage
            manual_query_conditions = [
                {"symbol": {"$regex": q_lower, "$options": "i"}},
                {"name": {"$regex": q_lower, "$options": "i"}},
                {"short_name": {"$regex": q_lower, "$options": "i"}},
                {"search_terms": q_lower}  # Exact match in array
            ]

            # Add search terms with regex for partial matches
            # Check for each array element individually
            search_terms_regex_conditions = []
            for term_regex in [q_lower, q_lower.replace(":", ""), q_lower.replace("nasdaq:", ""), q_lower.replace("nyse:", "")]:
                if term_regex:
                    search_terms_regex_conditions.append({"search_terms": {"$regex": term_regex, "$options": "i"}})

            if search_terms_regex_conditions:
                manual_query_conditions.extend(search_terms_regex_conditions)

            # Add simple fuzzy matching for common cases
            if len(q_lower) >= 3:
                # For queries like "msf" -> also search for "msft"
                fuzzy_variants = []

                # Add one character at the end (most common typo)
                for char in 'abcdefghijklmnopqrstuvwxyz':
                    fuzzy_variant = q_lower + char
                    if len(fuzzy_variant) <= 6:
                        fuzzy_variants.append(fuzzy_variant)

                # Remove last character (if query might be too long)
                if len(q_lower) > 3:
                    fuzzy_variants.append(q_lower[:-1])

                # Add fuzzy conditions for the most likely variants
                for variant in fuzzy_variants[:5]:  # Limit to top 5 variants
                    manual_query_conditions.extend([
                        {"search_terms": variant},
                        {"symbol": {"$regex": f":{variant}$", "$options": "i"}}
                    ])

            # Add numeric search for Israeli securities if query is numeric
            if is_numeric:
                manual_query_conditions.extend([
                    {"numeric_id": q},
                    {"tase_id": q}
                ])

            manual_query = {
                "$and": [
                    {"is_active": True},
                    {"$or": manual_query_conditions}
                ]
            }

            manual_cursor = collection.find(manual_query).limit(100)

            manual_results = []
            async for doc in manual_cursor:
                # Skip if we already have this result
                if any(r["symbol"] == doc["symbol"] for r in results):
                    continue

                manual_results.append({
                    "symbol": doc["symbol"],
                    "name": doc["name"],
                    "symbol_type": doc["symbol_type"],
                    "currency": doc["currency"],
                    "short_name": doc.get("short_name", ""),
                    "market": doc.get("market", ""),
                    "sector": doc.get("sector", "")
                })

            # Add manual results to main results
            results.extend(manual_results)

        # Sort results by relevance - exact symbol matches first
        def sort_key(item):
            symbol_lower = item["symbol"].lower()
            name_lower = item["name"].lower()
            q_lower = q.lower()

            # Extract base symbol for comparison (remove prefixes/suffixes)
            base_symbol = symbol_lower.replace("nyse:", "").replace("nasdaq:", "").replace(".ta", "")

            # Calculate edit distance for fuzzy matching
            def edit_distance(s1, s2):
                if len(s1) > len(s2):
                    s1, s2 = s2, s1
                distances = list(range(len(s1) + 1))
                for i2, c2 in enumerate(s2):
                    distances_ = [i2 + 1]
                    for i1, c1 in enumerate(s1):
                        if c1 == c2:
                            distances_.append(distances[i1])
                        else:
                            distances_.append(1 + min((distances[i1], distances[i1 + 1], distances_[-1])))
                    distances = distances_
                return distances[-1]

            # Calculate similarity scores
            base_edit_distance = edit_distance(q_lower, base_symbol)
            symbol_edit_distance = edit_distance(q_lower, symbol_lower)

            # Priority scoring with fuzzy matching
            if symbol_lower == q_lower:
                return (0, 0, symbol_lower)  # Exact symbol match
            elif base_symbol == q_lower:
                return (1, 0, symbol_lower)  # Base symbol exact match
            elif symbol_lower.startswith(q_lower):
                return (2, 0, symbol_lower)  # Symbol starts with query
            elif base_symbol.startswith(q_lower):
                return (3, 0, symbol_lower)  # Base symbol starts with query
            elif name_lower.startswith(q_lower):
                return (4, 0, name_lower)  # Name starts with query
            elif q_lower in base_symbol:
                return (5, 0, symbol_lower)  # Base symbol contains query
            elif q_lower in symbol_lower:
                return (6, 0, symbol_lower)  # Symbol contains query
            elif q_lower in name_lower:
                return (7, 0, name_lower)  # Name contains query
            elif base_edit_distance <= 2:  # Fuzzy match on base symbol (up to 2 edits)
                return (8, base_edit_distance, symbol_lower)  # Fuzzy match on base symbol
            elif symbol_edit_distance <= 2:  # Fuzzy match on full symbol (up to 2 edits)
                return (9, symbol_edit_distance, symbol_lower)  # Fuzzy match on symbol
            else:
                return (10, symbol_edit_distance, name_lower)  # Fallback with edit distance
        
        results.sort(key=sort_key)

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/symbols/populate")
async def populate_symbols_api(
    force: bool = Query(False, description="Force update all symbols, bypassing checksum validation"),
    symbol_types: Optional[List[str]] = Query(None, description="Specific symbol types to update (US, TASE, CURRENCY, CRYPTO)")
) -> dict[str, Any]:
    """
    API endpoint to populate the symbols collection using live APIs.
    - Uses Finnhub.io API for NYSE and NASDAQ securities
    - Uses PyMaya API for TASE securities
    - Includes currencies and crypto
    - Supports checksum-based incremental updates
    """
    try:
        # Import the consolidated populate_symbols function
        from populate_symbols import populate_symbols

        # Call the consolidated function
        result = await populate_symbols(force=force, symbol_types=symbol_types)

        # Get sample symbols for response
        sample_symbols = []
        if result["total_symbols"] > 0:
            collection = db_manager.get_collection("symbols")
            sample_cursor = collection.find({"is_active": True}).limit(5)
            async for doc in sample_cursor:
                sample_symbols.append({
                    "symbol": doc["symbol"],
                    "name": doc["name"],
                    "symbol_type": doc["symbol_type"],
                    "currency": doc["currency"],
                    "market": doc.get("market", ""),
                    "search_terms": doc.get("search_terms", [])[:3]  # Limit to first 3 terms
                })
        
        return {
            "success": True,
            "message": f"Symbols population completed. Updated: {result['updated_types']}, Skipped: {result['skipped_types']}",
            "stats": {
                "total_symbols": result["total_symbols"],
                "updated_types": result["updated_types"],
                "skipped_types": result["skipped_types"],
                "error_types": result["error_types"]
            },
            "details": result["details"],
            "sample_symbols": sample_symbols
        }

    except Exception as e:
        logger.error(f"Error populating symbols via API: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to populate symbols: {str(e)}")