from typing import Any, Dict, List, Optional, Union
import asyncio
import inspect

# pynadlan provides async functions - updated to new API
try:
	from pynadlan.api import (
		get_autocomplete_lists,
		get_neighborhoods_summary,
		get_city_timeseries
	)
except Exception:  # pragma: no cover - allow code to import even if not installed yet
	get_autocomplete_lists = None
	get_neighborhoods_summary = None
	get_city_timeseries = None


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
		"""
		Fetch median sale prices using new pynadlan API.
		Query format: "city" or "city, neighborhood"
		Returns dict mapping room count (as string) to median price.
		"""
		if get_city_timeseries is None:
			raise RuntimeError("pynadlan not installed")

		# Parse query - can be "city" or "city, neighborhood"
		if "," in query:
			parts = query.split(",", 1)
			city = parts[0].strip()
			neighborhood_filter = parts[1].strip()
		else:
			city = query.strip()
			neighborhood_filter = None

		# For neighborhood-level pricing, use neighborhoods_summary
		if neighborhood_filter and get_neighborhoods_summary is not None:
			try:
				summary = await get_neighborhoods_summary(city=city, min_deals=5)
				neighborhoods = summary.get("neighborhoods", [])

				# Filter to matching neighborhood
				matching = [
					n for n in neighborhoods
					if neighborhood_filter.lower() in n.get("neighborhood", "").lower()
				]

				if matching:
					# Use the first matching neighborhood's median price
					median_price = matching[0].get("median_price")
					if median_price:
						# Return same price for all room counts (neighborhood-level data)
						if rooms:
							return {str(rooms): median_price}
						else:
							return {
								"2": median_price,
								"3": median_price,
								"4": median_price,
								"5": median_price,
							}
			except Exception:
				pass  # Fall through to city-level data

		# City-level: use timeseries to get room category breakdown
		try:
			timeseries = await get_city_timeseries(
				city=city,
				property_type="apartment",
				time_range="1year"
			)

			# Extract room category summaries with latest prices
			summaries = timeseries.get("summaries", {})
			prices = {}

			# Map Hebrew room categories to room count strings
			# pynadlan returns keys like: "3 חדרים", "4 חדרים", "5 חדרים", "1-2 חדרים", "6+ חדרים"
			for category, summary_data in summaries.items():
				latest_price = summary_data.get("latestPrice")
				if not latest_price:
					continue

				# Extract room number from Hebrew category
				# Examples: "3 חדרים" -> "3", "1-2 חדרים" -> "2", "6+ חדרים" -> "6"
				if "1-2" in category:
					prices["2"] = latest_price
				elif "3" in category and "+" not in category:
					prices["3"] = latest_price
				elif "4" in category and "+" not in category:
					prices["4"] = latest_price
				elif "5" in category and "+" not in category:
					prices["5"] = latest_price
				elif "6" in category:
					# Both "6 חדרים" and "6+ חדרים" map to 6+
					if "6" not in prices:
						prices["6"] = latest_price

			# If specific rooms requested, filter to that
			if rooms:
				room_str = str(rooms)
				if room_str in prices:
					return {room_str: prices[room_str]}
				else:
					return {}

			return prices if prices else {}

		except Exception:
			# If city not found or error, return empty dict
			return {}

	async def fetch_rent_prices(self, query: str, rooms: Optional[Union[int, List[int]]] = None) -> Dict[str, Optional[float]]:
		"""
		Rent prices not yet supported in new pynadlan API.
		Return empty dict for now.

		When implemented, will use get_city_timeseries with transaction_type="rent"
		to fetch rent prices by room count.
		"""
		# Rent data not yet available in pynadlan API
		# Future implementation will follow same pattern as fetch_sell_prices
		# but with transaction_type="rent"
		return {}


_global_service: Optional[RealEstatePricingService] = None


def get_real_estate_service() -> RealEstatePricingService:
	global _global_service
	if _global_service is None:
		_global_service = RealEstatePricingService()
	return _global_service
