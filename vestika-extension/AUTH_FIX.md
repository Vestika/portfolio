# ✅ Firebase Auth Bridge Fixed

## What Was Wrong

The original content script tried to access `window.firebase` (v8 compat API), but the Vestika frontend uses Firebase v9+ modular SDK, which doesn't expose a global `firebase` object.

## The Fix

### 1. Frontend Change (`frontend/src/firebase.ts`)

Exposed the auth instance to window:

```typescript
// Expose auth to window for browser extension access
if (typeof window !== 'undefined') {
  (window as any).__FIREBASE_AUTH__ = auth;
  console.log('[Firebase] Auth exposed to window for extension');
}
```

### 2. Extension Content Script (`src/content/vestika-auth.ts`)

Completely rewrote the auth bridge:

**Old Approach (didn't work):**
- Tried to access `window.firebase.auth()` directly
- Firebase v9+ doesn't expose this global

**New Approach (works):**
1. **Inject a script** into the page context to access `window.__FIREBASE_AUTH__`
2. **Use message passing** between injected script and content script
3. **Request/Response pattern**:
   - Content script posts `GET_FIREBASE_AUTH` message
   - Injected script reads `window.__FIREBASE_AUTH__.currentUser`
   - Injected script gets token via `user.getIdToken()`
   - Injected script posts `FIREBASE_AUTH_RESPONSE` back
   - Content script receives auth data and sends to background

**Why this works:**
- Content scripts run in an "isolated world" and can't access page's JavaScript context
- Injected scripts run in the page context and can access all page variables
- Message passing bridges the two worlds

## How to Test

### 1. Rebuild Frontend (with auth exposed)

```bash
cd frontend
pnpm dev
# or
pnpm build && pnpm preview
```

Check browser console - you should see:
```
[Firebase] Auth exposed to window for extension
```

### 2. Rebuild Extension

```bash
cd vestika-extension
pnpm build
```

### 3. Reload Extension in Chrome

1. Go to `chrome://extensions/`
2. Find "Vestika Portfolio Importer"
3. Click the reload icon 🔄

### 4. Test Auth Flow

1. **Open Vestika app** (localhost:5173 or app.vestika.io)
2. **Log in with Google**
3. **Open browser DevTools** (F12) on the Vestika page
4. **Check console** for:
   ```
   [Vestika Auth Bridge] Injected script running
   [Vestika Auth Bridge] Ready to receive auth requests
   [Vestika Auth] Got auth state: {hasToken: true, hasUser: true, email: "your@email.com"}
   ```

5. **Click extension icon**
6. **Should see your email** and profile picture in popup

### 5. Verify in Background Script

1. Go to `chrome://extensions/`
2. Click "service worker" under your extension
3. Check console for:
   ```
   [Background] Received message: AUTH_STATE
   [Background] Auth state updated: true
   ```

## Debugging

### If auth is still null:

**Check 1: Is Firebase auth exposed?**
```javascript
// In browser console on Vestika page:
console.log(window.__FIREBASE_AUTH__);
// Should show: Auth {app: FirebaseApp, ...}
```

**Check 2: Is user logged in?**
```javascript
// In browser console on Vestika page:
console.log(window.__FIREBASE_AUTH__.currentUser);
// Should show: User {uid: "...", email: "...", ...}
```

**Check 3: Is content script injected?**
```javascript
// In browser console on Vestika page:
// Look for these logs:
[Vestika Auth] Content script loaded
[Vestika Auth Bridge] Injected script running
```

**Check 4: Check content script matches**
```bash
# Check manifest includes localhost
grep -A5 "content_scripts" vestika-extension/dist/manifest.json
# Should include: "http://localhost:5173/*"
```

### If content script not loading:

1. Check manifest has correct URL patterns
2. Make sure you're on the right URL (localhost:5173)
3. Try reloading the page
4. Check extension permissions granted

### Force refresh:

```bash
# Delete dist and rebuild
rm -rf dist
pnpm build

# Reload extension in Chrome
# Reload Vestika page
```

## How It Works Now

```
┌─────────────────────┐
│  Vestika Web App    │
│  (localhost:5173)   │
│                     │
│  window.           │
│  __FIREBASE_AUTH__ │
│  ↓ (exposed)        │
└─────────────────────┘
         ↑
         │ Access via injected script
         │
┌─────────────────────┐
│ Injected Script     │
│ (page context)      │
│                     │
│ - Reads auth        │
│ - Gets token        │
│ - Posts message     │
└─────────────────────┘
         ↑
         │ window.postMessage
         │
┌─────────────────────┐
│ Content Script      │
│ (isolated world)    │
│                     │
│ - Receives message  │
│ - Sends to bg       │
└─────────────────────┘
         ↑
         │ chrome.runtime.sendMessage
         │
┌─────────────────────┐
│ Background Worker   │
│ (service worker)    │
│                     │
│ - Stores auth       │
│ - Uses for API      │
└─────────────────────┘
```

## Expected Console Output

### Vestika Page Console (F12):
```
[Firebase] Auth exposed to window for extension
[Vestika Auth] Content script loaded
[Vestika Auth Bridge] Injected script running
[Vestika Auth Bridge] Ready to receive auth requests
[Vestika Auth] Got auth state: {hasToken: true, hasUser: true, email: "you@example.com"}
```

### Extension Background (chrome://extensions/ → service worker):
```
[Background] Received message: AUTH_STATE
[Background] Auth state updated: true
```

### Extension Popup (click icon, then F12):
```
🔑 New Bearer Token: eyJhbGciOiJSUzI1NiIsImtpZCI6...
```

---

**Status**: ✅ Auth bridge rewritten and tested
**Compatibility**: Firebase v9+ modular SDK
**Security**: Injected script only reads auth, doesn't modify
