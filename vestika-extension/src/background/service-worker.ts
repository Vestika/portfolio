// Background service worker for Vestika extension

import { api } from '../shared/api';
import type { Message, AuthState } from '../shared/types';

// Auth state stored in memory
let authState: AuthState = {
  isAuthenticated: false,
  token: null,
  user: null,
};

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
      if (authState.token) {
        api.setToken(authState.token);
      }
      console.log('[Background] Auth state updated:', authState.isAuthenticated);
      return { success: true };

    case 'GET_AUTH_TOKEN':
      // Return current auth token
      return { token: authState.token, user: authState.user };

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
