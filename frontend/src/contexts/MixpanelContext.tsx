/**
 * Mixpanel React Context
 *
 * Provides Mixpanel tracking functionality throughout the React app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { mixpanel } from '../lib/mixpanel';
import { generateSessionId, getViewportDimensions } from '../utils/privacy-sanitizer';
import type { UserProperties } from '../types/mixpanel';

/**
 * Mixpanel Context Type
 */
interface MixpanelContextType {
  track: (eventName: string, properties?: Record<string, any>) => void;
  identify: (userId: string, traits?: Record<string, any>) => void;
  setUserProperties: (properties: Partial<UserProperties>) => void;
  timeEvent: (eventName: string) => void;
  isInitialized: boolean;
  sessionId: string;
}

/**
 * Create Context
 */
const MixpanelContext = createContext<MixpanelContextType | undefined>(undefined);

/**
 * Mixpanel Provider Props
 */
interface MixpanelProviderProps {
  children: ReactNode;
}

/**
 * Mixpanel Provider Component
 */
export const MixpanelProvider: React.FC<MixpanelProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId] = useState(() => generateSessionId());

  // Initialize Mixpanel on mount
  useEffect(() => {
    try {
      mixpanel.init();
      setIsInitialized(mixpanel.isInitialized());

      if (mixpanel.isInitialized()) {
        // Set initial super properties
        const viewport = getViewportDimensions();
        mixpanel.setUserProperties({
          platform: 'web',
          viewport_width: viewport.width,
          viewport_height: viewport.height,
        } as Partial<UserProperties>);
      }
    } catch (error) {
      console.error('[MixpanelContext] Initialization error:', error);
    }
  }, []);

  // Update viewport dimensions on resize
  useEffect(() => {
    if (!mixpanel.isInitialized()) return;

    const handleResize = () => {
      const viewport = getViewportDimensions();
      mixpanel.setUserProperties({
        viewport_width: viewport.width,
        viewport_height: viewport.height,
      } as Partial<UserProperties>);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Track event wrapper
   */
  const track = (eventName: string, properties?: Record<string, any>) => {
    mixpanel.track(eventName, {
      ...properties,
      session_id: sessionId,
    });
  };

  /**
   * Identify user wrapper
   */
  const identify = (userId: string, traits?: Record<string, any>) => {
    mixpanel.identify(userId, traits);
  };

  /**
   * Set user properties wrapper
   */
  const setUserProperties = (properties: Partial<UserProperties>) => {
    mixpanel.setUserProperties(properties);
  };

  /**
   * Time event wrapper
   */
  const timeEvent = (eventName: string) => {
    mixpanel.timeEvent(eventName);
  };

  const value: MixpanelContextType = {
    track,
    identify,
    setUserProperties,
    timeEvent,
    isInitialized,
    sessionId,
  };

  return <MixpanelContext.Provider value={value}>{children}</MixpanelContext.Provider>;
};

/**
 * useMixpanel Hook
 *
 * Access Mixpanel functionality from any component
 */
export const useMixpanel = (): MixpanelContextType => {
  const context = useContext(MixpanelContext);
  if (context === undefined) {
    throw new Error('useMixpanel must be used within a MixpanelProvider');
  }
  return context;
};

/**
 * Export context for testing
 */
export { MixpanelContext };
