# Vestika Portfolio Importer - Browser Extension

A Chrome/Edge extension that simplifies importing portfolio holdings from brokerage websites into Vestika using AI-powered extraction.

## Features

- **Zero Manual Entry**: Import portfolio holdings with one click
- **AI-Powered Extraction**: Uses Google Gemini to parse brokerage HTML tables
- **Seamless Authentication**: Reuses your Vestika web app session (no separate login)
- **Community Configurations**: Share and use extraction configs for popular brokers
- **Auto-Sync**: Optionally sync portfolio data automatically when visiting brokerage pages
- **Validation Workflow**: Review and edit extracted data before importing

## Installation

### From Source (Development)

1. **Install dependencies:**
   ```bash
   cd vestika-extension
   pnpm install
   ```

2. **Build the extension:**
   ```bash
   pnpm build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `vestika-extension/dist` directory

### From Chrome Web Store (Coming Soon)

Search for "Vestika Portfolio Importer" in the Chrome Web Store.

## Usage

### First-Time Setup

1. **Install Extension**: Install from Chrome Web Store or load from source
2. **Authenticate**:
   - Click the extension icon
   - Click "Open Vestika & Log In"
   - Log in to Vestika with your Google account
   - The extension will automatically detect your auth state

3. **Create Configuration**:
   - Navigate to your brokerage portfolio page (e.g., Fidelity, Vanguard)
   - Click the extension icon → "Create Configuration"
   - Name the configuration (e.g., "Fidelity 401k")
   - Adjust URL pattern if needed (supports wildcards: `https://fidelity.com/portfolio/*`)
   - Choose extraction mode:
     - **Full Page**: Sends entire HTML (recommended for most brokers)
     - **CSS Selector**: Extracts specific element (e.g., `table.holdings-table`)
   - Test extraction to preview results
   - Save configuration

4. **Link to Portfolio**:
   - Select which Vestika portfolio to import to
   - Select existing account or create new one
   - Optionally enable auto-sync
   - Save private configuration

### Daily Use

1. **One-Click Import**:
   - Visit your brokerage portfolio page
   - Click extension icon
   - Click "Capture & Import"
   - Holdings are automatically extracted and imported

2. **Validation Workflow** (Optional):
   - Click "Validate Before Import" instead
   - Review extracted holdings in table
   - Edit any incorrect data
   - Click "Import"

3. **Auto-Sync** (Optional):
   - If auto-sync is enabled, portfolio syncs automatically when you visit brokerage page
   - Rate-limited to once per minute to prevent excessive API calls

## Architecture

### Extension Components

```
vestika-extension/
├── manifest.json              # Manifest V3 configuration
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Background service worker
│   ├── content/
│   │   ├── extractor.ts       # HTML extraction logic
│   │   └── vestika-auth.ts    # Firebase auth integration
│   ├── popup/
│   │   ├── Popup.tsx          # Main popup UI
│   │   └── popup.css
│   ├── options/
│   │   ├── Options.tsx        # Settings page
│   │   └── options.css
│   └── shared/
│       ├── api.ts             # Vestika API client
│       ├── types.ts           # TypeScript types
│       └── utils.ts           # Utility functions
```

### Backend Endpoints

The extension communicates with these Vestika backend endpoints:

- **`POST /api/extension/extract`**: Extract holdings from HTML using AI
- **`POST /api/extension/import`**: Import holdings into portfolio
- **`GET/POST/PUT/DELETE /api/extension/configs`**: Manage shared configs
- **`GET/POST/PUT/DELETE /api/extension/private-configs`**: Manage private configs

See [EXTENSION_PRD.md](../EXTENSION_PRD.md) for full API documentation.

## Development

### Tech Stack

- **Build Tool**: Vite with `@crxjs/vite-plugin` for Manifest V3 HMR
- **Framework**: React 18 + TypeScript
- **Styling**: CSS (Tailwind can be added if needed)
- **State**: Zustand (lightweight for extensions)
- **Package Manager**: pnpm

### Available Scripts

```bash
# Install dependencies
pnpm install

# Development mode (with HMR)
pnpm dev

# Build for production
pnpm build

# Preview build
pnpm preview
```

### Development Workflow

1. **Make changes** to source files in `src/`
2. **Run** `pnpm dev` for hot reload
3. **Reload extension** in Chrome if needed (background script changes require reload)
4. **Test** thoroughly on multiple brokerage sites
5. **Build** production version with `pnpm build`

### Adding a New Brokerage

1. Visit the brokerage portfolio page
2. Use "Create Configuration" in extension
3. Test extraction with "Validate Before Import"
4. Share configuration publicly so other users can benefit
5. Document any special notes (e.g., "Must be logged in first")

## Security & Privacy

### Security Principles

- **No Credential Storage**: Extension NEVER stores brokerage passwords
- **Firebase Auth Only**: Uses secure Firebase tokens for Vestika API
- **HTTPS Only**: All API requests use encrypted HTTPS
- **Minimal Permissions**: Only requests necessary Chrome permissions
- **User Consent**: Auto-sync requires explicit user opt-in

### Privacy Considerations

- **HTML Data**: Brokerage HTML is sent to Vestika backend for AI extraction (processed in-memory, not stored)
- **Shared Configs**: URL patterns are public (do not include personal data in config names)
- **Private Configs**: Portfolio/account mappings are user-specific and private

### Chrome Permissions

```json
{
  "permissions": [
    "activeTab",    // Access current tab when user clicks extension
    "storage",      // Store configuration cache locally
    "scripting"     // Execute scripts for HTML extraction
  ],
  "host_permissions": [
    "https://app.vestika.io/*"  // Access Vestika for auth
  ],
  "optional_host_permissions": [
    "https://*/*"  // User grants per-site access when creating configs
  ]
}
```

## Troubleshooting

### Extension not detecting auth

- Make sure you're logged into Vestika (app.vestika.io)
- Refresh the Vestika page
- Click extension icon to trigger auth check

### Extraction returns 0 holdings

- Try using CSS selector instead of full page
- Inspect the brokerage page HTML to find the holdings table
- Use browser DevTools to identify the correct selector

### Import fails with "Portfolio not found"

- Make sure you've selected the correct portfolio in private config
- Refresh your portfolios in the extension options page

### Auto-sync not working

- Check if auto-sync is enabled in private config
- Verify URL pattern matches the brokerage page
- Check browser console for errors

## Roadmap

### Phase 1: MVP (Current)
- ✅ Basic extraction and import
- ✅ Shared and private configurations
- ✅ Firebase authentication
- ✅ Simple popup and options UI

### Phase 2: Validation & Auto-Sync
- ⏳ Editable validation table with confidence scores
- ⏳ Auto-sync with rate limiting
- ⏳ Extension badge to show sync status

### Phase 3: CSS Selector & Advanced
- ⏳ Interactive element picker
- ⏳ Extraction testing in config wizard
- ⏳ Improved error handling

### Phase 4: Launch
- ⏳ UI/UX polish
- ⏳ Onboarding tutorial
- ⏳ Chrome Web Store listing
- ⏳ Video demo and documentation

## Contributing

We welcome contributions! Here's how you can help:

1. **Add Brokerage Configs**: Create and share configs for popular brokers
2. **Report Issues**: Open GitHub issues for bugs or feature requests
3. **Submit PRs**: Fix bugs or implement new features
4. **Test**: Try the extension on different brokerage sites

## License

MIT License - see LICENSE file for details

## Support

- **GitHub Issues**: https://github.com/your-repo/issues
- **Email**: support@vestika.io
- **Docs**: https://docs.vestika.io/extension

---

**Built with** ❤️ **by the Vestika team**
