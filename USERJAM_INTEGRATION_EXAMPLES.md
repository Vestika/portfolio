# Userjam Integration Examples

This document provides concrete examples of how to integrate Userjam tracking at key points in the Vestika application.

## Frontend Integration

### 1. AuthContext Integration (Required First Step)

Add Userjam tracking to `frontend/src/contexts/AuthContext.tsx`:

```typescript
import { identify, setUserId } from '../utils/userjam';

// In the useEffect where onAuthStateChange is called:
useEffect(() => {
  const unsubscribe = onAuthStateChange((user) => {
    setUser(user);
    setLoading(false);

    if (user) {
      // Existing Mixpanel code...
      mixpanel.identify(user.uid);
      mixpanel.setUserProperties({
        user_id: user.uid,
        user_email_hash: hashEmail(user.email || ''),
        $name: user.displayName || undefined,
        account_creation_date: user.metadata.creationTime || new Date().toISOString(),
      } as any);
      mixpanel.track('auth_sign_in_success');

      // ADD USERJAM TRACKING:
      // Set user ID for tracking
      setUserId(user.uid);

      // Identify user in Userjam
      identify({
        name: user.displayName || 'Unknown',
        email: user.email || '',
        created_at: user.metadata.creationTime || new Date().toISOString(),
      });
    } else {
      // User signed out
      mixpanel.reset();

      // ADD USERJAM: Reset user ID
      setUserId(null);
    }
  });

  return () => unsubscribe();
}, []);
```

### 2. Page View Tracking in App Router

Add to `frontend/src/App.tsx` or your router component:

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './utils/userjam';

function App() {
  const location = useLocation();

  // Track page views
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  // Rest of your component...
}
```

### 3. Portfolio Switch Tracking

In `frontend/src/contexts/PortfolioDataContext.tsx`:

```typescript
import { trackPortfolioSwitch } from '../utils/userjam';

// In setSelectedPortfolioId function or where portfolio changes:
const handlePortfolioChange = (portfolioId: string) => {
  const portfolio = portfolios.find(p => p.id === portfolioId);
  setSelectedPortfolioId(portfolioId);

  if (portfolio) {
    trackPortfolioSwitch(portfolioId, portfolio.name);
  }
};
```

### 4. Account Filter Tracking

In `frontend/src/contexts/PortfolioDataContext.tsx`:

```typescript
import { trackAccountFilter } from '../utils/userjam';

// When selected accounts change:
const handleAccountsChange = (portfolioId: string, accountIds: string[]) => {
  setSelectedAccounts(accountIds);
  trackAccountFilter(portfolioId, accountIds);
};
```

### 5. Modal Tracking

In any modal component:

```typescript
import { trackModal } from '@/utils/userjam';

function MyModal({ isOpen, onClose }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      trackModal('my_modal_name', 'opened');
    }
  }, [isOpen]);

  const handleClose = () => {
    trackModal('my_modal_name', 'closed');
    onClose();
  };

  // Rest of component...
}
```

### 6. Chart View Tracking

In chart components:

```typescript
import { trackChartView } from '@/utils/userjam';

function PortfolioChart({ portfolioId }: ChartProps) {
  const handleChartTypeChange = (chartType: string) => {
    setChartType(chartType);
    trackChartView(chartType, portfolioId);
  };

  // Rest of component...
}
```

### 7. Tool Usage Tracking

In `frontend/src/components/ToolsView.tsx`:

```typescript
import { trackToolUsage } from '@/utils/userjam';

function CompoundInterestCalculator() {
  const handleCalculate = (params: CalculatorParams) => {
    // Perform calculation...

    trackToolUsage('compound_interest', {
      initial_amount: params.initialAmount,
      years: params.years,
      interest_rate: params.interestRate
    });
  };

  // Rest of component...
}
```

## Backend Integration

### 1. Portfolio Endpoints

In `backend/app/endpoints/portfolio.py`:

```python
from services.userjam import track
from app.core.auth import get_current_user

@router.post("/")
async def create_portfolio(
    portfolio: PortfolioCreate,
    user_id: str = Depends(get_current_user)
):
    # Create portfolio logic...
    new_portfolio = await portfolio_service.create(portfolio, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="portfolio.created",
        properties={
            "portfolio_id": str(new_portfolio.id),
            "portfolio_name": new_portfolio.name,
            "base_currency": new_portfolio.base_currency,
            "account_count": len(new_portfolio.accounts)
        }
    )

    return new_portfolio

@router.put("/{portfolio_id}")
async def update_portfolio(
    portfolio_id: str,
    portfolio: PortfolioUpdate,
    user_id: str = Depends(get_current_user)
):
    # Update portfolio logic...
    updated = await portfolio_service.update(portfolio_id, portfolio, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="portfolio.updated",
        properties={
            "portfolio_id": portfolio_id,
            "updated_fields": list(portfolio.dict(exclude_unset=True).keys())
        }
    )

    return updated

@router.delete("/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    user_id: str = Depends(get_current_user)
):
    # Delete portfolio logic...
    await portfolio_service.delete(portfolio_id, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="portfolio.deleted",
        properties={
            "portfolio_id": portfolio_id
        }
    )

    return {"status": "deleted"}
```

### 2. Holdings Endpoints

In `backend/app/endpoints/holdings.py`:

```python
from services.userjam import track

@router.post("/")
async def add_holding(
    holding: HoldingCreate,
    user_id: str = Depends(get_current_user)
):
    # Add holding logic...
    new_holding = await holding_service.add(holding, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="holding.added",
        properties={
            "portfolio_id": holding.portfolio_id,
            "account_id": holding.account_id,
            "symbol": holding.symbol,
            "units": holding.units,
            "security_type": holding.security_type
        }
    )

    return new_holding

@router.delete("/{holding_id}")
async def remove_holding(
    holding_id: str,
    user_id: str = Depends(get_current_user)
):
    # Get holding info before deleting
    holding = await holding_service.get(holding_id, user_id)

    # Delete holding...
    await holding_service.delete(holding_id, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="holding.removed",
        properties={
            "portfolio_id": holding.portfolio_id,
            "account_id": holding.account_id,
            "symbol": holding.symbol
        }
    )

    return {"status": "deleted"}
```

### 3. Tag Endpoints

In `backend/app/endpoints/tags.py`:

```python
from services.userjam import track

@router.post("/library")
async def create_tag(
    tag: TagDefinition,
    user_id: str = Depends(get_current_user)
):
    # Create tag logic...
    new_tag = await tag_service.create(tag, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="tag.created",
        properties={
            "tag_id": new_tag.tag_id,
            "tag_name": new_tag.name,
            "tag_type": new_tag.tag_type
        }
    )

    return new_tag

@router.post("/holdings/{symbol}")
async def apply_tag(
    symbol: str,
    tag_data: HoldingTag,
    user_id: str = Depends(get_current_user)
):
    # Apply tag logic...
    await tag_service.apply_to_holding(symbol, tag_data, user_id)

    # Track event
    await track(
        user_id=user_id,
        event="tag.applied",
        properties={
            "symbol": symbol,
            "tag_id": tag_data.tag_id,
            "tag_value": tag_data.value
        }
    )

    return {"status": "applied"}
```

### 4. AI Chat Endpoints

In `backend/app/endpoints/ai.py`:

```python
from services.userjam import track

@router.post("/chat")
async def chat_with_ai(
    message: ChatMessage,
    user_id: str = Depends(get_current_user)
):
    # Track message sent
    await track(
        user_id=user_id,
        event="ai_chat.message_sent",
        properties={
            "message_length": len(message.content),
            "has_tagged_entities": bool(message.tagged_symbols or message.tagged_accounts)
        }
    )

    # Get AI response...
    response = await ai_service.chat(message, user_id)

    # Track response received
    await track(
        user_id=user_id,
        event="ai_chat.response_received",
        properties={
            "response_length": len(response.content),
            "response_time_ms": response.processing_time
        }
    )

    return response
```

### 5. IBKR Import Endpoints

In `backend/app/endpoints/ibkr.py`:

```python
from services.userjam import track

@router.post("/import")
async def import_from_ibkr(
    import_data: IBKRImport,
    user_id: str = Depends(get_current_user)
):
    # Track import started
    await track(
        user_id=user_id,
        event="ibkr.import_started",
        properties={
            "portfolio_id": import_data.portfolio_id,
            "data_size": len(import_data.flex_query_data)
        }
    )

    # Process import...
    result = await ibkr_service.import_trades(import_data, user_id)

    # Track import completed
    await track(
        user_id=user_id,
        event="ibkr.import_completed",
        properties={
            "portfolio_id": import_data.portfolio_id,
            "trades_imported": result.trades_count,
            "holdings_created": result.holdings_count,
            "success": result.success
        }
    )

    return result
```

### 6. Global Error Handler

In `backend/app/main.py`:

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from services.userjam import track

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Get user if authenticated
    user_id = None
    try:
        # Extract user from request state if available
        user_id = request.state.user_id if hasattr(request.state, 'user_id') else None
    except:
        pass

    # Track error if we have user context
    if user_id:
        await track(
            user_id=user_id,
            event="error.api_error",
            properties={
                "error_type": type(exc).__name__,
                "error_message": str(exc),
                "path": request.url.path,
                "method": request.method,
                "traceback": traceback.format_exc()
            }
        )

    # Return error response...
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

### 7. User Identification on Signup/Login

If you have explicit signup/login endpoints:

```python
from services.userjam import identify

@router.post("/signup")
async def signup(user_data: UserSignup):
    # Create user...
    new_user = await auth_service.create_user(user_data)

    # Identify user in Userjam
    await identify(
        user_id=new_user.uid,
        traits={
            "name": user_data.name,
            "email": user_data.email,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
    )

    return new_user

@router.post("/login")
async def login(credentials: LoginCredentials):
    # Authenticate user...
    user = await auth_service.authenticate(credentials)

    # Update user traits
    await identify(
        user_id=user.uid,
        traits={
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at,
            "last_login": datetime.utcnow().isoformat() + "Z"
        }
    )

    return user
```

## Testing Your Integration

### Frontend Testing

1. Open browser DevTools (Network tab)
2. Filter for requests to `userjam.com`
3. Perform actions (switch portfolio, open modal, etc.)
4. Verify POST requests are sent with correct event names

### Backend Testing

1. Set `LOG_LEVEL=DEBUG` in `backend/.env`
2. Restart backend server
3. Perform actions via API
4. Check logs for "Userjam:" messages
5. Verify events in Userjam dashboard

### Example Log Output

```
INFO: Userjam track: portfolio.created for user firebase_uid_123
DEBUG: Userjam payload: {"type": "track", "userId": "firebase_uid_123", "event": "portfolio.created", "properties": {"portfolio_id": "port_123", ...}}
```
