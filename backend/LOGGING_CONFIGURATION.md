# Logging Configuration Summary

## Overview
**All logging in the backend now uses loguru** for consistent, timestamped output.

## Loguru Format
Loguru provides automatic timestamps and formatting:

```
2026-01-03 17:57:57.984 | DEBUG    | portfolio_calculator:calc_holding_value:117 - Using cached value for FX:USD: 3.19 ILS
2026-01-03 18:08:32 | INFO     | app.endpoints.portfolio:get_complete_data:1447 - 🚀 [MAIN ENDPOINT] Starting complete data collection
```

## Configuration

### Import Pattern
All files now use:

```python
from loguru import logger
```

**NOT**:
```python
import logging
logger = logging.getLogger(__name__)  # ❌ Old pattern (removed)
```

## Files Converted to Loguru

### Entry Points
1. `__main__.py` - Removed basicConfig
2. `app/main.py` - Now uses loguru

### Endpoints (12 files)
1. `app/endpoints/portfolio.py`
2. `app/endpoints/profile.py`
3. `app/endpoints/tags.py`
4. `app/endpoints/user.py`
5. `app/endpoints/settings.py`
6. `app/endpoints/news/__init__.py`
7. `app/endpoints/ai_chat.py`
8. `app/endpoints/market.py`
9. `app/endpoints/extension.py`
10. `app/endpoints/notifications.py`

### Core Modules (8 files)
1. `core/auth.py`
2. `core/analytics.py`
3. `core/notification_service.py`
4. `core/tag_parser.py`
5. `core/portfolio_analyzer.py`
6. `core/logo_cache_service.py`
7. `core/tag_service.py`
8. `core/ai_analyst.py`
9. `core/chat_manager.py`

### Services (13 files - already had loguru)
1. `services/closing_price/price_manager.py`
2. `services/closing_price/database.py`
3. `services/closing_price/historical_sync.py`
4. `services/closing_price/stock_fetcher.py`
5. `services/closing_price/scheduler.py`
6. `services/closing_price/live_price_updater.py`
7. `services/closing_price/service.py`
8. `services/closing_price/live_price_cache.py`
9. `services/closing_price/currency_service.py`
10. `services/earnings_cache.py`
11. `services/earnings/service.py`
12. `services/telegram/service.py`
13. `services/interactive_brokers/service.py`

### Other
1. `portfolio_calculator.py` - Already had loguru

## Log Levels

Loguru automatically provides all standard log levels:

- **logger.info()**: Normal operations, metrics, timing
- **logger.warning()**: Non-critical issues, fallback behaviors
- **logger.error()**: Errors that need attention
- **logger.debug()**: Detailed debugging information

## Testing

Run the backend:

```bash
cd backend
python -m app.main
```

All logs will automatically have timestamps in loguru's format.

## Benefits of Loguru

✅ **Automatic timestamps** - No configuration needed
✅ **Better formatting** - Colored output, better readability
✅ **Exception handling** - Better stack traces with `logger.exception()`
✅ **Thread safety** - Safe for concurrent use
✅ **Performance** - Faster than standard logging
✅ **No configuration** - Works out of the box

## HTTP Access Logs (Uvicorn)

Uvicorn access logs are **intercepted and redirected to loguru** for consistent formatting!

**Before:**
```
INFO:     127.0.0.1:63986 - "OPTIONS /notifications/welcome HTTP/1.1" 200 OK
```

**After (using loguru):**
```
2026-01-03 18:45:12.345 | INFO     | uvicorn.access:log_http:456 - 127.0.0.1:58767 - "GET /default-portfolio HTTP/1.1" 200
```

### Implementation

We use a **logging intercept handler** in `__main__.py` to redirect all uvicorn logs to loguru:

```python
from loguru import logger
import logging

class InterceptHandler(logging.Handler):
    def emit(self, record):
        # Get corresponding Loguru level
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        
        # Log through loguru
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

# Intercept all uvicorn loggers
for name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
    logging_logger = logging.getLogger(name)
    logging_logger.handlers = [InterceptHandler()]
```

This means **ALL logs** (application + HTTP access) use loguru with timestamps!

## Notes

- Test files and scripts intentionally use print statements
- All production code now uses loguru
- Uvicorn access logs use Python's standard logging with custom format
- Both application logs (loguru) and access logs (uvicorn) now have timestamps
