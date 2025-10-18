# Setup Guide - Vestika Browser Extension

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Chrome or Edge browser
- Vestika backend running on localhost:8080

## Backend Setup

1. **Add extension endpoints to backend:**

The backend endpoints have already been created in:
- `/backend/models/extension_models.py` - Data models
- `/backend/app/endpoints/extension.py` - API endpoints

These are automatically registered in `backend/app/main.py`.

2. **Verify Google AI API key is configured:**

Make sure your `backend/.env` file has:
```bash
GOOGLE_AI_API_KEY=your_gemini_api_key_here
```

3. **Start the backend:**

```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8080
```

4. **Test the endpoints:**

Visit http://localhost:8080/docs to see the new extension endpoints:
- `POST /api/extension/extract`
- `POST /api/extension/import`
- `GET /api/extension/configs`
- `POST /api/extension/configs`
- etc.

## Extension Setup

1. **Install dependencies:**

```bash
cd vestika-extension
pnpm install
```

2. **Configure environment (optional):**

```bash
# Copy example env file
cp .env.example .env

# Edit .env to customize (defaults work for local development)
# VITE_API_URL=http://localhost:8080
# VITE_VESTIKA_APP_URL=http://localhost:5173
```

**Environment Files:**
- `.env` - Local development (git-tracked, default values)
- `.env.local` - Local overrides (git-ignored)
- `.env.production` - Production build values

3. **Build the extension:**

```bash
# Development build (uses .env)
pnpm build

# Production build (uses .env.production)
pnpm build --mode production
```

This creates a `dist/` folder with the compiled extension.

3. **Create extension icons:**

You need to create 3 icon files in `vestika-extension/src/assets/`:
- `icon-16.png` (16x16 pixels)
- `icon-48.png` (48x48 pixels)
- `icon-128.png` (128x128 pixels)

You can use any icon design tool or generate simple placeholder icons.

4. **Load extension in Chrome:**

- Open Chrome and go to `chrome://extensions/`
- Enable "Developer mode" (toggle in top right)
- Click "Load unpacked"
- Select the `vestika-extension/dist` folder
- The extension should now appear in your extensions list

## Development Workflow

### Development Mode (with Hot Reload)

```bash
cd vestika-extension
pnpm dev
```

Then in Chrome:
- Go to `chrome://extensions/`
- Click "Reload" on the Vestika extension whenever you make changes
- Background script changes require a full reload
- Popup/options changes hot reload automatically (just close and reopen popup)

### Production Build

```bash
pnpm build
```

## Testing the Extension

1. **Test Authentication:**

- Make sure Vestika web app is running (http://localhost:5173)
- Log in to Vestika
- Click the extension icon
- You should see your email displayed

2. **Create a Test Configuration:**

- Open a test HTML file with a table of holdings (or use any website)
- Click extension icon → "Create Configuration"
- Name it "Test Config"
- Use URL pattern: `file:///*` or `https://example.com/*`
- Save configuration

3. **Test Extraction:**

- Visit the test page
- Click extension icon → "Capture & Import"
- Check browser console (F12) for extraction logs
- Check Vestika backend logs for API calls

## Database Collections

The backend will automatically create these MongoDB collections:
- `extension_configs` - Shared extraction configurations
- `private_extension_configs` - User-specific config mappings

## Troubleshooting

### "Extension failed to load"

- Make sure you ran `pnpm build` before loading
- Check that `dist/manifest.json` exists
- Look for errors in Chrome extensions page

### "API calls failing with 401"

- Make sure you're logged into Vestika web app
- Check that Firebase auth is working
- Inspect extension background script console: `chrome://extensions/` → "Inspect views: service worker"

### "No HTML extracted"

- Check that content script is injected (look in DevTools → Sources)
- Make sure you granted host permissions to the extension
- Check browser console for errors

### "Icons not showing"

- Create placeholder PNG files in `src/assets/`
- Or temporarily comment out icon references in `manifest.json`

## Next Steps

1. **Create Real Icons**: Design proper extension icons
2. **Add Tailwind (Optional)**: `pnpm add -D tailwindcss` and configure
3. **Test with Real Brokers**: Try Fidelity, Vanguard, Schwab, etc.
4. **Implement Validation Table**: Add editable holdings table UI
5. **Add Auto-Sync Logic**: Complete auto-sync implementation
6. **Chrome Web Store**: Prepare for public release

## File Structure

```
vestika-extension/
├── dist/                      # Build output (created by pnpm build)
├── src/
│   ├── assets/
│   │   ├── icon-16.png       # ⚠️ CREATE THESE
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   ├── background/
│   │   └── service-worker.ts # ✅ Background script
│   ├── content/
│   │   ├── extractor.ts      # ✅ HTML extraction
│   │   └── vestika-auth.ts   # ✅ Firebase auth bridge
│   ├── popup/
│   │   ├── Popup.tsx         # ✅ Main popup UI
│   │   ├── popup.html
│   │   └── popup.css
│   ├── options/
│   │   ├── Options.tsx       # ✅ Settings page
│   │   ├── options.html
│   │   └── options.css
│   └── shared/
│       ├── api.ts            # ✅ API client
│       ├── types.ts          # ✅ TypeScript types
│       └── utils.ts          # ✅ Utilities
├── manifest.json             # ✅ Extension manifest
├── package.json              # ✅ Dependencies
├── tsconfig.json             # ✅ TypeScript config
├── vite.config.ts            # ✅ Vite config
└── README.md                 # ✅ Documentation
```

## Support

If you encounter issues:
1. Check browser console (F12)
2. Check extension service worker console (`chrome://extensions/` → "Inspect views")
3. Check Vestika backend logs
4. Check MongoDB for created documents

---

Happy coding! 🚀
