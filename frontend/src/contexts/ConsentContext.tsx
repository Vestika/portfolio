/**
 * Consent Management Context - Israeli Privacy Law Amendment 13 Compliance
 *
 * Manages user consent for analytics and marketing with MongoDB as source of truth.
 * Uses localStorage as performance cache to avoid API calls on every page load.
 *
 * Flow:
 * 1. Check localStorage cache on load
 * 2. Fetch from MongoDB to ensure sync across devices
 * 3. Update localStorage cache when consent changes
 * 4. Track consent grants in analytics (with consent!)
 */

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

interface ConsentStatus {
  analytics_consent: boolean;
  analytics_consent_date: string | null;
  marketing_consent: boolean;
  marketing_consent_date: string | null;
}

interface ConsentContextType {
  // Current consent status (null = loading)
  consentStatus: ConsentStatus | null;

  // Loading state
  isLoading: boolean;

  // Whether consent banner should be shown
  shouldShowBanner: boolean;

  // Update consent (calls MongoDB API)
  updateConsent: (analyticsConsent?: boolean, marketingConsent?: boolean) => Promise<void>;

  // Dismiss banner without accepting (user declined)
  dismissBanner: () => void;

  // Accept all consents
  acceptAll: () => Promise<void>;

  // Decline all consents
  declineAll: () => Promise<void>;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

const CONSENT_CACHE_KEY = 'vestika_consent_cache';
const BANNER_DISMISSED_KEY = 'vestika_consent_banner_dismissed';

interface ConsentProviderProps {
  children: ReactNode;
}

export const ConsentProvider: React.FC<ConsentProviderProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowBanner, setShouldShowBanner] = useState(false);

  // Load consent status after auth is ready
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Only fetch consent if user is authenticated
    if (user) {
      loadConsentStatus();
    } else {
      // User not logged in - set defaults
      const defaultConsent: ConsentStatus = {
        analytics_consent: false,
        analytics_consent_date: null,
        marketing_consent: false,
        marketing_consent_date: null
      };
      setConsentStatus(defaultConsent);
      setIsLoading(false);
      setShouldShowBanner(false); // Don't show banner when not logged in
    }
  }, [authLoading, user]);

  /**
   * Load consent status from MongoDB (via API)
   * Uses localStorage as cache to reduce API calls
   */
  const loadConsentStatus = async () => {
    try {
      setIsLoading(true);

      // 1. Check localStorage cache first (fast)
      const cachedConsent = localStorage.getItem(CONSENT_CACHE_KEY);
      if (cachedConsent) {
        const cached = JSON.parse(cachedConsent);
        setConsentStatus(cached);

        // Check if user has explicitly dismissed banner or made a choice
        const bannerDismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
        const hasConsented = cached.analytics_consent || cached.marketing_consent;
        setShouldShowBanner(!bannerDismissed && !hasConsented);
      } else {
        // No cache - show banner (user hasn't made a choice)
        setShouldShowBanner(true);
      }

      // 2. Fetch from MongoDB (source of truth) to ensure cross-device sync
      const response = await api.get<ConsentStatus>('/me/consent');
      const freshConsent = response.data;

      // 3. Update state and cache
      setConsentStatus(freshConsent);
      localStorage.setItem(CONSENT_CACHE_KEY, JSON.stringify(freshConsent));

      // Update banner visibility based on fresh data
      const bannerDismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
      const hasConsented = freshConsent.analytics_consent || freshConsent.marketing_consent;
      setShouldShowBanner(!bannerDismissed && !hasConsented);

    } catch (error) {
      console.error('Failed to load consent status:', error);

      // On error, default to no consent (privacy-first)
      const defaultConsent: ConsentStatus = {
        analytics_consent: false,
        analytics_consent_date: null,
        marketing_consent: false,
        marketing_consent_date: null
      };
      setConsentStatus(defaultConsent);
      setShouldShowBanner(true); // Show banner on error too
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update consent preferences (saves to MongoDB)
   */
  const updateConsent = async (
    analyticsConsent?: boolean,
    marketingConsent?: boolean
  ) => {
    try {
      const response = await api.post<ConsentStatus>('/me/consent', {
        analytics_consent: analyticsConsent,
        marketing_consent: marketingConsent
      });

      const updatedConsent = response.data;

      // Update state and cache
      setConsentStatus(updatedConsent);
      localStorage.setItem(CONSENT_CACHE_KEY, JSON.stringify(updatedConsent));

      // Hide banner after user makes a choice
      setShouldShowBanner(false);
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true');

      console.log('✅ Consent updated:', updatedConsent);
    } catch (error) {
      console.error('Failed to update consent:', error);
      throw error;
    }
  };

  /**
   * Accept all consents
   */
  const acceptAll = async () => {
    await updateConsent(true, true);
  };

  /**
   * Decline all consents
   */
  const declineAll = async () => {
    await updateConsent(false, false);
  };

  /**
   * Dismiss banner without making a choice (implicit decline)
   */
  const dismissBanner = () => {
    setShouldShowBanner(false);
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');

    // Ensure consent is set to false in MongoDB
    updateConsent(false, false).catch(error => {
      console.error('Failed to save consent decline:', error);
    });
  };

  return (
    <ConsentContext.Provider
      value={{
        consentStatus,
        isLoading,
        shouldShowBanner,
        updateConsent,
        dismissBanner,
        acceptAll,
        declineAll
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
};

/**
 * Hook to use consent context
 */
export const useConsent = (): ConsentContextType => {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
};

/**
 * Helper: Check if user has granted analytics consent
 * Use this before initializing analytics
 */
export const hasAnalyticsConsent = (consentStatus: ConsentStatus | null): boolean => {
  // Respect Do Not Track browser setting
  if (navigator.doNotTrack === '1') {
    return false;
  }

  return consentStatus?.analytics_consent ?? false;
};

/**
 * Helper: Check if user has granted marketing consent
 * Use this before sending marketing emails
 */
export const hasMarketingConsent = (consentStatus: ConsentStatus | null): boolean => {
  return consentStatus?.marketing_consent ?? false;
};
