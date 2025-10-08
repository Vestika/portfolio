from typing import Any, Dict, List, Optional, Union
import asyncio
import inspect

# pynadlan provides async functions per PyPI docs
try:
	from pynadlan.api import get_avg_prices, get_rent_prices, get_autocomplete_lists
except Exception:  # pragma: no cover - allow code to import even if not installed yet
	get_avg_prices = None
	get_rent_prices = None
	get_autocomplete_lists = None


class RealEstatePricingService:
	"""Thin async wrapper around pynadlan with simple in-memory caching."""

	def __init__(self, ttl_seconds: int = 3600):
		self._ttl_seconds = ttl_seconds
		self._cache: dict[str, tuple[float, Any]] = {}
		self._lock = asyncio.Lock()

	async def _get_cached(self, key: str) -> Optional[Any]:
		async with self._lock:
			entry = self._cache.get(key)
			if not entry:
				return None
			ts, value = entry
			import time
			if (time.time() - ts) > self._ttl_seconds:
				self._cache.pop(key, None)
				return None
			return value

	async def _set_cached(self, key: str, value: Any) -> None:
		async with self._lock:
			import time
			self._cache[key] = (time.time(), value)

	async def fetch_autocomplete(self) -> Dict[str, List[str]]:
		cache_key = "autocomplete_lists"
		cached = await self._get_cached(cache_key)
		if cached is not None:
			return cached
		if get_autocomplete_lists is None:
			raise RuntimeError("pynadlan not installed")
		# Support both async and sync implementations
		res = get_autocomplete_lists()
		data = await res if inspect.isawaitable(res) else res
		await self._set_cached(cache_key, data)
		return data

	async def fetch_sell_prices(self, query: str, rooms: Optional[Union[int, List[int]]] = None) -> Dict[str, Optional[float]]:
		if get_avg_prices is None:
			raise RuntimeError("pynadlan not installed")
		res = get_avg_prices(query, rooms=rooms)
		return await res if inspect.isawaitable(res) else res

	async def fetch_rent_prices(self, query: str, rooms: Optional[Union[int, List[int]]] = None) -> Dict[str, Optional[float]]:
		if get_rent_prices is None:
			raise RuntimeError("pynadlan not installed")
		res = get_rent_prices(query, rooms=rooms)
		return await res if inspect.isawaitable(res) else res


_global_service: Optional[RealEstatePricingService] = None


def get_real_estate_service() -> RealEstatePricingService:
	global _global_service
	if _global_service is None:
		_global_service = RealEstatePricingService()
	return _global_service
