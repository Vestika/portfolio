# ✅ Environment Configuration Complete!

The extension now supports configurable API and app URLs for both local development and production.

## What Was Added

### 1. Environment Files

**`.env`** - Local development defaults (committed)
```bash
VITE_API_URL=http://localhost:8080
VITE_VESTIKA_APP_URL=http://localhost:5173
```

**`.env.local`** - Local overrides (git-ignored, create if needed)
```bash
# Override for your machine
VITE_API_URL=http://localhost:3000
```

**`.env.production`** - Production values (committed)
```bash
VITE_API_URL=https://api.vestika.io
VITE_VESTIKA_APP_URL=https://app.vestika.io
```

**`.env.example`** - Template for new developers
```bash
VITE_API_URL=http://localhost:8080
VITE_VESTIKA_APP_URL=http://localhost:5173
```

### 2. TypeScript Definitions

**`src/vite-env.d.ts`** - Type definitions for `import.meta.env`
```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_VESTIKA_APP_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}
```

### 3. Config Module

**`src/shared/config.ts`** - Centralized config access
```typescript
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  vestikaAppUrl: import.meta.env.VITE_VESTIKA_APP_URL || 'http://localhost:5173',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
```

### 4. Code Updates

**Updated Files:**
- ✅ `src/shared/api.ts` - Uses `VITE_API_URL` for backend
- ✅ `src/popup/Popup.tsx` - Uses `VITE_VESTIKA_APP_URL` for "Open Vestika"
- ✅ `src/options/Options.tsx` - Uses `VITE_VESTIKA_APP_URL`
- ✅ `manifest.json` - Added localhost to `content_scripts` matches and `host_permissions`

### 5. Updated Documentation

- ✅ `SETUP.md` - Added environment configuration section
- ✅ `ENV_CONFIG.md` - Comprehensive environment guide
- ✅ `.gitignore` - Added `.env.local` and `.env.*.local`

## How to Use

### Local Development (Default)

Just build and run - defaults work out of the box:

```bash
pnpm build
# Uses .env (localhost:8080 + localhost:5173)
```

### Custom Local Setup

Create `.env.local` for your specific setup:

```bash
echo "VITE_API_URL=http://localhost:3000" > .env.local
pnpm build
```

### Production Build

```bash
pnpm build --mode production
# Uses .env.production (api.vestika.io + app.vestika.io)
```

## Verification

### Check Environment in Browser

1. Load extension in Chrome
2. Click extension icon to open popup
3. Open browser console (F12)
4. Look for config log (in dev mode):

```
[Config] Environment: {
  apiUrl: "http://localhost:8080",
  vestikaAppUrl: "http://localhost:5173",
  mode: "development"
}
```

### Test Local Development

```bash
# 1. Start backend
cd backend
poetry run uvicorn app.main:app --reload --port 8080

# 2. Start frontend
cd frontend
pnpm dev  # runs on 5173

# 3. Build extension (defaults work)
cd vestika-extension
pnpm build

# 4. Load in Chrome
# Should connect to localhost backend ✓
# Should use localhost app for auth ✓
```

### Test Production Mode

```bash
# Build for production
pnpm build --mode production

# Check manifest was updated
cat dist/manifest.json | grep -A5 content_scripts
# Should see both localhost and app.vestika.io
```

## Manifest Updates for Localhost

The manifest now supports both production and local:

### Content Scripts (Firebase Auth Bridge)
```json
{
  "matches": [
    "https://app.vestika.io/*",   // Production
    "http://localhost:5173/*",     // Local dev
    "http://localhost:*/*"         // Any local port
  ]
}
```

### Host Permissions
```json
{
  "host_permissions": [
    "https://app.vestika.io/*",
    "http://localhost/*"
  ]
}
```

This allows the extension to:
- Inject auth script into localhost during development
- Connect to local backend API
- Work with production seamlessly

## Build Output

```
✓ Built in 598ms
✓ Environment variables injected at build time
✓ API URL: from VITE_API_URL
✓ App URL: from VITE_VESTIKA_APP_URL
```

## Troubleshooting

### Extension not connecting to localhost

1. Check `.env` or `.env.local` has correct URLs
2. Delete `dist/` and rebuild
3. Reload extension in Chrome

### Auth not working

1. Make sure Vestika app is running on configured port
2. Check manifest has localhost in content_scripts.matches
3. Look for content script errors in browser console

### Still using production URLs

1. Don't use `--mode production` for local dev
2. Check `.env.local` isn't overriding with production values
3. Clear Vite cache: `rm -rf node_modules/.vite && pnpm build`

---

**Status**: ✅ Environment configuration complete and tested
**Build**: ✅ Successful with environment variables
**Ready for**: Local development and production deployment
