// This script is injected into the page context to access Firebase auth
// It runs in the page's JavaScript context, not the extension's isolated world

(function() {
  console.log('[Vestika Auth Bridge] Injected script running');

  // Function to get auth state from Firebase
  async function getAuthState() {
    try {
      // Wait for auth to be available (exported from firebase.ts)
      let attempts = 0;
      while (attempts < 50) {
        // Access auth from window (exposed by frontend)
        const authModule = (window as any).__FIREBASE_AUTH__;

        if (authModule && authModule.currentUser) {
          const user = authModule.currentUser;
          const token = await user.getIdToken();

          return {
            token,
            user: {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              uid: user.uid,
            },
          };
        }

        // Wait 100ms before next attempt
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      console.log('[Vestika Auth Bridge] Firebase auth not found after waiting');
      return { token: null, user: null };
    } catch (error) {
      console.error('[Vestika Auth Bridge] Error getting auth:', error);
      return { token: null, user: null };
    }
  }

  // Listen for requests from content script
  window.addEventListener('message', async function(event) {
    // Only accept messages from same window
    if (event.source !== window) return;

    if (event.data && event.data.type === 'GET_FIREBASE_AUTH') {
      const authState = await getAuthState();
      window.postMessage({
        type: 'FIREBASE_AUTH_RESPONSE',
        payload: authState
      }, window.location.origin);
    }
  });

  console.log('[Vestika Auth Bridge] Ready to receive auth requests');
})();
