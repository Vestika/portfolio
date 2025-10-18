# Environment Configuration

The extension uses Vite's environment variable system to configure API endpoints and app URLs.

## Environment Variables

### Available Variables

| Variable | Description | Default (Dev) | Production |
|----------|-------------|---------------|------------|
| `VITE_API_URL` | Vestika backend API URL | `http://localhost:8080` | `https://api.vestika.io` |
| `VITE_VESTIKA_APP_URL` | Vestika web app URL (for auth) | `http://localhost:5173` | `https://app.vestika.io` |

## Environment Files

### `.env` (Local Development)
Default configuration for local development. Committed to git.

```bash
VITE_API_URL=http://localhost:8080
VITE_VESTIKA_APP_URL=http://localhost:5173
```

### `.env.local` (Local Overrides)
Optional overrides for your local machine. **Not committed to git**.

Create this file if you need custom local settings:

```bash
# Example: Using different port
VITE_API_URL=http://localhost:3000
VITE_VESTIKA_APP_URL=http://localhost:8080
```

### `.env.production` (Production Build)
Used when building for production deployment.

```bash
VITE_API_URL=https://api.vestika.io
VITE_VESTIKA_APP_URL=https://app.vestika.io
```

## Usage in Code

### Import Environment Variables

```typescript
// In any .ts/.tsx file
const apiUrl = import.meta.env.VITE_API_URL;
const appUrl = import.meta.env.VITE_VESTIKA_APP_URL;

// Check environment
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
const mode = import.meta.env.MODE; // 'development' or 'production'
```

### Using the Config Module

For convenience, use the centralized config:

```typescript
import { config } from '@/shared/config';

console.log(config.apiUrl);        // API URL
console.log(config.vestikaAppUrl); // App URL
console.log(config.isDevelopment); // true/false
console.log(config.isProduction);  // true/false
```

## Build Commands

### Development Build

Uses `.env` + `.env.local` (if exists):

```bash
pnpm build
# or
pnpm dev  # for dev mode with hot reload
```

### Production Build

Uses `.env.production`:

```bash
pnpm build --mode production
```

### Custom Environment

```bash
# Create .env.staging
pnpm build --mode staging
```

## Manifest Updates for Local Development

The `manifest.json` has been updated to support both production and local development:

### Content Scripts (Auth Bridge)

```json
"content_scripts": [
  {
    "matches": [
      "https://app.vestika.io/*",   // Production
      "http://localhost:5173/*",     // Local dev
      "http://localhost:*/*"         // Any local port
    ]
  }
]
```

### Host Permissions

```json
"host_permissions": [
  "https://app.vestika.io/*",  // Production
  "http://localhost/*"          // Local dev
]
```

## Where Environment Variables Are Used

### API Client (`src/shared/api.ts`)

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
```

Used for all backend API calls:
- `/api/extension/extract`
- `/api/extension/import`
- `/api/extension/configs`
- etc.

### Popup UI (`src/popup/Popup.tsx`)

```typescript
function openVestika() {
  const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'http://localhost:5173';
  chrome.tabs.create({ url: vestikaUrl });
}
```

Used when user clicks "Open Vestika" button.

### Options Page (`src/options/Options.tsx`)

Same as popup - opens Vestika app for authentication.

### Background Worker

⚠️ **Note**: `import.meta.env` doesn't work in service workers (Chrome limitation).
The background worker uses hardcoded production URL for first install only.

## Testing Different Environments

### Test with Local Backend

```bash
# 1. Start local backend
cd backend
poetry run uvicorn app.main:app --reload --port 8080

# 2. Start local frontend
cd frontend
pnpm dev  # runs on port 5173

# 3. Build extension (uses .env defaults)
cd vestika-extension
pnpm build

# 4. Load in Chrome
# Extension will connect to localhost:8080 for API
# Extension will connect to localhost:5173 for auth
```

### Test with Production Backend

```bash
# Create .env.local with production API
echo "VITE_API_URL=https://api.vestika.io" > .env.local
echo "VITE_VESTIKA_APP_URL=https://app.vestika.io" >> .env.local

# Build
pnpm build

# Extension now points to production
```

### Test with Staging

```bash
# Create .env.staging
cat > .env.staging << EOF
VITE_API_URL=https://staging-api.vestika.io
VITE_VESTIKA_APP_URL=https://staging.vestika.io
EOF

# Build for staging
pnpm build --mode staging
```

## Debugging Environment Variables

### Check Loaded Config

Open extension popup → Browser console (F12):

```javascript
// In dev mode, config is logged automatically
[Config] Environment: {
  apiUrl: "http://localhost:8080",
  vestikaAppUrl: "http://localhost:5173",
  mode: "development"
}
```

### Verify in Build

After building, check the bundled code:

```bash
# Search for API URL in built files
grep -r "localhost:8080" dist/
```

## Troubleshooting

### Extension using wrong API URL

1. Check `.env.local` - it overrides `.env`
2. Delete `dist/` and rebuild
3. Hard refresh extension in Chrome

### Auth not working with localhost

1. Check manifest.json has localhost in `content_scripts.matches`
2. Check browser console for content script errors
3. Make sure Vestika frontend is running on port 5173

### Production build still using localhost

1. Use `--mode production` flag
2. Check `.env.production` exists and has correct values
3. Delete `node_modules/.vite` cache and rebuild

---

**Summary**: The extension is now fully configurable for local development and production deployment!
