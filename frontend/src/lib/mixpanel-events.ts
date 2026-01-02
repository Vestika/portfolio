/**
 * Mixpanel Event Taxonomy
 *
 * Centralized event names and helper functions for consistent tracking
 * Event naming convention: {category}_{action}_{object?}
 */

import { mixpanel } from './mixpanel';
import type { NavigationView } from '../types/mixpanel';

/**
 * Event name constants organized by category
 */
export const MIXPANEL_EVENTS = {
  // Authentication events
  AUTH: {
    SIGN_IN_SUCCESS: 'auth_sign_in_success',
    SIGN_IN_FAILED: 'auth_sign_in_failed',
    SIGN_OUT: 'auth_sign_out',
  },

  // Portfolio events
  PORTFOLIO: {
    CREATED: 'portfolio_created',
    SWITCHED: 'portfolio_switched',
    DELETED: 'portfolio_deleted',
    DATA_LOADED: 'portfolio_data_loaded',
    DATA_LOAD_FAILED: 'portfolio_data_load_failed',
  },

  // Account events
  ACCOUNT: {
    CREATED: 'account_created',
    FILTERED: 'account_filtered',
    DELETED: 'account_deleted',
  },

  // Navigation events
  NAVIGATION: {
    PAGE_VIEW: 'navigation_page_view',
    VIEW_CHANGED: 'navigation_view_changed',
    SESSION_START: 'navigation_session_start',
    SESSION_END: 'navigation_session_end',
    TIME_IN_VIEW: 'navigation_time_in_view',
  },

  // Feature usage events
  FEATURE: {
    AI_CHAT_OPENED: 'feature_ai_chat_opened',
    AI_CHAT_MESSAGE_SENT: 'feature_ai_chat_message_sent',
    AI_CHAT_ENTITY_TAGGED: 'feature_ai_chat_entity_tagged',
    NEWS_FEED_OPENED: 'feature_news_feed_opened',
    NEWS_WORD_CLOUD_CLICKED: 'feature_news_word_cloud_clicked',
    NEWS_ARTICLE_CLICKED: 'feature_news_article_clicked',
    TAGS_DEFINITION_CREATED: 'feature_tags_definition_created',
    TAGS_DEFINITION_EDITED: 'feature_tags_definition_edited',
    TAGS_DEFINITION_DELETED: 'feature_tags_definition_deleted',
    TAGS_APPLIED_TO_HOLDING: 'feature_tags_applied_to_holding',
    TAGS_CUSTOM_CHART_CREATED: 'feature_tags_custom_chart_created',
    TOOLS_CALCULATOR_USED: 'feature_tools_calculator_used',
    TOOLS_RESULT_VIEWED: 'feature_tools_result_viewed',
  },

  // Holdings events
  HOLDING: {
    ADDED: 'holding_added',
    REMOVED: 'holding_removed',
    VALUE_TOGGLED: 'holding_value_toggled',
  },

  // Onboarding / Activation milestone events
  ONBOARDING: {
    STARTED: 'onboarding_started',
    FIRST_PORTFOLIO_CREATED: 'onboarding_first_portfolio_created',
    FIRST_ACCOUNT_CREATED: 'onboarding_first_account_created',
    FIRST_HOLDING_ADDED: 'onboarding_first_holding_added',
    FIRST_TAG_CREATED: 'onboarding_first_tag_created',
    FIRST_TAG_APPLIED: 'onboarding_first_tag_applied',
    FIRST_AI_CHAT_MESSAGE: 'onboarding_first_ai_chat_message',
    FIRST_TOOL_USED: 'onboarding_first_tool_used',
    VIEWED_NEWS: 'onboarding_viewed_news',
    CREATED_CUSTOM_CHART: 'onboarding_created_custom_chart',
    FULLY_ACTIVATED: 'onboarding_fully_activated',
  },

  // Data loading events
  DATA: {
    AUTOCOMPLETE_LOADED: 'data_autocomplete_loaded',
    PRICES_LOADED: 'data_prices_loaded',
    HISTORICAL_PRICES_LOADED: 'data_historical_prices_loaded',
  },
} as const;

/**
 * Helper: Track page view
 */
export function trackPageView(view: NavigationView, path: string): void {
  mixpanel.track(MIXPANEL_EVENTS.NAVIGATION.PAGE_VIEW, {
    view,
    path,
  });
}

/**
 * Helper: Track navigation view change
 */
export function trackViewChanged(
  fromView: NavigationView | undefined,
  toView: NavigationView,
  isMobile?: boolean
): void {
  mixpanel.track(MIXPANEL_EVENTS.NAVIGATION.VIEW_CHANGED, {
    from_view: fromView || 'unknown',
    to_view: toView,
    is_mobile: !!isMobile,
  });
}

/**
 * Helper: Track session start
 */
export function trackSessionStart(sessionId: string): void {
  mixpanel.track(MIXPANEL_EVENTS.NAVIGATION.SESSION_START, {
    session_id: sessionId,
  });
}

/**
 * Helper: Track session end
 */
export function trackSessionEnd(sessionId: string, duration: number): void {
  mixpanel.track(MIXPANEL_EVENTS.NAVIGATION.SESSION_END, {
    session_id: sessionId,
    session_duration_ms: duration,
  });
}

/**
 * Helper: Track time spent in a view
 */
export function trackTimeInView(view: NavigationView, timeMs: number): void {
  mixpanel.track(MIXPANEL_EVENTS.NAVIGATION.TIME_IN_VIEW, {
    view,
    time_spent_ms: timeMs,
  });
}

/**
 * Helper: Track portfolio action (create, switch, delete)
 */
export function trackPortfolioAction(
  action: 'created' | 'switched' | 'deleted',
  metadata: Record<string, any>
): void {
  const eventName = {
    created: MIXPANEL_EVENTS.PORTFOLIO.CREATED,
    switched: MIXPANEL_EVENTS.PORTFOLIO.SWITCHED,
    deleted: MIXPANEL_EVENTS.PORTFOLIO.DELETED,
  }[action];

  mixpanel.track(eventName, metadata);
}

/**
 * Helper: Track account action (created, filtered, deleted)
 */
export function trackAccountAction(
  action: 'created' | 'filtered' | 'deleted',
  metadata: Record<string, any>
): void {
  const eventName = {
    created: MIXPANEL_EVENTS.ACCOUNT.CREATED,
    filtered: MIXPANEL_EVENTS.ACCOUNT.FILTERED,
    deleted: MIXPANEL_EVENTS.ACCOUNT.DELETED,
  }[action];

  mixpanel.track(eventName, metadata);
}

/**
 * Helper: Track feature usage
 */
export function trackFeatureUsage(
  feature: string,
  action: string,
  metadata?: Record<string, any>
): void {
  const eventName = `feature_${feature}_${action}`;
  mixpanel.track(eventName, metadata || {});
}

/**
 * Helper: Track activation milestone
 */
export function trackActivationMilestone(
  milestone: keyof typeof MIXPANEL_EVENTS.ONBOARDING,
  metadata?: Record<string, any>
): void {
  const eventName = MIXPANEL_EVENTS.ONBOARDING[milestone];
  mixpanel.track(eventName, metadata || {});
}

/**
 * Helper: Track AI chat interaction
 */
export function trackAIChatInteraction(
  action: 'opened' | 'message_sent' | 'entity_tagged',
  metadata?: Record<string, any>
): void {
  const eventName = {
    opened: MIXPANEL_EVENTS.FEATURE.AI_CHAT_OPENED,
    message_sent: MIXPANEL_EVENTS.FEATURE.AI_CHAT_MESSAGE_SENT,
    entity_tagged: MIXPANEL_EVENTS.FEATURE.AI_CHAT_ENTITY_TAGGED,
  }[action];

  mixpanel.track(eventName, metadata || {});
}

/**
 * Helper: Track news feed interaction
 */
export function trackNewsFeedInteraction(
  action: 'opened' | 'word_cloud_clicked' | 'article_clicked',
  metadata?: Record<string, any>
): void {
  const eventName = {
    opened: MIXPANEL_EVENTS.FEATURE.NEWS_FEED_OPENED,
    word_cloud_clicked: MIXPANEL_EVENTS.FEATURE.NEWS_WORD_CLOUD_CLICKED,
    article_clicked: MIXPANEL_EVENTS.FEATURE.NEWS_ARTICLE_CLICKED,
  }[action];

  mixpanel.track(eventName, metadata || {});
}

/**
 * Helper: Track tagging interaction
 */
export function trackTaggingInteraction(
  action:
    | 'definition_created'
    | 'definition_edited'
    | 'definition_deleted'
    | 'applied_to_holding'
    | 'custom_chart_created',
  metadata?: Record<string, any>
): void {
  const eventName = {
    definition_created: MIXPANEL_EVENTS.FEATURE.TAGS_DEFINITION_CREATED,
    definition_edited: MIXPANEL_EVENTS.FEATURE.TAGS_DEFINITION_EDITED,
    definition_deleted: MIXPANEL_EVENTS.FEATURE.TAGS_DEFINITION_DELETED,
    applied_to_holding: MIXPANEL_EVENTS.FEATURE.TAGS_APPLIED_TO_HOLDING,
    custom_chart_created: MIXPANEL_EVENTS.FEATURE.TAGS_CUSTOM_CHART_CREATED,
  }[action];

  mixpanel.track(eventName, metadata || {});
}

/**
 * Helper: Track tools/calculator usage
 */
export function trackToolsUsage(
  toolType: string,
  action: 'used' | 'result_viewed',
  metadata?: Record<string, any>
): void {
  const eventName =
    action === 'used'
      ? MIXPANEL_EVENTS.FEATURE.TOOLS_CALCULATOR_USED
      : MIXPANEL_EVENTS.FEATURE.TOOLS_RESULT_VIEWED;

  mixpanel.track(eventName, {
    tool_type: toolType,
    ...metadata,
  });
}

/**
 * Helper: Track authentication event
 */
export function trackAuthEvent(
  action: 'sign_in_success' | 'sign_in_failed' | 'sign_out',
  metadata?: Record<string, any>
): void {
  const eventName = {
    sign_in_success: MIXPANEL_EVENTS.AUTH.SIGN_IN_SUCCESS,
    sign_in_failed: MIXPANEL_EVENTS.AUTH.SIGN_IN_FAILED,
    sign_out: MIXPANEL_EVENTS.AUTH.SIGN_OUT,
  }[action];

  mixpanel.track(eventName, metadata || {});
}

/**
 * Helper: Track holding action
 */
export function trackHoldingAction(
  action: 'added' | 'removed' | 'value_toggled',
  metadata?: Record<string, any>
): void {
  const eventName = {
    added: MIXPANEL_EVENTS.HOLDING.ADDED,
    removed: MIXPANEL_EVENTS.HOLDING.REMOVED,
    value_toggled: MIXPANEL_EVENTS.HOLDING.VALUE_TOGGLED,
  }[action];

  mixpanel.track(eventName, metadata || {});
}
