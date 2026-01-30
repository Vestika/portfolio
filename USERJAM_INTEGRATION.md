# Userjam Analytics Integration

This document describes the Userjam analytics integration in Vestika.

## Overview

Userjam is integrated to track:
- **Backend Events**: Core business logic (portfolios, holdings, AI chat, imports)
- **Frontend Events**: UI interactions (page views, modals, chart changes)

## Configuration

### 1. Get Your Tracking Key

Visit [userjam.com/settings/tracking](https://www.userjam.com/settings/tracking) to get your tracking key.

### 2. Add to Environment Variables

**Backend** (`backend/.env`):
```bash
USERJAM_API_KEY=your_userjam_tracking_key_here
```

**Frontend** (`frontend/.env`):
```bash
VITE_USERJAM_KEY=your_userjam_tracking_key_here
```

## Event Naming Convention

All events follow the format: `category.action_past_tense` (snake_case)

Examples:
- `portfolio.created`
- `holding.added`
- `modal.opened`
- `chart.viewed`

## Backend Events

### User Events
- `user.signed_up` - First-time user signup
- `user.identified` - User login

### Portfolio Events
- `portfolio.created` - New portfolio created
- `portfolio.updated` - Portfolio metadata updated
- `portfolio.deleted` - Portfolio deleted
- `portfolio.imported` - Portfolio imported from external source

### Holding Events
- `holding.added` - Holding added/updated
- `holding.removed` - Holding deleted

### Tag Events
- `tag.created` - Custom tag created
- `tag.applied` - Tag applied to holding
- `tag.removed` - Tag removed from holding

### AI Chat Events
- `ai_chat.message_sent` - User sent message to AI analyst
- `ai_chat.response_received` - AI analyst responded

### IBKR Events
- `ibkr.import_started` - IBKR import initiated
- `ibkr.import_completed` - IBKR import finished

### Error Events
- `error.api_error` - API error occurred

## Frontend Events

### Navigation Events
- `page.viewed` - Page navigation

### Portfolio Events
- `portfolio.switched` - User switched portfolio
- `account.filtered` - User filtered accounts

### UI Events
- `modal.opened` - Modal opened
- `modal.closed` - Modal closed
- `chart.viewed` - Chart type/view changed
- `tab.switched` - Tab navigation

### Tool Events
- `tool.used` - Financial calculator used

## Usage Examples

### Backend (Python)

```python
from services.userjam import track, identify

# Track an event
await track(
    user_id=user_id,
    event="portfolio.created",
    properties={
        "portfolio_id": portfolio_id,
        "portfolio_name": "My 401k",
        "base_currency": "USD"
    }
)

# Identify a user
await identify(
    user_id=user_id,
    traits={
        "name": "Jane Doe",
        "email": "jane@example.com",
        "created_at": "2023-01-15T08:30:00Z",
        "portfolio_count": 3
    }
)
```

### Frontend (TypeScript)

```typescript
import { track, identify, trackPageView, trackPortfolioSwitch } from '@/utils/userjam';

// Track page view
trackPageView('/portfolio', 'Portfolio Dashboard');

// Track portfolio switch
trackPortfolioSwitch(portfolioId, portfolioName);

// Track custom event
track('tool.used', {
  tool_name: 'compound_interest',
  initial_amount: 10000,
  years: 10
});

// Identify user
identify({
  name: 'Jane Doe',
  email: 'jane@example.com',
  created_at: '2023-01-15T08:30:00Z',
  portfolio_count: 3
});
```

## Integration Points

### Backend Integration Points

1. **User Authentication** (`app/endpoints/auth.py` or wherever auth happens)
   - Call `identify()` on login/signup

2. **Portfolio Operations** (`app/endpoints/portfolio.py`)
   - Track `portfolio.created`, `portfolio.updated`, `portfolio.deleted`

3. **Holdings Operations** (`app/endpoints/holdings.py`)
   - Track `holding.added`, `holding.removed`

4. **Tags Operations** (`app/endpoints/tags.py`)
   - Track `tag.created`, `tag.applied`, `tag.removed`

5. **AI Chat** (`app/endpoints/ai.py`)
   - Track `ai_chat.message_sent`, `ai_chat.response_received`

6. **IBKR Import** (`app/endpoints/ibkr.py`)
   - Track `ibkr.import_started`, `ibkr.import_completed`

7. **Error Handler** (`app/main.py`)
   - Track `error.api_error` in global error handler

### Frontend Integration Points

1. **Auth Context** (`src/contexts/AuthContext.tsx`)
   - Call `identify()` on login
   - Set user ID for tracking

2. **Portfolio Data Context** (`src/contexts/PortfolioDataContext.tsx`)
   - Track `portfolio.switched` when portfolio changes
   - Track `account.filtered` when accounts filter changes

3. **App Router** (`src/App.tsx`)
   - Track `page.viewed` on route changes

4. **Modal Components**
   - Track `modal.opened`, `modal.closed`

5. **Chart Components**
   - Track `chart.viewed` on chart type changes

6. **Tools Components** (`src/components/ToolsView.tsx`)
   - Track `tool.used` when calculations run

## User Identification

Always call `identify()` with these critical traits:

- `name` - User's full name
- `email` - User's email
- `created_at` - ISO 8601 timestamp of user signup (CRITICAL for cohort analysis)

Optional but recommended:
- `portfolio_count` - Number of portfolios
- `total_holdings` - Total number of holdings
- `base_currency` - Primary currency
- `plan` - Subscription plan (if applicable)

## Best Practices

1. **Backend-First**: Track core business logic on backend for reliability
2. **Frontend for UI**: Track UI interactions on frontend only
3. **Rich Properties**: Include detailed metadata in event properties
4. **Fire and Forget**: All tracking calls are non-blocking
5. **Error Handling**: Tracking errors are logged but don't affect app flow
6. **No PII**: Never track sensitive data (passwords, credit cards, tokens)

## Testing

Test tracking locally:
1. Set `LOG_LEVEL=DEBUG` in backend `.env`
2. Check backend logs for "Userjam:" messages
3. Check browser console for frontend tracking
4. Verify events in Userjam dashboard

## Troubleshooting

**Events not appearing in Userjam:**
1. Check API key is set correctly in `.env` files
2. Check logs for error messages
3. Verify network requests in browser DevTools
4. Check Userjam dashboard for data delays (can take a few minutes)

**Backend tracking not working:**
- Check `USERJAM_API_KEY` environment variable
- Check logs for connection errors
- Verify async event loop is running

**Frontend tracking not working:**
- Check `VITE_USERJAM_KEY` environment variable
- Check browser console for errors
- Verify user is authenticated (userId is set)
- Check network tab for POST requests to `api.userjam.com`
