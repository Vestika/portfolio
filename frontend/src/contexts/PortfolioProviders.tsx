import React from 'react';
import { AuthProvider } from './AuthContext';
import { PortfolioDataProvider } from './PortfolioDataContext'; // Back to original full-featured version
import { GrowthBookProvider } from './GrowthBookProvider';
import { MixpanelProvider } from './MixpanelContext';

interface PortfolioProvidersProps {
  children: React.ReactNode;
}

/**
 * Combines all portfolio-related providers in the correct order
 */
export const PortfolioProviders: React.FC<PortfolioProvidersProps> = ({ children }) => {
  console.log('🔧 [PROVIDERS] Initializing portfolio providers stack with simple context');

  return (
    <AuthProvider>
      <GrowthBookProvider>
        <MixpanelProvider>
          <PortfolioDataProvider>
            {children}
          </PortfolioDataProvider>
        </MixpanelProvider>
      </GrowthBookProvider>
    </AuthProvider>
  );
};
