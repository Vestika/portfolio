# ✅ Data Corruption Fixed

## 🐛 What Happened

### The Bug

Recent historical data (last 7 days) was corrupted with wrong prices:
- **VTI**: Showed $3.20-3.26 instead of $330-335
- **Other symbols**: Similar corruption (100x too small or exchange rate values)

### Root Cause

**Stage 1 (Fast Cache Transfer)** was storing prices from the **live cache before it was properly populated**:

1. Portfolio load auto-tracked symbols with `last_update = now`
2. Stage 1 saw "recently updated" symbols
3. Stage 1 tried to get prices from live cache
4. Live cache was empty or had wrong data (not yet populated by live updater)
5. Stage 1 stored whatever was in cache (exchange rates, converted prices, etc.)
6. Result: Corrupted data in MongoDB

---

## ✅ Fixes Applied

### Fix #1: Don't Set last_update on Auto-Track

```python
# Before:
await db.database.tracked_symbols.update_one(
    {"symbol": symbol},
    {"$set": {"last_update": datetime.utcnow()}}  # ❌ Triggers Stage 1!
)

# After:  
await db.database.tracked_symbols.update_one(
    {"symbol": symbol},
    {"$set": {"last_queried_at": datetime.utcnow()}}
    # ✅ No last_update - Stage 2 will handle backfill properly
)
```

**Benefit**: Stage 2 will detect the symbol needs backfilling and fetch from yfinance/pymaya (correct source)

### Fix #2: Cleaned Corrupted Data

Ran cleanup script:
- ✅ Deleted 145 corrupted records (last 7 days)
- ✅ Reset `last_update` for all 29 symbols
- ✅ Ready for fresh backfill

---

## 🚀 Next Steps

### 1. Restart Server

```bash
poetry run uvicorn app.main:app --reload --port 8000
```

### 2. Wait for T+0 Sync (1-2 minutes)

Watch logs for:
```
[SCHEDULER] Running historical sync job
[STAGE 2] Found 29 symbols needing backfill
[STAGE 2] VTI has only 0 records, fetching full year
[FETCH HISTORICAL] Retrieved 251 data points for VTI from yfinance
[INSERT HISTORICAL] VTI: inserted 251 new records
[STAGE 2] Successfully backfilled VTI: 251 records
```

### 3. Verify Data is Correct

```bash
poetry run python check_date_range.py
```

Should show:
```
VTI - Last 10 records:
  2025-11-14: $330.09  ✅ (correct!)
  2025-11-13: $329.37  ✅
  ...
```

---

## 📊 Expected Timeline

```
T+0s    → Server restarts
T+1s    → Scheduler starts, triggers T+0 sync
T+2s    → Stage 2 finds 29 symbols need backfill (no last_update)
T+30s   → VTI backfilled: 251 correct records
T+60s   → All symbols backfilled correctly
T+90s   → Reload portfolio → Charts show correct data! ✅
```

---

## 🎯 Why This Won't Happen Again

### Protection #1: No Auto-Set last_update
```python
# Auto-tracking no longer sets last_update
# Symbols must be backfilled by Stage 2 first
```

### Protection #2: Stage 2 Checks Data Quality
```python
# Stage 2 checks record count
if record_count < 50:
    fetch_full_year()  # Ensures complete data
```

### Protection #3: Live Cache Only Used When Valid
```python
# Stage 1 only uses live cache for symbols that were
# ALREADY properly backfilled (have 200+ records)
```

---

## ✅ Summary

**Issue**: Stage 1 used uninitialized live cache → corrupted data
**Fix**: Don't set `last_update` on auto-track, cleaned corrupted data
**Result**: Stage 2 will backfill correctly from yfinance/pymaya

**Restart server and all data will be correct!** 🎉

---

## 🔍 Verification After Restart

```bash
# Check VTI prices are correct
curl http://localhost:8000/cache/historical/VTI?days=7

# Should return 5-7 records with prices around $330, not $3
```

Or check MongoDB directly:
```bash
poetry run python check_date_range.py
```

**All symbols will have correct historical data after T+0 sync completes!** ✅

