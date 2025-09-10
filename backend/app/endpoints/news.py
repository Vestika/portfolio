"""News feed endpoints"""
from typing import Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import get_current_user
from core.database import db_manager
from services.news.service import NewsService
from services.news.keyword_generator import KeywordTopicGenerator
from services.closing_price.price_manager import PriceManager
from models.portfolio import Portfolio

# Create router for this module
router = APIRouter()

# Initialize services
news_service = NewsService()
price_manager = PriceManager()

# Request/Response models
class NewsFeedRequest(BaseModel):
    start_date: str | None = None  # ISO
    end_date: str | None = None    # ISO
    topics: list[str] | None = None
    keywords: list[str] | None = None
    page_size: int | None = 99
    sources: list[str] | None = None
    q: str | None = None

class FeedbackRequest(BaseModel):
    articleId: str
    action: str  # like | dislike

@router.post("/api/news/feed")
async def get_news_feed(req: NewsFeedRequest, user=Depends(get_current_user)):
    import os

    # Date window
    end_dt = datetime.fromisoformat(req.end_date) if (req.end_date) else datetime.utcnow()
    start_dt = datetime.fromisoformat(req.start_date) if (req.start_date) else end_dt - timedelta(days=7)

    # Derive keywords/topics if not provided using user's holdings
    keywords = req.keywords or []
    topics = req.topics or []
    symbols_set = set()  # Track unique symbols for logo fetching
    if not keywords or not topics:
        # Aggregate holdings across all portfolios
        portfolios_col = db_manager.get_collection("portfolios")
        holdings_ctx: list[dict[str, Any]] = []
        async for doc in portfolios_col.find({"user_id": user.id}):
            p = Portfolio.from_dict(doc)
            for acc in p.accounts:
                for h in acc.holdings:
                    sec = p.securities.get(h.symbol)
                    symbols_set.add(h.symbol)  # Collect symbols for logo fetching
                    holdings_ctx.append({
                        "symbol": h.symbol,
                        "name": getattr(sec, "name", h.symbol) if sec else h.symbol,
                        "sector": getattr(sec, "tags", {}).get("sector") if sec else None,
                    })
        api_key = os.getenv("NOT_GEMINI_API_KEY", "")
        if api_key and False:
            # we dont want to pay for this right now
            generator = KeywordTopicGenerator(api_key=api_key)
            try:
                data = await generator.generate(holdings_ctx)
                if not keywords:
                    keywords = data.get("keywords", [])
                if not topics:
                    topics = data.get("topics", [])
            except Exception:
                pass
        keywords += [holding.get("name") for holding in holdings_ctx if holding.get("name") not in ["USD", "ILS"]]

    items = await news_service.fetch_feed(
        user_id=user.id,
        start_date=start_dt,
        end_date=end_dt,
        keywords=set(keywords),
        topics=set(topics),
        max_results=2,
    )

    # Optional source filter (by domain or publisher contains)
    if req.sources:
        import re
        from urllib.parse import urlparse
        wanted = [s.strip().lower() for s in req.sources if s and s.strip()]
        def matches_source(item: dict[str, Any]) -> bool:
            try:
                netloc = urlparse(item.get("url", "")).netloc.lower()
            except Exception:
                netloc = ""
            publisher = (item.get("source") or "").lower()
            for s in wanted:
                if s in netloc or s in publisher or netloc.endswith(s):
                    return True
            return False
        items = [it for it in items if matches_source(it)]

    # Optional free-text filter across title/description/source/topic/domain
    if req.q:
        from urllib.parse import urlparse
        needle = req.q.strip().lower()
        def matches_q(item: dict[str, Any]) -> bool:
            title = (item.get("title") or "").lower()
            desc = (item.get("description") or "").lower()
            src = (item.get("source") or "").lower()
            topic = (item.get("topic") or "").lower()
            try:
                domain = urlparse(item.get("url", "")).netloc.lower()
            except Exception:
                domain = ""
            return (
                needle in title
                or needle in desc
                or needle in src
                or needle in topic
                or needle in domain
            )
        items = [it for it in items if matches_q(it)]

    # Add logos to news items based on symbols from user's holdings
    if symbols_set:
        # Create a mapping of symbol to logo URL
        symbol_logos = {}
        for symbol in symbols_set:
            try:
                logo_url = await price_manager.get_logo(symbol)
                if logo_url:
                    symbol_logos[symbol] = logo_url
            except Exception as e:
                # Log error but continue processing
                print(f"Error fetching logo for {symbol}: {e}")
        
        # Add logo URLs to news items based on symbol matching
        for item in items:
            item_logos = []
            # Check if any of the user's symbols appear in the news item
            for symbol in symbols_set:
                if (symbol.lower() in (item.get("title", "").lower()) or 
                    symbol.lower() in (item.get("description", "").lower()) or
                    symbol.lower() in (item.get("source", "").lower())):
                    if symbol in symbol_logos:
                        item_logos.append({
                            "symbol": symbol,
                            "logo_url": symbol_logos[symbol]
                        })
                        break  # Stop after finding the first match
            item["symbol_logos"] = item_logos

    # Compute next window for older items
    next_window = None
    if items:
        try:
            oldest_str = items[-1]["publishedAt"]
            oldest_dt = datetime.fromisoformat(str(oldest_str).replace("Z", "+00:00"))
            next_end = oldest_dt - timedelta(seconds=1)
            next_start = next_end - timedelta(days=7)
            next_window = {"start_date": next_start.isoformat(), "end_date": next_end.isoformat()}
        except Exception:
            pass

    return {
        "items": items,
        "next_window": next_window,
        "used_keywords": keywords,
        "used_topics": topics,
    }

@router.post("/api/news/feedback")
async def post_news_feedback(req: FeedbackRequest, user=Depends(get_current_user)):
    if req.action not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="Invalid action")
    col = db_manager.get_collection("news_feedback")
    await col.insert_one({
        "user_id": user.id,
        "article_id": req.articleId,
        "action": req.action,
        "created_at": datetime.utcnow().isoformat(),
    })
    return {"ok": True}