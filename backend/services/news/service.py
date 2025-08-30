from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlparse, urlunparse, parse_qsl

from core.database import db_manager
from services.news.gnews_client import GNewsClient


def normalize_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        # drop query tracking params
        qs = [(k, v) for k, v in parse_qsl(parsed.query) if k.lower() not in {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"}]
        clean = parsed._replace(query="&".join([f"{k}={v}" for k, v in qs]), fragment="")
        # lowercase host and path
        clean = clean._replace(netloc=clean.netloc.lower(), path=clean.path)
        return urlunparse(clean)
    except Exception:
        return url


def article_id_from_url(url: str) -> str:
    normalized = normalize_url(url)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class NewsService:
    def __init__(self, language: str = "en", country: str = "US") -> None:
        self.language = language
        self.country = country

    async def fetch_feed(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        keywords: list[str] | set[str],
        topics: list[str] | set[str],
        max_results: int = 2,
    ) -> list[dict[str, Any]]:
        client = GNewsClient(language=self.language, country=self.country, max_results=max_results)
        client.set_window(start_date, end_date)

        by_kw = client.fetch_by_keywords(keywords)
        by_topic = client.fetch_by_topics(topics)
        raw = by_kw + by_topic

        # Canonicalize and dedupe
        items: dict[str, dict[str, Any]] = {}
        for art in raw:
            url = art.get("url") or art.get("link")
            if not url:
                continue
            aid = article_id_from_url(url)
            if aid in items:
                continue
            items[aid] = {
                "id": aid,
                "title": art.get("title"),
                "description": art.get("description"),
                "url": url,
                "imageUrl": art.get("image") or art.get("thumbnail") or None,
                "publishedAt": self._extract_published(art),
                "source": str(art.get("publisher") or art.get("source") or ""),
                "topic": art.get("topic"),
                "keywords": [],  # optionally backfilled
            }

        # Exclude already seen
        # seen_ids = await self._get_seen_ids(user_id)
        # result = [v for k, v in items.items() if k not in seen_ids]
        result =  [v for k, v in items.items()]

        # Sort newest first
        result.sort(key=lambda x: x.get("publishedAt") or "", reverse=True)
        return result

    async def _get_seen_ids(self, user_id: str) -> set[str]:
        try:
            col = db_manager.get_collection("news_seen")
            seen = set()
            async for doc in col.find({"user_id": user_id}, {"_id": 0, "article_id": 1}):
                seen.add(doc["article_id"])
            return seen
        except Exception:
            return set()

    @staticmethod
    def _extract_published(article: dict[str, Any]) -> str | None:
        for key in ("published date", "publishedAt", "published"):
            val = article.get(key)
            if val:
                try:
                    # Many formats; return raw string for now (ISO is ideal if provided)
                    return str(val)
                except Exception:
                    pass
        return None


