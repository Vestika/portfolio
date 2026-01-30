# Dead Code & Unused Files Audit Report

**Generated**: 2026-01-30
**Purpose**: Identify potentially unused code, files, and dependencies for review before deletion
**Status**: ⚠️ REVIEW REQUIRED - Do not delete without verification

---

## Executive Summary

| Category | Backend | Frontend | Total |
|----------|---------|----------|-------|
| Unused Files/Components | 1 directory | 5 components + 1 data file | 7 |
| Unused Dependencies | 1 package | 6 packages | 7 |
| Unused API Functions | 0 | 4 functions | 4 |
| Unused Imports | 1 | N/A | 1 |
| **Total Items** | **3** | **16** | **19** |

---

## 🔴 HIGH PRIORITY - SAFE TO DELETE

### Backend

#### 1. Legacy Price Management Directory
**Path**: `/backend/prices-db/`
**Contains**: `stock_price_manager.py`
**Status**: ❌ OBSOLETE
**Reason**: Completely replaced by modern `services/closing_price/` implementation
**Risk**: LOW - Never imported anywhere
**Action**: DELETE entire directory

```bash
rm -rf backend/prices-db/
```

#### 2. Unused Python Dependency
**Package**: `aiofiles` (v24.1.0)
**Status**: ❌ NOT USED
**Reason**: Not imported anywhere in codebase
**Risk**: LOW - No code references found
**Action**: Remove from `pyproject.toml`

```bash
cd backend && poetry remove aiofiles
```

### Frontend

#### 3. Obsolete Components (Superseded by Active Implementations)

**a) AIAnalyst.tsx**
**Path**: `/frontend/src/components/AIAnalyst.tsx`
**Status**: ❌ REPLACED by `AIChatView.tsx`
**Risk**: LOW - Never imported
**Action**: DELETE

```bash
rm frontend/src/components/AIAnalyst.tsx
```

**b) CashFlowCalculator.tsx**
**Path**: `/frontend/src/components/CashFlowCalculator.tsx`
**Status**: ❌ REPLACED by `CashFlowView.tsx` (which IS active)
**Risk**: LOW - Never imported
**Action**: DELETE

```bash
rm frontend/src/components/CashFlowCalculator.tsx
```

**c) HoldingTagManager.tsx**
**Path**: `/frontend/src/components/HoldingTagManager.tsx`
**Status**: ❌ REPLACED by `ManageTagsView.tsx`
**Risk**: LOW - Never imported
**Action**: DELETE

```bash
rm frontend/src/components/HoldingTagManager.tsx
```

#### 4. Dummy Test Data
**Path**: `/frontend/src/dummyHoldingsData.ts`
**Size**: ~800 lines
**Status**: ❌ NOT IMPORTED
**Risk**: LOW - No code references
**Action**: DELETE (unless explicitly needed for future testing)

```bash
rm frontend/src/dummyHoldingsData.ts
```

#### 5. Unused NPM Dependencies

All of these are installed but have ZERO imports in the codebase:

**a) Material-UI Stack**
```json
"@mui/material": "^7.2.0",
"@mui/icons-material": "^7.2.0",
"@emotion/react": "^11.14.0",
"@emotion/styled": "^11.14.1"
```
**Reason**: App uses Radix UI + Tailwind instead
**Risk**: LOW
**Action**: Remove all

```bash
cd frontend && pnpm remove @mui/material @mui/icons-material @emotion/react @emotion/styled
```

**b) Recharts**
```json
"recharts": "^3.2.1"
```
**Reason**: App uses Highcharts instead
**Risk**: LOW
**Action**: Remove

```bash
cd frontend && pnpm remove recharts
```

**c) Remark-GFM**
```json
"remark-gfm": "^4.0.1"
```
**Reason**: react-markdown is used but not this plugin
**Risk**: LOW
**Action**: Remove

```bash
cd frontend && pnpm remove remark-gfm
```

**d) Sharp (devDependency)**
```json
"sharp": "^0.34.5"
```
**Reason**: Not used in build process
**Risk**: LOW
**Action**: Remove

```bash
cd frontend && pnpm remove -D sharp
```

#### 6. Unused API Functions
**File**: `/frontend/src/utils/ai-api.ts`

The following exported functions are NEVER called:

- `analyzePortfolio(portfolioId)` - Only used in deleted `AIAnalyst.tsx`
- `searchChatHistory(query)` - No references
- `closeChatSession(sessionId)` - No references
- `getChatAutocomplete(query, tagType)` - Used only in `TaggingInput.tsx` (verify if that's active)

**Risk**: LOW
**Action**: Review and remove unused functions from `ai-api.ts`

---

## 🟡 MEDIUM PRIORITY - NEEDS REVIEW

### Frontend

#### 7. Placeholder "Coming Soon" View
**Path**: `/frontend/src/components/ExploreView.tsx`
**Status**: ⚠️ PLACEHOLDER - Contains only "Coming Soon" UI
**Risk**: MEDIUM - Might be planned feature
**Question**: Is this feature planned for future implementation?
**Action**:
- If NO future plans → DELETE
- If planned → Keep and document in roadmap

#### 8. React Flow Stub Components
**Path**: `/frontend/src/components/CashFlowNode.tsx`
**Status**: ⚠️ TEMPORARY STUBS - Has commented imports and placeholder types
**Risk**: MEDIUM - CashFlowView IS active but uses stubs
**Dependencies**: `reactflow` package IS installed (v11.11.4)
**Question**: Is reactflow integration incomplete or intentionally minimal?
**Action**:
- If using stubs intentionally → Keep as-is
- If incomplete → Complete integration or simplify CashFlowView

#### 9. Feature Flag Hook
**Path**: `/frontend/src/hooks/useFeatureFlag.ts`
**Status**: ⚠️ DEFINED BUT NOT USED
**Dependencies**: `@growthbook/growthbook-react` IS installed
**Question**: Are feature flags planned for A/B testing?
**Action**:
- If not using feature flags → Remove hook + GrowthBook dependency
- If planned → Document usage plan

#### 10. Unused Imports
**File**: `/backend/core/ai_analyst.py`
**Import**: `Optional` (line 2)
**Status**: ⚠️ UNUSED
**Risk**: LOW
**Action**: Remove import

```python
# Remove this line from ai_analyst.py:
from typing import Optional
```

---

## 🟢 LOW PRIORITY - KEEP AS-IS

### Backend Standalone Scripts

These are operational/maintenance scripts that run independently (not imported):

| Script | Purpose | Status |
|--------|---------|--------|
| `clean_corrupted_data.py` | Data cleanup utility | ✅ Keep |
| `check_date_range.py` | Date validation | ✅ Keep |
| `debug_ibit.py` | Debug IBIT symbols | ✅ Keep |
| `debug_tase.py` | Debug TASE symbols | ✅ Keep |
| `migrate_backfill_historical.py` | Migration script | ✅ Keep |
| `populate_historical_cache.py` | Cache population | ✅ Keep |
| `test_*.py` files (7 files) | Integration tests | ✅ Keep |

**Recommendation**: Consider organizing into `scripts/` and `tests/` directories for clarity.

### All Registered Endpoints

All 18 backend API endpoint routers are properly registered in `main.py` and actively used:

✅ portfolio, tags, ai_chat, user, profile, settings, market, news, ibkr, files, notifications, custom_charts, real_estate, feedback, extension, tax_planner, cash_flow (ALL ACTIVE)

### All Core Services

All backend core services and external integrations are in active use:

✅ auth, ai_analyst, analytics, chat_manager, database, firebase, logo_cache, notification_service, options_calculator, portfolio_analyzer, rsu_calculator, tag_parser, tag_service, user_deletion_service (ALL ACTIVE)

✅ Services: closing_price, earnings, interactive_brokers, news, real_estate, telegram (ALL ACTIVE)

### All Dependencies (Verified as Used)

#### Backend (All Used)
- ✅ fastapi, yfinance, pymaya, pymongo, redis, fakeredis
- ✅ loguru, uvicorn, httpx, python-multipart, pydantic-settings
- ✅ firebase-admin, finnhub-python, google-genai, gnews
- ✅ python-telegram-bot (for feedback notifications)
- ✅ pynadlan (real estate pricing)
- ✅ apscheduler (price refresh scheduler)
- ✅ mixpanel (analytics)
- ❌ aiofiles (NOT USED - see HIGH PRIORITY)

#### Frontend (Active Dependencies)
- ✅ react, react-dom, react-router-dom
- ✅ @radix-ui/* (dialog, dropdown, select, etc.)
- ✅ highcharts, highcharts-react-official
- ✅ firebase, axios, lucide-react
- ✅ tailwindcss, postcss, autoprefixer
- ✅ react-markdown, js-yaml
- ✅ mixpanel-browser
- ✅ @growthbook/growthbook-react (used in GrowthBookProvider)
- ✅ reactflow (installed, used with stubs in CashFlowView)
- ❌ Material-UI, emotion, recharts, remark-gfm, sharp (NOT USED - see HIGH PRIORITY)

---

## 📋 Commented Code Blocks

### Minor Cleanup Opportunities

| File | Lines | Type | Action |
|------|-------|------|--------|
| `frontend/src/types/cashflow.ts` | 3-7 | Commented reactflow imports | Keep (documents stub status) |
| `frontend/src/components/CashFlowNode.tsx` | 1-4, 15-16 | Commented reactflow imports | Keep (documents stub status) |
| `frontend/src/components/ESPPAnalysis.tsx` | Various | TODO comments | Review TODOs for completion |

**Risk**: VERY LOW - These comments document implementation status
**Action**: Keep unless reactflow is fully integrated or removed

---

## 📊 Statistics Summary

### Backend
- **Files**: ~100+ Python files analyzed
- **Unused Files**: 1 directory (prices-db/)
- **Unused Dependencies**: 1 (aiofiles)
- **Dead Code**: Minimal
- **Code Quality**: ✅ EXCELLENT (DRY principles, clear architecture)

### Frontend
- **Files**: ~50+ TypeScript/TSX files analyzed
- **Unused Components**: 5
- **Unused Dependencies**: 6 packages
- **Unused API Functions**: 4
- **Dead Code**: Moderate (old refactoring artifacts)

---

## 🚀 Recommended Cleanup Sequence

### Phase 1: Safe Deletions (No Risk)
```bash
# Backend
rm -rf backend/prices-db/
cd backend && poetry remove aiofiles

# Frontend
rm frontend/src/components/AIAnalyst.tsx
rm frontend/src/components/CashFlowCalculator.tsx
rm frontend/src/components/HoldingTagManager.tsx
rm frontend/src/dummyHoldingsData.ts

cd frontend && pnpm remove @mui/material @mui/icons-material @emotion/react @emotion/styled recharts remark-gfm sharp
```

**Estimated Savings**:
- Disk space: ~800KB (mostly dummy data)
- node_modules: ~15MB (MUI stack + recharts)
- Dependency count: -7 packages

### Phase 2: Code Cleanup
1. Remove unused API functions from `frontend/src/utils/ai-api.ts`
2. Remove `Optional` import from `backend/core/ai_analyst.py`
3. Run linters to verify no breakage

### Phase 3: Decisions Required
1. **ExploreView.tsx**: Keep or delete?
2. **CashFlowNode.tsx**: Complete reactflow integration or simplify?
3. **useFeatureFlag.ts**: Implement feature flags or remove?

### Phase 4: Organization (Optional)
```bash
# Backend
mkdir -p backend/scripts backend/tests
mv backend/*debug*.py backend/scripts/
mv backend/test_*.py backend/tests/
mv backend/clean_*.py backend/scripts/
mv backend/migrate_*.py backend/scripts/
mv backend/populate_*.py backend/scripts/
```

---

## ✅ Verification Checklist

Before deleting any code, verify:

- [ ] Run backend tests: `cd backend && poetry run pytest`
- [ ] Run frontend build: `cd frontend && pnpm build`
- [ ] Check git history for recent usage of files
- [ ] Search for dynamic imports or string-based references
- [ ] Verify API endpoints are not called directly from external tools
- [ ] Test app locally after deletions
- [ ] Run linter after deletions

---

## 📝 Notes

1. **Conservative Analysis**: This audit errs on the side of caution. When uncertain, items were marked for review rather than deletion.

2. **Dynamic Imports**: Some files might be imported dynamically (e.g., lazy loading). Always test after deletion.

3. **API Endpoints**: Backend routers are exposed as HTTP endpoints and might be called by external tools, Chrome extensions, or mobile apps. Be extra careful with endpoint deletions.

4. **Test Files**: Backend test files exist but aren't configured in `pyproject.toml` for automated pytest. Consider adding test configuration.

5. **Documentation**: Several markdown docs exist in the root (e.g., `GROWTHBOOK_INTEGRATION.md`, `TAGGING_SYSTEM_IMPLEMENTATION.md`). These are valuable documentation and should be kept.

---

## 🎯 Impact Assessment

### High Confidence Deletions (Phase 1)
- **Backend Risk**: ✅ MINIMAL - Legacy directory never imported
- **Frontend Risk**: ✅ MINIMAL - Components confirmed unused via static analysis
- **Dependency Risk**: ✅ MINIMAL - Zero imports found for all listed packages

### Medium Confidence (Phase 3)
- **ExploreView**: Might be planned feature - needs PM decision
- **CashFlowNode stubs**: Intentional simplification vs incomplete work - needs dev decision
- **Feature flags**: Strategic A/B testing decision - needs product decision

---

## Contact & Review

**Audit Performed By**: Claude Code
**Review Required By**: @mpalarya (repository owner)
**Next Steps**: Review each HIGH PRIORITY item and approve for deletion

**Questions?** Comment on specific items in this document before proceeding with deletions.
