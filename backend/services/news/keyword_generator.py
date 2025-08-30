from __future__ import annotations

from typing import Any

from google import genai


ALLOWED_TOPICS = {
    "WORLD", "NATION", "BUSINESS", "TECHNOLOGY", "ENTERTAINMENT", "SPORTS", "SCIENCE", "HEALTH",
    "POLITICS", "CELEBRITIES", "TV", "MUSIC", "MOVIES", "THEATER", "SOCCER", "CYCLING",
    "MOTOR SPORTS", "TENNIS", "COMBAT SPORTS", "BASKETBALL", "BASEBALL", "FOOTBALL",
    "SPORTS BETTING", "WATER SPORTS", "HOCKEY", "GOLF", "CRICKET", "RUGBY", "ECONOMY",
    "PERSONAL FINANCE", "FINANCE", "DIGITAL CURRENCIES", "MOBILE", "ENERGY", "GAMING",
    "INTERNET SECURITY", "GADGETS", "VIRTUAL REALITY", "ROBOTICS", "NUTRITION", "PUBLIC HEALTH",
    "MENTAL HEALTH", "MEDICINE", "SPACE", "WILDLIFE", "ENVIRONMENT", "NEUROSCIENCE", "PHYSICS",
    "GEOLOGY", "PALEONTOLOGY", "SOCIAL SCIENCES", "EDUCATION", "JOBS", "ONLINE EDUCATION",
    "HIGHER EDUCATION", "VEHICLES", "ARTS-DESIGN", "BEAUTY", "FOOD", "TRAVEL", "SHOPPING",
    "HOME", "OUTDOORS", "FASHION",
}


class KeywordTopicGenerator:
    def __init__(self, api_key: str) -> None:
        self.client = genai.Client(api_key=api_key)

    async def generate(self, holdings: list[dict[str, Any]], max_keywords: int = 25, max_topics: int = 8) -> dict[str, list[str]]:
        # Build prompt
        symbols = sorted({h.get("symbol") for h in holdings if h.get("symbol")})
        names = sorted({h.get("name") for h in holdings if h.get("name")})
        sectors = sorted({h.get("sector") for h in holdings if h.get("sector")})

        system = (
            "You generate concise news search intents from an investment portfolio. "
            "Return JSON with 'keywords' and 'topics'. Topics must be a subset of the allowed list."
        )
        allowed = ", ".join(sorted(ALLOWED_TOPICS))
        user = {
            "symbols": symbols,
            "names": names,
            "sectors": sectors,
            "constraints": {
                "max_keywords": max_keywords,
                "max_topics": max_topics,
                "allowed_topics": allowed,
            },
        }

        # Use text response and parse JSON safely
        model = "gemini-2.0-flash"
        response = await self.client.models.generate_text_async(
            model=model,
            system_instruction=system,
            text=f"""Given this portfolio context (JSON), return a compact JSON object with keys 'keywords' and 'topics'.\n\n{user}\n\nRules:\n- keywords: <= {max_keywords}, lowercase phrases, no tickers-only unless well-known (e.g. 'apple stock').\n- topics: <= {max_topics}, strictly from allowed list.\n- Output must be pure JSON with those two keys only.\n""",
        )

        content = response.text or "{}"
        import json

        try:
            data = json.loads(content)
        except Exception:
            data = {"keywords": [], "topics": []}

        # Sanitize
        keywords = [str(k).strip() for k in (data.get("keywords") or []) if k]
        topics = [str(t).strip().upper() for t in (data.get("topics") or []) if t]
        topics = [t for t in topics if t in ALLOWED_TOPICS]

        return {"keywords": keywords[:max_keywords], "topics": topics[:max_topics]}


