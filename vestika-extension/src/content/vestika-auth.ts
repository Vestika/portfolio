// Content script to bridge Firebase auth from Vestika web app to extension
// This script runs in an isolated world, so we need to inject code into the page to access Firebase

console.log('[Vestika Auth] Content script loaded');

// Inject the auth bridge script into the page context
function injectAuthBridge() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('assets/injected-auth-bridge.js');
    script.onload = () => {
      console.log('[Vestika Auth] Bridge script loaded');
      script.remove();
    };
    script.onerror = () => {
      console.error('[Vestika Auth] Failed to load bridge script');
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[Vestika Auth] Error injecting bridge script:', error);
  }
}

// Inject the bridge when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectAuthBridge);
} else {
  injectAuthBridge();
}

// Function to get auth from injected script
function getFirebaseAuthToken(forceRefresh: boolean = false): Promise<{ token: string | null; user: any; expiresAt: number | null }> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      console.log('[Vestika Auth] Timeout waiting for auth response');
      resolve({ token: null, user: null, expiresAt: null });
    }, 5000);

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data && event.data.type === 'FIREBASE_AUTH_RESPONSE') {
        cleanup();
        resolve(event.data.payload);
      }
    }

    function cleanup() {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    }

    window.addEventListener('message', handleMessage);

    // Request auth from injected script with forceRefresh flag
    window.postMessage({ type: 'GET_FIREBASE_AUTH', forceRefresh }, window.location.origin);
  });
}

// Send auth state to background script and persist to storage
async function syncAuthState(forceRefresh: boolean = false) {
  try {
    const { token, user, expiresAt } = await getFirebaseAuthToken(forceRefresh);

    console.log('[Vestika Auth] Got auth state:', {
      hasToken: !!token,
      hasUser: !!user,
      email: user?.email,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    });

    const authData = {
      isAuthenticated: !!token,
      token,
      user,
      expiresAt,
      lastUpdated: Date.now()
    };

    // Persist to chrome.storage.local for durability across service worker restarts
    await chrome.storage.local.set({ authState: authData });

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'AUTH_STATE',
      payload: authData,
    }).catch(err => {
      console.error('[Vestika Auth] Failed to send to background:', err);
    });

  } catch (error) {
    console.error('[Vestika Auth] Error syncing auth state:', error);
  }
}

// Initial sync
setTimeout(() => {
  syncAuthState();

  // Periodic refresh - check token every 30 minutes and refresh if close to expiry
  setInterval(async () => {
    const result = await chrome.storage.local.get('authState');
    const authState = result.authState;

    if (authState?.expiresAt) {
      const timeUntilExpiry = authState.expiresAt - Date.now();
      // Refresh if less than 5 minutes until expiry
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log('[Vestika Auth] Token close to expiry, refreshing...');
        await syncAuthState(true); // Force refresh
      }
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}, 2000);

// Listen for messages from extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REQUEST_AUTH') {
    getFirebaseAuthToken(message.forceRefresh || false).then(({ token, user, expiresAt }) => {
      sendResponse({ token, user, expiresAt });
    });
    return true;
  }
});
