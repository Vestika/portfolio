/**
 * Userjam Analytics Client
 *
 * Tracks UI interactions and page views.
 * Events follow naming convention: category.action_past_tense
 *
 * Frontend events:
 * - page.viewed - navigation tracking
 * - portfolio.switched - portfolio selection changed
 * - account.filtered - account filter applied
 * - modal.opened, modal.closed - modal interactions
 * - chart.viewed - chart type/view changed
 * - tool.used - financial calculator used
 * - tab.switched - tab navigation
 */

const USERJAM_ENDPOINT = 'https://api.userjam.com/api/report';
const API_KEY = import.meta.env.VITE_USERJAM_KEY;

interface TrackPayload {
  type: 'track';
  userId: string;
  event: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

interface IdentifyPayload {
  type: 'identify';
  userId: string;
  traits: Record<string, any>;
}

// Store user ID globally when user authenticates
let currentUserId: string | null = null;

/**
 * Set the current user ID.
 * Call this from AuthContext when user signs in.
 */
export function setUserId(userId: string | null): void {
  currentUserId = userId;
}

/**
 * Get current user ID.
 */
function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Track a user event.
 *
 * @param event Event name in format 'category.action_past_tense'
 * @param properties Optional event properties
 *
 * @example
 * track('portfolio.switched', {
 *   portfolio_id: 'port_123',
 *   portfolio_name: 'My 401k'
 * });
 */
export function track(event: string, properties?: Record<string, any>): void {
  if (!API_KEY) {
    console.debug('Userjam: No API key configured, skipping event:', event);
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    console.debug('Userjam: No user authenticated, skipping event:', event);
    return;
  }

  const payload: TrackPayload = {
    type: 'track',
    userId,
    event,
    properties: properties || {},
    timestamp: new Date().toISOString()
  };

  // Fire and forget
  fetch(USERJAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).catch(err => {
    console.error('Userjam track error:', err);
  });
}

/**
 * Identify a user with traits.
 *
 * Call on login and profile updates.
 *
 * @param traits User traits (name, email, created_at, etc.)
 *
 * @example
 * identify({
 *   name: 'Jane Doe',
 *   email: 'jane@example.com',
 *   created_at: '2023-01-15T08:30:00Z',
 *   portfolio_count: 3
 * });
 */
export function identify(traits: Record<string, any>): void {
  if (!API_KEY) {
    console.debug('Userjam: No API key configured, skipping identify');
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    console.debug('Userjam: No user authenticated, skipping identify');
    return;
  }

  const payload: IdentifyPayload = {
    type: 'identify',
    userId,
    traits
  };

  fetch(USERJAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).catch(err => {
    console.error('Userjam identify error:', err);
  });
}

/**
 * Track page view.
 * Call this when route changes.
 *
 * @param path Current path (e.g., '/portfolio', '/settings')
 * @param title Optional page title
 */
export function trackPageView(path: string, title?: string): void {
  track('page.viewed', {
    path,
    title: title || document.title,
    referrer: document.referrer || undefined
  });
}

/**
 * Track portfolio switch.
 *
 * @param portfolioId Portfolio ID
 * @param portfolioName Portfolio name
 */
export function trackPortfolioSwitch(portfolioId: string, portfolioName: string): void {
  track('portfolio.switched', {
    portfolio_id: portfolioId,
    portfolio_name: portfolioName
  });
}

/**
 * Track account filter change.
 *
 * @param portfolioId Portfolio ID
 * @param selectedAccounts Array of selected account IDs
 */
export function trackAccountFilter(portfolioId: string, selectedAccounts: string[]): void {
  track('account.filtered', {
    portfolio_id: portfolioId,
    account_count: selectedAccounts.length,
    account_ids: selectedAccounts
  });
}

/**
 * Track modal interaction.
 *
 * @param modalName Name of the modal
 * @param action 'opened' or 'closed'
 */
export function trackModal(modalName: string, action: 'opened' | 'closed'): void {
  track(`modal.${action}`, {
    modal_name: modalName
  });
}

/**
 * Track chart view change.
 *
 * @param chartType Type of chart being viewed
 * @param portfolioId Portfolio ID
 */
export function trackChartView(chartType: string, portfolioId: string): void {
  track('chart.viewed', {
    chart_type: chartType,
    portfolio_id: portfolioId
  });
}

/**
 * Track financial tool usage.
 *
 * @param toolName Name of the tool
 * @param properties Additional properties specific to the tool
 */
export function trackToolUsage(toolName: string, properties?: Record<string, any>): void {
  track('tool.used', {
    tool_name: toolName,
    ...properties
  });
}

/**
 * Track tab switch.
 *
 * @param tabName Name of the tab
 * @param view Current view context
 */
export function trackTabSwitch(tabName: string, view: string): void {
  track('tab.switched', {
    tab_name: tabName,
    view
  });
}
