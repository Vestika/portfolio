// Background service worker for Vestika extension

import { api } from '../shared/api';
import type { Message, AuthState } from '../shared/types';

// Auth state - loaded from storage on startup
let authState: AuthState | null = null;

// Load auth state from storage on startup (survives service worker restarts)
async function loadAuthFromStorage() {
  try {
    const result = await chrome.storage.local.get('authState');
    if (result.authState) {
      authState = result.authState;
      console.log('[Background] Loaded auth from storage:', {
        isAuthenticated: authState?.isAuthenticated,
        expiresAt: authState?.expiresAt ? new Date(authState.expiresAt).toISOString() : null
      });

      // Set token in API client
      if (authState?.token) {
        api.setToken(authState.token);
      }

      // Check if token needs refresh
      if (authState?.expiresAt) {
        const timeUntilExpiry = authState.expiresAt - Date.now();
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('[Background] Token close to expiry, requesting refresh...');
          // Request fresh token from Vestika tab
          await requestAuthRefresh();
        }
      }
    }
  } catch (error) {
    console.error('[Background] Error loading auth from storage:', error);
  }
}

// Request auth refresh from Vestika web app tab
async function requestAuthRefresh() {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://app.vestika.io/*', 'http://localhost:5173/*', 'http://localhost:*/*'] });

    if (tabs.length > 0) {
      // Send refresh request to first matching tab
      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'REQUEST_AUTH',
        forceRefresh: true
      });

      if (response?.token) {
        // Update auth state
        authState = {
          isAuthenticated: true,
          token: response.token,
          user: response.user,
          expiresAt: response.expiresAt,
          lastUpdated: Date.now()
        };

        // Persist to storage
        await chrome.storage.local.set({ authState });

        // Update API client
        api.setToken(response.token);

        console.log('[Background] Token refreshed successfully');
      }
    } else {
      console.log('[Background] No Vestika tab open for token refresh');
    }
  } catch (error) {
    console.error('[Background] Error refreshing token:', error);
  }
}

// Load auth on startup
loadAuthFromStorage();

// Set up periodic token refresh check (every 30 minutes)
chrome.alarms.create('tokenRefresh', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tokenRefresh') {
    loadAuthFromStorage().then(() => {
      if (authState?.expiresAt) {
        const timeUntilExpiry = authState.expiresAt - Date.now();
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('[Background] Periodic check: Token needs refresh');
          requestAuthRefresh();
        }
      }
    });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: Message) {
  console.log('[Background] Received message:', message.type);

  switch (message.type) {
    case 'AUTH_STATE':
      // Update auth state from Vestika web app
      authState = message.payload;
      // Already persisted by content script, just update in-memory state
      if (authState?.token) {
        api.setToken(authState.token);
      }
      console.log('[Background] Auth state updated:', authState?.isAuthenticated);
      return { success: true };

    case 'GET_AUTH_TOKEN':
      // Return current auth token (from storage if needed)
      if (!authState) {
        await loadAuthFromStorage();
      }

      // Check if token needs refresh
      if (authState?.expiresAt) {
        const timeUntilExpiry = authState.expiresAt - Date.now();
        if (timeUntilExpiry < 5 * 60 * 1000) {
          // Try to refresh
          await requestAuthRefresh();
        }
      }

      return {
        token: authState?.token || null,
        user: authState?.user || null,
        expiresAt: authState?.expiresAt || null
      };

    case 'EXTRACT_HTML':
      // Extract HTML from active tab
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
          throw new Error('No active tab found');
        }

        const result = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: extractPageHTML,
          args: [message.payload.selector, message.payload.fullPage],
        });

        return { html: result[0]?.result };
      } catch (error: any) {
        console.error('[Background] Extract HTML error:', error);
        return { error: error.message };
      }

    case 'AUTO_SYNC':
      // Handle auto-sync trigger
      console.log('[Background] Auto-sync triggered for:', message.payload);
      // TODO: Implement auto-sync logic
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

// Function to execute in page context to extract HTML
function extractPageHTML(selector?: string, fullPage: boolean = true): string {
  if (!fullPage && selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found for selector: ${selector}`);
    }
    return element.outerHTML;
  }

  // Clean HTML by removing scripts and styles
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  // Remove inline event handlers
  clone.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return clone.outerHTML;
}

// Check extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Open welcome page on first install
    // Note: import.meta.env doesn't work in service workers, use hardcoded for now
    chrome.tabs.create({ url: 'http://localhost:5173' });
  }
});

// Listen for tab updates to trigger auto-sync
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if URL matches any private configs with auto_sync enabled
    await checkAutoSync(tab.url);
  }
});

async function checkAutoSync(url: string) {
  try {
    // Get private configs with auto_sync enabled
    const result = await chrome.storage.local.get('lastSync');
    const lastSync = result.lastSync || {};

    // Check if we've synced this URL recently (within 1 minute)
    const lastSyncTime = lastSync[url];
    if (lastSyncTime && Date.now() - lastSyncTime < 60000) {
      console.log('[Background] Auto-sync skipped (too recent):', url);
      return;
    }

    // TODO: Fetch private configs and check if URL matches
    // For now, just log
    console.log('[Background] Checking auto-sync for URL:', url);

  } catch (error) {
    console.error('[Background] Auto-sync check error:', error);
  }
}

console.log('[Background] Service worker initialized');
