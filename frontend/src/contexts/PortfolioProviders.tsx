import React from 'react';
import { AuthProvider } from './AuthContext';
import { PortfolioDataProvider } from './PortfolioDataContext'; // Back to original full-featured version
import { GrowthBookProvider } from './GrowthBookProvider';
import { MixpanelProvider } from './MixpanelContext';
import { ConsentProvider } from './ConsentContext';

interface PortfolioProvidersProps {
  children: React.ReactNode;
}

/**
 * Combines all portfolio-related providers in the correct order
 *
 * **Provider Hierarchy (Privacy Compliance):**
 * 1. AuthProvider - User authentication
 * 2. GrowthBookProvider - Feature flags
 * 3. ConsentProvider - Privacy consent (Amendment 13 compliance)
 * 4. MixpanelProvider - Analytics (requires consent)
 * 5. PortfolioDataProvider - Portfolio data
 *
 * **Important:** ConsentProvider must come BEFORE MixpanelProvider
 * so that Mixpanel only initializes if user has granted consent.
 */
export const PortfolioProviders: React.FC<PortfolioProvidersProps> = ({ children }) => {
  console.log('🔧 [PROVIDERS] Initializing portfolio providers stack with consent management');

  return (
    <AuthProvider>
      <GrowthBookProvider>
        <ConsentProvider>
          <MixpanelProvider>
            <PortfolioDataProvider>
              {children}
            </PortfolioDataProvider>
          </MixpanelProvider>
        </ConsentProvider>
      </GrowthBookProvider>
    </AuthProvider>
  );
};
