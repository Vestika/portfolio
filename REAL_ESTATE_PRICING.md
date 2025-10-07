# Real Estate Pricing Feature

Estimate Israeli real-estate sell/rent prices by location using `pynadlan`, accept user inputs for rooms and square meters, and compute leverage metrics. Integrate as a new account type inside `AccountSelector.tsx` (not in Tools). Location is selected via autocomplete powered by backend endpoint.

Reference: [pynadlan on PyPI](https://pypi.org/project/pynadlan/)

## Completed Tasks

- [x] Create feature task list and plan
- [x] Add backend dependency `pynadlan` and service wrapper for price APIs
- [x] Implement backend endpoints: autocomplete and price estimates (sell/rent)
- [x] Add basic caching for `pynadlan` calls

## In Progress Tasks

- [ ] Add tests and docs for backend, hooks, and UI

## Future Tasks

- [ ] Introduce frontend feature flag env var to gate visibility (optional)
- [ ] Add Real Estate account type in `AccountSelector.tsx`
  - Fields: location (autocomplete from `/api/real-estate/autocomplete`), rooms, sqm
  - Debt inputs: loan amount, years, amount already paid
  - Display: estimated value, equity, LTV, leverage multiple
- [ ] Persist real estate account inputs per portfolio (localStorage first, backend later)
- [ ] Show leverage chip in dashboard header when real estate account exists
- [ ] Document usage in `README.md` (env var, endpoints, UI)

## Implementation Plan

### Data Source

Use `pynadlan` async helpers to fetch:
- `get_autocomplete_lists()` → provides `cities` and `cities_and_neighborhoods` for location input
- `get_avg_prices(query, rooms?)` → latest sell prices by room count
- `get_rent_prices(query, rooms?)` → latest rent prices by room count

Refer to: [pynadlan on PyPI](https://pypi.org/project/pynadlan/)

### Backend

- `pynadlan` added to dependencies
- Service wrapper for `get_autocomplete_lists`, `get_avg_prices`, `get_rent_prices`
- Endpoints:
  - `GET /api/real-estate/autocomplete` → returns `cities_and_neighborhoods`
  - `GET /api/real-estate/estimate` → query params: `q`, `rooms`, `sqm?`, `type=sell|rent`
- In-memory TTL cache for autocomplete; input validation

### Frontend

- Add Real Estate as an `account_type` within `AccountSelector.tsx`
  - When selected, show fields: location (with autocomplete), rooms, sqm
  - Fetch estimates via `/api/real-estate/estimate` and show computed price
  - Debt inputs: loan amount, years, amount already paid
  - Compute and show leverage metrics (Equity, LTV, Leverage)
- Persist inputs locally keyed by portfolio and account name
- Optionally gate feature with `VITE_FEATURE_REAL_ESTATE`

### Calculations

Given `propertyValue`, `debtOutstanding`, and `amountAlreadyPaid`:
- Equity = `propertyValue - debtOutstanding`
- LTV = `debtOutstanding / propertyValue`
- Leverage Multiple = `propertyValue / max(Equity, 1)`

Notes:
- Initial `propertyValue` is derived from the avg price for the selected `rooms` from `pynadlan`. If `sqm` is provided, future refinement can adjust by heuristics; first version uses room-based price directly.

## Relevant Files

- `backend/pyproject.toml` — Add `pynadlan` ✅
- `backend/services/real_estate/pricing.py` — Wrapper around `pynadlan` ✅
- `backend/app/endpoints/real_estate.py` — REST endpoints ✅
- `frontend/src/AccountSelector.tsx` — New account type UI and logic (location autocomplete, price, leverage)
- `frontend/src/hooks/useRealEstate.ts` — Hook for API calls and calculations
- `frontend/src/types/realEstate.ts` — Shared types
- `frontend/src/contexts/RealEstateContext.tsx` — Optional persistence and dashboard chip support
- `frontend/src/PortfolioSummary.tsx` — Leverage chip display

