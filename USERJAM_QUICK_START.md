# Userjam Integration - Quick Start Guide

This guide will get you up and running with Userjam analytics in 5 minutes.

## Prerequisites

1. **Get Your Tracking Key**
   - Visit [userjam.com/settings/tracking](https://www.userjam.com/settings/tracking)
   - Copy your tracking key

## Step 1: Configure Environment Variables (1 min)

### Backend

Edit `backend/.env`:
```bash
# Replace with your actual tracking key
USERJAM_API_KEY=your_userjam_tracking_key_here
```

### Frontend

Edit `frontend/.env`:
```bash
# Replace with your actual tracking key
VITE_USERJAM_KEY=your_userjam_tracking_key_here
```

## Step 2: Integrate Frontend Auth (2 min)

Edit `frontend/src/contexts/AuthContext.tsx`:

```typescript
// Add import at the top
import { identify, setUserId } from '../utils/userjam';

// In the useEffect where onAuthStateChange is called, add after Mixpanel code:
if (user) {
  // Existing Mixpanel code...
  mixpanel.identify(user.uid);
  // ... other Mixpanel code ...

  // ADD THESE LINES:
  setUserId(user.uid);
  identify({
    name: user.displayName || 'Unknown',
    email: user.email || '',
    created_at: user.metadata.creationTime || new Date().toISOString(),
  });
} else {
  mixpanel.reset();

  // ADD THIS LINE:
  setUserId(null);
}
```

## Step 3: Add Backend Tracking (2 min)

Pick one endpoint to start with. For example, in `backend/app/endpoints/portfolio.py`:

```python
# Add import at the top
from services.userjam import track

# In your create_portfolio endpoint:
@router.post("/")
async def create_portfolio(
    portfolio: PortfolioCreate,
    user_id: str = Depends(get_current_user)
):
    # Your existing code...
    new_portfolio = await portfolio_service.create(portfolio, user_id)

    # ADD THIS TRACKING CALL:
    await track(
        user_id=user_id,
        event="portfolio.created",
        properties={
            "portfolio_id": str(new_portfolio.id),
            "portfolio_name": new_portfolio.name,
            "base_currency": new_portfolio.base_currency
        }
    )

    return new_portfolio
```

## Step 4: Test It! (30 seconds)

1. **Restart your services**:
   ```bash
   # Backend
   cd backend
   poetry run uvicorn app.main:app --reload --port 8080

   # Frontend (in another terminal)
   cd frontend
   pnpm dev
   ```

2. **Test the integration**:
   - Open the app in your browser
   - Sign in (should trigger `identify` call)
   - Create a portfolio (should trigger `portfolio.created` event)

3. **Verify**:
   - Open browser DevTools > Network tab
   - Filter for `userjam.com`
   - You should see POST requests being sent

4. **Check Userjam Dashboard**:
   - Visit your Userjam dashboard
   - Events may take a few minutes to appear
   - Look for `user.identified` and `portfolio.created` events

## Next Steps

Now that the basic integration is working, you can:

1. **Add more backend tracking**
   - See `USERJAM_INTEGRATION_EXAMPLES.md` for examples
   - Track holdings, tags, AI chat, IBKR imports, etc.

2. **Add more frontend tracking**
   - Track page views, portfolio switches, modal interactions
   - See `USERJAM_INTEGRATION_EXAMPLES.md` for examples

3. **Review the documentation**
   - `USERJAM_INTEGRATION.md` - Comprehensive integration guide
   - `USERJAM_INTEGRATION_EXAMPLES.md` - Code examples
   - `llms-full.txt` - Full Userjam API documentation

## Troubleshooting

### Events not showing up?

1. **Check environment variables**:
   ```bash
   # Backend
   echo $USERJAM_API_KEY

   # Frontend
   echo $VITE_USERJAM_KEY
   ```

2. **Check backend logs**:
   - Set `LOG_LEVEL=DEBUG` in `backend/.env`
   - Restart backend
   - Look for "Userjam:" messages in logs

3. **Check browser console**:
   - Open DevTools > Console
   - Look for Userjam-related messages
   - Check Network tab for failed requests

4. **Verify user is authenticated**:
   - Userjam tracking requires a user ID
   - Make sure you're signed in

### Common Issues

**"No API Key found"**
- Check that environment variable is set correctly
- For frontend, variable must start with `VITE_`
- Restart dev servers after changing `.env` files

**"No user authenticated"**
- Frontend tracking requires user to be signed in
- Check that `setUserId()` is being called in AuthContext

**Backend tracking not working**
- Check that you're using `await track()` (not `track()` without await)
- Check that the function is async
- Check logs for error messages

## Event Naming Reference

Follow this convention: `category.action_past_tense`

**Good examples**:
- `portfolio.created`
- `holding.added`
- `modal.opened`
- `chart.viewed`

**Bad examples**:
- `Create Portfolio` (spaces, not past tense)
- `clicked` (too generic)
- `userUpdate` (camelCase instead of snake_case)

## Getting Help

- Review `USERJAM_INTEGRATION.md` for detailed documentation
- Check `USERJAM_INTEGRATION_EXAMPLES.md` for code examples
- See `llms-full.txt` for full Userjam API reference
- Visit [Userjam documentation](https://userjam.com/docs)
