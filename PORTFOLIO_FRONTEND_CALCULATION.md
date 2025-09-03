# Frontend Portfolio Calculation Migration

Migrate portfolio breakdown and aggregation calculations from backend to frontend to reduce latency. Backend will provide raw portfolio data; frontend will fetch prices, FX, and compute views locally.

Targeting replacement for slow endpoints: `https://api.vestika.io/portfolio/breakdown` and `https://api.vestika.io/portfolio/holdings` (observed ~20s).

## Completed Tasks

- [ ] None yet

## In Progress Tasks

- [ ] None

## Future Tasks

- [ ] Define frontend types for portfolio, holding, price quote, and FX rates
- [ ] Build price/FX fetching layer with batching, caching (TTL), and error fallback
- [ ] Compute Account Size Overview from holdings and account_breakdown
- [ ] Compute Holdings Aggregation By Symbol (sum values, percentages)
- [ ] Compute Geographical Distribution using `tags.geographical` weights
- [ ] Compute Breakdown By Asset Type using `security_type`
- [ ] Ensure currency normalization to a single base (respect `base_currency`)
- [ ] Implement feature flag to toggle backend vs frontend calculation
- [ ] Add parity checker that compares frontend results with backend responses
- [ ] Wire computations into existing charts/views without UI regressions
- [ ] Add unit tests for aggregation math and rounding/percentage logic
- [ ] Add performance benchmarks and logging (time to compute vs fetch)
- [ ] Implement retry/backoff for price/FX requests and offline cache
- [ ] Document rollout plan and fallback strategy

## Implementation Plan

1. Data contracts
   - Reuse or extend `frontend/src/types.ts` to model `Portfolio`, `Holding`, `AccountBreakdown`, `PriceQuote`, and `FxRate`.
   - Normalize money values in smallest units or consistent decimals; define rounding strategy for display vs calc.

2. Data sources
   - Backend: single call to fetch user portfolio (accounts, positions, tags, base currency).
   - Frontend: services to fetch latest ticker prices and FX rates; batch symbols; cache results with TTL; dedupe concurrent requests.

3. Calculation modules
   - Implement pure functions to compute:
     - Total portfolio value and per-account totals
     - Aggregation by symbol (sum of position values)
     - Geographical distribution via weighted sum from `tags.geographical`
     - Aggregation by `security_type` (etf, stock, cash, etc.)
   - Return result shapes compatible with current charts: `{ chart_title, chart_total, chart_data: [{ label, value, percentage }] }`.

4. Currency handling
   - Convert each holding value to base currency using FX when needed.
   - Respect `price_source` semantics (`real-time`, `cash`, `predefined`).

5. Feature flag & rollout
   - Gate new logic behind a flag (e.g., `frontendPortfolioCalc`).
   - Add side-by-side parity check (dev-only) to compare with backend endpoints; log diffs.

6. Integration
   - Replace calls to `/portfolio/breakdown` and `/portfolio/holdings` in the UI layer with local compute when the flag is on.
   - Ensure existing components (`PortfolioSummary`, `HoldingsTable`, `PieChart`, heatmaps) receive the same props shape.

7. Testing & performance
   - Unit tests for all aggregators, FX conversion, and percentage calculations.
   - Benchmark compute time for typical portfolios; set SLO (e.g., <200ms for 1k positions on modern devices).

8. Fallbacks
   - On price/FX fetch failure: use last-known cache, then gracefully degrade to backend endpoints if enabled.

## Relevant Files

- `frontend/src/types.ts` — Types for portfolio, holdings, and computed view models
- `frontend/src/utils/api.ts` — Existing API client; add portfolio fetch and price/FX endpoints
- `frontend/src/lib/utils.ts` — Helpers; may host math/aggregation utilities
- `frontend/src/hooks/useFeatureFlag.ts` — Feature flag for gradual rollout
- `frontend/src/components/PortfolioSummary.tsx` — Summary chips using computed totals
- `frontend/src/HoldingsTable.tsx` — Holdings view consuming computed data
- `frontend/src/PieChart.tsx` — Pie components for breakdown charts
- `frontend/src/HoldingsHeatmap.tsx` — Heatmap, ensure compatibility
- `backend/` — Provide raw portfolio endpoint and any price proxy if needed (reference only)

## Backend Reference (parity targets)

Use these as the source of truth for output shape and edge cases while migrating logic to the frontend:

- Breakdown endpoint: `backend/app/main.py:get_portfolio_aggregations` (`/portfolio/breakdown`)
  - Aggregates precomputed holding values across charts defined by `CHARTS`.
  - Applies `security_filter` and `aggregation_key` callbacks, including handling for:
    - Dictionary tag weights (e.g., `tags.geographical` weighted sums)
    - Lists of keys (multi-bucket aggregation)
    - Simple keys with `_Unknown` fallback
  - Includes RSU virtual holdings per account through `rsu_calculator`.
  - Returns array of `{ chart_title, chart_total, chart_data: [{ label, value, percentage }] }`.

- Holdings endpoint: `backend/app/main.py:get_holdings_table` (`/portfolio/holdings`)
  - Produces holdings with `account_breakdown`, `total_units`, `total_value`, `value_per_unit`, and `historical_prices`.
  - Historical price logic:
    - `USD` → FX series vs `base_currency` (yfinance pair `USD{base}=X`), 7-day window with fallback mock.
    - Numeric symbols (TASE) → `Maya().get_price_history` with fallback.
    - Other symbols → yfinance 7-day close with fallback.
  - Includes RSU virtual holdings, flags them in breakdown, sorts `account_breakdown` by value desc.
  - Returns `{ base_currency, holdings: [...] }` sorted by `total_value` desc.

Frontend parity requirements:
- Include RSU virtual holdings in both breakdown and holdings views.
- Respect `tags` weighting for geographical and other tag-based aggregations.
- Normalize all values to `base_currency`; handle `price_source` differences.
- Maintain output shapes and sorting, including deterministic rounding for percentages and totals.

## Notes

- Maintain output compatibility with current backend responses to minimize UI changes.
- Use stable sort and deterministic rounding to avoid flicker.
- Cache keys should include symbol and quote currency; include FX pair and TTL.


