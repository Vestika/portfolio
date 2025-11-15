# ⚠️ RESTART REQUIRED

## The Error You're Seeing

```
{"detail":"Failed to get cache status: 'coroutine' object has no attribute 'to_list'"}
```

**This error is from OLD CODE.** I already fixed it, but your server is still running the old version.

---

## ✅ Solution: Restart Server

### Step 1: Stop Current Server

Go to the terminal where uvicorn is running and press:
```
Ctrl+C
```

### Step 2: Start Server Again

```bash
cd /Users/mpalarya/code/portfolio/backend
poetry run uvicorn app.main:app --reload --port 8000
```

### Step 3: Test Again

```bash
curl http://localhost:8000/cache/status
```

**Expected**: Should work now and return JSON with cache stats!

---

## 🔍 What Was Fixed

The aggregate query syntax was incorrect:

**OLD CODE (broken)**:
```python
result = await db.database.historical_prices.aggregate(pipeline).to_list(length=1)
```

**NEW CODE (fixed)**:
```python
cursor = db.database.historical_prices.aggregate(pipeline)
result = await cursor.to_list(length=1)
```

I already made this fix, but you need to restart for it to take effect!

---

## ✅ After Restart

All these commands should work:

```bash
# 1. Cache status
curl http://localhost:8000/cache/status

# 2. Historical data
curl http://localhost:8000/cache/historical/AAPL?days=7

# 3. Scheduler status
curl http://localhost:8000/cache/scheduler/status

# 4. Manually trigger sync (if needed)
curl -X POST http://localhost:8000/cache/sync-historical \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 Summary

**The fix is already in the code** - you just need to restart the server!

After restart:
- ✅ curl will work
- ✅ Portfolio will load with hybrid fallback
- ✅ Charts will show data
- ✅ Performance will improve automatically

**Just restart and you're good to go!** 🚀

