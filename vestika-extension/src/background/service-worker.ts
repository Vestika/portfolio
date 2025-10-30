// Background service worker for Vestika extension

import { api } from '../shared/api';
import type { Message, AuthState } from '../shared/types';

// Auth state - loaded from storage on startup
let authState: AuthState | null = null;

// Badge state management
let badgeClearTimer: number | null = null;

// Set badge with auto-clear
function setBadge(text: string, color: string, autoCleanMs?: number) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });

  // Clear any existing timer
  if (badgeClearTimer) {
    clearTimeout(badgeClearTimer);
    badgeClearTimer = null;
  }

  // Auto-clear after specified time
  if (autoCleanMs) {
    badgeClearTimer = setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
      badgeClearTimer = null;
    }, autoCleanMs);
  }
}

// Clear badge
function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
  if (badgeClearTimer) {
    clearTimeout(badgeClearTimer);
    badgeClearTimer = null;
  }
}

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

    case 'EXTRACTION_SUCCESS':
      // Show green badge for successful extraction
      setBadge('✓', '#4CAF50', 10000); // Green, auto-clear in 10s
      console.log('[Background] Extraction successful');
      return { success: true };

    case 'EXTRACTION_FAILED':
      // Show red badge for failed extraction
      setBadge('✗', '#F44336', 15000); // Red, auto-clear in 15s
      console.log('[Background] Extraction failed');
      return { success: true };

    case 'EXTRACTION_CONFLICT':
      // Show blue badge for conflicts requiring review
      setBadge('!', '#2196F3', 0); // Blue, don't auto-clear (user needs to review)
      console.log('[Background] Extraction has conflicts');
      return { success: true };

    case 'CLEAR_BADGE':
      // Clear badge manually
      clearBadge();
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
    // Check if auth is available
    if (!authState?.token || !authState?.isAuthenticated) {
      console.log('[Background] Auto-sync skipped (not authenticated)');
      return;
    }

    // Get private configs with auto_sync enabled
    const result = await chrome.storage.local.get('lastSync');
    const lastSync = result.lastSync || {};

    // Check if we've synced this URL recently (within 5 minutes to avoid spam)
    const domain = new URL(url).hostname;
    const lastSyncTime = lastSync[domain];
    if (lastSyncTime && Date.now() - lastSyncTime < 300000) {
      console.log('[Background] Auto-sync skipped (too recent):', domain);
      return;
    }

    // Fetch user's private configs
    try {
      const response = await api.getPrivateConfigs();
      const configs = response.configs || [];

      // Find matching config for this URL
      for (const privateConfig of configs) {
        if (!privateConfig.enabled) continue;

        // Get the shared config to check URL pattern
        try {
          const sharedConfigResponse = await api.getSharedConfigs();
          const sharedConfig = sharedConfigResponse.configs?.find(
            (c: any) => c.config_id === privateConfig.shared_config_id
          );

          if (!sharedConfig) continue;

          // Check if URL matches pattern
          const pattern = sharedConfig.url_pattern;
          const regex = new RegExp(pattern);

          if (regex.test(url)) {
            console.log('[Background] Auto-sync match found:', sharedConfig.site_name);

            // Trigger auto-sync
            await triggerAutoSync(url, sharedConfig, privateConfig);

            // Update last sync time
            lastSync[domain] = Date.now();
            await chrome.storage.local.set({ lastSync });

            break; // Only trigger one auto-sync per page load
          }
        } catch (error) {
          console.error('[Background] Error checking shared config:', error);
        }
      }
    } catch (error) {
      console.error('[Background] Error fetching private configs:', error);
    }

  } catch (error) {
    console.error('[Background] Auto-sync check error:', error);
  }
}

async function triggerAutoSync(url: string, sharedConfig: any, privateConfig: any) {
  try {
    console.log('[Background] Triggering auto-sync for:', sharedConfig.site_name);

    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      console.error('[Background] No active tab found');
      return;
    }

    const tabId = tabs[0].id;

    // Extract HTML using the config
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageHTML,
      args: [sharedConfig.selector, sharedConfig.full_page],
    });

    const html = result[0]?.result;
    if (!html) {
      console.error('[Background] Failed to extract HTML');
      return;
    }

    // Call extract API
    const extractResponse = await api.extractHoldings(
      html,
      url,
      sharedConfig.selector
    );

    console.log('[Background] Auto-sync extraction started, session:', extractResponse.session_id);

    // Decide what to do based on notification preference
    if (privateConfig.notification_preference === 'auto_redirect') {
      // Redirect to import page immediately
      const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'http://localhost:5173';
      const importUrl = `${vestikaUrl}/import?session=${extractResponse.session_id}&config=${sharedConfig.config_id}&autosync=true`;

      await chrome.tabs.create({ url: importUrl });
    } else {
      // notification_only mode - inject banner
      await injectNotificationBanner(tabId, extractResponse.session_id, sharedConfig);
    }

  } catch (error) {
    console.error('[Background] Auto-sync trigger error:', error);
  }
}

async function injectNotificationBanner(tabId: number, sessionId: string, sharedConfig: any) {
  try {
    console.log('[Background] Injecting notification banner');

    // Inject banner into page
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sessionId: string, siteName: string) => {
        // Check if banner already exists
        if (document.getElementById('vestika-autosync-banner')) {
          return;
        }

        // Create banner
        const banner = document.createElement('div');
        banner.id = 'vestika-autosync-banner';
        banner.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 999999;
          animation: slideDown 0.3s ease-out;
        `;

        banner.innerHTML = `
          <style>
            @keyframes slideDown {
              from { transform: translateY(-100%); }
              to { transform: translateY(0); }
            }
          </style>
          <div style="display: flex; align-items: center; gap: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <div>
              <div style="font-weight: 600;">Portfolio Updated from ${siteName}</div>
              <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">Review your updated holdings in Vestika</div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button id="vestika-view-btn" style="
              background: rgba(255, 255, 255, 0.2);
              border: 1px solid rgba(255, 255, 255, 0.3);
              color: white;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
              font-size: 13px;
            ">View Import</button>
            <button id="vestika-dismiss-btn" style="
              background: transparent;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 24px;
              opacity: 0.8;
              padding: 0 4px;
            ">&times;</button>
          </div>
        `;

        document.body.appendChild(banner);

        // Add event listeners
        const viewBtn = document.getElementById('vestika-view-btn');
        const dismissBtn = document.getElementById('vestika-dismiss-btn');

        viewBtn?.addEventListener('click', () => {
          const vestikaUrl = 'http://localhost:5173'; // TODO: Use env var
          window.open(`${vestikaUrl}/import?session=${sessionId}&autosync=true`, '_blank');
          banner.remove();
        });

        dismissBtn?.addEventListener('click', () => {
          banner.style.animation = 'slideDown 0.3s ease-out reverse';
          setTimeout(() => banner.remove(), 300);
        });

        // Auto-dismiss after 15 seconds
        setTimeout(() => {
          if (document.getElementById('vestika-autosync-banner')) {
            banner.style.animation = 'slideDown 0.3s ease-out reverse';
            setTimeout(() => banner.remove(), 300);
          }
        }, 15000);
      },
      args: [sessionId, sharedConfig.site_name],
    });

    console.log('[Background] Banner injected successfully');
  } catch (error) {
    console.error('[Background] Banner injection error:', error);
  }
}

console.log('[Background] Service worker initialized');
