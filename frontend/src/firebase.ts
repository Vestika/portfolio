import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDn8cytBf4yziTmLqXeNJzw2WdIlZrgCIk",
  authDomain: "vestika-92a0a.firebaseapp.com",
  projectId: "vestika-92a0a",
  storageBucket: "vestika-92a0a.firebasestorage.app",
  messagingSenderId: "962053007917",
  appId: "1:962053007917:web:7b262da81e832a3b6c66a4",
  measurementId: "G-W3B5H0X6YZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Authentication functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export default app; 

// Expose Firebase ID token to trusted callers (browser extension) via window message
// Only responds to explicit requests and never broadcasts tokens.
window.addEventListener('message', async (event: MessageEvent) => {
  try {
    // Accept only messages targeting this window
    if (event.source !== window) return;
    const data = event.data as { type?: string; requestId?: string; forceRefresh?: boolean } | undefined;
    if (!data || data.type !== 'VESTIKA_EXTENSION_GET_ID_TOKEN') return;

    const user = auth.currentUser;
    const idToken = user ? await user.getIdToken(!!data.forceRefresh) : null;

    window.postMessage(
      {
        type: 'VESTIKA_EXTENSION_ID_TOKEN',
        requestId: data.requestId,
        token: idToken,
      },
      window.location.origin
    );
  } catch {
    window.postMessage(
      {
        type: 'VESTIKA_EXTENSION_ID_TOKEN',
        requestId: (event.data && (event.data as { requestId?: string }).requestId) || undefined,
        error: 'TOKEN_ERROR',
      },
      window.location.origin
    );
  }
});