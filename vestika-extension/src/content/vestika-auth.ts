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
function getFirebaseAuthToken(): Promise<{ token: string | null; user: any }> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      console.log('[Vestika Auth] Timeout waiting for auth response');
      resolve({ token: null, user: null });
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

    // Request auth from injected script
    window.postMessage({ type: 'GET_FIREBASE_AUTH' }, window.location.origin);
  });
}

// Send auth state to background script
async function monitorAuthState() {
  try {
    const { token, user } = await getFirebaseAuthToken();

    console.log('[Vestika Auth] Got auth state:', {
      hasToken: !!token,
      hasUser: !!user,
      email: user?.email
    });

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'AUTH_STATE',
      payload: {
        isAuthenticated: !!token,
        token,
        user,
      },
    }).catch(err => {
      console.error('[Vestika Auth] Failed to send to background:', err);
    });

  } catch (error) {
    console.error('[Vestika Auth] Error getting auth token:', error);
  }
}

// Monitor auth state
// Wait a bit for page to load
setTimeout(() => {
  monitorAuthState();
  // Check periodically
  setInterval(monitorAuthState, 60000); // Every minute
}, 2000);

// Listen for messages from extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REQUEST_AUTH') {
    getFirebaseAuthToken().then(({ token, user }) => {
      sendResponse({ token, user });
    });
    return true;
  }
});
