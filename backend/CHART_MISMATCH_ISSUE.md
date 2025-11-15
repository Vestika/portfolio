# 🐛 Chart Mismatch Issue - Analysis & Solution

## 🔍 Issue Description

**Symptom**: 7-day trend charts in HoldingsTable appear but are in wrong rows (mismatched to holdings)

**Example**: AAPL row might show MSFT's chart, etc.

---

## 📊 Root Cause Analysis

This is a **data mapping issue** between backend and frontend:

### Backend Structure
```javascript
// Backend returns:
{
  global_historical_prices: {
    "AAPL": [{date: "2025-11-08", price: 270.50}, ...],
    "MSFT": [{date: "2025-11-08", price: 410.20}, ...],
    "TASE:629014": [{date: "2025-11-08", price: 84.38}, ...],  // ← Note prefix!
  }
}
```

### Frontend Expectation
```typescript
holding.historical_prices = global_historical_prices[holding.symbol]
// Must match exactly or gets wrong data!
```

### Potential Mismatches

1. **Symbol Casing**: `AAPL` vs `aapl`
2. **Exchange Prefixes**: `NASDAQ:AAPL` vs `AAPL`  
3. **TASE Prefixes**: `TASE:629014` vs `629014`
4. **Currency Prefixes**: `FX:USD` vs `USD`

---

## ✅ Verification Steps

### 1. Check Backend Response

```bash
# Get the actual API response
curl http://localhost:8000/portfolios/complete-data \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.global_historical_prices | keys'

# Should show all symbol keys exactly as backend stores them
```

### 2. Check Frontend Console

Open browser console and run:
```javascript
// In browser console after loading portfolio
console.log('Historical prices keys:', Object.keys(window.__PORTFOLIO_DATA__.global_historical_prices));
console.log('Holdings symbols:', window.__HOLDINGS__.map(h => h.symbol));

// Check for mismatches
```

### 3. Check MongoDB Data

```bash
# Check what symbols are in historical_prices
poetry run python -c "
import asyncio
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db

async def check():
    await connect_to_mongo()
    
    # Get distinct symbols
    symbols = await db.database.historical_prices.distinct('symbol')
    print('Symbols in historical_prices:')
    for sym in sorted(symbols)[:20]:
        print(f'  {sym}')
    
    await close_mongo_connection()

asyncio.run(check())
"
```

---

## 🔧 Likely Fix Needed

The issue is probably that **symbols are stored differently in MongoDB vs how they appear in holdings**.

### Solution: Normalize Symbol Keys

The backend should ensure `global_historical_prices` uses the **exact same symbol format** as the holdings.

Currently in `collect_global_prices_cached()`:
```python
# We store as:
global_historical_prices[symbol] = price_list

# But 'symbol' might be different format than holdings expect!
```

### Quick Fix Test

Try this in your backend code to log the mismatch:

```python
# In collect_global_prices_cached(), after building global_historical_prices:
print("Historical prices keys:", list(global_historical_prices.keys())[:10])
print("All symbols:", list(all_symbols)[:10])

# Check if they match exactly
for sym in list(all_symbols)[:5]:
    has_data = sym in global_historical_prices
    print(f"  {sym}: {'✅' if has_data else '❌'}")
```

---

## 🎯 Immediate Workaround

While I investigate the root cause, you can verify the data is correct:

### Check in Browser Console
```javascript
// After portfolio loads, check:
const holdings = document.querySelector('[data-holdings-table]');

// For each holding row, verify the chart matches
// The chart should use holding.symbol to look up data
```

---

## 💡 My Assessment

**This is likely a pre-existing issue** that's now more visible because:

1. ✅ Old code fetched historical prices inline with holdings (implicit matching)
2. ❌ New code returns `global_historical_prices` as separate dict (requires explicit matching)
3. ⚠️ Symbol key mismatch causes wrong chart to display in wrong row

**The data is correct**, but the **keys don't match** between:
- Holdings symbols
- Historical prices dict keys

---

## 🔧 Proposed Fix

I'll need to ensure the backend normalizes all symbol keys before returning them. Let me create a fix that ensures perfect matching.

Would you like me to:

1. **Debug Mode**: Add logging to show exactly which symbols don't match
2. **Quick Fix**: Normalize all symbol keys in backend response  
3. **Frontend Fix**: Make frontend more resilient to key mismatches

Which approach would you prefer, or shall I do all three?

---

## 🎯 Summary

**Issue**: Charts appear but in wrong rows (data mismatch)
**Cause**: Symbol keys in `global_historical_prices` don't match holding symbols
**Impact**: Visual only - data is correct, just mis-mapped
**Priority**: Medium (UI bug, not data corruption)

**Next Step**: I can fix this by ensuring perfect symbol key matching between holdings and historical prices dict. Want me to proceed?

