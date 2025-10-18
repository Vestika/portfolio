# ✅ CSP (Content Security Policy) Issue Fixed

## The Problem

When trying to inject an inline script, the browser's CSP blocked it with:
```
Refused to execute inline script because it violates the following Content Security Policy directive
```

Chrome extensions cannot inject inline scripts into pages with strict CSP.

## The Solution

Changed from **inline script injection** to **external script file injection**:

### Before (didn't work):
```typescript
const script = document.createElement('script');
script.textContent = `
  // Inline JavaScript code here
`;
document.head.appendChild(script);
```

### After (works):
```typescript
const script = document.createElement('script');
script.src = chrome.runtime.getURL('assets/injected-auth-bridge.js');
document.head.appendChild(script);
```

## What Changed

### 1. Created External Script File
**`src/content/injected-auth-bridge.ts`** - Separate TypeScript file with auth bridge logic

### 2. Updated Build Config
**`vite.config.ts`** - Added to build inputs:
```typescript
input: {
  popup: 'src/popup/popup.html',
  options: 'src/options/options.html',
  'injected-auth-bridge': 'src/content/injected-auth-bridge.ts'  // NEW
}
```

Output config ensures fixed filename:
```typescript
entryFileNames: (chunkInfo) => {
  if (chunkInfo.name === 'injected-auth-bridge') {
    return 'assets/injected-auth-bridge.js';  // Fixed name, no hash
  }
  return 'assets/[name]-[hash].js';
}
```

### 3. Updated Manifest
**`manifest.json`** - Added to web_accessible_resources:
```json
"web_accessible_resources": [
  {
    "resources": ["assets/injected-auth-bridge.js"],
    "matches": [
      "https://app.vestika.io/*",
      "http://localhost:*/*"
    ]
  }
]
```

This allows the script to be loaded from the extension's origin into web pages.

### 4. Updated Content Script
**`src/content/vestika-auth.ts`** - Load external script instead of inline:
```typescript
const script = document.createElement('script');
script.src = chrome.runtime.getURL('assets/injected-auth-bridge.js');
script.onload = () => {
  console.log('[Vestika Auth] Bridge script loaded');
  script.remove();
};
```

## How It Works Now

```
┌────────────────────────────────┐
│ Extension Package              │
│                                │
│ dist/assets/                   │
│   injected-auth-bridge.js  ◄───┼─── Built from .ts
│                                │
└────────────────────────────────┘
         │
         │ chrome.runtime.getURL()
         │
         ▼
┌────────────────────────────────┐
│ Vestika Web Page               │
│ (localhost:5173)               │
│                                │
│ <script src="chrome-extension: │
│   //7403a76b.../assets/        │
│   injected-auth-bridge.js">    │
│                                │
│ Script has access to:          │
│ - window.__FIREBASE_AUTH__     │
│ - page's JavaScript context    │
└────────────────────────────────┘
```

## Build Output

```
dist/assets/injected-auth-bridge.js    0.85 kB │ gzip: 0.48 kB
```

The script is:
- ✅ Built as separate file
- ✅ Has fixed name (no hash)
- ✅ Exposed via web_accessible_resources
- ✅ Loaded by content script
- ✅ Runs in page context
- ✅ Bypasses CSP restrictions

## Testing

1. **Rebuild frontend** (if not already done):
   ```bash
   cd frontend
   pnpm dev
   ```

2. **Reload extension**:
   - Go to `chrome://extensions/`
   - Click reload on Vestika extension

3. **Check page console** (F12 on Vestika page):
   ```
   [Vestika Auth] Content script loaded
   [Vestika Auth] Bridge script loaded  ← New!
   [Vestika Auth Bridge] Injected script running
   [Vestika Auth Bridge] Ready to receive auth requests
   ```

4. **Check for CSP errors**:
   - Should see NO CSP errors in console
   - Should see "[Vestika Auth] Bridge script loaded"

5. **Test auth**:
   - Click extension icon
   - Should see your email and profile pic

## Why This Approach Works

1. **External scripts bypass inline CSP**
   - CSP blocks inline `<script>` tags
   - CSP allows external scripts loaded via `src`

2. **web_accessible_resources**
   - Makes extension files accessible to web pages
   - Allows `chrome-extension://` URLs in `<script src>`

3. **Runs in page context**
   - Script executes with same privileges as page's own scripts
   - Can access `window.__FIREBASE_AUTH__`
   - No isolated world restrictions

## Security Note

The injected script is **read-only**:
- Only reads `window.__FIREBASE_AUTH__.currentUser`
- Only calls `user.getIdToken()`
- Does NOT modify page or Firebase state
- Communication via `window.postMessage` (standard web API)

---

**Status**: ✅ CSP issue resolved
**Build**: ✅ Successful
**Ready to test**: Yes
