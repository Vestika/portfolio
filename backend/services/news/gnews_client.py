from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from gnews import GNews


class GNewsClient:
    def __init__(
        self,
        language: str = "en",
        country: str = "US",
        max_results: int = 99,
        exclude_websites: list[str] | None = None,
    ) -> None:
        self.client = GNews(
            language=language,
            country=country,
            max_results=max_results,
        )
        if exclude_websites:
            self.client.exclude_websites = exclude_websites

    def set_window(self, start_date: datetime | None, end_date: datetime | None) -> None:
        self.client.start_date = start_date
        self.client.end_date = end_date

    def fetch_by_keywords(self, keywords: Iterable[str]) -> list[dict[str, Any]]:
        articles: list[dict[str, Any]] = []
        for keyword in keywords:
            if not keyword:
                continue
            try:
                articles.extend(self.client.get_news(keyword))
            except Exception:
                # best-effort; continue on single-keyword failure
                continue
        return articles

    def fetch_by_topics(self, topics: Iterable[str]) -> list[dict[str, Any]]:
        articles: list[dict[str, Any]] = []
        for topic in topics:
            if not topic:
                continue
            try:
                articles.extend(self.client.get_news_by_topic(topic))
            except Exception:
                continue
        return articles


