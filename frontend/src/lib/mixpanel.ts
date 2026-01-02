/**
 * Mixpanel Core Library
 *
 * Wrapper around Mixpanel SDK with privacy safeguards and graceful degradation
 */

import mixpanelBrowser from 'mixpanel-browser';
import type { MixpanelConfig, UserProperties } from '../types/mixpanel';
import {
  validateEventProperties,
  isDoNotTrackEnabled,
  getViewportDimensions,
  hashEmail,
} from '../utils/privacy-sanitizer';

// Environment variables
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
const MIXPANEL_DEBUG = import.meta.env.VITE_MIXPANEL_DEBUG === 'true';
const IS_DEV = import.meta.env.DEV;

// Track initialization state
let isInitialized = false;
let isDisabled = false;

/**
 * Initialize Mixpanel with privacy-first configuration
 */
export function initializeMixpanel(
  token?: string,
  config?: Partial<MixpanelConfig>
): void {
  const finalToken = token || MIXPANEL_TOKEN;

  // Check if token exists
  if (!finalToken || finalToken === 'your_mixpanel_project_token_here') {
    console.warn(
      '[Mixpanel] Token not configured. Analytics disabled. Set VITE_MIXPANEL_TOKEN in .env'
    );
    isDisabled = true;
    return;
  }

  // Check for Do Not Track
  if (isDoNotTrackEnabled()) {
    console.log('[Mixpanel] Do Not Track enabled. Analytics disabled.');
    isDisabled = true;
    return;
  }

  try {
    mixpanelBrowser.init(finalToken, {
      debug: MIXPANEL_DEBUG || IS_DEV,
      track_pageview: false, // We'll track manually
      persistence: 'localStorage',
      ip: false, // Privacy: don't track IP addresses
      property_blacklist: [], // We handle blacklisting ourselves
      ...config,
    });

    isInitialized = true;
    console.log('[Mixpanel] Initialized successfully');
  } catch (error) {
    console.error('[Mixpanel] Initialization error:', error);
    isDisabled = true;
  }
}

/**
 * Track an event with privacy-validated properties
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (isDisabled || !isInitialized) {
    if (IS_DEV) {
      console.log(`[Mixpanel] Would track: ${eventName}`, properties);
    }
    return;
  }

  try {
    const sanitizedProperties = properties
      ? validateEventProperties(properties)
      : {};

    // Add timestamp
    const finalProperties = {
      ...sanitizedProperties,
      timestamp: Date.now(),
    };

    mixpanelBrowser.track(eventName, finalProperties);

    if (IS_DEV || MIXPANEL_DEBUG) {
      console.log(`[Mixpanel] Event tracked: ${eventName}`, finalProperties);
    }
  } catch (error) {
    console.error(`[Mixpanel] Error tracking event "${eventName}":`, error);
  }
}

/**
 * Identify a user in Mixpanel
 */
export function identifyUser(userId: string, traits?: Record<string, any>): void {
  if (isDisabled || !isInitialized) {
    if (IS_DEV) {
      console.log(`[Mixpanel] Would identify user: ${userId}`, traits);
    }
    return;
  }

  try {
    mixpanelBrowser.identify(userId);

    if (traits) {
      const sanitizedTraits = validateEventProperties(traits);
      mixpanelBrowser.people.set(sanitizedTraits);
    }

    if (IS_DEV || MIXPANEL_DEBUG) {
      console.log(`[Mixpanel] User identified: ${userId}`);
    }
  } catch (error) {
    console.error('[Mixpanel] Error identifying user:', error);
  }
}

/**
 * Set user properties (super properties)
 * These persist across all events for the user
 */
export function setUserProperties(properties: Partial<UserProperties>): void {
  if (isDisabled || !isInitialized) {
    if (IS_DEV) {
      console.log('[Mixpanel] Would set user properties:', properties);
    }
    return;
  }

  try {
    const sanitizedProperties = validateEventProperties(properties as any);

    // Set as super properties (sent with every event)
    mixpanelBrowser.register(sanitizedProperties);

    // Also set on user profile
    mixpanelBrowser.people.set(sanitizedProperties);

    if (IS_DEV || MIXPANEL_DEBUG) {
      console.log('[Mixpanel] User properties set:', sanitizedProperties);
    }
  } catch (error) {
    console.error('[Mixpanel] Error setting user properties:', error);
  }
}

/**
 * Set user properties that will only be set once
 */
export function setUserPropertiesOnce(properties: Partial<UserProperties>): void {
  if (isDisabled || !isInitialized) {
    return;
  }

  try {
    const sanitizedProperties = validateEventProperties(properties as any);
    mixpanelBrowser.register_once(sanitizedProperties);
    mixpanelBrowser.people.set_once(sanitizedProperties);
  } catch (error) {
    console.error('[Mixpanel] Error setting user properties once:', error);
  }
}

/**
 * Start timing an event
 * Call trackEvent with the same event name to record duration
 */
export function timeEvent(eventName: string): void {
  if (isDisabled || !isInitialized) {
    return;
  }

  try {
    mixpanelBrowser.time_event(eventName);
  } catch (error) {
    console.error('[Mixpanel] Error timing event:', error);
  }
}

/**
 * Reset Mixpanel state (e.g., on logout)
 */
export function resetMixpanel(): void {
  if (isDisabled || !isInitialized) {
    return;
  }

  try {
    mixpanelBrowser.reset();
    if (IS_DEV || MIXPANEL_DEBUG) {
      console.log('[Mixpanel] State reset');
    }
  } catch (error) {
    console.error('[Mixpanel] Error resetting:', error);
  }
}

/**
 * Opt user out of tracking
 */
export function optOutOfTracking(): void {
  if (isDisabled || !isInitialized) {
    return;
  }

  try {
    mixpanelBrowser.opt_out_tracking();
    localStorage.setItem('mixpanel_opt_out', 'true');
    console.log('[Mixpanel] User opted out of tracking');
  } catch (error) {
    console.error('[Mixpanel] Error opting out:', error);
  }
}

/**
 * Opt user back into tracking
 */
export function optInToTracking(): void {
  if (isDisabled || !isInitialized) {
    return;
  }

  try {
    mixpanelBrowser.opt_in_tracking();
    localStorage.removeItem('mixpanel_opt_out');
    console.log('[Mixpanel] User opted into tracking');
  } catch (error) {
    console.error('[Mixpanel] Error opting in:', error);
  }
}

/**
 * Get the current distinct ID
 */
export function getDistinctId(): string {
  if (isDisabled || !isInitialized) {
    return 'unknown';
  }

  try {
    return mixpanelBrowser.get_distinct_id();
  } catch (error) {
    console.error('[Mixpanel] Error getting distinct ID:', error);
    return 'unknown';
  }
}

/**
 * Check if Mixpanel is initialized
 */
export function getIsInitialized(): boolean {
  return isInitialized && !isDisabled;
}

/**
 * Mixpanel singleton instance with convenience methods
 */
export const mixpanel = {
  init: initializeMixpanel,
  track: trackEvent,
  identify: identifyUser,
  setUserProperties,
  setUserPropertiesOnce,
  timeEvent,
  reset: resetMixpanel,
  optOut: optOutOfTracking,
  optIn: optInToTracking,
  getDistinctId,
  isInitialized: getIsInitialized,
};

// Export default
export default mixpanel;
