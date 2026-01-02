"""News feed endpoints"""
import asyncio
import json
from typing import Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.auth import get_current_user
from core.database import db_manager
from services.news.service import NewsService
from models.portfolio import Portfolio

# Create router for this module
router = APIRouter()

# Initialize services
news_service = NewsService()

# Request/Response models
class NewsFeedRequest(BaseModel):
    page_size: int | None = 99

@router.get("/api/news/feed/stream")
async def stream_news_feed(user=Depends(get_current_user)):
    """Stream news articles as they're discovered"""
    async def generate():
        try:
            # Only fetch news from the last week
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=7)

            # Derive keywords from user's holdings
            portfolios_col = db_manager.get_collection("portfolios")
            holdings_ctx: list[dict[str, Any]] = []
            
            async for doc in portfolios_col.find({"user_id": user.id}):
                p = Portfolio.from_dict(doc)
                for acc in p.accounts:
                    for h in acc.holdings:
                        sec = p.securities.get(h.symbol)
                        holdings_ctx.append({
                            "symbol": h.symbol,
                            "name": getattr(sec, "name", h.symbol) if sec else h.symbol,
                        })
            
            # Use symbols as keywords (more consistent than names)
            # Keep crypto symbols (BTC, ETH, etc.)
            keywords = []
            seen = set()
            
            for holding in holdings_ctx:
                symbol = holding.get("symbol", "")
                
                # Skip currencies, FX pairs, and numeric-only symbols
                if not symbol or symbol in ["USD", "ILS", "EUR", "GBP"]:
                    continue
                if symbol.startswith("FX:"):
                    continue
                # Skip numeric-only symbols (like TASE symbols: 1185164, 629014, etc.)
                if symbol.isdigit():
                    continue
                
                # Deduplicate
                if symbol.lower() in seen:
                    continue
                seen.add(symbol.lower())
                keywords.append(symbol)
            
            print(f"📰 [NEWS STREAM] Total holdings: {len(holdings_ctx)}")
            print(f"📰 [NEWS STREAM] Using all {len(keywords)} symbol keywords")
            
            # Send keywords immediately at the start
            yield f"data: {json.dumps({'keywords': keywords})}\n\n"
            
            # Stream articles as they come in
            seen_article_ids = set()
            from services.news.gnews_client import GNewsClient
            client = GNewsClient(
                language="en",
                country="US",
                max_results=3  # 3 per keyword
            )
            client.set_window(start_dt, end_dt)
            
            for keyword in keywords:
                try:
                    print(f"  📡 [NEWS STREAM] Fetching for keyword: {keyword}")
                    articles = client.fetch_by_keywords([keyword])
                    
                    # Limit to first 3 articles per keyword and sort by date
                    articles = sorted(
                        articles, 
                        key=lambda a: a.get('published date', '') or a.get('publishedAt', '') or '', 
                        reverse=True
                    )[:3]
                    
                    for art in articles:
                        url = art.get("url") or art.get("link")
                        if not url:
                            continue
                        
                        # Generate article ID for deduplication
                        from services.news.service import article_id_from_url
                        aid = article_id_from_url(url)
                        
                        if aid in seen_article_ids:
                            continue
                        seen_article_ids.add(aid)
                        
                        # Format article
                        item = {
                            "id": aid,
                            "title": art.get("title"),
                            "description": art.get("description"),
                            "url": url,
                            "imageUrl": art.get("image") or art.get("thumbnail") or None,
                            "publishedAt": news_service._extract_published(art),
                            "source": str(art.get("publisher") or art.get("source") or ""),
                            "topic": art.get("topic"),
                            "keywords": [keyword],
                            "symbol_logos": []
                        }
                        
                        # Send article to client
                        yield f"data: {json.dumps(item)}\n\n"
                        print(f"  ✅ [NEWS STREAM] Sent article: {item['title'][:50]}")
                        
                except Exception as e:
                    print(f"  ⚠️ [NEWS STREAM] Error with keyword {keyword}: {e}")
                    continue
            
            # Send completion signal
            yield f"data: {json.dumps({'done': True})}\n\n"
            print(f"📰 [NEWS STREAM] Stream completed. Sent {len(seen_article_ids)} unique articles")
            
        except Exception as e:
            print(f"❌ [NEWS STREAM] Error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/api/news/feed")
async def get_news_feed(req: NewsFeedRequest, user=Depends(get_current_user)):
    print(f"📰 [NEWS] Starting news feed fetch for user {user.id}")
    # Only fetch news from the last week
    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=7)

    # Derive keywords from user's holdings
    portfolios_col = db_manager.get_collection("portfolios")
    holdings_ctx: list[dict[str, Any]] = []
    
    async for doc in portfolios_col.find({"user_id": user.id}):
        p = Portfolio.from_dict(doc)
        for acc in p.accounts:
            for h in acc.holdings:
                sec = p.securities.get(h.symbol)
                holdings_ctx.append({
                    "symbol": h.symbol,
                    "name": getattr(sec, "name", h.symbol) if sec else h.symbol,
                })
    
    # Use company names as keywords, filtering out currencies and technical symbols
    keywords = []
    seen = set()
    for holding in holdings_ctx:
        name = holding.get("name", "")
        symbol = holding.get("symbol", "")
        
        # Skip currencies, FX pairs, and technical symbols
        if not name or name in ["USD", "ILS", "EUR", "GBP"]:
            continue
        if name.startswith("FX:") or symbol.startswith("FX:"):
            continue
        if "-USD" in name or "-USD" in symbol:  # Skip crypto pairs like BTC-USD, ETH-USD
            continue
        
        # Deduplicate
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        keywords.append(name)
    
    # Limit to first 5 keywords for speed
    if len(keywords) > 5:
        keywords = keywords[:5]
    
    print(f"📰 [NEWS] Fetching news with {len(keywords)} keywords: {keywords}")

    # Add timeout to prevent infinite hangs (20 seconds max)
    try:
        items = await asyncio.wait_for(
            news_service.fetch_feed(
                user_id=user.id,
                start_date=start_dt,
                end_date=end_dt,
                keywords=set(keywords),
                topics=set(),
                max_results=3,  # Only 3 articles per keyword for speed
            ),
            timeout=20.0
        )
    except asyncio.TimeoutError:
        print(f"⚠️ [NEWS] Fetch timed out after 20 seconds")
        # Return empty result on timeout rather than failing
        items = []
    except Exception as e:
        print(f"❌ [NEWS] Error fetching news: {e}")
        items = []

    # Limit total results to 30 most recent articles
    if len(items) > 30:
        items = items[:30]
    
    # Fetch Open Graph images or use microlink.io for missing images
    await enrich_article_images(items)
    
    # Add logos to news items
    for item in items:
        item["symbol_logos"] = []  # Initialize empty

    print(f"📰 [NEWS] Returning {len(items)} news items")
    
    return {
        "items": items,
        "used_keywords": keywords,
    }
