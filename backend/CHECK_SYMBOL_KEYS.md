# 🔍 Chart Mismatch - Quick Debug Guide

## The Issue

Charts showing in wrong rows means `global_historical_prices` keys don't match `holding.symbol` values.

---

## 🧪 Quick Debug (Run This)

Add this to your backend **temporarily** in `collect_global_prices_cached()` right before the return statement:

```python
# DEBUG: Check for key mismatches
print("\n🔍 [DEBUG] Symbol Key Analysis:")
print(f"  Total symbols in all_symbols: {len(all_symbols)}")
print(f"  Total keys in global_historical_prices: {len(global_historical_prices)}")

# Show first 10 symbols and whether they have historical data
print("\n  Sample symbols:")
for symbol in list(all_symbols)[:10]:
    has_data = symbol in global_historical_prices
    data_count = len(global_historical_prices.get(symbol, [])) if has_data else 0
    print(f"    {symbol}: {'✅' if has_data else '❌'} ({data_count} records)")

# Check for case sensitivity issues
symbols_upper = {s.upper() for s in all_symbols}
hist_keys_upper = {k.upper() for k in global_historical_prices.keys()}
if symbols_upper != hist_keys_upper:
    print("\n⚠️  WARNING: Case mismatch detected!")
    missing = symbols_upper - hist_keys_upper
    extra = hist_keys_upper - symbols_upper
    if missing:
        print(f"    Missing from historical: {list(missing)[:5]}")
    if extra:
        print(f"    Extra in historical: {list(extra)[:5]}")
```

---

## 🎯 What You're Looking For

### ✅ Good (Keys Match)
```
Symbol Key Analysis:
  Total symbols: 31
  Total keys in global_historical_prices: 31
  
  Sample symbols:
    AAPL: ✅ (7 records)
    MSFT: ✅ (7 records)
    629014: ✅ (7 records)
```

### ❌ Bad (Keys Don't Match)
```
Symbol Key Analysis:
  Total symbols: 31
  Total keys in global_historical_prices: 31
  
  Sample symbols:
    aapl: ❌ (0 records)  ← Symbol is lowercase
    
⚠️  WARNING: Case mismatch detected!
    Missing from historical: ['AAPL', 'MSFT']  ← Holdings use uppercase
    Extra in historical: ['aapl', 'msft']      ← Historical uses lowercase
```

---

## 🔧 Common Fixes

### If Case Mismatch
```python
# In collect_global_prices_cached(), ensure uppercase:
symbol = symbol.upper()  # Normalize to uppercase
```

### If Prefix Mismatch
```python
# Remove exchange prefixes from historical_prices keys:
clean_symbol = symbol.replace('NASDAQ:', '').replace('NYSE:', '').replace('TASE:', '')
global_historical_prices[clean_symbol] = price_list
```

---

## 💡 My Recommendation

Since you're seeing this issue **after** switching to the cached version, it means the old `collect_global_prices()` function was somehow handling this correctly, but my `collect_global_prices_cached()` is not.

The fix is simple: **ensure `global_historical_prices` uses the exact same symbol keys as `all_symbols`**.

Want me to add defensive symbol normalization to prevent this issue?

