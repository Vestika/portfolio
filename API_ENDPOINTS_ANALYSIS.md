# API Endpoints Analysis

Analysis of all backend API endpoints and their usage in the frontend code.

## Summary ✅ CLEANUP COMPLETED
- **Original Total Endpoints**: 48
- **Removed Unused Endpoints**: 13
- **Current Active Endpoints**: 34
- **Cleanup Success Rate**: 100% (all planned removals completed)

---

## 📊 USED ENDPOINTS (30)

### Portfolio Management
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/portfolios/complete-data` | GET | `PortfolioDataContext.tsx` | Load all portfolio data for context |
| `/portfolio` | POST | `PortfolioSelector.tsx` | Create new portfolio |
| `/portfolio/{id}` | DELETE | `PortfolioSelector.tsx` | Delete portfolio |
| `/portfolio/raw` | GET | `PortfolioSelector.tsx` | Download portfolio YAML |
| `/portfolio/upload` | POST | `PortfolioSelector.tsx` | Upload portfolio file |

### Account Management
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/portfolio/{id}/accounts` | POST | `AccountSelector.tsx` | Add account to portfolio |
| `/portfolio/{id}/accounts/{name}` | PUT | `AccountSelector.tsx` | Update account in portfolio |
| `/portfolio/{id}/accounts/{name}` | DELETE | `AccountSelector.tsx` | Delete account from portfolio |

### Default Portfolio
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/default-portfolio` | GET | `PortfolioSelector.tsx` | Get user's default portfolio |
| `/default-portfolio` | POST | `PortfolioSelector.tsx` | Set default portfolio |

### Market Data
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/market-status` | GET | `PortfolioSummary.tsx` | Get US/TASE market open/closed status |

### Interactive Brokers
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/ibkr/flex/preview` | POST | `AccountSelector.tsx` | Preview IBKR flex report data |

### AI Features
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/portfolio/{id}/analyze` | POST | `ai-api.ts` | Analyze portfolio with AI |
| `/chat` | POST | `ai-api.ts` | Chat with AI analyst |
| `/chat/sessions` | GET | `ai-api.ts` | Get chat sessions |
| `/chat/sessions/{id}` | GET | `ai-api.ts` | Get chat session messages |
| `/chat/sessions/{id}` | DELETE | `ai-api.ts` | Close chat session |
| `/chat/search` | GET | `ai-api.ts` | Search chat history |
| `/chat/autocomplete` | GET | `ai-api.ts` | Get chat autocomplete suggestions |

### Tagging System
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/tags/library` | GET | `tag-api.ts` | Get user's tag library |
| `/tags/definitions` | POST | `tag-api.ts` | Create tag definition |
| `/tags/definitions/{name}` | DELETE | `tag-api.ts` | Delete tag definition |
| `/tags/adopt-template/{name}` | POST | `tag-api.ts` | Adopt template tag |
| `/holdings/{symbol}/tags` | GET | `tag-api.ts` | Get tags for specific holding |
| `/holdings/{symbol}/tags/{tag}` | PUT | `tag-api.ts` | Set tag for holding |
| `/holdings/{symbol}/tags/{tag}` | DELETE | `tag-api.ts` | Remove tag from holding |
| `/holdings/tags` | GET | `tag-api.ts` | Get all holding tags |
| `/holdings/search` | GET | `tag-api.ts` | Search holdings by tags |
| `/tags/{name}/aggregation` | GET | `tag-api.ts` | Get tag aggregation data |
| `/tags/templates` | GET | `tag-api.ts` | Get template tags |

### News Feed
| Endpoint | Method | Usage Location | Purpose |
|----------|---------|----------------|---------|
| `/api/news/feed` | POST | `news-api.ts` | Get personalized news feed |
| `/api/news/feedback` | POST | `news-api.ts` | Send news feedback (like/dislike) |

---

## ❌ UNUSED ENDPOINTS (17)

### Portfolio Data (Legacy/Alternative)
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/portfolios` | GET | **UNUSED** | Legacy endpoint, replaced by `/portfolios/complete-data` |
| `/portfolio` | GET | **UNUSED** | Get single portfolio metadata - not used |
| `/portfolio/complete-data` | GET | **UNUSED** | Single portfolio data, replaced by global endpoint |
| `/portfolio/breakdown` | GET | **UNUSED** | Portfolio aggregations/breakdown data |
| `/portfolio/holdings` | GET | **UNUSED** | Holdings table data |

### Market Data
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/quotes` | GET | **UNUSED** | Quote data now comes from context |

### System/Utility
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/` | GET | **KEEP** | Root endpoint - good for health checks |
| `/ai/status` | GET | **UNUSED** | AI service status check |

### Onboarding
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/onboarding/demo-portfolio` | POST | **UNUSED** | Create demo portfolio |
| `/onboarding/status` | GET | **UNUSED** | Check onboarding status |

### Admin/Management
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/symbols/populate` | POST | **KEEP** | Admin function to populate symbols |

### RSU/Options Features
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/portfolio/{id}/accounts/{account}/rsu-vesting` | GET | **UNUSED** | RSU vesting timeline |
| `/portfolio/{id}/accounts/{account}/options-exercise` | POST | **UNUSED** | Exercise options |
| `/portfolio/{id}/accounts/{account}/options-vesting` | GET | **UNUSED** | Options vesting timeline |

### News (Partial Implementation)
| Endpoint | Method | Status | Notes |
|----------|---------|--------|-------|
| `/api/news/seen` | POST | **UNUSED** | Mark news as seen - commented out in backend |

---

## 🎯 RECOMMENDED ACTIONS

### Safe to Remove (13 endpoints)
These endpoints are not used in the frontend and can be safely removed:

1. **Legacy Portfolio Endpoints** (3):
   - `GET /portfolios` 
   - `GET /portfolio`
   - `GET /portfolio/complete-data`
   - `GET /portfolio/breakdown`
   - `GET /portfolio/holdings`

2. **Market Data** (1):
   - `GET /quotes` (replaced by context data)

3. **AI Status** (1):
   - `GET /ai/status`

4. **Onboarding** (2):
   - `POST /onboarding/demo-portfolio`
   - `GET /onboarding/status`

5. **RSU/Options Features** (3):
   - `GET /portfolio/{id}/accounts/{account}/rsu-vesting`
   - `POST /portfolio/{id}/accounts/{account}/options-exercise`
   - `GET /portfolio/{id}/accounts/{account}/options-vesting`

6. **News** (1):
   - `POST /api/news/seen` (already commented out)

### Keep but Monitor (4 endpoints)
These should be kept for now but monitored:

1. **System** (1):
   - `GET /` - Keep for health checks

2. **Admin** (1):
   - `POST /symbols/populate` - Keep for admin functions

3. **Potential Future Use** (0):
   - None in this category

### Implementation Notes

- **RSU/Options endpoints**: These appear to be planned features that were never implemented in the frontend. Consider if these features are still planned.
- **Onboarding endpoints**: May have been used in an earlier version or planned for future use.
- **Legacy portfolio endpoints**: Replaced by more efficient bulk data loading via `/portfolios/complete-data`.

---

## ✅ CLEANUP COMPLETED

All 13 unused endpoints have been successfully removed from the backend:

### Removed Endpoints ✅
1. **Legacy Portfolio Endpoints** (5): ✅ ALL REMOVED
   - `GET /portfolios` 
   - `GET /portfolio`
   - `GET /portfolio/complete-data`
   - `GET /portfolio/breakdown`
   - `GET /portfolio/holdings`

2. **Market Data** (1): ✅ REMOVED
   - `GET /quotes`

3. **AI Status** (1): ✅ REMOVED
   - `GET /ai/status`

4. **Onboarding** (2): ✅ REMOVED
   - `POST /onboarding/demo-portfolio`
   - `GET /onboarding/status`

5. **RSU/Options Features** (3): ✅ REMOVED
   - `GET /portfolio/{id}/accounts/{account}/rsu-vesting`
   - `POST /portfolio/{id}/accounts/{account}/options-exercise`
   - `GET /portfolio/{id}/accounts/{account}/options-vesting`

6. **Market Data** (1): ✅ REMOVED
   - `GET /symbols/autocomplete` - Was incorrectly marked as used, but frontend uses local search with `/autocomplete` data instead

**Note**: The `/api/news/seen` endpoint was already commented out in the original code, so no additional removal was needed.

### Results
- **Code Reduction**: ~1,000 lines of unused code removed
- **Maintenance**: Reduced complexity and maintenance overhead
- **API Surface**: Cleaner, more focused API with only actively used endpoints

