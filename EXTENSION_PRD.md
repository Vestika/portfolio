# Vestika Browser Extension - Product Requirements Document

## Executive Summary

The Vestika Browser Extension is a Chrome/Edge extension (Manifest V3) that simplifies the process of importing and synchronizing investment portfolio data from brokerage websites into the Vestika platform. By capturing portfolio data directly from investment account pages and leveraging AI-powered extraction, the extension eliminates manual data entry and enables automatic portfolio updates.

**Key Value Propositions:**
- **Zero Manual Entry**: Capture portfolio holdings directly from brokerage websites with one click
- **Seamless Authentication**: Reuses existing Vestika web app session (no separate login)
- **AI-Powered Extraction**: Automatically parses HTML tables and financial data using Google Gemini
- **Flexible Configuration**: Community-shared configurations for popular brokers + custom private configurations
- **Auto-Sync**: Optional automatic synchronization of portfolio data on schedule or page load
- **Validation Workflow**: Review and edit extracted data before importing

---

## Table of Contents

1. [User Personas & Use Cases](#user-personas--use-cases)
2. [Core Features & Requirements](#core-features--requirements)
3. [Technical Architecture](#technical-architecture)
4. [Data Models & API Contracts](#data-models--api-contracts)
5. [User Experience Flows](#user-experience-flows)
6. [Security & Privacy](#security--privacy)
7. [Success Metrics](#success-metrics)
8. [Implementation Phases](#implementation-phases)
9. [Open Questions & Future Enhancements](#open-questions--future-enhancements)

---

## User Personas & Use Cases

### Primary Persona: Active Investor Alex
- **Profile**: Has 3-5 investment accounts across different brokers (e.g., Fidelity 401k, Vanguard IRA, Robinhood taxable)
- **Pain Points**:
  - Manually updates Vestika portfolio by copy-pasting or typing holdings from each broker
  - Data becomes stale quickly, leading to inaccurate portfolio analysis
  - Switching between multiple browser tabs to collect data is tedious
- **Goals**:
  - Import all holdings with one click per brokerage site
  - Keep Vestika portfolio automatically synchronized
  - Minimize time spent on portfolio maintenance

### Secondary Persona: Portfolio Manager Maria
- **Profile**: Manages portfolios for family members or small clients
- **Pain Points**:
  - Needs to import data from multiple brokerage accounts regularly
  - Each brokerage has different HTML table structures
  - Manual configuration of data extraction is time-consuming
- **Goals**:
  - Leverage community-shared configurations for common brokers
  - Create custom configurations for specialized brokers
  - Validate extracted data before importing to catch errors

---

## Core Features & Requirements

### 1. User Authentication

**Requirement**: Extension must authenticate users via Firebase without separate login.

**Functional Requirements:**
- **FR-AUTH-1**: Extension accesses Firebase auth token from `auth.currentUser.getIdToken()` via messaging API
- **FR-AUTH-2**: Extension listens for auth state changes from the Vestika web app
- **FR-AUTH-3**: Extension popup displays user's email and profile picture when authenticated
- **FR-AUTH-4**: If user is not authenticated, extension prompts user to log into Vestika web app first
- **FR-AUTH-5**: All API requests to Vestika backend include `Authorization: Bearer <token>` header

**Technical Notes:**
- Extension communicates with Vestika web app via `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`
- Content script injected into `app.vestika.io` pages can access Firebase SDK and relay auth state
- Background service worker stores auth token in memory (no local storage for security)

---

### 2. Configuration Management

The extension supports two types of configurations:
1. **Shared Configurations**: Community-created, globally available to all users for popular brokers
2. **Private Configurations**: User-specific configurations linking shared configs to their portfolios/accounts

#### 2.1 Shared Configuration Management

**Requirement**: Users can create and share data extraction configurations for brokerage websites.

**Functional Requirements:**

- **FR-CONFIG-SHARED-1**: User navigates to brokerage portfolio page and clicks "Create Configuration" in extension popup
- **FR-CONFIG-SHARED-2**: Extension captures current page URL and allows user to edit it with wildcards (e.g., `https://www.fidelity.com/portfolio/*`)
- **FR-CONFIG-SHARED-3**: Extension offers two extraction modes:
  - **Full Page Body**: Sends entire HTML body (with `<script>` and `<style>` tags removed)
  - **CSS Selector**: User specifies CSS selector (e.g., `table.holdings-table`) to extract specific element
- **FR-CONFIG-SHARED-4**: User can test extraction by running AI extraction immediately and reviewing results
- **FR-CONFIG-SHARED-5**: User provides a friendly name for the configuration (e.g., "Fidelity Portfolio Page")
- **FR-CONFIG-SHARED-6**: Configuration is saved to backend with the following data:
  - `extension_config_id` (UUID)
  - `name` (string, e.g., "Fidelity Portfolio")
  - `url` (string with wildcards, e.g., `https://fidelity.com/portfolio/*`)
  - `full_url` (boolean, true = send full body, false = use selector)
  - `selector` (string, CSS selector, optional if full_url = true)
  - `created_by` (user_id of creator)
  - `is_public` (boolean, default true for community sharing)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

**Non-Functional Requirements:**
- **NFR-CONFIG-SHARED-1**: URL wildcard matching uses standard glob patterns (`*` = any characters, `?` = single character)
- **NFR-CONFIG-SHARED-2**: HTML cleaning removes `<script>`, `<style>`, `<noscript>`, and inline event handlers to minimize data size
- **NFR-CONFIG-SHARED-3**: Maximum HTML body size: 500KB (if larger, prompt user to use CSS selector)

**API Endpoint (Backend):**

```
POST /api/extension/configs
GET /api/extension/configs (list all shared configs)
GET /api/extension/configs/:id
PUT /api/extension/configs/:id
DELETE /api/extension/configs/:id
```

**Data Model:**

```python
class ExtensionConfig(BaseModel):
    id: str  # UUID
    name: str
    url: str  # with wildcards
    full_url: bool
    selector: Optional[str]
    created_by: str  # user_id
    is_public: bool = True
    created_at: datetime
    updated_at: datetime
```

#### 2.2 Private Configuration Management

**Requirement**: Users map shared configurations to their specific portfolios and accounts.

**Functional Requirements:**

- **FR-CONFIG-PRIVATE-1**: Extension configuration page displays list of available shared configurations
- **FR-CONFIG-PRIVATE-2**: User selects a shared configuration (or creates new one)
- **FR-CONFIG-PRIVATE-3**: User maps configuration to:
  - **Portfolio**: Dropdown of user's existing portfolios (from `/portfolios/complete-data`)
  - **Account**: Dropdown of accounts within selected portfolio, or "Create New Account"
- **FR-CONFIG-PRIVATE-4**: If creating new account:
  - User provides account name (string)
  - User selects account type (dropdown: `taxable-brokerage`, `401k`, `ira`, `roth-ira`, `company-custodian-account`, `real-estate`, `crypto`)
  - Account is created immediately via `POST /portfolio/{portfolio_id}/accounts`
- **FR-CONFIG-PRIVATE-5**: User toggles "Auto-Sync" option:
  - If enabled, extension automatically captures and imports data when user visits matching URL
  - Auto-sync interval: on page load (debounced to 1 minute to prevent excessive API calls)
- **FR-CONFIG-PRIVATE-6**: Private configuration is saved with:
  - `private_config_id` (UUID)
  - `user_id` (string)
  - `extension_config_id` (UUID, references shared config)
  - `portfolio_id` (string)
  - `account_id` (string)
  - `auto_sync` (boolean)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

**API Endpoint (Backend):**

```
POST /api/extension/private-configs
GET /api/extension/private-configs (list user's private configs)
GET /api/extension/private-configs/:id
PUT /api/extension/private-configs/:id
DELETE /api/extension/private-configs/:id
```

**Data Model:**

```python
class PrivateExtensionConfig(BaseModel):
    id: str  # UUID
    user_id: str
    extension_config_id: str  # references ExtensionConfig
    portfolio_id: str
    account_id: str
    auto_sync: bool = False
    created_at: datetime
    updated_at: datetime
```

---

### 3. Portfolio Import Flow

**Requirement**: Extension captures portfolio data and imports it into Vestika via AI extraction.

#### 3.1 Capture & Import (One-Click)

**Functional Requirements:**

- **FR-IMPORT-1**: User navigates to brokerage portfolio page
- **FR-IMPORT-2**: Extension detects matching private configuration (via URL pattern matching)
- **FR-IMPORT-3**: Extension popup displays:
  - Matched configuration name (e.g., "Fidelity 401k → My Portfolio → 401k Account")
  - "Capture & Import" button
  - "Validate Before Import" button
- **FR-IMPORT-4**: When user clicks "Capture & Import":
  1. Extension extracts HTML based on shared config (full page or CSS selector)
  2. Extension sends HTML to `POST /api/extension/extract` with:
     - `html_body` (string)
     - `extension_config_id` (UUID)
     - `portfolio_id` (string, for currency context)
  3. Backend runs AI extraction and returns JSON holdings array
  4. Extension automatically calls `POST /api/extension/import` with:
     - `portfolio_id` (string)
     - `account_id` (string, optional)
     - `account_name` (string, optional if creating new account)
     - `holdings` (array of holdings from extraction)
  5. Extension displays success notification with link to portfolio

**Non-Functional Requirements:**
- **NFR-IMPORT-1**: Extraction timeout: 30 seconds (AI can be slow)
- **NFR-IMPORT-2**: Import timeout: 15 seconds
- **NFR-IMPORT-3**: Display loading spinner during extraction/import

#### 3.2 Validate Before Import

**Functional Requirements:**

- **FR-VALIDATE-1**: When user clicks "Validate Before Import":
  1. Extension extracts HTML and calls `POST /api/extension/extract`
  2. Extension displays extracted holdings in editable table:
     - Columns: Symbol, Units, Cost Basis (optional), Security Name (optional)
     - Each row is editable (user can fix errors)
     - User can add new rows or delete rows
  3. User reviews and edits extracted data
  4. User clicks "Import" to submit to `POST /api/extension/import`
  5. Extension displays success notification

**UI/UX Requirements:**
- **UX-VALIDATE-1**: Validation modal opens in extension popup (expanded view)
- **UX-VALIDATE-2**: Table uses semantic colors:
  - Green row border: High confidence extraction (AI confidence score > 0.8)
  - Yellow row border: Medium confidence (0.5 - 0.8)
  - Red row border: Low confidence (< 0.5)
- **UX-VALIDATE-3**: User can click "Retry Extraction" to re-run AI if results are poor

---

### 4. Auto-Sync

**Requirement**: Extension automatically synchronizes portfolio data when enabled.

**Functional Requirements:**

- **FR-AUTOSYNC-1**: When user visits URL matching a private config with `auto_sync = true`:
  1. Extension waits 3 seconds (debounce to ensure page is fully loaded)
  2. Extension automatically triggers "Capture & Import" flow (no user interaction)
  3. Extension displays non-intrusive notification: "Portfolio auto-synced to Vestika"
- **FR-AUTOSYNC-2**: Auto-sync is rate-limited:
  - Maximum 1 sync per URL per 1 minute (prevent excessive API calls on page refreshes)
  - Sync timestamp stored in `chrome.storage.local` per private config
- **FR-AUTOSYNC-3**: User can disable auto-sync globally via extension settings:
  - "Enable Auto-Sync" toggle in extension options page
  - If disabled, no auto-syncs occur even if private config has `auto_sync = true`

**Non-Functional Requirements:**
- **NFR-AUTOSYNC-1**: Auto-sync failures are logged but do not block user browsing
- **NFR-AUTOSYNC-2**: Extension badge icon shows sync status (e.g., green checkmark on success, red X on failure)

---

## Technical Architecture

### Extension Architecture

**Manifest V3 Components:**

1. **Background Service Worker** (`background.js`)
   - Manages auth state
   - Handles API requests to Vestika backend
   - Coordinates message passing between popup and content scripts
   - Implements auto-sync scheduling

2. **Content Script** (`content.js`)
   - Injected into brokerage pages matching URL patterns
   - Extracts HTML based on configuration (full body or CSS selector)
   - Relays data to background service worker
   - Injected into `app.vestika.io` to access Firebase auth

3. **Popup UI** (`popup.html`, `popup.tsx`)
   - Displays active configuration for current tab
   - "Capture & Import" and "Validate Before Import" buttons
   - Status indicators and notifications

4. **Options Page** (`options.html`, `options.tsx`)
   - Manage private configurations
   - View/edit shared configurations
   - Global auto-sync toggle
   - Account linking interface

**Technology Stack:**

- **Build Tool**: Vite with `@crxjs/vite-plugin` for Manifest V3 HMR
- **Package Manager**: `pnpm`
- **Framework**: React 18 + TypeScript
- **UI Library**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand (lightweight, extension-optimized)
- **Messaging**: `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`
- **Storage**: `chrome.storage.local` for configuration cache
- **Auth**: Firebase SDK (accessed via messaging to Vestika web app)

**Directory Structure:**

```
vestika-extension/
├── manifest.json          # Manifest V3 configuration
├── src/
│   ├── background/
│   │   └── service-worker.ts    # Background service worker
│   ├── content/
│   │   ├── extractor.ts         # HTML extraction logic
│   │   └── vestika-auth.ts      # Injected into app.vestika.io
│   ├── popup/
│   │   ├── Popup.tsx            # Main popup UI
│   │   ├── ConfigStatus.tsx     # Current config display
│   │   └── ValidationModal.tsx  # Data validation UI
│   ├── options/
│   │   ├── Options.tsx          # Options page
│   │   ├── ConfigList.tsx       # Shared configs list
│   │   └── PrivateConfigForm.tsx # Private config editor
│   ├── shared/
│   │   ├── api.ts               # API client
│   │   ├── types.ts             # TypeScript types
│   │   └── utils.ts             # Utilities
│   └── assets/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Data Models & API Contracts

### Backend Endpoints

#### 1. Extract Endpoint

**Purpose**: Parse HTML and extract portfolio holdings using Google Gemini AI.

**Endpoint**: `POST /api/extension/extract`

**Authentication**: Required (Firebase Bearer token)

**Request Body:**

```json
{
  "html_body": "<html>...</html>",
  "extension_config_id": "uuid-of-config",
  "portfolio_id": "optional-for-currency-context"
}
```

**Response (Success - 200 OK):**

```json
{
  "holdings": [
    {
      "symbol": "AAPL",
      "units": 150,
      "cost_basis": 12000.50,
      "security_name": "Apple Inc.",
      "confidence_score": 0.95
    },
    {
      "symbol": "GOOGL",
      "units": 75,
      "cost_basis": 8500.00,
      "security_name": "Alphabet Inc.",
      "confidence_score": 0.88
    }
  ],
  "extraction_metadata": {
    "model_used": "gemini-1.5-pro",
    "timestamp": "2025-10-17T14:32:00Z",
    "html_size_bytes": 45000,
    "extraction_time_ms": 2300
  }
}
```

**Response (Error - 400 Bad Request):**

```json
{
  "error": "Unable to extract holdings from HTML",
  "details": "No table or structured data found in HTML body"
}
```

**Backend Implementation Notes:**

```python
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types

class ExtractHoldingRequest(BaseModel):
    html_body: str
    extension_config_id: str
    portfolio_id: Optional[str] = None

class ExtractedHolding(BaseModel):
    symbol: str
    units: float
    cost_basis: Optional[float] = None
    security_name: Optional[str] = None
    confidence_score: float = 0.0

class ExtractHoldingsResponse(BaseModel):
    holdings: List[ExtractedHolding]
    extraction_metadata: dict

@router.post("/api/extension/extract")
async def extract_holdings(
    request: ExtractHoldingRequest,
    user=Depends(get_current_user)
) -> ExtractHoldingsResponse:
    """
    Extract portfolio holdings from HTML using Google Gemini.

    AI Prompt Strategy:
    - Provide HTML body to Gemini with structured output request
    - Ask Gemini to extract: symbol, units, cost_basis (optional)
    - Return JSON array matching ExtractedHolding schema
    - Handle edge cases: missing symbols, ambiguous units, etc.
    """

    # Initialize Gemini client
    client = genai.Client(api_key=settings.google_ai_api_key)

    # Construct AI prompt
    prompt = f"""
You are a financial data extraction assistant. Analyze the following HTML from a brokerage portfolio page and extract all investment holdings.

HTML Content:
{request.html_body}

Extract the following information for each holding:
- symbol: Stock ticker symbol (e.g., AAPL, GOOGL)
- units: Number of shares/units held (numeric)
- cost_basis: Total cost basis in dollars (optional, may not be present)
- security_name: Full name of the security (e.g., "Apple Inc.")
- confidence_score: Your confidence in the extraction (0.0 - 1.0)

Return a JSON array of holdings matching this structure:
[
  {{
    "symbol": "AAPL",
    "units": 150,
    "cost_basis": 12000.50,
    "security_name": "Apple Inc.",
    "confidence_score": 0.95
  }}
]

Important:
- Only extract securities (stocks, ETFs, bonds, etc.), not cash balances
- If a field is not present or unclear, omit it (except symbol and units which are required)
- Confidence score should reflect certainty of extraction
- Handle variations like "Shares", "Qty", "Quantity" for units
- Handle variations like "Total Value", "Market Value" (DO NOT use these for cost_basis)
"""

    # Call Gemini API
    content = types.Content(parts=[types.Part(text=prompt)])
    response = await client.models.generate_content(
        model=settings.google_ai_model,
        contents=[content]
    )

    # Parse JSON response
    response_text = response.candidates[0].content.parts[0].text

    # Extract JSON from response (handle markdown code blocks)
    import re
    json_match = re.search(r'```json\s*(\[.*?\])\s*```', response_text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # Try to find JSON array directly
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        json_str = json_match.group(0) if json_match else "[]"

    holdings_data = json.loads(json_str)
    holdings = [ExtractedHolding(**h) for h in holdings_data]

    return ExtractHoldingsResponse(
        holdings=holdings,
        extraction_metadata={
            "model_used": settings.google_ai_model,
            "timestamp": datetime.utcnow().isoformat(),
            "html_size_bytes": len(request.html_body),
            "extraction_time_ms": 0  # TODO: Track actual time
        }
    )
```

#### 2. Import Endpoint

**Purpose**: Create or update an account with extracted holdings.

**Endpoint**: `POST /api/extension/import`

**Authentication**: Required (Firebase Bearer token)

**Request Body:**

```json
{
  "portfolio_id": "507f1f77bcf86cd799439011",
  "account_id": "507f1f77bcf86cd799439012",
  "account_name": "Fidelity 401k",
  "account_type": "401k",
  "holdings": [
    {
      "symbol": "AAPL",
      "units": 150
    },
    {
      "symbol": "GOOGL",
      "units": 75
    }
  ],
  "replace_holdings": true
}
```

**Request Parameters:**
- `portfolio_id` (required): Target portfolio ID
- `account_id` (optional): If provided, update existing account; otherwise create new
- `account_name` (required if creating): Name for new account
- `account_type` (optional, default "taxable-brokerage"): Type of account
- `holdings` (required): Array of holdings to import
- `replace_holdings` (optional, default true): If true, replace all holdings; if false, merge/append

**Response (Success - 200 OK):**

```json
{
  "success": true,
  "portfolio_id": "507f1f77bcf86cd799439011",
  "account_id": "507f1f77bcf86cd799439012",
  "account_name": "Fidelity 401k",
  "imported_holdings_count": 2,
  "message": "Account updated successfully"
}
```

**Response (Error - 404 Not Found):**

```json
{
  "error": "Portfolio not found",
  "portfolio_id": "507f1f77bcf86cd799439011"
}
```

**Backend Implementation:**

```python
class ImportHoldingsRequest(BaseModel):
    portfolio_id: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    account_type: str = "taxable-brokerage"
    holdings: List[dict]  # [{"symbol": "AAPL", "units": 150}, ...]
    replace_holdings: bool = True

@router.post("/api/extension/import")
async def import_holdings(
    request: ImportHoldingsRequest,
    user=Depends(get_current_user)
) -> dict:
    """
    Import holdings into a portfolio account.

    Logic:
    - If account_id is provided: Update existing account
    - If account_id is None: Create new account with account_name
    - If replace_holdings = True: Replace all holdings
    - If replace_holdings = False: Merge holdings (update existing, add new)
    """

    collection = db_manager.get_collection("portfolios")

    # Verify portfolio ownership
    portfolio_doc = await collection.find_one({
        "_id": ObjectId(request.portfolio_id),
        "user_id": user.id
    })

    if not portfolio_doc:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if request.account_id:
        # Update existing account
        # (Reuse existing logic from PUT /portfolio/{id}/accounts/{name})
        accounts = portfolio_doc.get("accounts", [])
        account_index = None

        for i, acc in enumerate(accounts):
            if acc.get("_id") == request.account_id or acc["name"] == request.account_name:
                account_index = i
                break

        if account_index is None:
            raise HTTPException(status_code=404, detail="Account not found")

        if request.replace_holdings:
            accounts[account_index]["holdings"] = request.holdings
        else:
            # Merge holdings
            existing_holdings = {h["symbol"]: h for h in accounts[account_index].get("holdings", [])}
            for new_holding in request.holdings:
                existing_holdings[new_holding["symbol"]] = new_holding
            accounts[account_index]["holdings"] = list(existing_holdings.values())

        await collection.update_one(
            {"_id": ObjectId(request.portfolio_id)},
            {"$set": {"accounts": accounts}}
        )

        return {
            "success": True,
            "portfolio_id": request.portfolio_id,
            "account_id": request.account_id,
            "account_name": accounts[account_index]["name"],
            "imported_holdings_count": len(request.holdings),
            "message": "Account updated successfully"
        }

    else:
        # Create new account
        # (Reuse existing logic from POST /portfolio/{id}/accounts)
        if not request.account_name:
            raise HTTPException(status_code=400, detail="account_name required when creating new account")

        new_account = {
            "_id": str(ObjectId()),
            "name": request.account_name,
            "type": request.account_type,
            "owners": ["me"],
            "holdings": request.holdings,
            "rsu_plans": [],
            "espp_plans": [],
            "options_plans": []
        }

        await collection.update_one(
            {"_id": ObjectId(request.portfolio_id)},
            {"$push": {"accounts": new_account}}
        )

        return {
            "success": True,
            "portfolio_id": request.portfolio_id,
            "account_id": new_account["_id"],
            "account_name": new_account["name"],
            "imported_holdings_count": len(request.holdings),
            "message": "Account created successfully"
        }
```

#### 3. Configuration Endpoints

**Shared Configurations:**

```
POST /api/extension/configs
GET /api/extension/configs
GET /api/extension/configs/:id
PUT /api/extension/configs/:id
DELETE /api/extension/configs/:id
```

**Private Configurations:**

```
POST /api/extension/private-configs
GET /api/extension/private-configs
GET /api/extension/private-configs/:id
PUT /api/extension/private-configs/:id
DELETE /api/extension/private-configs/:id
```

*(Full implementation similar to existing CRUD endpoints in Vestika backend)*

---

## User Experience Flows

### Flow 1: First-Time Setup

1. **Install Extension**
   - User installs extension from Chrome Web Store
   - Extension icon appears in toolbar

2. **Authenticate**
   - User clicks extension icon
   - Popup displays: "Please log in to Vestika to continue"
   - User clicks "Open Vestika" button
   - Vestika web app opens in new tab, user logs in with Google
   - Extension detects auth state change and updates popup

3. **Create First Configuration**
   - User navigates to Fidelity portfolio page
   - User clicks extension icon
   - Popup displays: "No configuration found for this page. Create one?"
   - User clicks "Create Configuration"
   - Configuration wizard opens:
     - Step 1: Name configuration ("Fidelity Portfolio")
     - Step 2: Adjust URL pattern (`https://www.fidelity.com/portfolio/*`)
     - Step 3: Choose extraction mode (Full Page or CSS Selector)
     - Step 4: Test extraction (shows preview of holdings)
     - Step 5: Save configuration
   - User is prompted: "Link this configuration to a portfolio?"
   - User selects portfolio and account
   - Private configuration is saved

4. **First Import**
   - User clicks "Capture & Import" in popup
   - Extension extracts HTML, calls `/extract`, then `/import`
   - Success notification: "Imported 15 holdings to My Portfolio → Fidelity 401k"
   - User clicks notification to view portfolio in Vestika

### Flow 2: Daily Auto-Sync

1. **User Visits Brokerage Page**
   - User navigates to Fidelity portfolio page (already configured with auto-sync enabled)
   - Extension detects matching private config with `auto_sync = true`

2. **Auto-Sync Triggers**
   - Extension waits 3 seconds (debounce)
   - Extension automatically extracts HTML and imports holdings
   - Small non-intrusive notification appears: "Synced 15 holdings to Vestika"

3. **User Continues Browsing**
   - No interruption to user workflow
   - Portfolio data is now up-to-date in Vestika

### Flow 3: Validation Workflow

1. **User Wants to Review Data**
   - User navigates to E*TRADE portfolio page
   - User clicks extension icon
   - User clicks "Validate Before Import"

2. **Extraction & Review**
   - Extension extracts HTML and calls `/extract`
   - Validation modal opens with editable table:
     - Row 1: AAPL | 150 | $12,000.50 (green border, high confidence)
     - Row 2: GOOGL | 75 | $8,500.00 (yellow border, medium confidence)
     - Row 3: TSLA | ??? | ??? (red border, low confidence - user edits to 50 units)
   - User fixes Row 3 and clicks "Import"

3. **Import Confirmed**
   - Extension calls `/import` with corrected data
   - Success notification appears

---

## Security & Privacy

### Security Principles

1. **No Credentials Storage**
   - Extension NEVER stores brokerage credentials
   - Extension NEVER captures login forms or password fields
   - Extension only accesses portfolio data pages (after user has logged into brokerage)

2. **Firebase Auth Only**
   - Extension uses Firebase Bearer tokens for Vestika API authentication
   - Tokens stored in memory only (background service worker)
   - Tokens auto-refresh using Firebase SDK

3. **User Consent**
   - Extension only runs on pages with matching URL patterns
   - User must explicitly enable auto-sync per configuration
   - User can revoke extension permissions at any time via Chrome settings

4. **Data Transmission**
   - All API requests to Vestika backend use HTTPS
   - HTML data is sent to `/extract` endpoint (server-side AI processing)
   - No HTML data is stored permanently (processed in-memory and discarded)

5. **Permissions (Manifest V3)**

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://app.vestika.io/*"
  ],
  "optional_host_permissions": [
    "https://*/*"  // User grants per-site access when creating configs
  ]
}
```

### Privacy Considerations

- **HTML Data Processing**: Brokerage HTML is sent to Vestika backend for AI extraction. Users should be informed via privacy policy.
- **Shared Configurations**: Shared configs are public (URL patterns and selectors). Users should not include personal data in config names.
- **Private Configurations**: Private configs (portfolio/account mappings) are user-specific and not shared.

---

## Success Metrics

### Adoption Metrics
- **Extension Installs**: Target 1,000 installs in first 3 months
- **Active Users**: % of installers who create at least 1 private config (target: 60%)
- **Repeat Usage**: % of users who import holdings at least once per week (target: 40%)

### Feature Usage Metrics
- **Auto-Sync Adoption**: % of private configs with auto-sync enabled (target: 50%)
- **Validation Usage**: % of imports using "Validate Before Import" vs. "Capture & Import" (baseline: 70% validate initially, 30% after trust is built)
- **Shared Config Reuse**: Average # of private configs per shared config (higher = better community value)

### Quality Metrics
- **Extraction Accuracy**: % of extractions with avg confidence score > 0.8 (target: 85%)
- **Import Success Rate**: % of imports that complete without errors (target: 95%)
- **Time Saved**: Estimated time saved per user per month (target: 30 minutes)

### Error & Support Metrics
- **Failed Extractions**: # of extractions with 0 holdings returned (investigate top failure patterns)
- **User-Reported Issues**: # of support tickets related to extraction errors
- **Configuration Coverage**: # of unique brokerage domains with shared configs (target: top 20 US brokers)

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-4)

**Backend:**
- ✅ Implement `/extract` endpoint with Google Gemini integration
- ✅ Implement `/import` endpoint (reuse existing account creation logic)
- ✅ Create database collections for `extension_configs` and `private_configs`
- ✅ Add CRUD endpoints for configurations

**Extension:**
- ✅ Set up Manifest V3 extension boilerplate with Vite + React + TypeScript
- ✅ Implement Firebase auth messaging (content script on `app.vestika.io`)
- ✅ Implement HTML extraction (full page body only, no CSS selector support yet)
- ✅ Build basic popup UI with "Capture & Import" button
- ✅ Build configuration creation wizard (simplified, no testing)
- ✅ Implement private configuration management in options page

**Testing:**
- ✅ Manual testing with 3 brokerage sites (Fidelity, Vanguard, Schwab)
- ✅ End-to-end flow: Install → Auth → Create Config → Import

**Deliverables:**
- Working extension installable via developer mode
- 3 example shared configurations for popular brokers

### Phase 2: Validation & Auto-Sync (Weeks 5-6)

**Backend:**
- ✅ Add confidence scoring to `/extract` response
- ✅ Optimize AI prompt for better extraction accuracy

**Extension:**
- ✅ Implement "Validate Before Import" flow with editable table
- ✅ Implement auto-sync with rate limiting and debounce
- ✅ Add extension badge icon to show sync status
- ✅ Add global auto-sync toggle in options

**Testing:**
- ✅ User testing with 5 beta users
- ✅ Measure extraction accuracy across 10 brokerage sites

**Deliverables:**
- Beta version ready for limited release

### Phase 3: CSS Selector & Advanced Features (Weeks 7-8)

**Backend:**
- ✅ No changes required

**Extension:**
- ✅ Implement CSS selector extraction mode
- ✅ Add interactive element picker (click to select table on page)
- ✅ Add extraction testing in configuration wizard
- ✅ Improve error handling and retry logic

**Testing:**
- ✅ Test CSS selector mode on 5 complex brokerage sites
- ✅ Performance testing (large HTML extraction)

**Deliverables:**
- Full-featured extension ready for public beta

### Phase 4: Polish & Launch (Weeks 9-10)

**Backend:**
- ✅ Performance optimization (caching, rate limiting)
- ✅ Add logging and monitoring for extraction failures

**Extension:**
- ✅ UI/UX polish (animations, loading states, error messages)
- ✅ Onboarding tutorial for first-time users
- ✅ Prepare Chrome Web Store listing (screenshots, description, video demo)

**Testing:**
- ✅ Load testing (100 concurrent extractions)
- ✅ Security audit (third-party review)

**Deliverables:**
- Public Chrome Web Store release
- Landing page with demo video
- Documentation and user guides

---

## Open Questions & Future Enhancements

### Open Questions

1. **Brokerage Website Compatibility**
   - Q: How do we handle SPAs (Single-Page Applications) where portfolio data loads asynchronously?
   - A: Implement DOM mutation observer to wait for data to load before extraction

2. **Multi-Currency Accounts**
   - Q: How do we handle accounts with holdings in multiple currencies?
   - A: Extension sends portfolio_id to `/extract` so AI knows base currency context; AI should extract currency per holding if present

3. **Options & Complex Securities**
   - Q: Can AI extract options, bonds, and other complex securities?
   - A: Start with stocks/ETFs only; expand to options in Phase 5 (future)

4. **Rate Limiting**
   - Q: What if user triggers 100 extractions in 1 minute?
   - A: Backend implements rate limiting (e.g., 10 extractions per minute per user)

### Future Enhancements (Post-Launch)

1. **Shared Config Marketplace**
   - Community voting on shared configs (upvote/downvote)
   - Featured configs for popular brokers
   - User-submitted config reviews

2. **Transaction History Import**
   - Extract not just current holdings but also transaction history (buy/sell)
   - Import as trade history into Vestika

3. **Multi-Brokerage Bulk Import**
   - User defines multiple private configs, clicks "Sync All"
   - Extension sequentially visits each URL and auto-imports

4. **Cost Basis Tracking**
   - Extract cost basis from brokerage pages (if available)
   - Calculate gains/losses in Vestika

5. **Mobile Extension**
   - Safari extension for iOS (using same backend APIs)
   - Firefox extension (Manifest V3 compatible)

6. **AI Model Fine-Tuning**
   - Collect user-corrected extraction data (with consent)
   - Fine-tune Gemini model on brokerage-specific data for higher accuracy

7. **Real-Time Sync**
   - WebSocket connection to Vestika backend
   - Push notifications when portfolio data changes on brokerage site

---

## Appendix

### Competitive Analysis

| Feature | Vestika Extension | Mint (defunct) | Personal Capital | Sharesight |
|---------|------------------|----------------|------------------|------------|
| Browser Extension | ✅ | ❌ | ❌ | ❌ |
| AI-Powered Extraction | ✅ | ❌ | ❌ | ❌ |
| Auto-Sync | ✅ | ✅ (via Plaid) | ✅ (via Plaid) | ❌ (manual CSV) |
| No Credential Storage | ✅ | ❌ (Plaid stores creds) | ❌ | ✅ |
| Community Configs | ✅ | ❌ | ❌ | ❌ |
| Custom Brokers | ✅ | ❌ (Plaid-supported only) | ❌ | ❌ |

**Key Differentiators:**
- **No Plaid Dependency**: Vestika extension does not require brokerage API credentials (Plaid is expensive and limited broker support)
- **AI-Powered**: Handles any broker website structure (even obscure/international brokers)
- **Community-Driven**: Users create and share configurations for new brokers

### Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Brokerage websites change HTML structure | High | High | Community-submitted config updates; AI is resilient to minor changes |
| AI extraction accuracy too low | Medium | High | Validation workflow allows user correction; collect feedback to improve prompts |
| Chrome Web Store rejection | Low | High | Thorough privacy policy; clear permission explanations; security audit |
| Backend API rate limits hit | Medium | Medium | Implement exponential backoff; user-facing rate limit warnings |
| Firebase auth token expiry | Low | Low | Auto-refresh logic in background service worker |

### Design Mockups

*(Not included in this PRD - to be created during implementation)*

**Mockup Checklist:**
- [ ] Extension popup (no config matched)
- [ ] Extension popup (config matched, ready to import)
- [ ] Configuration creation wizard (Step 1-5)
- [ ] Validation modal (editable holdings table)
- [ ] Options page (private config list)
- [ ] Auto-sync success notification
- [ ] Error states (extraction failed, import failed)

---

## Conclusion

The Vestika Browser Extension solves a critical pain point for portfolio management: **manual data entry**. By leveraging AI-powered extraction and community-shared configurations, the extension enables users to import portfolio holdings from any brokerage website with minimal effort.

**Key Success Factors:**
1. **High Extraction Accuracy**: AI must reliably extract holdings (target: 85% accuracy)
2. **Seamless UX**: One-click import with optional validation
3. **Community Engagement**: Shared configs reduce setup friction for new users
4. **Privacy & Security**: Zero credential storage, transparent data handling

**Next Steps:**
1. Backend team: Implement `/extract` and `/import` endpoints (Sprint 1)
2. Extension team: Set up Manifest V3 boilerplate (Sprint 1)
3. Design team: Create mockups for popup and configuration wizard (Sprint 1)
4. Product team: Recruit 5 beta testers from existing Vestika users (Sprint 2)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-17
**Author**: Claude Code (AI Assistant)
**Reviewers**: [To be filled]
**Approved By**: [To be filled]
