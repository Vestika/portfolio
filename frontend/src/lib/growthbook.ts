import { GrowthBook } from '@growthbook/growthbook-react';

// Initialize GrowthBook
export const growthbook = new GrowthBook({
  apiHost: import.meta.env.VITE_GROWTHBOOK_API_HOST || 'https://cdn.growthbook.io',
  clientKey: import.meta.env.VITE_GROWTHBOOK_CLIENT_KEY || '',
  enableDevMode: import.meta.env.DEV,
  // Set initial attributes (will be updated when user logs in)
  attributes: {
    id: null, // Will be set to userId when available
  },
  trackingCallback: (experiment, result) => {
    // Track experiment views
    console.log('Experiment viewed:', {
      experimentId: experiment.key,
      variationId: result.key,
    });
  },
});

// Initialize GrowthBook to load features
growthbook.init({
  // Optional: enable streaming updates
  streaming: true
});

// Feature flag definitions
export const FEATURE_FLAGS = {
  aiChat: 'aiChat',
  frontendPortfolioCalc: 'frontendPortfolioCalc',
} as const;

export type FeatureFlags = typeof FEATURE_FLAGS;

// Helper function to update user attributes
export const updateUserAttributes = (userId: string | null) => {
  growthbook.setAttributes({
    id: userId,
  });
}; 