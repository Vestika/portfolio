import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '../firebase';
import { mixpanel } from '../lib/mixpanel';
import { hashEmail } from '../utils/privacy-sanitizer';
import { identify as userjamIdentify } from '../utils/userjam';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}



export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use Firebase authentication
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);

      // Track authentication events in Mixpanel
      if (user) {
        // User signed in - identify and track
        mixpanel.identify(user.uid);
        mixpanel.setUserProperties({
          user_id: user.uid,
          user_email_hash: hashEmail(user.email || ''),
          $name: user.displayName || undefined, // Mixpanel standard property (matches backend)
          account_creation_date: user.metadata.creationTime || new Date().toISOString(),
        } as any);
        mixpanel.track('auth_sign_in_success');

        // Identify user in Userjam
        userjamIdentify({
          name: user.displayName || user.email || 'Unknown User',
          email: user.email || undefined,
          created_at: user.metadata.creationTime || new Date().toISOString(),
        });
      } else {
        // User signed out - reset Mixpanel (no Userjam reset needed)
        mixpanel.reset();
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 