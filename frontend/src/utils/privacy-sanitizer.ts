/**
 * Privacy Sanitizer Utility
 *
 * Ensures no sensitive financial data or PII is sent to Mixpanel.
 * All data must be validated before tracking.
 */

import type {
  SafeHoldingData,
  SafeAccountData,
  SafePortfolioData,
} from '../types/mixpanel';

/**
 * Blacklisted property names that should NEVER be sent to Mixpanel
 * These represent sensitive financial data or PII
 */
export const BLACKLISTED_PROPERTIES: readonly string[] = [
  // Financial values
  'price',
  'value',
  'amount',
  'balance',
  'cost',
  'total',
  'gain',
  'loss',
  'profit',
  'return',
  'dividend',
  'yield',
  'income',
  'worth',
  'cash',

  // Holdings
  'symbol',
  'ticker',
  'holding',
  'position',
  'units',
  'shares',
  'quantity',

  // Personal info
  'name',
  'email',
  'phone',
  'address',
  'account_name',
  'tag_name',
  'custom_name',

  // Location
  'street',
  'city',
  'zip',
  'postal',
  'latitude',
  'longitude',
  'location',

  // Authentication
  'password',
  'token',
  'api_key',
  'secret',
  'auth',
] as const;

/**
 * Whitelisted user identity properties that are allowed for user identification
 * These are exempt from blacklist checks when setting user properties
 */
export const USER_IDENTITY_WHITELIST: readonly string[] = [
  'user_id',
  'user_email_hash',
  '$name', // Mixpanel standard property for display name (matches backend)
  '$email', // Mixpanel standard property for email
  'account_creation_date',
] as const;

/**
 * Check if a property key is safe to send to Mixpanel
 */
export function isPropertySafe(key: string, value: any): boolean {
  const lowerKey = key.toLowerCase();

  // Check whitelist first - user identity properties are always allowed
  for (const whitelisted of USER_IDENTITY_WHITELIST) {
    if (lowerKey === whitelisted.toLowerCase()) {
      return true;
    }
  }

  // Check against blacklist
  for (const blacklisted of BLACKLISTED_PROPERTIES) {
    if (lowerKey.includes(blacklisted)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Mixpanel Privacy] Blocked property "${key}" - contains blacklisted term "${blacklisted}"`
        );
      }
      return false;
    }
  }

  // Check value type - don't send objects or arrays (except null/undefined)
  if (value !== null && value !== undefined && typeof value === 'object') {
    if (import.meta.env.DEV) {
      console.warn(
        `[Mixpanel Privacy] Blocked property "${key}" - complex objects not allowed`
      );
    }
    return false;
  }

  return true;
}

/**
 * Validate and sanitize event properties
 * Removes any blacklisted properties and warns in development
 */
export function validateEventProperties(
  properties: Record<string, any>
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    }

    if (isPropertySafe(key, value)) {
      // Only allow primitive types
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize holding data to remove sensitive financial information
 * Returns only metadata about the holding
 */
export function sanitizeHolding(holding: any): SafeHoldingData {
  return {
    security_type: holding.security_type || 'unknown',
    has_custom_price: !!holding.custom_price,
    is_custom: !!holding.is_custom,
  };
}

/**
 * Sanitize account data to remove sensitive information
 * Returns only metadata about the account
 */
export function sanitizeAccount(account: any): SafeAccountData {
  return {
    account_type: account.account_type || 'unknown',
    holdings_count: Array.isArray(account.holdings) ? account.holdings.length : 0,
    has_rsu_plans: Array.isArray(account.rsu_plans) && account.rsu_plans.length > 0,
    has_espp_plans:
      Array.isArray(account.espp_plans) && account.espp_plans.length > 0,
    has_options_plans:
      Array.isArray(account.options_plans) && account.options_plans.length > 0,
  };
}

/**
 * Sanitize portfolio data to remove sensitive information
 * Returns only metadata about the portfolio
 */
export function sanitizePortfolio(portfolio: any): SafePortfolioData {
  const accounts = portfolio.accounts || [];
  const totalHoldings = accounts.reduce(
    (sum: number, account: any) =>
      sum + (Array.isArray(account.holdings) ? account.holdings.length : 0),
    0
  );

  return {
    portfolio_id_hash: hashId(portfolio.portfolio_id || ''),
    base_currency: portfolio.base_currency || 'USD',
    accounts_count: accounts.length,
    total_holdings_count: totalHoldings,
  };
}

/**
 * Hash a sensitive ID to anonymize it
 * Uses simple hash function for client-side hashing
 */
export function hashId(id: string): string {
  if (!id) return 'unknown';

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Hash an email address for privacy
 * Returns first 8 characters of hashed email
 */
export function hashEmail(email: string): string {
  if (!email) return 'unknown';

  const hash = hashId(email.toLowerCase());
  return hash.substring(0, 8);
}

/**
 * Recursively sanitize a nested object
 * Removes all blacklisted properties at any depth
 */
export function deepSanitize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isPropertySafe(key, value)) {
        if (typeof value === 'object') {
          sanitized[key] = deepSanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Generate session ID for tracking user sessions
 */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if Do Not Track is enabled
 */
export function isDoNotTrackEnabled(): boolean {
  const DNT =
    navigator.doNotTrack ||
    (window as any).doNotTrack ||
    (navigator as any).msDoNotTrack;
  return DNT === '1' || DNT === 'yes';
}

/**
 * Get viewport dimensions for analytics
 */
export function getViewportDimensions(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
