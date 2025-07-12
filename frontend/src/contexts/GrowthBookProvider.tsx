import React, { useEffect } from 'react';
import { GrowthBookProvider as GBProvider } from '@growthbook/growthbook-react';
import { growthbook, updateUserAttributes } from '../lib/growthbook';
import { useAuth } from './AuthContext';

interface GrowthBookProviderProps {
  children: React.ReactNode;
}

export const GrowthBookProvider: React.FC<GrowthBookProviderProps> = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    // Update user attributes when user changes
    if (user) {
      updateUserAttributes(user.uid);
    } else {
      // Clear attributes when user logs out
      updateUserAttributes(null);
    }
  }, [user]);



  return (
    <GBProvider growthbook={growthbook}>
      {children}
    </GBProvider>
  );
}; 