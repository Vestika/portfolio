/**
 * Mixpanel TypeScript Type Definitions
 *
 * Defines all types used for Mixpanel analytics integration
 */

/**
 * Mixpanel configuration options
 */
export interface MixpanelConfig {
  token: string;
  debug?: boolean;
  track_pageview?: boolean;
  persistence?: 'localStorage' | 'cookie';
  ip?: boolean;
  property_blacklist?: string[];
}

/**
 * Generic event properties that can be attached to any event
 */
export interface EventProperties {
  event_name: string;
  timestamp: number;
  session_id: string;
  current_view?: NavigationView;
  previous_view?: NavigationView;
  [key: string]: string | number | boolean | undefined;
}

/**
 * User properties (super properties) set on user identification
 * These persist across all events for the user
 */
export interface UserProperties {
  user_id: string;
  user_email_hash: string;
  account_creation_date: string;
  total_portfolios: number;
  total_accounts: number;
  total_holdings: number;
  has_used_ai_chat: boolean;
  has_created_custom_tags: boolean;
  has_created_custom_charts: boolean;
  has_used_tools: boolean;
  preferred_currency: string;
  platform: 'web';
  viewport_width: number;
  viewport_height: number;
}

/**
 * Privacy-safe holding data (no sensitive financial info)
 */
export interface SafeHoldingData {
  security_type: string;
  has_custom_price: boolean;
  is_custom: boolean;
}

/**
 * Privacy-safe account data (no account names or balances)
 */
export interface SafeAccountData {
  account_type: string;
  holdings_count: number;
  has_rsu_plans: boolean;
  has_espp_plans: boolean;
  has_options_plans: boolean;
}

/**
 * Privacy-safe portfolio data (no values or names)
 */
export interface SafePortfolioData {
  portfolio_id_hash: string;
  base_currency: string;
  accounts_count: number;
  total_holdings_count: number;
}

/**
 * Navigation view types in the application
 */
export type NavigationView =
  | 'portfolios'
  | 'cashflow'
  | 'news'
  | 'analyst'
  | 'tags'
  | 'tools'
  | 'config-gallery'
  | 'import';

/**
 * User traits for identification
 */
export interface UserTraits {
  email?: string;
  name?: string;
  created_at?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Mixpanel instance interface
 */
export interface MixpanelInstance {
  init: (token: string, config?: Partial<MixpanelConfig>) => void;
  track: (eventName: string, properties?: Record<string, any>) => void;
  identify: (userId: string) => void;
  people: {
    set: (properties: Record<string, any>) => void;
    set_once: (properties: Record<string, any>) => void;
  };
  register: (properties: Record<string, any>) => void;
  register_once: (properties: Record<string, any>) => void;
  reset: () => void;
  opt_out_tracking: () => void;
  opt_in_tracking: () => void;
  time_event: (eventName: string) => void;
  get_distinct_id: () => string;
}
