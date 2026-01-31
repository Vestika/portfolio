/**
 * Userjam Analytics Client
 *
 * Usage:
 *   import { track, identify } from '@/utils/userjam';
 *
 *   // Track events
 *   track('portfolio.created', { portfolio_id: '123', base_currency: 'USD' });
 *
 *   // Identify users
 *   identify({
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     created_at: '2024-01-01T00:00:00Z'
 *   });
 *
 * Event Naming Convention:
 *   - Format: category.action_past_tense
 *   - Use snake_case
 *   - Examples: portfolio.created, modal.opened, settings.updated
 */

const USERJAM_ENDPOINT = 'https://api.userjam.com/api/report';
const API_KEY = import.meta.env.VITE_USERJAM_KEY;

interface TrackProperties {
  [key: string]: any;
}

interface UserTraits {
  name?: string;
  email?: string;
  created_at?: string;
  [key: string]: any;
}

import { getCurrentUser } from '../firebase';

/**
 * Get the current user ID from Firebase auth
 */
function getUserId(): string | null {
  const user = getCurrentUser();
  return user?.uid || null;
}

/**
 * Track an analytics event (non-blocking)
 *
 * @param event - Event name in format "category.action_past_tense"
 * @param properties - Additional event properties (rich metadata encouraged)
 */
export function track(event: string, properties?: TrackProperties): void {
  if (!API_KEY) {
    console.warn('[Userjam] No API key configured');
    return;
  }

  const userId = getUserId();
  if (!userId) {
    console.warn('[Userjam] No user ID available, skipping event:', event);
    return;
  }

  try {
    // Fire and forget - don't await or block the UI
    fetch(USERJAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'track',
        userId,
        event,
        properties: properties || {},
        timestamp: new Date().toISOString()
      })
    }).catch((error) => {
      console.error('[Userjam] Failed to track event:', event, error);
    });
  } catch (error) {
    console.error('[Userjam] Error tracking event:', event, error);
  }
}

/**
 * Identify a user and set their traits
 * Call on signup, login, or profile update
 *
 * @param traits - User traits including name, email, created_at, etc.
 */
export function identify(traits: UserTraits): void {
  if (!API_KEY) {
    console.warn('[Userjam] No API key configured');
    return;
  }

  const userId = getUserId();
  if (!userId) {
    console.warn('[Userjam] No user ID available, skipping identify');
    return;
  }

  try {
    // Fire and forget - don't await or block the UI
    fetch(USERJAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'identify',
        userId,
        traits
      })
    }).catch((error) => {
      console.error('[Userjam] Failed to identify user:', error);
    });
  } catch (error) {
    console.error('[Userjam] Error identifying user:', error);
  }
}

/**
 * Track page navigation
 * Call this when the user navigates to a new page
 *
 * @param path - Current page path (e.g., '/dashboard', '/portfolio/123')
 * @param title - Page title (optional)
 */
export function trackPageView(path: string, title?: string): void {
  track('page.viewed', {
    path,
    title: title || document.title,
    referrer: document.referrer
  });
}

/**
 * Track modal interactions
 *
 * @param modalName - Name of the modal (e.g., 'add_holding', 'settings')
 * @param action - Action performed ('opened' or 'closed')
 */
export function trackModal(modalName: string, action: 'opened' | 'closed'): void {
  track(`modal.${action}`, {
    modal_name: modalName
  });
}
