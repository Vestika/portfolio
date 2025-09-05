# Portfolio Summary Enhancements

Brief task list to track improvements to portfolio information display.

## Completed Tasks

- [ ] None yet

## In Progress Tasks

- [ ] None

## Future Tasks

- [ ] Display Bitcoin equivalent for IBIT holdings in portfolio info
  - Trigger: When a user holds IBIT among their stocks/ETFs
  - Location: `frontend/src/PortfolioSummary.tsx`
  - Behavior: Show how many BTC the IBIT position equals, alongside existing portfolio info
  - Visibility: Respect `isValueVisible` masking state
  - UX: Present as a concise chip near Total/Cash chips; tooltip for details if needed

## Implementation Plan

1. Detect presence and quantity of IBIT in holdings for the selected accounts shown by `PortfolioSummary`.
2. Compute conversion using `bitcoinEquivalent = ibitShares * btcPerShare`.
   - Prefer backend-provided per-share BTC value (e.g., IBIT NAV per share) or an existing service if available.
   - If not available, add/reuse an API endpoint to supply the ratio.
3. Render a BTC-equivalent chip in `PortfolioSummary`, colocated with existing summary chips, honoring `isValueVisible`.
4. Format with appropriate precision (e.g., up to 6-8 decimals) and accessibility attributes/title.
5. Add unit tests for conversion logic (if extracted) and component rendering states.

### Relevant Files

- `frontend/src/PortfolioSummary.tsx` — Portfolio info chips; display target for BTC equivalent
- `frontend/src/types.ts` — `AccountInfo`/holdings types used by the component
- `frontend/src/utils/api.ts` — API client to fetch conversion data if needed
- `backend/` (TBD if needed) — Endpoint or service for IBIT→BTC conversion data


# AI Chat in Explore View

Embed the AI chat experience directly into the Explore page so conversations happen there without a popup.

## Completed Tasks

- [x] Embed `AIChat` component inside `ExploreView` layout
- [x] Remove modal/popup invocations of `AIChat` sidebar and toggles

## In Progress Tasks

- [ ] Verify sessions list/loader works inside Explore

## Future Tasks

- [ ] Replace Explore placeholder content with chat-friendly layout and spacing
- [ ] Ensure mobile responsiveness and full-height scroll behavior
- [ ] Verify sessions list/loader works inside Explore
- [ ] Adjust styles to match Explore theme (borders, padding, background)
- [ ] Smoke-test API calls via `utils/ai-api.ts` and error states

## Implementation Plan

1. Import and render `AIChat` in `frontend/src/components/ExploreView.tsx`, replacing the current placeholder card.
2. Provide `portfolioName` prop if available; omit `onClose` and keep `isOpen` true by default.
3. Wrap `AIChat` in a container sized for Explore: min-height viewport minus header, with proper padding.
4. Search for and remove/disable any remaining popup/modal usages of `AIChat` (none expected, but verify).
5. Validate sessions panel toggling, message streaming, tagging input, and error UI within Explore.
6. Tweak styles for dark theme consistency and responsive behavior.

### Relevant Files

- `frontend/src/components/ExploreView.tsx` — Target container to embed `AIChat`
- `frontend/src/components/AIChat.tsx` — Chat component to embed
- `frontend/src/utils/ai-api.ts` — Chat/session API calls used by `AIChat`


# PriceManager batch + fresh and /quotes params

Enhance price fetching to support batch queries via `PriceManager` and a flag to bypass cache. Update `/quotes` to optionally use `PriceManager` and request fresh prices.

## Completed Tasks

- [x] Add batch symbol fetching to `backend/services/closing_price/price_manager.py` (`get_prices`)
- [x] Add `fresh` flag to `PriceManager.get_price` to bypass cache/DB

## In Progress Tasks

- [ ] Update `/quotes` to support `use_manager` and `fresh` params

## Future Tasks

- [ ] Extend `PriceManager` to compute percent change fields for UI
- [ ] Unit tests for `get_prices` and fresh flag behavior

## Implementation Plan

1. Extend `PriceManager.get_price(symbol, fresh=False)` to respect fresh flag.
2. Add `PriceManager.get_prices(symbols: list[str], fresh=False)` to iterate and collect results.
3. Modify `/quotes` to accept `use_manager` and `fresh` query params and map `PriceResponse` to frontend Quote shape minimally.
4. Consider enriching change metrics by comparing to previous close in a follow-up.

### Relevant Files

- `backend/services/closing_price/price_manager.py` — Batch and fresh support ✅
- `backend/app/main.py` — `/quotes` updated to support new params
- `frontend/src/HoldingsTable.tsx` — Consumes `/quotes`; no changes required right now
