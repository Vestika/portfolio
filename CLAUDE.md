# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vestika is a comprehensive portfolio management system with AI-powered analysis, real-time stock tracking, and interactive dashboards. The application consists of a Python FastAPI backend and a React TypeScript frontend.

**Live Application**: https://app.vestika.io

## Development Commands

### Backend (Python FastAPI)

```bash
# Navigate to backend directory
cd backend

# Install dependencies with Poetry
poetry install

# Run development server (port 8080)
poetry run uvicorn app.main:app --reload --port 8080

# Run tests
poetry run pytest

# Alternative: Use Makefile
make backend
```

### Frontend (React + TypeScript + Vite)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies with pnpm
pnpm install

# Run development server (port 5173)
pnpm dev

# Build for production
pnpm build

# Run linter
pnpm lint

# Alternative: Use Makefile
make frontend
```

### Run Both Services

```bash
# From project root - runs backend on port 8000 and frontend on port 5173
make run

# Stop all services
make stop

# Install all dependencies
make install

# Clean temporary files and caches
make clean
```

## Architecture

### Backend Architecture (FastAPI)

**Core Design**: The backend follows a modular architecture with clear separation of concerns:

- **App Layer** (`backend/app/`): FastAPI application setup and endpoint routers
  - `main.py`: Application entry point, CORS middleware, Firebase auth, startup/shutdown lifecycle
  - `endpoints/`: Individual router modules for different features (portfolio, tags, AI chat, market, news, IBKR, etc.)

- **Core Layer** (`backend/core/`): Business logic and services
  - `database.py`: MongoDB connection manager with async support and event loop handling
  - `ai_analyst.py`: Google Gemini integration for portfolio analysis with mandatory disclaimers
  - `tag_service.py`: Flexible tagging system with support for multiple tag types (ENUM, SCALAR, BOOLEAN, MAP, HIERARCHICAL)
  - `portfolio_analyzer.py`: Portfolio aggregation and computation logic
  - `auth.py`: Firebase authentication integration
  - `firebase.py`: Firebase admin SDK middleware

- **Services Layer** (`backend/services/`): External integrations
  - `closing_price/`: Stock price fetching service with caching (MongoDB + Redis)
    - `service.py`: Main price service with sync/async wrappers
    - `price_manager.py`: Price fetching and tracking
    - `stock_fetcher.py`: Finnhub API integration for US stocks, yfinance fallback
    - `currency_service.py`: Exchange rate management
  - `news/`: News feed integration (GNews API)
  - `interactive_brokers/`: IBKR Flex Query integration for importing trades
  - `real_estate/`: Real estate pricing service
  - `telegram/`: Telegram bot for feedback notifications

- **Models Layer** (`backend/models/`): Pydantic data models
  - Domain models for Portfolio, Account, Holding, Security, Tag, User, etc.

**Key Architectural Patterns**:

1. **ALL Portfolios Data Model**: The backend provides a `/portfolios/complete-data` endpoint that returns ALL user portfolios in a single response, including:
   - All portfolio metadata and accounts
   - Global securities catalog (shared across portfolios)
   - Global current prices (single source of truth)
   - Global historical prices (7-day series)
   - Global logos by symbol
   - Global earnings data
   - User tag library and all holding tags
   - Options vesting data per portfolio/account
   - Custom charts configuration

2. **Price Management**: Centralized price service with:
   - MongoDB for persistent storage
   - Redis for caching (TTL: 24 hours)
   - Finnhub API for US stocks
   - yfinance as fallback
   - Symbol tracking with 7-day expiry
   - Exchange rate conversion support

3. **Authentication**: Firebase Auth middleware on all routes except `/docs`, `/openapi.json`, `/redoc`

4. **Database Connections**: Async MongoDB client with proper event loop management
   - Auto-reconnection on startup
   - Graceful shutdown with connection cleanup
   - Symbol auto-population on startup (checks staleness)

### Frontend Architecture (React + TypeScript)

**Core Design**: Modern React with context-based state management and optimized data flow:

- **Context Architecture**:
  - `PortfolioDataContext.tsx`: Central data store for ALL portfolios
    - Single API call on app init loads everything (`/portfolios/complete-data`)
    - Portfolio switching is instant (no API calls, just filtering in-memory data)
    - Account filtering is client-side (instant updates)
    - Provides memoized computed data for selected portfolio + accounts
    - Autocomplete data loaded in parallel on init

  - `AuthContext.tsx`: Firebase authentication state
  - `NotificationContext.tsx`: In-app notification system
  - `UserProfileContext.tsx`: User profile and preferences
  - `GrowthBookProvider.tsx`: Feature flag management

- **View Components** (`frontend/src/components/`):
  - `PortfolioView.tsx`: Main portfolio dashboard with charts and holdings table
  - `ExploreView.tsx`: Exploration and discovery features
  - `NewsView.tsx`: News feed for holdings
  - `AIChatView.tsx`: AI analyst chat interface with message tagging (`$SYMBOL`, `@ACCOUNT`)
  - `ManageTagsView.tsx`: Tag library and holding tag management
  - `ToolsView.tsx`: Financial calculators (compound interest, scenario comparison, ESPP analysis)
  - `ProfileView.tsx`: User profile management
  - `SettingsView.tsx`: App settings and preferences

- **Key Features**:
  - **Tagging System**: Flexible tagging with multiple types (ENUM, BOOLEAN, SCALAR, etc.)
    - Template tags provided by system
    - Custom tags created by users
    - Tags stored per holding with MongoDB validation
    - Custom charts created from tag aggregations

  - **AI Analyst Chat**:
    - Google Gemini integration
    - Tagged entities support (`$AAPL`, `@MyAccount`)
    - Conversation history
    - Mandatory financial disclaimers

  - **Lazy Loading**: Heavy components (charts, news) load on-demand

  - **Skeleton States**: Smooth loading states for all views

  - **Mobile-Friendly**: Responsive design with hamburger menu on mobile

**Data Flow**:

```
App Init → Load ALL portfolios → Context stores everything
  ↓
User selects portfolio → Instant switch (filter in-memory data)
  ↓
User selects accounts → Instant filter (client-side recomputation)
  ↓
Views consume computed data → Fast rendering (no API calls)
```

### Data Model Concepts

**Portfolio Structure**:
- **Portfolio**: Top-level container with metadata (name, base currency)
- **Account**: Sub-container within portfolio (e.g., "401k", "Taxable Brokerage")
- **Holding**: Security position within account (symbol, units, cost basis)
- **Security**: Metadata about a tradable asset (name, type, currency)

**Security Types**: `stock`, `etf`, `mutual-fund`, `bond`, `real-estate`, `crypto`, `option`, `cash`

**Account Types**: `taxable-brokerage`, `ira`, `401k`, `roth-ira`, `company-custodian-account`, `real-estate`, `crypto`

**Tagging System**:
- Tags are flexible metadata attached to holdings
- Tag definitions stored in user's tag library
- Tag values stored per holding in MongoDB
- Supported tag types: ENUM, BOOLEAN, SCALAR, MAP, HIERARCHICAL, TIME_SERIES, RELATIONSHIP
- Template tags provided: "Asset Class", "Risk Level", "Holding Period", etc.
- Custom charts can be created by aggregating holdings by tag values

## Environment Configuration

### Backend (.env in `backend/`)

```bash
# Required for production
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=vestika
REDIS_URL=redis://localhost:6379
FINNHUB_API_KEY=your_key_here  # Get from https://finnhub.io/
GOOGLE_AI_API_KEY=your_key_here  # Get from https://aistudio.google.com/apikey
FIREBASE_CREDENTIALS={}  # Firebase service account JSON

# Optional
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
LOG_LEVEL=INFO
```

### Frontend (.env in `frontend/`)

```bash
VITE_API_URL=http://localhost:8080
VITE_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
VITE_GROWTHBOOK_CLIENT_KEY=sdk-JCSC6ZrWMHjBLLPA
```

## API Documentation

Once backend is running:
- **Swagger UI**: http://localhost:8080/docs
- **ReDoc**: http://localhost:8080/redoc

Key endpoints:
- `GET /portfolios/complete-data` - Returns ALL user portfolios in single response
- `GET /portfolios/raw` - Raw portfolio data without aggregations (for frontend-calc mode)
- `POST /prices/batch` - Batch price fetching with currency conversion
- `POST /prices/historical` - Historical price data (7 days)
- `GET /tags/library` - User's tag definitions
- `GET /holdings/tags` - All holding tags
- `POST /ai/chat` - AI analyst chat with tagged entities support
- `GET /news/feed` - News feed for holdings
- `POST /ibkr/import` - Import trades from IBKR Flex Query
- `POST /notifications/templates` - Create notification template (admin only, see README)

## Testing

```bash
# Backend tests
cd backend
poetry run pytest

# Frontend tests
cd frontend
pnpm test
```

## Important Implementation Notes

### Price Management
- All prices stored in MongoDB with Redis caching (24h TTL)
- Prices automatically converted to portfolio base currency
- `original_price` and `original_currency` preserved for display
- Symbol tracking expires after 7 days of no requests
- Use `/prices/batch` for efficient multi-symbol fetching

### Tagging System
- Tag definitions stored in `tag_libraries` collection (per user)
- Tag values stored in `holding_tags` collection (per user + symbol)
- Always validate tag values against definitions before saving
- Template tags are read-only (can be adopted as custom tags)
- Custom charts dynamically computed from tag aggregations

### AI Analyst
- Always append `MANDATORY_DISCLAIMER` to AI responses
- Support tagged entities in chat (`$SYMBOL` for securities, `@ACCOUNT` for accounts)
- Parse tagged entities and pass to AI for context-aware responses
- Use `chat_with_analyst_multi_portfolio()` when multiple portfolios are tagged

### Notification Templates
Create notifications for features/announcements via `POST /notifications/templates` (admin only).

**Quick Reference:**
```json
{
  "template_id": "feature_xyz",
  "notification_type": "feature",
  "title_template": "New Feature!",
  "message_template": "Hi {user_name}! Check out...",
  "distribution_type": "pull",
  "display_type": "both",
  "dismissal_type": "once",
  "link_url": "/tools",
  "link_text": "Try it"
}
```

**Options:**
- `distribution_type`: `push` (targeted users now), `pull` (on login), `trigger` (events only)
- `display_type`: `popup`, `bell`, `both`
- `dismissal_type`: `once`, `until_clicked`, `auto_expire`
- Variables: `{user_name}` always available; `{symbol}`, `{units}`, `{account_name}` for RSU

**Targeting (optional):**
- `target_user_ids`: `["firebase_uid_1", "firebase_uid_2"]` - specific users
- `target_filter`: criteria-based targeting:
  - `{"has_holding": "AAPL"}` - users who hold AAPL
  - `{"has_account_type": "401k"}` - users with 401k accounts
  - `{"has_portfolio": true}` - users with portfolios

If neither specified, notification goes to all users.

**Files:**
- Model: `backend/models/notification_model.py`
- Service: `backend/core/notification_service.py`
- Endpoints: `backend/app/endpoints/notifications.py`

See README.md for full documentation.

### Frontend State Management
- ALL portfolios data loaded once on app init
- Portfolio switching is instant (filter in-memory data, no API call)
- Account filtering triggers client-side recomputation (no API call)
- Use `refreshAllPortfoliosData()` only when server data changes (e.g., after upload)
- Use `refreshTagsOnly()` for lightweight tag updates after tagging operations

### Database Indexes
- Indexes auto-created on startup in `services/closing_price/database.py`
- Symbol tracking uses TTL index (7 days)
- Price cache uses compound index (symbol + date)

## Common Development Tasks

### Adding a New Endpoint

1. Create router in `backend/app/endpoints/`
2. Import and include router in `backend/app/main.py`
3. Add business logic in `backend/core/` or `backend/services/`
4. Update frontend API client (`frontend/src/utils/api.ts` or specific `*-api.ts`)

### Adding a New Tag Type

1. Add tag type to `TagType` enum in `backend/models/tag_models.py`
2. Add validation logic in `TagService._validate_tag_value()`
3. Update frontend `TagEditor.tsx` to support new type
4. Add to `DEFAULT_TAG_TEMPLATES` if it's a template tag

### Adding a New View

1. Create component in `frontend/src/components/`
2. Add to `NavigationView` type in `frontend/src/components/topbar/TopBar.tsx`
3. Add view option to `TopBar` component
4. Add route handling in `App.tsx`
5. Add skeleton state in `frontend/src/components/PortfolioSkeleton.tsx`

## Documentation Files

The following markdown files contain detailed implementation documentation:

- `GROWTHBOOK_INTEGRATION.md` - Feature flag setup
- `FINANCIAL_ANALYST_AI.md` - AI analyst implementation
- `TAGGING_SYSTEM_IMPLEMENTATION.md` - Tag system details
- `INTERACTIVE_BROKERS_INTEGRATION.md` - IBKR Flex Query import
- `NEWS_FEED_TASKS.md` - News feed implementation
- `COMPOUND_INTEREST_TOOL.md` - Financial calculators
- `FEEDBACK_FEATURE.md` - User feedback system
- `API_ENDPOINTS_ANALYSIS.md` - Complete API documentation

## Cursor Rules

Task list management is documented in `.cursor/rules/task-lists.mdc`:
- Use `TASKS.md` or feature-specific markdown files for tracking
- Structure with "Completed", "In Progress", and "Future Tasks" sections
- Update after implementing significant components
- Document relevant files and implementation details


## Visual Development

### Design Principles
- Comprehensive design checklist in `/context/design-principles.md`
- Brand style guide in `/context/style-guide.md`
- When making visual (front-end, UI/UX) changes, always refer to these files for guidance

### Quick Visual Check
IMMEDIATELY after implementing any front-end change:
1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/context/design-principles.md` and `/context/style-guide.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### UI/UX Expert Knowledge Base

**Comprehensive Resources** in `.claude/skills/`:

1. **ui-ux-expert.md** - Complete design guide covering:
   - Essential books and resources (top 10 must-reads)
   - 2026 design philosophy and trends
   - Platform guidelines (iOS HIG, Material Design 3)
   - WCAG 2.2 accessibility standards
   - Mobile-first and responsive design
   - Micro-interactions and animations
   - Design systems and component libraries
   - Dark mode, forms, dashboards
   - Pre-launch checklists

2. **ui-ux-quick-reference.md** - Fast lookups for:
   - Contrast ratios (4.5:1 text, 3:1 UI)
   - Touch targets (48x48px)
   - Animation timing (150-500ms)
   - Typography scales and spacing (8px grid)
   - Responsive breakpoints
   - Decision trees (modal vs toast vs tooltip)
   - Accessibility quick checks

3. **README.md** - Usage guide and sources

**When to Reference:**
- Designing new UI components or features
- Reviewing accessibility compliance
- Making platform-specific design decisions
- Optimizing animations and micro-interactions
- Implementing dark mode
- Creating forms or dashboards
- Quick value lookups (contrast, sizing, timing)

**Usage Examples:**
```
"Review this button design for WCAG 2.2 compliance"
"What's the minimum touch target size for mobile?"
"Help me design a mobile-first form"
"Check if this animation timing follows best practices"
```

### Comprehensive Design Review
Invoke the `@agent-design-review-specialist` subagent for thorough design validation when:
- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing