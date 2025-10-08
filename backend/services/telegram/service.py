from __future__ import annotations

import asyncio
import logging
from typing import Optional, Dict, Any

from telegram import Bot

from config import settings

logger = logging.getLogger(__name__)


class TelegramService:
    """Lightweight Telegram sender using python-telegram-bot's Bot API.

    Lazily initializes a Bot with the token from settings and sends messages
    to a configured chat ID. If configuration is missing, calls are no-ops
    with warnings in logs instead of raising, so core flows are not blocked.
    """

    def __init__(self) -> None:
        self._bot: Optional[Bot] = None
        self._token: Optional[str] = settings.telegram_bot_token
        self._chat_id: Optional[str] = settings.telegram_chat_id

    def _ensure_bot(self) -> Optional[Bot]:
        if not self._token:
            logger.warning("Telegram bot token not configured; skipping Telegram send")
            return None
        if self._bot is None:
            self._bot = Bot(token=self._token)
        return self._bot

    async def send_text(self, text: str) -> bool:
        """Send a plain text message to the configured chat. Returns success."""
        if not self._chat_id:
            logger.warning("Telegram chat id not configured; skipping Telegram send")
            return False

        bot = self._ensure_bot()
        if bot is None:
            return False

        try:
            await bot.send_message(chat_id=self._chat_id, text=text)
            return True
        except Exception as exc:
            logger.error(f"Failed to send Telegram message: {exc}")
            return False

    @staticmethod
    def _format_feedback_message(doc: Dict[str, Any]) -> str:
        user_line = "Anonymous"
        if user := doc.get("user"):
            parts = [user.get("uid"), user.get("email"), user.get("name")]
            user_line = " | ".join([p for p in parts if p])

        meta_parts = []
        if doc.get("nps_score") is not None:
            meta_parts.append(f"NPS: {doc['nps_score']}")
        if cat := doc.get("category"):
            meta_parts.append(f"Category: {cat}")
        if page := doc.get("page_url"):
            meta_parts.append(f"Page: {page}")

        meta = " | ".join(meta_parts) if meta_parts else ""
        header = f"📝 New Feedback from {user_line}"
        body = doc.get("message", "").strip()
        contact = doc.get("contact_email")

        lines = [header]
        if meta:
            lines.append(meta)
        lines.append("")
        lines.append(body)
        if contact:
            lines.append("")
            lines.append(f"📬 Contact: {contact}")

        return "\n".join(lines)

    async def send_feedback(self, feedback_doc: Dict[str, Any]) -> bool:
        """Format and send a feedback document to Telegram."""
        text = self._format_feedback_message(feedback_doc)
        return await self.send_text(text)


_global_service: Optional[TelegramService] = None


def get_telegram_service() -> TelegramService:
    global _global_service
    if _global_service is None:
        _global_service = TelegramService()
    return _global_service


