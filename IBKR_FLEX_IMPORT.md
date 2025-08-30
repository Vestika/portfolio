# IBKR Flex Web Service Import

Enable importing an Interactive Brokers (IBKR) investment account using the Flex Web Service (not the Web API). Users will link an `investment-account` by supplying an Access Token and a Flex Query ID. We will use only the Flex Web Service endpoints to Generate a Report and Retrieve the Report to pull current holdings and fill missing data.

Reference: [IBKR Flex Web Service](https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/)

## Completed Tasks

- [x] Backend: Flex Web Service client with SendRequest/GetStatement and XML parsing of `<OpenPositions>`
- [x] Backend: Preview endpoint `POST /portfolio/{portfolioId}/ibkr/flex/preview` returning aggregated holdings
- [x] Backend: Import endpoint `POST /portfolio/{portfolioId}/accounts/ibkr/import` creating/updating account holdings
- [x] Frontend: Add UI in `frontend/src/AccountSelector.tsx` to link IBKR via Flex (token + query id) with Test connection and Import actions in Add and Edit modals

## In Progress Tasks

- [ ] Documentation polish in README and `INTERACTIVE_BROKERS_INTEGRATION.md`

## Future Tasks

- [ ] Backend: Optionally parse cash balances if included in statement
- [ ] Backend: Decide storage for IBKR credentials
  - Prefer ephemeral (request-time only) to avoid storing sensitive tokens
  - If persisted, store encrypted with rotation and allow delete/revoke
- [ ] Mapping: Convert Flex `OpenPosition` fields to our holding model
  - Use `symbol`, `position` (units), `currency`
  - Aggregate by symbol; ignore lots-level `levelOfDetail="LOT"` when summing
  - Leave cost basis optional for now; may be enhanced later
- [ ] Error handling and UX
  - Display clear errors for Flex error codes; retry guidance for generation delay
  - Handle empty or missing sections gracefully
- [ ] Tests
  - Unit tests for XML parsing and aggregation
  - Integration test hitting mocked Flex responses
- [ ] Documentation
  - Update README with IBKR Flex import instructions
  - Add security note regarding Access Token handling

## Implementation Plan

1. Frontend UI (non-breaking opt-in)
   - In `frontend/src/AccountSelector.tsx`, when `account_type === 'investment-account'`, expose an optional section to link IBKR:
     - Inputs for `Access Token` and `Flex Query ID`
     - Inline help (see User Guide below) linking to the official IBKR doc
     - "Test connection" button that calls a new backend endpoint to verify the credentials and show a lightweight preview (e.g., count of symbols)

2. Backend Flex client
   - Add a lightweight client that performs two HTTP requests:
     - Generate: `/SendRequest` with `t=AccessToken` and `q=QueryId` → returns `ReferenceCode`
     - Retrieve: `/GetStatement` with `t=AccessToken` and `q=ReferenceCode` → returns XML
   - Parse `<OpenPositions>`; sum `position` by `symbol` and carry `currency`.
   - Return normalized holdings list: `[ { symbol, units, currency? } ]`

3. Import endpoint
   - `POST /portfolio/{portfolioId}/accounts/ibkr/import` → Updates the specified account’s holdings to match Flex output (or creates new account if missing)
   - No long-term storage of Access Token by default; treat as sensitive one-time input

4. UX & Validation
   - Show clear statuses: generating, waiting, retrieving, done
   - Handle IBKR timing caveats (documented by IBKR) with a short retry/backoff

5. Tests & Docs
   - Add unit tests for the XML parser using provided sample
   - Add docs and cautions about token handling

## Short User Guide (to embed in `AccountSelector.tsx`)

Use IBKR Flex Web Service (not the Web API) to import your current positions.

1) Create Access Token and Flex Query
- In Client Portal, generate an Access Token for Flex Web Service.
- Create a Flex Query of type "Activity Statement" with a period such as "Last Business Day".
- Include at minimum the section "Open Positions". This yields your current holdings by lot; we will aggregate by `symbol`.
- Optionally include cash sections if you want cash balances imported.

2) Locate Your IDs
- Copy the Access Token value.
- Copy the Flex Query ID for the Activity Statement you created.

3) Paste Into This App
- In the `investment-account` configuration, enable "Link IBKR (Flex Web Service)".
- Paste your Access Token and Flex Query ID.
- Click "Test connection" to verify. We will:
  - Generate a report
  - Retrieve the statement (XML)
  - Parse `<OpenPositions>` and aggregate units by symbol

Notes from IBKR:
- Activity Statements are updated once daily after close of business; fetching more than once per day typically won’t change results.
- There can be a short delay between generating and retrieving the report; we’ll auto-retry briefly.

Official guide: [IBKR Flex Web Service](https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/)

## Relevant Files

- `frontend/src/AccountSelector.tsx` – IBKR Flex linking UI with inputs, inline guide, test connection, and import actions
- `backend/app/main.py` – Preview and import endpoints (`/portfolio/{portfolioId}/ibkr/flex/preview`, `/portfolio/{portfolioId}/accounts/ibkr/import`)
- `backend/services/interactive_brokers/service.py` – Flex client (SendRequest/GetStatement) and XML parsing
- `backend/models/user_preferences.py` – If needed, optional secure storage hooks for tokens (prefer ephemeral use)

## Acceptance Criteria

- User can link an `investment-account` to IBKR by entering Access Token + Flex Query ID
- Clicking "Test connection" shows a successful retrieval with a brief preview (e.g., N symbols found)
- Import endpoint returns normalized holdings aggregated by symbol from `<OpenPositions>`
- No usage of IBKR Web API; only Flex Web Service Generate/Retrieve endpoints
- Clear user-facing guide and error messages


