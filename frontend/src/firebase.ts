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

// Expose auth to window for browser extension access
if (typeof window !== 'undefined') {
  (window as any).__FIREBASE_AUTH__ = auth;
  console.log('[Firebase] Auth exposed to window for extension');
}

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