/**
 * Portfolio Cache Service
 *
 * IndexedDB-based client-side cache for portfolio data using stale-while-revalidate pattern.
 * Provides instant app loads by showing cached data immediately while fetching fresh data in background.
 *
 * Key Features:
 * - 5-minute TTL for cache freshness
 * - User-isolated cache (prevents cross-user data leaks)
 * - Graceful degradation on IndexedDB failures
 * - Automatic cache invalidation on logout
 */

import { get, set, del, clear } from 'idb-keyval';
import { AllPortfoliosData } from '@/types/portfolio-types';

// Cache keys
const CACHE_KEYS = {
  DATA: 'vestika:portfolios:data',
  TIMESTAMP: 'vestika:portfolios:timestamp',
  USER_ID: 'vestika:portfolios:user',
} as const;

// Cache configuration
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cached portfolio data structure
 */
export interface CachedPortfolioData {
  data: AllPortfoliosData;
  timestamp: number;
  userId: string;
}

/**
 * Get cached portfolio data for a specific user
 *
 * @param userId - Firebase user ID
 * @returns Cached data or null if cache miss or error
 */
export async function getCachedPortfolios(userId: string): Promise<CachedPortfolioData | null> {
  try {
    const [data, timestamp, cachedUserId] = await Promise.all([
      get<AllPortfoliosData>(CACHE_KEYS.DATA),
      get<number>(CACHE_KEYS.TIMESTAMP),
      get<string>(CACHE_KEYS.USER_ID),
    ]);

    // Validate cache exists and belongs to current user
    if (!data || !timestamp || !cachedUserId || cachedUserId !== userId) {
      console.log('[PortfolioCache] Cache miss or user mismatch');
      return null;
    }

    console.log('[PortfolioCache] Cache hit', {
      userId,
      age: Date.now() - timestamp,
      portfolioCount: data.portfolios.length,
    });

    return {
      data,
      timestamp,
      userId: cachedUserId,
    };
  } catch (error) {
    // Gracefully handle IndexedDB errors (Safari private mode, quota exceeded, etc.)
    console.warn('[PortfolioCache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Store portfolio data in cache
 *
 * @param userId - Firebase user ID
 * @param data - Portfolio data to cache
 */
export async function setCachedPortfolios(
  userId: string,
  data: AllPortfoliosData
): Promise<void> {
  try {
    const timestamp = Date.now();

    await Promise.all([
      set(CACHE_KEYS.DATA, data),
      set(CACHE_KEYS.TIMESTAMP, timestamp),
      set(CACHE_KEYS.USER_ID, userId),
    ]);

    console.log('[PortfolioCache] Cache updated', {
      userId,
      timestamp,
      portfolioCount: data.portfolios.length,
      sizeEstimate: JSON.stringify(data).length,
    });
  } catch (error) {
    // Gracefully handle storage errors (quota exceeded, etc.)
    console.warn('[PortfolioCache] Failed to write cache:', error);
    // Don't throw - failing to cache shouldn't break the app
  }
}

/**
 * Check if cached data is still fresh based on TTL
 *
 * @param timestamp - When the cache was created
 * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
 * @returns True if cache is still fresh
 */
export function isCacheFresh(timestamp: number, ttlMs: number = DEFAULT_TTL_MS): boolean {
  const age = Date.now() - timestamp;
  const isFresh = age < ttlMs;

  console.log('[PortfolioCache] Cache freshness check', {
    age: Math.round(age / 1000),
    ttl: Math.round(ttlMs / 1000),
    isFresh,
  });

  return isFresh;
}

/**
 * Invalidate all cached data
 * Call this on logout or when forcing a refresh
 */
export async function invalidateCache(): Promise<void> {
  try {
    await Promise.all([
      del(CACHE_KEYS.DATA),
      del(CACHE_KEYS.TIMESTAMP),
      del(CACHE_KEYS.USER_ID),
    ]);
    console.log('[PortfolioCache] Cache invalidated');
  } catch (error) {
    console.warn('[PortfolioCache] Failed to invalidate cache:', error);
    // Try nuclear option - clear everything
    try {
      await clear();
      console.log('[PortfolioCache] All IndexedDB cleared');
    } catch (clearError) {
      console.warn('[PortfolioCache] Failed to clear IndexedDB:', clearError);
    }
  }
}

/**
 * Get cache age in seconds for debugging/display
 *
 * @param timestamp - When the cache was created
 * @returns Age in seconds, or null if no timestamp
 */
export function getCacheAge(timestamp: number | null): number | null {
  if (!timestamp) return null;
  return Math.floor((Date.now() - timestamp) / 1000);
}
