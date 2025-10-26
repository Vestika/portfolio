# Vestika Browser Extension UX Design Document
## Prebuilt Configurations & Auto-Sync Features

---

## 1. Executive Summary

This document outlines the UX design for two transformative features for the Vestika browser extension: **Prebuilt Configurations** and **Auto-Sync**. These features aim to reduce the friction in portfolio data extraction by leveraging community knowledge and automation.

**Prebuilt Configurations** allow users to benefit from CSS selector mappings created by other users for popular financial sites, eliminating manual element selection on sites where configurations already exist. The system detects matching configurations automatically and offers users a one-click extraction experience.

**Auto-Sync** enables scheduled, automatic portfolio synchronization when users visit specific financial sites, transforming portfolio management from a manual periodic task into a seamless, always-up-to-date experience.

**Core Design Strategy**: These features follow the progressive disclosure principle—they enhance the extension for users who want them while remaining invisible to those who prefer manual control. Both features prioritize **transparency**, **trust**, and **user control** to ensure users always feel informed and in command of their data.

**Implementation Architecture**: The extension uses a **session-based background extraction flow** where the extension captures HTML, initiates server-side AI extraction, and redirects users to the web app for review and import. This architecture keeps the extension minimal and non-intrusive while providing a spacious, feature-rich review experience on the web app.

**Success Metrics**:
- Reduction in time-to-first-import for new users (target: 80% reduction)
- Increase in sync frequency (target: 3x more frequent portfolio updates)
- User satisfaction with data accuracy (target: >90% confidence rating)
- Adoption rate of community configurations (target: >60% usage on supported sites)

---

## 2. User Personas & Scenarios

### Persona 1: Emily - The New Investor
**Background**: 28-year-old marketing manager with 401k and Robinhood account
**Tech Savvy**: Medium
**Pain Point**: Intimidated by manual element selection, wants "it just works" experience
**Scenario**: Visits Robinhood for the first time with Vestika extension installed

**Goals**:
- Import portfolio data without understanding CSS selectors
- Trust that the data extraction is accurate
- Set up automatic updates so she never has to think about it again

### Persona 2: David - The Portfolio Optimizer
**Background**: 42-year-old engineer with 8 different investment accounts
**Tech Savvy**: High
**Pain Point**: Manually updating 8 accounts every week is tedious
**Scenario**: Has already set up Vestika, wants to automate all his accounts

**Goals**:
- Enable auto-sync for all his accounts
- Have granular control over sync timing and frequency
- Quickly identify and fix sync errors when sites change layouts

### Persona 3: Sarah - The Community Contributor
**Background**: 35-year-old financial advisor who manages client portfolios
**Tech Savvy**: High
**Pain Point**: Wants to help clients use Vestika on niche platforms
**Scenario**: Uses a boutique wealth management platform, creates custom config

**Goals**:
- Create configurations for platforms her clients use
- Share configurations with the community
- Get feedback on configuration accuracy

---

## 3. Detailed User Flows

### 3.1 Prebuilt Configuration Flow

#### Flow A: First-Time User Discovers Prebuilt Config

**Entry Point**: User visits a financial site (e.g., Robinhood) with Vestika extension installed

**Step 1: Automatic Detection (Background)**
```
Browser loads page
↓
Extension content script detects URL
↓
Checks local cache for matching config (URL pattern match)
↓
If not cached, queries backend API: GET /api/configs/match?url={current_url}
↓
Backend returns matching shared configs (if any)
↓
Extension caches result (TTL: 24 hours)
```

**Step 2: User Clicks Extension Icon**
- User clicks Vestika extension icon in browser toolbar
- Extension popup opens (360px width, auto height)

**Visual State**:
```
┌─────────────────────────────────────┐
│ Vestika                        [X]  │
├─────────────────────────────────────┤
│ 🎉 Good news!                       │
│                                     │
│ A configuration for Robinhood is    │
│ available. Import your portfolio    │
│ in one click.                       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Robinhood Holdings              │ │
│ │ Created by: Sarah K.            │ │
│ │ Last updated: 2 days ago        │ │
│ │ Used by: 1,247 users            │ │
│ │ Success rate: 94%               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Extract Data]                      │
│ [or select elements manually >]     │
└─────────────────────────────────────┘
```

**Step 3: User Clicks "Extract Data"**
- Extension captures HTML from page (using prebuilt selectors or full page)
- Shows progress indicator
- Creates extraction session on backend

**Backend Flow**:
```
Extension calls: POST /api/import/extract
Body: { html: "...", config_id: "config_xyz", url: "..." }
↓
Backend creates extraction session:
{
  session_id: "sess_abc123",
  status: "processing",
  user_id: "user123",
  created_at: timestamp
}
↓
Backend starts AI extraction in background task
↓
Backend returns session_id immediately
```

**Visual State** (Extension popup):
```
┌─────────────────────────────────────┐
│ Extracting Data...             [X]  │
├─────────────────────────────────────┤
│ Please wait while we extract your   │
│ holdings from Robinhood.            │
│                                     │
│ [Progress spinner]                  │
│                                     │
│ This usually takes 5-10 seconds...  │
│                                     │
└─────────────────────────────────────┘
```

**Step 4: Extension Redirects to Web App**
- After receiving session_id, extension redirects browser tab to:
  `https://app.vestika.io/import?session={session_id}`
- Extension shows subtle badge indicator (green dot)
- Extension popup closes

**Step 5: Web App Import Page Loads**
- Web app polls session status: `GET /api/import/sessions/{session_id}`
- Shows loading state while extraction is processing
- When status becomes "completed", shows extracted holdings

**Visual State** (Web app - during processing):
```
┌───────────────────────────────────────────────┐
│ Import Holdings                               │
├───────────────────────────────────────────────┤
│ Extracting data from Robinhood...             │
│                                               │
│ [Progress bar with spinner]                   │
│                                               │
│ Our AI is analyzing your portfolio data.      │
│ This usually takes 5-10 seconds.              │
│                                               │
└───────────────────────────────────────────────┘
```

**Visual State** (Web app - extraction complete):
```
┌───────────────────────────────────────────────┐
│ Import Holdings from Robinhood           [X]  │
├───────────────────────────────────────────────┤
│ Review Extracted Holdings                     │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Symbol  Qty     Value      Cost Basis   │   │
│ │ AAPL    10     $1,850.00   $1,500.00   │   │
│ │ TSLA    5      $1,200.00   $1,100.00   │   │
│ │ BTC     0.5    $22,000.00  $20,000.00  │   │
│ │                                         │   │
│ │ [+ Add Holding]  [Edit]  [Remove]      │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ Import to Portfolio                           │
│ Portfolio: [My Portfolio ▼]                   │
│ Account:   [Main Brokerage ▼]                 │
│                                               │
│ [Cancel]                  [Import 3 Holdings] │
└───────────────────────────────────────────────┘
```

**Step 6: User Reviews & Edits Holdings (Optional)**
- User can add/remove holdings
- User can edit symbols, quantities, values
- User can fix extraction errors
- Changes happen client-side (no API calls until import)

**Step 7: User Selects Portfolio & Account**
- Dropdown shows all user's portfolios
- Second dropdown shows accounts within selected portfolio
- Required fields (cannot import without selection)

**Step 8: User Clicks "Import"**
- Web app calls: `POST /api/import/holdings`
  ```json
  {
    "session_id": "sess_abc123",
    "portfolio_id": "portfolio_123",
    "account_id": "account_456",
    "holdings": [
      { "symbol": "AAPL", "quantity": 10, "cost_basis": 1500 },
      { "symbol": "TSLA", "quantity": 5, "cost_basis": 1100 },
      { "symbol": "BTC", "quantity": 0.5, "cost_basis": 20000 }
    ]
  }
  ```
- Backend imports holdings to specified portfolio/account
- Backend deletes session after successful import
- Web app shows success message

**Visual State** (Web app - success):
```
┌───────────────────────────────────────────────┐
│ ✓ Import Successful                      [X]  │
├───────────────────────────────────────────────┤
│ 3 holdings imported to My Portfolio >         │
│ Main Brokerage                                │
│                                               │
│ 💡 Want automatic updates?                    │
│                                               │
│ Enable Auto-Sync to keep this portfolio      │
│ updated automatically when you visit          │
│ Robinhood.                                    │
│                                               │
│ [ ] Enable Auto-Sync for Robinhood            │
│                                               │
│ [View Portfolio]              [Set Up Later]  │
└───────────────────────────────────────────────┘
```

**Step 9: Post-Import Actions**
- User can enable auto-sync (checkbox)
- "View Portfolio" navigates to main portfolio view
- "Set Up Later" closes modal, stays on import page

**Alternative Paths**:
- **No config available**: Show manual selection UI (existing flow)
- **Multiple configs available**: Show list ranked by success rate
- **Extraction fails**: Show error on web app with retry/manual options
- **Session expires**: Show error message with option to restart

---

#### Flow B: Prebuilt Config Extraction Fails

**Trigger**: AI extraction completes with errors or no data found

**Step 1: Detection**
```
AI extraction runs in background
↓
Validation fails (e.g., 0 holdings found, or required fields missing)
↓
Session status set to "failed"
↓
Error details stored in session
```

**Step 2: Web App Shows Error**

**Visual State**:
```
┌───────────────────────────────────────────────┐
│ ⚠ Extraction Issue                       [X]  │
├───────────────────────────────────────────────┤
│ We couldn't extract holdings from this page.  │
│                                               │
│ Possible reasons:                             │
│ • The page layout may have changed            │
│ • No holdings visible on the current page     │
│ • The configuration may be outdated           │
│                                               │
│ What would you like to do?                    │
│                                               │
│ [Try Manual Selection]  [Report Issue]        │
│                                               │
│ [Go Back to Extension]                        │
└───────────────────────────────────────────────┘
```

**Step 3: User Actions**
- **Try Manual Selection**: Opens manual element picker flow
- **Report Issue**: Sends error report to backend, notifies config creator
- **Go Back**: Returns to previous page

**Backend Behavior**:
- After 3+ failure reports in 24 hours, config is marked "Under Review"
- Config creator is notified via email/in-app notification
- "Under Review" configs show warning badge to users in extension popup

---

### 3.2 Auto-Sync Flow

#### Flow C: User Enables Auto-Sync for First Time

**Entry Point**: After successful import on web app

**Step 1: Auto-Sync Prompt (Post-Import)**
- Shown immediately after successful data import on web app
- Part of success confirmation modal

**Visual State** (from Flow A, Step 8):
```
┌───────────────────────────────────────────────┐
│ ✓ Import Successful                      [X]  │
├───────────────────────────────────────────────┤
│ 3 holdings imported to My Portfolio >         │
│ Main Brokerage                                │
│                                               │
│ 💡 Want automatic updates?                    │
│                                               │
│ Enable Auto-Sync to keep this portfolio      │
│ updated automatically when you visit          │
│ Robinhood.                                    │
│                                               │
│ [✓] Enable Auto-Sync for Robinhood            │
│                                               │
│ [View Portfolio]              [Set Up Later]  │
└───────────────────────────────────────────────┘
```

**Step 2: User Enables Auto-Sync**
- User checks "Enable Auto-Sync" checkbox
- Web app calls: `POST /api/import/autosync/enable`
  ```json
  {
    "site_url": "robinhood.com/account",
    "config_id": "config_xyz",
    "portfolio_id": "portfolio_123",
    "account_id": "account_456",
    "frequency": "every_visit"
  }
  ```
- Backend creates private extension config (links shared config to user's portfolio/account)
- Extension sync state updates via background message

**Backend Storage**:
```json
{
  "id": "private_config_123",
  "user_id": "user123",
  "shared_config_id": "config_xyz",
  "portfolio_id": "portfolio_123",
  "account_id": "account_456",
  "enabled": true,
  "frequency": "every_visit",
  "last_sync": null,
  "created_at": "2025-10-27T10:00:00Z"
}
```

**Step 3: First Auto-Sync Trigger**
- User revisits Robinhood (e.g., next day)
- Page loads completely
- Extension detects auto-sync is enabled for this URL

**Background Flow**:
```
Page loads (readyState === 'complete')
↓
Wait 2 seconds (ensure dynamic content loads)
↓
Extension checks for matching auto-sync config
↓
Config found with enabled: true
↓
Extract HTML using saved selectors
↓
Call POST /api/import/extract (with auto_sync: true flag)
↓
Receive session_id
↓
Show subtle notification on page
```

**Visual State** (Notification banner on page):
```
┌─────────────────────────────────────────────────────┐
│ 🔄 Vestika: Extracting portfolio data...       [x] │
└─────────────────────────────────────────────────────┘
```

**Step 4: Auto-Extraction & Optional Redirect**
- Extension can either:
  - **Option A**: Silently extract and show notification when done
  - **Option B**: Auto-redirect to web app after extraction starts

**Option A (Silent, recommended for auto-sync)**:

**Visual State** (Notification banner - after extraction completes):
```
┌─────────────────────────────────────────────────────┐
│ ✓ Portfolio data extracted                     [x] │
│ Last updated: Just now  [Click to Review & Import] │
└─────────────────────────────────────────────────────┘
```

User can:
- Click "Click to Review & Import" → Opens `app.vestika.io/import?session={session_id}`
- Dismiss notification → Data is extracted but not imported (user can review later)
- Do nothing → Notification auto-dismisses after 10 seconds

**Option B (Auto-redirect)**:
- Extension automatically redirects current tab to web app import page
- User sees extraction/import flow as in Flow A
- More intrusive but ensures user reviews data

**Configuration Setting**: User can choose preference in extension settings:
- "Show notification only" (default)
- "Auto-redirect to review page"

**Step 5: User Reviews & Imports on Web App**
- Same flow as Flow A (steps 5-8)
- User reviews extracted holdings
- User confirms portfolio/account (pre-selected from auto-sync config)
- User clicks "Import"

**Step 6: Sync Success**
- Web app shows success message
- Extension badge updates (green dot for 10 seconds)
- Last sync timestamp updated in backend

**Alternative Paths**:
- **Extraction fails**: Show error notification, disable auto-sync until user re-enables
- **No changes detected**: Silent sync, update timestamp only, no notification
- **Significant changes detected**: Show notification requiring user review (see Flow E)

---

#### Flow D: User Manages Auto-Sync Settings

**Entry Point**: User clicks extension icon > Settings

**Step 1: Extension Popup → Settings**

**Visual State**:
```
┌─────────────────────────────────────┐
│ Vestika                   [⚙] [X]  │
├─────────────────────────────────────┤
│ Current page: Robinhood             │
│                                     │
│ [Extract Data from This Page]       │
│                                     │
│ Auto-Sync: Enabled ✓                │
│ Last synced: 2 hours ago            │
│                                     │
│ [Settings]                          │
└─────────────────────────────────────┘
```

User clicks **[⚙]** (settings icon)

**Step 2: Settings View**

**Visual State**:
```
┌─────────────────────────────────────┐
│ ← Settings                     [X]  │
├─────────────────────────────────────┤
│ Auto-Sync Sites                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Robinhood                   [•] │ │
│ │ Last synced: 2 hours ago        │ │
│ │ My Portfolio > Main Brokerage   │ │
│ │ [Configure]                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Coinbase                    [ ] │ │
│ │ Last synced: Never              │ │
│ │ Not configured                  │ │
│ │ [Set Up]                        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Add Auto-Sync for Current Site]  │
│                                     │
│ Global Settings                     │
│ [ ] Pause all auto-sync             │
│ [ ] Show sync notifications         │
│ [ ] Auto-redirect to review page    │
│                                     │
└─────────────────────────────────────┘
```

**Step 3: Configure Individual Site**
User clicks **[Configure]** on Robinhood

**Visual State**:
```
┌─────────────────────────────────────┐
│ ← Robinhood Auto-Sync          [X]  │
├─────────────────────────────────────┤
│ Status: [•] Enabled                 │
│                                     │
│ Import To                           │
│ Portfolio: My Portfolio             │
│ Account:   Main Brokerage           │
│ [Change]                            │
│                                     │
│ Notification Preference             │
│ • Show notification only            │
│ ○ Auto-redirect to review page      │
│                                     │
│ Sync History (Last 7 days)          │
│ ✓ Oct 27, 10:00 AM - 3 holdings    │
│ ✓ Oct 25, 3:30 PM  - 3 holdings    │
│ ✗ Oct 23, 2:00 PM  - Failed        │
│   [View Error Details]              │
│                                     │
│ [Disable Auto-Sync]  [Save Changes] │
└─────────────────────────────────────┘
```

**Step 4: User Modifies Settings**
- Toggle enabled/disabled
- Change destination portfolio/account
- Change notification preference (silent vs. auto-redirect)
- View sync history with details
- Disable auto-sync (requires confirmation)

---

#### Flow E: Data Conflict Resolution

**Trigger**: Auto-sync detects significant changes (e.g., 50%+ difference in value)

**Step 1: Conflict Detection**
```
Auto-sync extracts data in background
↓
Backend AI extraction completes
↓
Backend compares with last known state for this account
↓
Detects major difference:
  - Number of holdings changed by >2
  - Total value changed by >50%
  - New securities not seen before
↓
Session marked as "requires_review"
↓
Extension receives notification
```

**Step 2: User Notification**

**Visual State** (Notification banner on page):
```
┌─────────────────────────────────────────────────────┐
│ ⚠ Significant portfolio changes detected       [x] │
│ Review before importing  [Review Changes]           │
└─────────────────────────────────────────────────────┘
```

**Step 3: User Clicks "Review Changes"**
- Browser redirects to: `app.vestika.io/import?session={session_id}`
- Web app shows comparison view

**Visual State** (Web app):
```
┌───────────────────────────────────────────────────┐
│ Review Changes - Robinhood                   [X]  │
├───────────────────────────────────────────────────┤
│ We detected significant changes to your portfolio.│
│ Please review before importing.                   │
│                                                   │
│ Current (in Vestika)  →  New (from Robinhood)    │
│ ─────────────────────────────────────────────────│
│ AAPL  10 shares        →  15 shares (+5) ✓       │
│ TSLA  5 shares         →  0 shares (removed) ⚠    │
│ [NEW] NVDA             →  20 shares ⚠             │
│                                                   │
│ Total value:                                      │
│ $25,050                →  $32,400 (+29%)          │
│                                                   │
│ Why am I seeing this?                             │
│ We ask you to review when we detect large        │
│ changes to prevent accidental overwrites.         │
│                                                   │
│ [Edit Holdings]                                   │
│                                                   │
│ [Cancel]                      [Accept & Import]   │
└───────────────────────────────────────────────────┘
```

**Step 4: User Decision**
- **Accept & Import**: Imports new data, updates portfolio, updates last_sync timestamp
- **Edit Holdings**: Opens editor to manually adjust before import
- **Cancel**: Dismisses, keeps old data, logs decision, last_sync not updated

---

### 3.3 Configuration Creation & Sharing Flow

#### Flow F: User Creates & Publishes Configuration

**Entry Point**: User successfully extracts data from a site without a prebuilt config (using manual selection)

**Step 1: Manual Extraction Success**
- User used manual element picker to extract data
- Extraction completed successfully
- Web app shows success message with sharing prompt

**Visual State** (Web app post-import):
```
┌───────────────────────────────────────────────────┐
│ ✓ Import Successful                          [X]  │
├───────────────────────────────────────────────────┤
│ 3 holdings imported successfully.                 │
│                                                   │
│ 💡 Help others save time                          │
│                                                   │
│ You manually selected elements for TD Ameritrade. │
│ Share your configuration so other Vestika users   │
│ can import from this site with one click.         │
│                                                   │
│ Your configuration will include:                  │
│ • Site URL pattern                                │
│ • CSS selectors you defined                       │
│ • Your name as creator (optional)                 │
│                                                   │
│ [ ] Make this configuration public                │
│ [ ] Credit me as creator (show my name)           │
│                                                   │
│ [Skip]                        [Save & Publish]    │
└───────────────────────────────────────────────────┘
```

**Step 2: User Publishes Config**
- User checks "Make this configuration public"
- Optionally checks "Credit me as creator"
- Clicks "Save & Publish"
- Web app uploads config to backend

**Backend API**:
```
POST /api/configs/shared
{
  "site_name": "TD Ameritrade",
  "url_pattern": "tdameritrade.com/portfolio",
  "selectors": {
    "symbol": ".holding-symbol",
    "quantity": ".holding-qty",
    "value": ".holding-value",
    "cost_basis": ".holding-cost"
  },
  "public": true,
  "credit_creator": true
}
```

**Backend Storage** (shared config):
```json
{
  "id": "config_abc",
  "site_name": "TD Ameritrade",
  "url_pattern": "tdameritrade.com/portfolio",
  "creator_id": "user123",
  "creator_name": "Sarah K.",
  "selectors": { ... },
  "status": "active",
  "created_at": "2025-10-27T10:00:00Z",
  "usage_count": 0,
  "success_rate": null,
  "verified": false
}
```

**Step 3: Confirmation**

**Visual State**:
```
┌───────────────────────────────────────────────────┐
│ ✓ Configuration Published                    [X]  │
├───────────────────────────────────────────────────┤
│ Thank you for contributing!                       │
│                                                   │
│ Your TD Ameritrade configuration is now available │
│ to all Vestika users.                             │
│                                                   │
│ You'll receive notifications when:                │
│ • Users report issues with your config            │
│ • Your config is verified by the community        │
│ • The site layout changes                         │
│                                                   │
│ [View My Configurations]              [Done]      │
└───────────────────────────────────────────────────┘
```

---

### 3.4 Session Management Flow

#### Flow G: Session Lifecycle

**Session States**:
1. **Processing**: AI extraction in progress
2. **Completed**: Extraction successful, holdings available
3. **Failed**: Extraction failed with error details
4. **Requires Review**: Conflict detected, user review needed
5. **Expired**: Session TTL exceeded (24 hours)
6. **Deleted**: Successfully imported and cleaned up

**Session Storage** (MongoDB):
```json
{
  "session_id": "sess_abc123",
  "user_id": "user123",
  "status": "processing",
  "html": "...",
  "config_id": "config_xyz",
  "url": "robinhood.com/account",
  "holdings": null,
  "error_message": null,
  "created_at": "2025-10-27T10:00:00Z",
  "expires_at": "2025-10-28T10:00:00Z",
  "auto_sync": false
}
```

**Polling Flow** (Web app):
```
Web app loads import page with session_id
↓
Poll every 2 seconds: GET /api/import/sessions/{session_id}
↓
If status === "processing": Continue polling, show progress
If status === "completed": Show holdings for review
If status === "failed": Show error message
If status === "requires_review": Show conflict comparison
If status === "expired": Show error, offer retry
```

**Session Expiry**:
- Sessions expire 24 hours after creation
- Expired sessions cannot be imported
- User must restart extraction process

**Session Cleanup**:
- Sessions are deleted after successful import
- Failed sessions are retained for 24 hours for debugging
- Periodic cleanup job runs daily to delete old sessions

**Resuming Interrupted Flows**:
- User can close browser mid-extraction
- Session persists on server
- User can return to `app.vestika.io/import?session={session_id}` anytime within 24 hours
- Web app resumes from where user left off

---

## 4. UI Component Specifications

### 4.1 Extension Popup (Minimal Design)

**Dimensions**:
- Width: 360px (fixed)
- Height: Auto (min 180px, max 400px)

**Layout**:
```
┌──────────────────────────────────────────┐
│ Header (50px)                            │
│ - Logo (left)                            │
│ - Settings icon (top-right)              │
│ - Close icon (top-right)                 │
├──────────────────────────────────────────┤
│ Content Area (auto height)               │
│ - Minimal content: action button + info  │
│ - No preview UI (happens on web app)     │
│ - Padding: 16px                          │
├──────────────────────────────────────────┤
│ Footer (optional, 50px)                  │
│ - Single primary action button           │
└──────────────────────────────────────────┘
```

**Default State** (no config):
```
┌──────────────────────────────────────────┐
│ Vestika                        [⚙] [X]  │
├──────────────────────────────────────────┤
│ Current page: [Site Name]                │
│                                          │
│ [Extract Data from This Page]            │
│                                          │
│ [Settings]                               │
└──────────────────────────────────────────┘
```

**With Prebuilt Config** (see Flow A, Step 2)

**During Extraction**:
```
┌──────────────────────────────────────────┐
│ Vestika                             [X]  │
├──────────────────────────────────────────┤
│ Extracting data...                       │
│                                          │
│ [Spinner animation]                      │
│                                          │
│ Redirecting to review page...            │
└──────────────────────────────────────────┘
```

**Styling** (following Vestika design system):
- Background: `#1a1a1a` (gray-900)
- Text: `#ffffff` (white)
- Border: `1px solid #374151` (gray-700)
- Border radius: `8px` (rounded-lg)
- Font: Inter

**Key Principle**: Extension popup is **minimal and non-intrusive**. No complex preview UI, no editing, no portfolio selection. All complex interactions happen on web app.

---

### 4.2 Web App Import Page

**Layout**:
```
┌───────────────────────────────────────────────────┐
│ Header: Import Holdings                           │
├───────────────────────────────────────────────────┤
│ [If processing]                                   │
│   Loading state with progress bar                 │
│                                                   │
│ [If completed]                                    │
│   Holdings table (editable)                       │
│   Portfolio/Account selectors                     │
│   Import button                                   │
│                                                   │
│ [If failed]                                       │
│   Error message with retry/manual options         │
│                                                   │
│ [If requires_review]                              │
│   Comparison view (old vs. new)                   │
│   Accept/Edit/Cancel actions                      │
└───────────────────────────────────────────────────┘
```

**Processing State**:
```
┌───────────────────────────────────────────────────┐
│ Import Holdings                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│     [Animated spinner]                            │
│                                                   │
│     Extracting data from Robinhood...             │
│                                                   │
│     Our AI is analyzing your portfolio data.      │
│     This usually takes 5-10 seconds.              │
│                                                   │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Completed State** (see Flow A, Step 5)

**Holdings Table** (editable):
- Add/remove rows
- Edit all fields inline
- Symbol autocomplete
- Validation on blur
- Unsaved changes warning

**Portfolio/Account Selectors**:
- Dropdowns with search
- Create new option (opens modal)
- Required fields (highlighted if empty)

---

### 4.3 Page Notification Banners

**Position**: Fixed top of page, full width, slides down on appear

**Extracting State**:
```
┌─────────────────────────────────────────────────────┐
│ 🔄 Vestika: Extracting portfolio data...       [x] │
└─────────────────────────────────────────────────────┘
```

**Extraction Complete** (notification only mode):
```
┌─────────────────────────────────────────────────────┐
│ ✓ Portfolio data extracted                     [x] │
│ Last updated: Just now  [Click to Review & Import] │
└─────────────────────────────────────────────────────┘
```

**Conflict Detected**:
```
┌─────────────────────────────────────────────────────┐
│ ⚠ Significant portfolio changes detected       [x] │
│ Review before importing  [Review Changes]           │
└─────────────────────────────────────────────────────┘
```

**Error**:
```
┌─────────────────────────────────────────────────────┐
│ ✗ Extraction failed                            [x] │
│ Could not find holdings. [Try Manual] [Report]      │
└─────────────────────────────────────────────────────┘
```

**Specifications**:
- Height: 48px (single line) or 64px (with actions)
- Background: `rgba(26, 26, 26, 0.95)` with backdrop blur
- Z-index: 10000 (above page content)
- Animation: Slide down from top (300ms ease-out)
- Auto-dismiss: Success (10s), Processing (never), Error (manual)
- Click outside to dismiss

---

### 4.4 Extension Badge States

**Badge** (on browser toolbar icon):

1. **No badge** - Default state
2. **Green dot** - Extraction completed recently (shown for 10s)
3. **Red dot** - Extraction error occurred
4. **Blue dot** - Review required (conflict detected)

**Badge Styling**:
- Size: 8px diameter
- Position: Top-right corner of icon
- Colors:
  - Success: `#22c55e` (green-500)
  - Error: `#ef4444` (red-500)
  - Info: `#3b82f6` (blue-500)

---

### 4.5 Configuration Card Component (Extension Popup)

**Visual Structure**:
```
┌─────────────────────────────────────────┐
│ [Icon] Robinhood Holdings               │
│                                         │
│ Created by: Sarah K.                    │
│ Last updated: 2 days ago                │
│ Used by: 1,247 users                    │
│ Success rate: 94%  [Verified ✓]        │
└─────────────────────────────────────────┘
```

**Status Badges**:
- "Verified" (green) - High success rate (>90%), many users (>1000)
- "Under Review" (yellow) - Recent failure reports (3+ in 24h)
- "Beta" (blue) - New config (<100 uses)

**Styling**:
- Background: `#262626` (gray-800)
- Border: `1px solid #374151`
- Padding: `12px`
- Border radius: `6px`
- Hover state: Border color `#3b82f6` (blue-600)

---

### 4.6 Settings Panel Layout (Extension)

**Structure**:
```
┌──────────────────────────────────────┐
│ ← Settings                      [X]  │
├──────────────────────────────────────┤
│                                      │
│ Auto-Sync Sites                      │
│ ┌──────────────────────────────────┐ │
│ │ [Site Card 1]               [•] │ │
│ │ Last synced: 2 hours ago        │ │
│ │ Portfolio > Account             │ │
│ │ [Configure]                     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [+ Add Auto-Sync for Current Site]   │
│                                      │
│ Global Settings                      │
│ [ ] Pause all auto-sync              │
│ [ ] Show notifications               │
│ [ ] Auto-redirect to review page     │
│                                      │
│ About                                │
│ Version 2.0.0                        │
│ [Documentation] [Privacy Policy]     │
└──────────────────────────────────────┘
```

---

## 5. Interaction Specifications

### 5.1 Extension → Backend Flow

**1. Check for Matching Config**:
```
Extension: GET /api/configs/match?url={current_url}
Backend: Returns matching shared configs (if any)
Extension: Caches result for 24 hours
```

**2. Extract Data**:
```
Extension: POST /api/import/extract
Body: {
  html: "<html>...</html>",
  config_id: "config_xyz" | null,
  url: "robinhood.com/account",
  auto_sync: false
}
Backend: Creates session, starts AI extraction, returns session_id
Extension: Receives { session_id: "sess_abc123" }
```

**3. Redirect to Web App**:
```
Extension: Opens tab to app.vestika.io/import?session={session_id}
```

---

### 5.2 Web App → Backend Flow

**1. Poll Session Status**:
```
Web App: GET /api/import/sessions/{session_id}
Backend: Returns session object with status
Web App: Polls every 2 seconds until status !== "processing"
```

**2. Import Holdings**:
```
Web App: POST /api/import/holdings
Body: {
  session_id: "sess_abc123",
  portfolio_id: "portfolio_123",
  account_id: "account_456",
  holdings: [...]
}
Backend: Imports holdings, deletes session, returns success
```

**3. Enable Auto-Sync**:
```
Web App: POST /api/import/autosync/enable
Body: {
  site_url: "robinhood.com",
  config_id: "config_xyz",
  portfolio_id: "portfolio_123",
  account_id: "account_456",
  notification_preference: "notification_only" | "auto_redirect"
}
Backend: Creates private config, returns success
```

---

### 5.3 Auto-Sync Trigger Logic

**When to Trigger Auto-Sync**:

1. **Page Load Complete**:
   - Wait for `document.readyState === 'complete'`
   - Additional 2-second delay (allow JavaScript to render dynamic content)

2. **URL Match**:
   - Check if current URL matches saved `url_pattern` (regex)
   - Example pattern: `^https://robinhood\.com/(account|portfolio)`

3. **Throttling**:
   - Don't sync if last sync was <1 hour ago (prevent excessive syncs)
   - Exception: Manual trigger from extension popup

4. **User Enabled**:
   - Check that auto-sync is enabled for this site
   - Check global "Pause all" setting is not active

**Code Logic** (Pseudocode):
```javascript
async function checkAndTriggerAutoSync(url) {
  const configs = await getAutoSyncConfigs();

  for (const config of configs) {
    if (!config.enabled) continue;
    if (!urlMatchesPattern(url, config.url_pattern)) continue;

    const lastSync = config.last_sync;
    const now = Date.now();

    // Throttle: Don't sync if synced <1 hour ago
    if (lastSync && (now - lastSync) < 3600000) {
      console.log('Skipping sync: too recent');
      continue;
    }

    // Global pause check
    if (globalSettings.pauseAllAutoSync) {
      console.log('Skipping sync: global pause enabled');
      continue;
    }

    // Trigger sync
    await executeAutoSync(config);
  }
}

async function executeAutoSync(config) {
  showNotification('Extracting portfolio data...');

  const html = document.documentElement.outerHTML;
  const response = await fetch('/api/import/extract', {
    method: 'POST',
    body: JSON.stringify({
      html,
      config_id: config.shared_config_id,
      url: window.location.href,
      auto_sync: true
    })
  });

  const { session_id } = await response.json();

  if (userSettings.notificationPreference === 'auto_redirect') {
    // Option B: Auto-redirect
    window.location.href = `https://app.vestika.io/import?session=${session_id}`;
  } else {
    // Option A: Show notification
    pollSessionUntilComplete(session_id);
  }
}

async function pollSessionUntilComplete(session_id) {
  const interval = setInterval(async () => {
    const session = await fetch(`/api/import/sessions/${session_id}`).then(r => r.json());

    if (session.status === 'completed') {
      clearInterval(interval);
      showNotification(
        '✓ Portfolio data extracted',
        'Click to review & import',
        () => window.open(`https://app.vestika.io/import?session=${session_id}`)
      );
    } else if (session.status === 'failed') {
      clearInterval(interval);
      showNotification('✗ Extraction failed', 'Click to retry');
    }
  }, 2000);
}
```

---

### 5.4 Data Validation & Conflict Detection

**Validation Rules**:

1. **Minimum Data Check**:
   - At least 1 holding extracted
   - Required fields present: symbol, quantity OR value

2. **Data Quality Check**:
   - Symbols are valid (2-5 uppercase letters, or crypto format)
   - Quantities are positive numbers
   - Values are positive numbers

3. **Conflict Detection**:
   - Trigger review if:
     - Holdings count changed by >50% OR >2 holdings
     - Total portfolio value changed by >50%
     - New symbols not previously seen (first occurrence)

**Backend Validation Flow**:
```javascript
async function validateExtractedData(newData, oldData) {
  // Basic validation
  if (newData.holdings.length === 0) {
    return { valid: false, reason: 'No holdings found' };
  }

  // Data quality
  for (const holding of newData.holdings) {
    if (!holding.symbol || !isValidSymbol(holding.symbol)) {
      return { valid: false, reason: 'Invalid symbol detected' };
    }
  }

  // Conflict detection (only for auto-sync)
  if (!oldData) return { valid: true, needsReview: false };

  const oldCount = oldData.holdings.length;
  const newCount = newData.holdings.length;
  const countChange = Math.abs(newCount - oldCount);
  const countChangePercent = countChange / oldCount;

  if (countChangePercent > 0.5 || countChange > 2) {
    return {
      valid: true,
      needsReview: true,
      reason: 'Significant holdings change',
      status: 'requires_review'
    };
  }

  const oldValue = oldData.total_value;
  const newValue = newData.total_value;
  const valueChangePercent = Math.abs(newValue - oldValue) / oldValue;

  if (valueChangePercent > 0.5) {
    return {
      valid: true,
      needsReview: true,
      reason: 'Large value change',
      status: 'requires_review'
    };
  }

  return { valid: true, needsReview: false, status: 'completed' };
}
```

---

### 5.5 Session Management

**Session Expiry Policy**:
- Sessions expire 24 hours after creation
- TTL index on `expires_at` field (MongoDB)
- Expired sessions return 410 Gone status

**Session Cleanup**:
```javascript
// Periodic cleanup job (runs daily)
async function cleanupExpiredSessions() {
  const expiredSessions = await db.sessions.find({
    expires_at: { $lt: new Date() }
  });

  await db.sessions.deleteMany({
    expires_at: { $lt: new Date() }
  });

  console.log(`Deleted ${expiredSessions.length} expired sessions`);
}
```

**Handling Expired Sessions** (Web app):
```javascript
async function loadSession(session_id) {
  try {
    const response = await fetch(`/api/import/sessions/${session_id}`);

    if (response.status === 410) {
      showError('This import session has expired. Please extract data again.');
      return;
    }

    const session = await response.json();
    return session;
  } catch (error) {
    showError('Failed to load session. Please try again.');
  }
}
```

---

## 6. Copy & Microcopy Recommendations

### 6.1 Extension Popup Copy

**Config Available**:
- ✅ "Good news! A configuration for [Site] is available."
- ✅ "Import in one click"
- ❌ "Use community configuration?" (too vague)

**Action Buttons**:
- ✅ "Extract Data" (clear action)
- ✅ "Select Manually Instead" (clear alternative)
- ❌ "Apply Config" (sounds technical)

**During Extraction**:
- ✅ "Extracting data..."
- ✅ "This usually takes 5-10 seconds"
- ✅ "Redirecting to review page..."
- ❌ "Processing HTML DOM..."

---

### 6.2 Web App Import Page Copy

**Processing State**:
- ✅ "Extracting data from [Site]..."
- ✅ "Our AI is analyzing your portfolio data."
- ✅ "This usually takes 5-10 seconds."
- ❌ "Executing extraction pipeline..."

**Review Holdings**:
- ✅ "Review Extracted Holdings"
- ✅ "Edit if needed, then import to your portfolio"
- ❌ "Verify extraction results"

**Conflict Review**:
- ✅ "We detected significant changes to your portfolio."
- ✅ "Please review before importing."
- ✅ "Why am I seeing this? We ask you to review large changes to prevent accidental overwrites."
- ❌ "Data delta exceeds threshold."

---

### 6.3 Notification Banner Copy

**Extracting**:
- ✅ "Vestika: Extracting portfolio data..."
- ❌ "Data extraction in progress..."

**Success** (notification only mode):
- ✅ "Portfolio data extracted"
- ✅ "Last updated: Just now"
- ✅ "Click to Review & Import"
- ❌ "Extraction successful. Navigate to import page."

**Conflict**:
- ✅ "Significant portfolio changes detected"
- ✅ "Review before importing"
- ❌ "Change threshold exceeded"

**Error**:
- ✅ "Extraction failed"
- ✅ "Could not find holdings on this page"
- ❌ "Selector matching failed"

---

### 6.4 Auto-Sync Enablement Copy

**Post-Import Prompt**:
- ✅ "Want automatic updates?"
- ✅ "Enable Auto-Sync to keep this portfolio updated automatically when you visit [Site]."
- ❌ "Activate automated synchronization?"

**Settings Labels**:
- ✅ "Auto-Sync Sites"
- ✅ "Notification Preference"
  - "Show notification only"
  - "Auto-redirect to review page"
- ❌ "Synchronization Configuration"
  - "Silent mode"
  - "Interactive mode"

---

## 7. Edge Cases & Error States

### 7.1 Edge Case Matrix

| Scenario | Expected Behavior | UI Treatment |
|----------|------------------|--------------|
| **Session expired** | Return 410 Gone, show error on web app | "This session has expired. Please extract data again." |
| **User closes browser mid-extraction** | Session persists on server | User can resume by visiting import URL with session_id |
| **Config broken (site changed)** | Extraction fails, mark config "Under Review" | Show error, offer manual selection, report issue |
| **Network timeout during extraction** | Backend times out AI request after 30s | Show error, offer retry |
| **Multiple configs for same site** | Show list ranked by success rate | Dropdown or list view in extension popup |
| **User has no internet** | API call fails | Show error: "Check your internet connection" |
| **Page requires login, user logged out** | Extraction may find no data | Show error: "Could not find holdings. Make sure you're logged in." |
| **User clicks extract twice rapidly** | First request creates session, second returns existing session | Idempotent behavior, same session_id returned |
| **Site uses infinite scroll** | Only extract visible holdings | Warning on web app: "Only visible holdings extracted" |
| **Holdings in multiple currencies** | Extract all, rely on backend conversion | No special UI treatment |
| **User edits holdings then closes page** | Changes lost (client-side only) | "Unsaved changes" warning on page unload |

---

### 7.2 Error State Details

#### Error: Extraction Failed (No Data)

**Web App State**:
```
┌───────────────────────────────────────────────────┐
│ ⚠ Extraction Issue                           [X]  │
├───────────────────────────────────────────────────┤
│ We couldn't extract holdings from this page.      │
│                                                   │
│ Possible reasons:                                 │
│ • The page layout may have changed                │
│ • No holdings visible on the current page         │
│ • You might not be logged in                      │
│                                                   │
│ What would you like to do?                        │
│                                                   │
│ [Try Manual Selection]  [Report Issue]            │
│                                                   │
│ [Go Back]                                         │
└───────────────────────────────────────────────────┘
```

**Actions**:
- Try Manual Selection: Opens manual element picker on original site
- Report Issue: Sends error report, marks config as potentially broken
- Go Back: Returns to previous page

---

#### Error: Session Expired

**Web App State**:
```
┌───────────────────────────────────────────────────┐
│ ⚠ Session Expired                            [X]  │
├───────────────────────────────────────────────────┤
│ This import session has expired.                  │
│                                                   │
│ Import sessions are valid for 24 hours.           │
│ Please extract your data again.                   │
│                                                   │
│ [Go to Extension]               [Close]           │
└───────────────────────────────────────────────────┘
```

---

#### Error: Network Timeout

**Notification Banner**:
```
┌─────────────────────────────────────────────────────┐
│ ✗ Network Error                                [x] │
│ Could not reach Vestika servers. [Retry]            │
└─────────────────────────────────────────────────────┘
```

**Retry Logic**:
- Attempt 1: Immediate retry
- Attempt 2: After 2 seconds
- Attempt 3: After 5 seconds
- After 3 failures: Show error, manual retry button

---

### 7.3 Handling Broken Configs

**Detection**:
- 3+ users report extraction failure in 24 hours
- Success rate drops below 50%
- Config creator manually marks as broken

**User Experience**:

**Extension Popup** (when broken config is detected):
```
┌─────────────────────────────────────┐
│ Vestika                        [X]  │
├─────────────────────────────────────┤
│ ⚠ Configuration May Be Outdated     │
│                                     │
│ The Robinhood configuration might   │
│ not work correctly. The site may    │
│ have changed recently.              │
│                                     │
│ [Try Anyway]  [Select Manually]     │
└─────────────────────────────────────┘
```

**Auto-Sync Behavior**:
- Auto-sync is automatically disabled when config breaks
- User receives notification:
  ```
  Auto-Sync Paused - Robinhood
  The configuration stopped working.
  [Try Manual Sync] [Disable Auto-Sync]
  ```

**Creator Notification**:
- Email: "Your Robinhood configuration needs updating"
- In-app notification with link to view errors and update config

---

## 8. Privacy & Trust Considerations

### 8.1 Transparency Measures

**What Users Should Know**:

1. **Data Access Transparency**:
   - Extension only reads visible page content (DOM)
   - Never accesses cookies, passwords, or login tokens
   - Never runs on login pages (excluded in manifest permissions)

2. **Data Transmission**:
   - HTML sent to Vestika backend for AI extraction
   - Extracted portfolio data returned in session
   - Encrypted in transit (HTTPS)
   - Stored securely, associated with user account

3. **Session-Based Flow**:
   - Extraction happens on server, not in browser
   - Sessions expire after 24 hours
   - Sessions deleted after successful import
   - User always reviews data before import

4. **Community Configs**:
   - Configs contain only CSS selectors (no personal data)
   - Creator name is public (opt-in)
   - Configs are reviewed before marked "Verified"

**Privacy Policy Link**:
- Visible in extension settings
- Link: `https://vestika.io/extension-privacy`

**In-App Privacy Notice** (First-time setup):
```
┌─────────────────────────────────────────┐
│ Welcome to Vestika Extension      [X]  │
├─────────────────────────────────────────┤
│ How it works:                           │
│                                         │
│ 1. You click "Extract Data" on a site  │
│ 2. We send page HTML to our servers    │
│ 3. Our AI extracts your holdings        │
│ 4. You review & import on web app      │
│                                         │
│ We NEVER access:                        │
│ • Login credentials                     │
│ • Cookies or sessions                   │
│ • Pages you don't interact with         │
│                                         │
│ [Learn More]  [Get Started]             │
└─────────────────────────────────────────┘
```

---

### 8.2 Trust Signals for Community Configs

**Trust Indicators**:

1. **Verified Badge**:
   - Criteria: >1,000 uses, >90% success rate, >30 days old
   - Visual: Green checkmark badge
   - Tooltip: "Verified by community usage"

2. **Creator Reputation**:
   - Show creator's total configs published
   - Show total usage across all their configs
   - Example: "Sarah K. • 3 configs • Used 5.2k times"

3. **Success Metrics**:
   - Real-time success rate (last 30 days)
   - Total usage count
   - Last successful use (relative time)

**Warning Indicators**:

1. **Under Review Badge** (Yellow):
   - Shown when: 3+ failure reports in 24 hours
   - Tooltip: "Some users reported issues recently. Use with caution."

2. **Beta Badge** (Blue):
   - Shown when: <100 total uses
   - Tooltip: "New configuration. Help us test it!"

---

## 9. Progressive Disclosure Strategy

### 9.1 Information Layering

**Level 1: First-Time User (Minimal)**
- Extension popup shows only: "Extract Data" button
- Auto-sync mentioned only after successful first import on web app
- Settings icon visible but not emphasized

**Level 2: Returning User (Contextual)**
- Auto-sync prompt appears after first successful import on web app
- Badge indicator when extraction completes
- Settings shows enabled auto-sync sites

**Level 3: Power User (Full Access)**
- All settings accessible via settings panel
- Auto-sync for multiple sites
- Config creation and sharing options
- Advanced notification preferences

---

### 9.2 Onboarding Flow

**First Extension Install**:

**Step 1: Welcome Screen** (Extension popup):
```
┌─────────────────────────────────────┐
│ Welcome to Vestika            [X]  │
├─────────────────────────────────────┤
│ Import portfolios from any          │
│ financial site with one click.      │
│                                     │
│ 1. Visit your brokerage site        │
│ 2. Click "Extract Data"             │
│ 3. Review & import on Vestika       │
│                                     │
│ [Get Started]                       │
└─────────────────────────────────────┘
```

**Step 2: First Site Visit** (e.g., user goes to Robinhood)
- Extension icon badge shows blue dot (actionable)
- User clicks extension icon
- If prebuilt config exists: Show Flow A UI
- If no config: Show manual selection prompt

**Step 3: Post-First-Import** (Web app):
```
✓ Import Successful

Your holdings are now in Vestika.

💡 Want automatic updates?
Enable Auto-Sync to keep this portfolio
updated when you visit [Site].

[ ] Enable Auto-Sync for [Site]

[View Portfolio]  [Set Up Later]
```

---

## 10. Accessibility Considerations

### 10.1 Keyboard Navigation

**All Interactive Elements Must**:
- Be focusable via Tab key
- Have visible focus states (blue ring)
- Support Enter/Space for activation
- Support Escape to close modals/popups

**Keyboard Shortcuts** (in extension popup):
- `Tab` / `Shift+Tab` - Navigate elements
- `Enter` - Activate focused button/link
- `Escape` - Close popup or modal

---

### 10.2 Screen Reader Support

**Semantic HTML**:
- Use `<button>` for actions (not `<div>` with click handlers)
- Use proper heading hierarchy (`<h1>`, `<h2>`, etc.)
- Use `<main>`, `<nav>`, `<article>` for sections

**ARIA Labels**:
```html
<!-- Extension popup -->
<button aria-label="Extract portfolio data from current page">
  Extract Data
</button>

<!-- Notification banner -->
<div role="status" aria-live="polite" aria-atomic="true">
  Extracting portfolio data...
</div>

<!-- Error message -->
<div role="alert" aria-live="assertive">
  Extraction failed. Could not find holdings on this page.
</div>
```

**Web App Import Page**:
```html
<!-- Holdings table -->
<table aria-label="Extracted holdings">
  <caption>Review and edit extracted holdings before import</caption>
  ...
</table>

<!-- Portfolio selector -->
<label for="portfolio-select">Import to Portfolio</label>
<select id="portfolio-select" aria-required="true">
  ...
</select>
```

---

### 10.3 Visual Accessibility

**Color Contrast**:
- All text meets WCAG AA (4.5:1 for normal text, 3:1 for large)
- Error states use both color AND icon (not just red text)
- Success states use both color AND checkmark

**Focus Indicators**:
```css
button:focus-visible {
  outline: 2px solid #3b82f6; /* blue-600 */
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Text Sizing**:
- Minimum text size: 14px
- Support browser zoom up to 200% without breaking layout
- Use relative units (rem, em) for font sizes

**Motion Sensitivity**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Analytics & Instrumentation

### 11.1 Key Metrics to Track

**Adoption Metrics**:
- % of users who use prebuilt configs (vs. manual selection)
- % of users who enable auto-sync (overall, per site)
- Number of active auto-sync sites per user
- Config creation rate (user-submitted configs per week)

**Engagement Metrics**:
- Auto-sync frequency (syncs per user per week)
- Config usage distribution (which sites are most popular)
- Average time on web app import page
- Session completion rate (started → imported)

**Quality Metrics**:
- Config success rate (per config, aggregated)
- Conflict review rate (% of syncs requiring review)
- Conflict review acceptance rate (% accepted vs. cancelled)
- Error rate (failed extractions, broken configs)
- Session expiry rate (% of sessions that expire before import)

**User Satisfaction**:
- Feature rating (in-app prompt: "How useful is auto-sync?")
- Support ticket volume (config-related, auto-sync-related)
- User retention (do auto-sync users sync more frequently long-term?)

---

### 11.2 Event Tracking

**Events to Log** (send to analytics backend):

```javascript
// Session flow events
trackEvent('extraction_started', { site_name, config_id, auto_sync });
trackEvent('extraction_completed', { session_id, holdings_count, duration_ms });
trackEvent('extraction_failed', { session_id, error_type });
trackEvent('session_polled', { session_id, poll_count });
trackEvent('session_expired', { session_id, age_hours });

// Web app import events
trackEvent('import_page_loaded', { session_id });
trackEvent('holdings_edited', { session_id, edit_count });
trackEvent('holdings_imported', { session_id, portfolio_id, account_id, holdings_count });
trackEvent('import_cancelled', { session_id, reason });

// Config events
trackEvent('config_shown', { site_name, config_id });
trackEvent('config_used', { site_name, config_id });
trackEvent('config_failed', { site_name, config_id, error_type });
trackEvent('config_reported', { site_name, config_id, reason });
trackEvent('config_created', { site_name, user_id });
trackEvent('config_published', { site_name, config_id });

// Auto-sync events
trackEvent('autosync_enabled', { site_name, portfolio_id, account_id, notification_pref });
trackEvent('autosync_disabled', { site_name, reason });
trackEvent('autosync_triggered', { site_name, trigger_type });
trackEvent('autosync_conflict', { site_name, change_percent });
trackEvent('conflict_accepted', { site_name });
trackEvent('conflict_rejected', { site_name });

// Notification events
trackEvent('notification_shown', { notification_type, site_name });
trackEvent('notification_clicked', { notification_type, action });
trackEvent('notification_dismissed', { notification_type });
```

**Privacy Considerations**:
- Never log extracted portfolio data (symbols, quantities, values)
- Only log aggregate/anonymized metrics
- Allow users to opt out of analytics in settings

---

## 12. Future Enhancements (Post-MVP)

### 12.1 Short-Term (3-6 months)

1. **Smart Import Suggestions**:
   - If user visits site multiple times without importing, suggest enabling auto-sync
   - "You've extracted data 3 times. Want to enable auto-sync?"

2. **Batch Import**:
   - User can extract from multiple sites, then review all at once
   - Single import page with tabs for each site

3. **Partial Sync**:
   - Sync only changed holdings (delta updates)
   - Reduces processing time for large portfolios

4. **Config Versioning**:
   - Track config changes over time
   - Automatically migrate users to new versions
   - Rollback if new version breaks

5. **Mobile Browser Support**:
   - Optimize extension for mobile Chrome/Firefox
   - Responsive import page for mobile web app

---

### 12.2 Long-Term (6-12 months)

1. **AI-Assisted Config Creation**:
   - Extension uses computer vision to auto-detect table structure
   - Suggests CSS selectors for user to confirm
   - Reduces manual selector crafting

2. **Real-Time Sync Monitoring**:
   - Dashboard showing all auto-sync sites and last sync times
   - Alerts for configs that haven't synced in X days
   - Health status for each auto-sync config

3. **Cross-Site Portfolio Aggregation**:
   - Extension badge shows total portfolio value across all auto-sync sites
   - Click to see breakdown by site

4. **Social Features**:
   - Follow other users' config contributions
   - "Thank you" system for helpful configs
   - Community-voted "Config of the Month"

5. **Advanced Conflict Resolution**:
   - ML-based anomaly detection
   - Smart recommendations: "This looks like a stock split"
   - Historical change patterns for better thresholds

6. **Security Enhancements**:
   - Code signing for configs (prevent tampering)
   - Two-factor verification for auto-sync
   - Anomaly detection (alert if unusual holdings appear)

---

## 13. Implementation Phasing Recommendations

### Phase 1: MVP (Weeks 1-4)

**Scope**:
- Session-based extraction flow (extension → backend → web app)
- Prebuilt configs for top 5 sites (Robinhood, Coinbase, Vanguard, Fidelity, Schwab)
- Basic auto-sync (notification only mode)
- Simple conflict detection (50% threshold)
- Web app import page with editable holdings table

**Deliverables**:
- Extension popup with config detection UI
- Backend API for sessions and extraction
- Web app import page with polling
- Auto-sync enablement in post-import modal
- Basic settings panel in extension

**Success Criteria**:
- Feature works end-to-end for 5 sites
- Session flow completes successfully >95% of time
- User testing validates flows
- No critical bugs in production

---

### Phase 2: Auto-Sync Enhancements (Weeks 5-8)

**Scope**:
- Auto-redirect mode (alternative to notification only)
- Advanced settings (per-site configuration)
- Sync history view
- Config creator notifications
- "Under Review" badge for broken configs

**Deliverables**:
- Enhanced settings panel with per-site config
- Sync history UI
- Email notifications for config creators
- Conflict comparison view on web app

**Success Criteria**:
- >30% of users who complete first import enable auto-sync
- <10% of auto-syncs require conflict review
- Support ticket volume remains low

---

### Phase 3: Community Features (Weeks 9-12)

**Scope**:
- User-created configs (publish & share)
- Config rating/reporting system
- "Verified" badge algorithm
- Public config gallery

**Deliverables**:
- Config creation flow on web app
- Backend moderation system
- Public config gallery page
- Creator analytics dashboard

**Success Criteria**:
- >20 user-created configs published
- Community configs have >80% success rate
- Active moderation prevents malicious configs

---

### Phase 4: Polish & Scale (Weeks 13-16)

**Scope**:
- Performance optimizations
- Expanded site coverage (20+ configs)
- Advanced conflict resolution settings
- Mobile optimization

**Deliverables**:
- Optimized polling mechanism
- 20+ verified configs
- Mobile-responsive import page
- Advanced settings for power users

**Success Criteria**:
- Session polling doesn't impact web app performance
- Extension performs well with 10+ auto-sync sites
- Mobile users have good experience
- Community actively maintains configs

---

## 14. Open Questions & User Testing Recommendations

### 14.1 Open Questions

**Session-Based Flow**:

1. **Notification vs. Auto-Redirect**:
   - Should auto-sync default to "notification only" or "auto-redirect"?
   - **Recommendation**: Default to "notification only" (less intrusive), allow users to opt into auto-redirect.

2. **Session Expiry Duration**:
   - Is 24 hours the right expiry time, or too long/short?
   - **Recommendation**: Start with 24 hours, monitor how often users return to expired sessions.

3. **Polling Frequency**:
   - Is 2-second polling optimal, or too frequent/infrequent?
   - **Recommendation**: Start with 2 seconds, implement exponential backoff if needed (2s → 4s → 8s).

4. **Import Page UX**:
   - Should holdings table be editable by default, or show/hide edit mode?
   - **Recommendation**: Always editable (inline editing), no mode switching.

---

**Auto-Sync**:

1. **Conflict Threshold**:
   - Is 50% value change the right threshold, or too sensitive?
   - **Recommendation**: A/B test 50% vs. 75%. Hypothesis: 50% catches important changes; 75% reduces false positives.

2. **Notification Duration**:
   - How long should success notifications stay visible?
   - **Recommendation**: 10 seconds for "data extracted" banner (gives user time to click).

3. **Failed Extraction Behavior**:
   - Should auto-sync automatically disable after first failure, or retry a few times?
   - **Recommendation**: Retry once silently, then disable and notify user if still failing.

---

### 14.2 User Testing Recommendations

**Test Group 1: New Users (5-7 participants)**

**Scenario**: Install extension, visit Robinhood (with prebuilt config), complete first import

**Key Questions**:
1. Do users understand the redirect to web app? Does it feel seamless or jarring?
2. Do they trust leaving the brokerage site and going to Vestika?
3. Is the import page clear and easy to use?
4. Do they notice the auto-sync prompt after import?
5. Do they understand what auto-sync does?

**Metrics**:
- Time to first successful import
- % who complete full flow without help
- % who enable auto-sync on first prompt
- Qualitative feedback on session flow

---

**Test Group 2: Existing Users (5-7 participants)**

**Scenario**: Users who already use manual extraction, now trying auto-sync

**Key Questions**:
1. Do they discover auto-sync in settings or post-import prompt?
2. Do they trust auto-sync enough to enable it?
3. How do they react to the first auto-sync notification?
4. Do they prefer "notification only" or "auto-redirect" mode?
5. How do they react to conflict review prompts?

**Metrics**:
- % who enable auto-sync after learning about it
- Preferred notification mode
- Satisfaction with conflict review process
- Frequency of manual overrides

---

**Test Group 3: Power Users (3-5 participants)**

**Scenario**: Users with 5+ portfolios, multiple auto-sync sites

**Key Questions**:
1. Can they manage auto-sync for multiple sites easily?
2. Do they use advanced settings?
3. Do they create and publish configs?
4. How do they handle sync errors across multiple sites?
5. What features do they wish existed?

**Metrics**:
- Number of auto-sync sites managed
- Usage of advanced features
- Config creation rate
- Feature requests

---

**A/B Tests to Run**:

1. **Notification Mode Default**:
   - **A**: Default to "notification only"
   - **B**: Default to "auto-redirect"
   - **Hypothesis**: A is less intrusive and higher adoption; B ensures users review data

2. **Conflict Threshold**:
   - **A**: 50% value change triggers review
   - **B**: 75% value change triggers review
   - **Hypothesis**: A catches more issues; B reduces false positives

3. **Auto-Sync Prompt Timing**:
   - **A**: Show after first import
   - **B**: Show after second import
   - **Hypothesis**: B has higher acceptance (less overwhelming)

---

## 15. Success Criteria for MVP Launch

**Session-Based Extraction**:
- ✅ Session flow completes successfully >95% of time
- ✅ Average extraction time <10 seconds (from click to web app showing data)
- ✅ Session expiry rate <5% (users complete import within 24 hours)
- ✅ Import page usability score >4.5/5

**Prebuilt Configurations**:
- ✅ At least 10 popular sites have configs
- ✅ >60% of users on supported sites use prebuilt configs (vs. manual)
- ✅ <5% config failure rate (broken selectors)
- ✅ >80% of users understand what prebuilt configs do

**Auto-Sync**:
- ✅ >30% of users who complete first import enable auto-sync
- ✅ <10% of auto-syncs require conflict review
- ✅ >90% of conflict reviews result in accepting changes (not false alarms)
- ✅ Average sync frequency increases from 1x/week (manual) to 3x/week (auto)

**Overall**:
- ✅ Time-to-first-import reduced by >80% for new users on supported sites
- ✅ User satisfaction score >4.5/5 for both features
- ✅ <2% support ticket rate related to these features

---

## 16. Conclusion & Next Steps

This UX design document provides a comprehensive blueprint for implementing **Prebuilt Configurations** and **Auto-Sync** features in the Vestika browser extension using a **session-based background extraction architecture**. The design prioritizes:

- **Simplicity**: Extension is minimal and non-intrusive; complex interactions happen on web app
- **Trust**: Users always review data before import; transparent about what's happening
- **Control**: Users remain in command with granular settings and ability to review/reject changes
- **Scalability**: Session-based architecture allows for long-running AI extraction without blocking browser

**Key Architectural Benefits**:
- Extension stays lightweight and fast
- Web app provides spacious, feature-rich review experience
- Server-side AI extraction can take as long as needed
- Sessions allow resuming interrupted flows
- User never loses context (can review data anytime within 24 hours)

**Recommended Next Steps**:

1. **Validate Assumptions**:
   - Conduct user interviews (5-7 participants per test group)
   - Test session-based flow for perceived speed and trust
   - Gather feedback on web app import page

2. **Prototype & Test**:
   - Build clickable prototype (Figma)
   - Test with 10-15 users across personas
   - Iterate on session polling UX and import page

3. **Develop MVP** (Phase 1):
   - Implement session-based extraction flow
   - Build web app import page with polling
   - Focus on reliability and error handling
   - Launch to beta users (50-100 users)

4. **Measure & Iterate**:
   - Track session completion rates
   - Monitor extraction times and failure rates
   - Weekly review of analytics and user feedback
   - Rapid iteration based on data

5. **Scale Community** (Phase 2-3):
   - Enable user config creation
   - Build moderation tools
   - Incentivize quality contributions

**Success will be measured by**:
- **80% reduction** in time-to-first-import for new users
- **3x increase** in sync frequency (from weekly to 3x/week)
- **>95% session completion** rate (started → imported)
- **>90% confidence** in auto-sync data accuracy

This design sets the foundation for a **magical portfolio management experience** where users' portfolios stay up-to-date effortlessly, backed by a thriving community of contributors—all while keeping the browser extension minimal and the user experience seamless.

---

**Document Version**: 2.0
**Last Updated**: 2025-10-27
**Author**: Claude (Elite UX Architect)
**Review Status**: Updated for session-based architecture