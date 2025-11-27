from typing import Any, Dict, List, Optional, Union
import asyncio
import inspect

# pynadlan provides async functions - updated to new API
try:
	from pynadlan.api import (
		get_autocomplete_lists,
		get_neighborhoods_summary,
		get_city_timeseries,
		get_locations_search,
		get_avg_prices,
		get_street_deals,
	)
except Exception:  # pragma: no cover - allow code to import even if not installed yet
	get_autocomplete_lists = None
	get_neighborhoods_summary = None
	get_city_timeseries = None
	get_locations_search = None
	get_avg_prices = None
	get_street_deals = None


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

	async def search_locations(
		self,
		query: str,
		page: int = 1,
		per_page: int = 20,
		min_deals: Optional[int] = None,
		location_type: str = "all",
	) -> Dict[str, Any]:
		"""
		Search for locations (cities, neighborhoods, streets) with market data.

		Args:
			query: Search string (Hebrew or English)
			page: Page number for pagination
			per_page: Results per page
			min_deals: Minimum number of deals filter
			location_type: Filter by type - "all", "city", "neighborhood", "street"

		Returns:
			Dict with results, pagination, and summary
		"""
		if get_locations_search is None:
			raise RuntimeError("pynadlan not installed")

		# Build cache key for this specific search
		cache_key = f"search:{query}:{page}:{per_page}:{min_deals}:{location_type}"
		cached = await self._get_cached(cache_key)
		if cached is not None:
			return cached

		result = await get_locations_search(
			query=query,
			page=page,
			per_page=per_page,
			min_deals=min_deals,
			location_type=location_type,
		)

		# Cache with shorter TTL for search results (5 minutes)
		await self._set_cached(cache_key, result)
		return result

	async def fetch_prices_for_location(
		self,
		location_type: str,
		city: str,
		street: Optional[str] = None,
		neighborhood: Optional[str] = None,
		rooms: Optional[int] = None,
		sqm: Optional[int] = None,
	) -> Dict[str, Any]:
		"""
		Fetch prices based on location type selected from search.

		For streets: uses get_street_deals to get actual transaction data
		For cities/neighborhoods: uses get_avg_prices for room-based pricing

		Args:
			location_type: "city", "neighborhood", or "street"
			city: City name
			street: Street name (required if location_type is "street")
			neighborhood: Neighborhood name (optional)
			rooms: Number of rooms for filtering
			sqm: Square meters for price calculation

		Returns:
			Dict with prices and optional calculation details
		"""
		if location_type == "street" and street:
			if get_street_deals is None:
				raise RuntimeError("pynadlan not installed")

			# Format: "city_street" in Hebrew
			city_street = f"{city}_{street}"
			cache_key = f"street_deals:{city_street}"
			cached = await self._get_cached(cache_key)

			if cached is None:
				cached = await get_street_deals(city_street=city_street)
				await self._set_cached(cache_key, cached)

			# Extract summary statistics
			summary = cached.get("summary", {})
			median_price = summary.get("medianPrice")
			avg_price_per_sqm = summary.get("avgPricePerSquareMeter")

			# If we have sqm, calculate estimated price based on avg price per sqm
			estimated_total = None
			if sqm and avg_price_per_sqm:
				estimated_total = int(avg_price_per_sqm * sqm)

			# Build room-based prices from actual deals if possible
			deals = cached.get("deals", [])
			room_prices: Dict[str, int] = {}
			room_counts: Dict[str, List[int]] = {}

			for deal in deals:
				deal_rooms = deal.get("rooms")
				deal_price = deal.get("price")
				if deal_rooms and deal_price:
					room_key = str(int(deal_rooms))
					if room_key not in room_counts:
						room_counts[room_key] = []
					room_counts[room_key].append(deal_price)

			# Calculate median price per room count
			for room_key, prices in room_counts.items():
				sorted_prices = sorted(prices)
				mid = len(sorted_prices) // 2
				if len(sorted_prices) % 2 == 0:
					room_prices[room_key] = int((sorted_prices[mid - 1] + sorted_prices[mid]) / 2)
				else:
					room_prices[room_key] = sorted_prices[mid]

			return {
				"location_type": "street",
				"city": city,
				"street": street,
				"prices": room_prices if room_prices else ({str(rooms): median_price} if rooms and median_price else {}),
				"median_price": median_price,
				"avg_price_per_sqm": avg_price_per_sqm,
				"estimated_total": estimated_total,
				"total_deals": summary.get("totalDeals"),
			}

		else:
			# City or neighborhood - use get_avg_prices
			if get_avg_prices is None:
				raise RuntimeError("pynadlan not installed")

			# Build query string
			if neighborhood:
				query = f"{city}, {neighborhood}"
			else:
				query = city

			cache_key = f"avg_prices:{query}:{rooms}"
			cached = await self._get_cached(cache_key)

			if cached is None:
				cached = await get_avg_prices(query=query, rooms=rooms)
				await self._set_cached(cache_key, cached)

			# Convert response format: sell_3_price -> "3": price
			prices: Dict[str, int] = {}
			for key, value in cached.items():
				if key.startswith("sell_") and key.endswith("_price") and value is not None:
					room_num = key.replace("sell_", "").replace("_price", "")
					prices[room_num] = int(value)

			# Typical sqm per room count for Israeli apartments
			TYPICAL_SQM_BY_ROOMS = {
				"2": 60,
				"3": 80,
				"4": 105,
				"5": 135,
				"6": 160,
			}

			# Calculate price per sqm and estimated total based on actual sqm
			estimated_total = None
			avg_price_per_sqm = None

			if rooms and str(rooms) in prices:
				room_key = str(rooms)
				room_price = prices[room_key]
				typical_sqm = TYPICAL_SQM_BY_ROOMS.get(room_key, 80)  # Default to 80 if unknown

				# Calculate price per sqm based on typical size for this room count
				avg_price_per_sqm = int(room_price / typical_sqm)

				# If user provided actual sqm, calculate estimated total
				if sqm:
					estimated_total = int(avg_price_per_sqm * sqm)

			return {
				"location_type": location_type,
				"city": city,
				"neighborhood": neighborhood,
				"prices": prices,
				"avg_price_per_sqm": avg_price_per_sqm,
				"estimated_total": estimated_total,
				"typical_sqm_used": TYPICAL_SQM_BY_ROOMS.get(str(rooms)) if rooms else None,
			}


_global_service: Optional[RealEstatePricingService] = None


def get_real_estate_service() -> RealEstatePricingService:
	global _global_service
	if _global_service is None:
		_global_service = RealEstatePricingService()
	return _global_service
