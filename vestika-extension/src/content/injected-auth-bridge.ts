// This script is injected into the page context to access Firebase auth
// It runs in the page's JavaScript context, not the extension's isolated world

(function() {
  console.log('[Vestika Auth Bridge] Injected script running');

  // Function to get auth state from Firebase
  async function getAuthState(forceRefresh: boolean = false) {
    try {
      // Wait for auth to be available (exported from firebase.ts)
      let attempts = 0;
      while (attempts < 50) {
        // Access auth from window (exposed by frontend)
        const authModule = (window as any).__FIREBASE_AUTH__;

        if (authModule && authModule.currentUser) {
          const user = authModule.currentUser;

          // Get ID token with force refresh option
          // Firebase tokens expire after 1 hour, so we can force refresh when needed
          const token = await user.getIdToken(forceRefresh);

          // Calculate expiration time (Firebase tokens last 1 hour)
          // We use the token's actual expiration from the decoded token
          const decodedToken = parseJwt(token);
          const expiresAt = decodedToken.exp * 1000; // Convert to milliseconds

          return {
            token,
            user: {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              uid: user.uid,
            },
            expiresAt
          };
        }

        // Wait 100ms before next attempt
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      console.log('[Vestika Auth Bridge] Firebase auth not found after waiting');
      return { token: null, user: null, expiresAt: null };
    } catch (error) {
      console.error('[Vestika Auth Bridge] Error getting auth:', error);
      return { token: null, user: null, expiresAt: null };
    }
  }

  // Helper to decode JWT and get expiration
  function parseJwt(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('[Vestika Auth Bridge] Error parsing JWT:', error);
      return { exp: Date.now() / 1000 + 3600 }; // Default to 1 hour from now
    }
  }

  // Listen for requests from content script
  window.addEventListener('message', async function(event) {
    // Only accept messages from same window
    if (event.source !== window) return;

    if (event.data && event.data.type === 'GET_FIREBASE_AUTH') {
      const forceRefresh = event.data.forceRefresh || false;
      const authState = await getAuthState(forceRefresh);
      window.postMessage({
        type: 'FIREBASE_AUTH_RESPONSE',
        payload: authState
      }, window.location.origin);
    }
  });

  console.log('[Vestika Auth Bridge] Ready to receive auth requests');
})();
