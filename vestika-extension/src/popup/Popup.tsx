import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../shared/api';
import type { SharedConfig } from '../shared/types';
import './popup.css';

function Popup() {
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: any;
  }>({ isAuthenticated: false, user: null });
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [selector, setSelector] = useState('');
  const [pickingElement, setPickingElement] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Config detection state
  const [matchedConfigs, setMatchedConfigs] = useState<SharedConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [showManualMode, setShowManualMode] = useState(false);

  useEffect(() => {
    checkAuth();
    loadPageInfo();
    loadSavedState();
  }, []);

  // Check for matching configs when URL is available
  useEffect(() => {
    if (currentUrl && authState.isAuthenticated) {
      checkForMatchingConfigs();
    }
  }, [currentUrl, authState.isAuthenticated]);

  // Save selector to storage when it changes
  useEffect(() => {
    if (selector) {
      chrome.storage.local.set({ lastSelector: selector });
    }
  }, [selector]);

  async function checkAuth() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' });
      if (response.token) {
        api.setToken(response.token);
        setAuthState({ isAuthenticated: true, user: response.user });
      }
    } catch (err: any) {
      console.error('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url) return;
      setCurrentUrl(tab.url);
    } catch (err: any) {
      console.error('Error loading page info:', err);
    }
  }

  async function loadSavedState() {
    try {
      const result = await chrome.storage.local.get(['lastSelector']);
      if (result.lastSelector) {
        setSelector(result.lastSelector);
      }
    } catch (err: any) {
      console.error('Error loading saved state:', err);
    }
  }

  // Helper: Extract domain from URL
  function getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  // Helper: Check if cache is expired
  function isCacheExpired(cache: any): boolean {
    return !cache.expires || Date.now() > cache.expires;
  }

  // Check for matching configs with caching
  async function checkForMatchingConfigs() {
    if (!currentUrl) return;

    setLoadingConfigs(true);

    try {
      // Check cache first
      const cacheKey = `config_match:${getDomain(currentUrl)}`;
      const cached = await chrome.storage.local.get([cacheKey]);

      if (cached[cacheKey] && !isCacheExpired(cached[cacheKey])) {
        setMatchedConfigs(cached[cacheKey].configs);
        setLoadingConfigs(false);
        return;
      }

      // Fetch from API
      const response = await api.matchConfigsForUrl(currentUrl);

      if (response.matched && response.configs.length > 0) {
        setMatchedConfigs(response.configs);

        // Cache for 24 hours
        await chrome.storage.local.set({
          [cacheKey]: {
            configs: response.configs,
            timestamp: Date.now(),
            expires: Date.now() + 86400000 // 24h
          }
        });
      }
    } catch (error) {
      console.error('Config matching error:', error);
      // Silently fail - user can still use manual mode
    } finally {
      setLoadingConfigs(false);
    }
  }

  async function handleStartPicker() {
    setPickingElement(true);
    setError(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url) {
        throw new Error('No active tab found');
      }

      const url = new URL(tab.url);
      const origin = `${url.protocol}//${url.host}/*`;

      const hasPermission = await chrome.permissions.contains({ origins: [origin] });

      if (!hasPermission) {
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) {
          throw new Error('Permission denied for this site');
        }
      }

      setSelector('');
      await chrome.storage.local.set({
        lastSelector: '',
        pickerActive: true
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if ((window as any).__VESTIKA_PICKER_INJECTED__) return;
          (window as any).__VESTIKA_PICKER_INJECTED__ = true;

          let isPickerActive = false;
          let hoveredElement: HTMLElement | null = null;
          let pickerOverlay: HTMLDivElement | null = null;

          const PICKER_STYLES = `
            .vestika-picker-highlight {
              outline: 3px solid #4CAF50 !important;
              outline-offset: 2px !important;
              cursor: crosshair !important;
              background-color: rgba(76, 175, 80, 0.15) !important;
              box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3) !important;
              position: relative !important;
              z-index: 999999 !important;
            }
            .vestika-picker-overlay {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              z-index: 999998 !important;
              cursor: crosshair !important;
              background: transparent !important;
              pointer-events: none !important;
            }
          `;

          function generateSelector(element: HTMLElement): string {
            if (element.id) return `#${element.id}`;

            const path: string[] = [];
            let current: HTMLElement | null = element;

            while (current && current !== document.body) {
              let selector = current.tagName.toLowerCase();

              if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
              }

              if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('vestika-'));
                if (classes.length > 0) {
                  selector += '.' + classes.join('.');
                }
              }

              path.unshift(selector);
              current = current.parentElement;
            }

            return path.join(' > ');
          }

          function injectStyles() {
            if (document.getElementById('vestika-picker-styles')) return;
            const style = document.createElement('style');
            style.id = 'vestika-picker-styles';
            style.textContent = PICKER_STYLES;
            document.head.appendChild(style);
          }

          function removeStyles() {
            document.getElementById('vestika-picker-styles')?.remove();
          }

          function handleMouseMove(event: MouseEvent) {
            if (!isPickerActive) return;

            const target = event.target as HTMLElement;
            if (target === pickerOverlay || target.classList.contains('vestika-picker-overlay')) return;

            if (hoveredElement && hoveredElement !== target) {
              hoveredElement.classList.remove('vestika-picker-highlight');
            }

            hoveredElement = target;
            hoveredElement.classList.add('vestika-picker-highlight');
          }

          function handleClick(event: MouseEvent) {
            if (!isPickerActive) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const target = event.target as HTMLElement;

            if (target === pickerOverlay || target.classList.contains('vestika-picker-overlay')) {
              return;
            }

            const selector = generateSelector(target);
            stopPicker();

            setTimeout(() => {
              chrome.storage.local.set({
                lastSelector: selector,
                pickerActive: false
              });

              chrome.runtime.sendMessage({
                type: 'ELEMENT_SELECTED',
                payload: { selector }
              }).catch(() => {});
            }, 0);
          }

          function handleKeyDown(event: KeyboardEvent) {
            if (!isPickerActive || event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            stopPicker();

            chrome.storage.local.set({ pickerActive: false });
            chrome.runtime.sendMessage({ type: 'ELEMENT_PICKER_CANCELLED' }).catch(() => {});
          }

          function startPicker() {
            if (isPickerActive) return;
            isPickerActive = true;

            injectStyles();

            pickerOverlay = document.createElement('div');
            pickerOverlay.className = 'vestika-picker-overlay';
            document.body.appendChild(pickerOverlay);

            document.addEventListener('mousemove', handleMouseMove, true);
            document.addEventListener('click', handleClick, true);
            document.addEventListener('keydown', handleKeyDown, true);
          }

          function stopPicker() {
            if (!isPickerActive) return;
            isPickerActive = false;

            if (hoveredElement) {
              hoveredElement.classList.remove('vestika-picker-highlight');
              hoveredElement = null;
            }

            if (pickerOverlay) {
              pickerOverlay.remove();
              pickerOverlay = null;
            }

            document.removeEventListener('mousemove', handleMouseMove, true);
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);

            removeStyles();
          }

          chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message.type === 'START_ELEMENT_PICKER') {
              startPicker();
              sendResponse({ success: true });
            } else if (message.type === 'STOP_ELEMENT_PICKER') {
              stopPicker();
              sendResponse({ success: true });
            }
            return true;
          });
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });
      window.close();
    } catch (err: any) {
      console.error('Error starting element picker:', err);
      setError(`Failed to start element picker: ${err.message}`);
      setPickingElement(false);
    }
  }

  async function handleImport() {
    setError(null);

    if (!selector) {
      setError('Please select an element using the element picker');
      return;
    }

    setExtracting(true);

    try {
      // Extract HTML from page
      const htmlResult = await chrome.runtime.sendMessage({
        type: 'EXTRACT_HTML',
        payload: {
          selector,
          fullPage: false,
        },
      });

      if (htmlResult.error) {
        throw new Error(htmlResult.error);
      }

      // Call extract API - returns session_id
      const extractResponse = await api.extractHoldings(
        htmlResult.html,
        currentUrl,
        selector
      );

      setExtracting(false);

      // Show success badge
      chrome.runtime.sendMessage({ type: 'EXTRACTION_SUCCESS' }).catch(() => {});

      // Redirect to web app import page with session_id
      const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'https://app.vestika.io';
      const importUrl = `${vestikaUrl}/import?session=${extractResponse.session_id}`;

      chrome.tabs.create({ url: importUrl });
      window.close();
    } catch (err: any) {
      setError(err.message);
      setExtracting(false);

      // Show failure badge
      chrome.runtime.sendMessage({ type: 'EXTRACTION_FAILED' }).catch(() => {});
    }
  }

  // Extract with prebuilt config
  async function handleExtractWithConfig(config: SharedConfig) {
    setError(null);
    setExtracting(true);

    try {
      // Extract HTML (full page or selector-based)
      const htmlResult = await chrome.runtime.sendMessage({
        type: 'EXTRACT_HTML',
        payload: {
          selector: config.selector || null,
          fullPage: config.full_page,
        },
      });

      if (htmlResult.error) {
        throw new Error(htmlResult.error);
      }

      // Call extract API with config info
      const extractResponse = await api.extractHoldings(
        htmlResult.html,
        currentUrl,
        config.selector || undefined
      );

      setExtracting(false);

      // Show success badge
      chrome.runtime.sendMessage({ type: 'EXTRACTION_SUCCESS' }).catch(() => {});

      // Redirect to web app with config info
      const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'https://app.vestika.io';
      const importUrl = `${vestikaUrl}/import?session=${extractResponse.session_id}&config=${config.config_id}`;

      chrome.tabs.create({ url: importUrl });
      window.close();
    } catch (err: any) {
      setError(err.message);
      setExtracting(false);

      // Show failure badge
      chrome.runtime.sendMessage({ type: 'EXTRACTION_FAILED' }).catch(() => {});
    }
  }

  function openVestika() {
    const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'https://app.vestika.io';
    chrome.tabs.create({ url: vestikaUrl });
  }

  if (loading) {
    return (
      <div className="popup">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="popup">
        <div className="header">
          <h1>Vestika Portfolio Importer</h1>
        </div>
        <div className="content">
          <p className="info">Please log in to Vestika to continue</p>
          <button onClick={openVestika} className="btn-primary">
            Open Vestika & Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup">
      <div className="header">
        <h1>Vestika Importer</h1>
        {authState.user && (
          <div className="user-info">
            {authState.user.photoURL && (
              <img src={authState.user.photoURL} alt="User" className="avatar" />
            )}
            <span className="email">{authState.user.email}</span>
          </div>
        )}
      </div>

      <div className="content">
        {error && <div className="alert alert-error">{error}</div>}

        {loadingConfigs && (
          <div className="loading-configs">
            <div className="spinner"></div>
            <span>Checking for prebuilt configuration...</span>
          </div>
        )}

        {!loadingConfigs && matchedConfigs.length > 0 && !showManualMode && (
          <div className="config-card">
            <div className="config-header">
              <span className="success-icon">🎉</span>
              <h3>Good news!</h3>
            </div>
            <p>A configuration for <strong>{matchedConfigs[0].site_name}</strong> is available.</p>
            <p className="subtitle">Import in one click.</p>

            <div className="config-details">
              <div className="config-name">{matchedConfigs[0].site_name} Holdings</div>
              <div className="config-meta">
                {matchedConfigs[0].creator_name && (
                  <span>Created by: {matchedConfigs[0].creator_name}</span>
                )}
                {matchedConfigs[0].verified && (
                  <span className="badge-verified">✓ Verified</span>
                )}
              </div>
              <div className="config-stats">
                <span>Enabled by: {(matchedConfigs[0].enabled_users_count ?? 0).toLocaleString()} users</span>
                {(matchedConfigs[0].successful_imports_count ?? 0) > 0 && (
                  <span>
                    Imports completed: {(matchedConfigs[0].successful_imports_count ?? 0).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="config-actions">
              <button
                onClick={() => handleExtractWithConfig(matchedConfigs[0])}
                disabled={extracting}
                className="btn-primary"
              >
                {extracting ? 'Extracting...' : 'Extract Data'}
              </button>

              <button
                onClick={() => setShowManualMode(true)}
                className="btn-link"
              >
                or select elements manually &gt;
              </button>
            </div>
          </div>
        )}

        {(showManualMode || (!loadingConfigs && matchedConfigs.length === 0)) && (
          <>
            <div className="form-group">
              <label>Element Selector</label>
              <button
                onClick={handleStartPicker}
                disabled={pickingElement}
                className="btn-secondary"
                style={{ width: '100%', marginBottom: '8px' }}
              >
                {pickingElement ? 'Picking... (ESC to cancel)' : 'Pick Element from Page'}
              </button>
              {selector && (
                <div style={{ padding: '8px', background: 'hsl(var(--card))', borderRadius: '4px', border: '1px solid hsl(var(--border))' }}>
                  <div style={{ fontSize: '11px', color: '#4CAF50', marginBottom: '4px', fontWeight: 'bold' }}>
                    ✓ Element Selected
                  </div>
                  <input
                    type="text"
                    value={selector}
                    readOnly
                    placeholder="CSS selector"
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      background: 'hsl(var(--input))',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border))',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}
                  />
                  <button
                    onClick={() => setSelector('')}
                    style={{ marginTop: '4px', fontSize: '10px', padding: '2px 6px' }}
                    className="btn-secondary"
                  >
                    Clear & Pick Again
                  </button>
                </div>
              )}
              <small style={{ display: 'block', marginTop: '4px', color: 'hsl(var(--muted-foreground))' }}>
                Click button to visually select the holdings table or element
              </small>
            </div>

            <div className="actions">
              <button
                onClick={handleImport}
                disabled={extracting || !selector}
                className="btn-primary"
              >
                {extracting ? 'Extracting...' : 'Import Now'}
              </button>
            </div>

            <p style={{ marginTop: '16px', fontSize: '12px', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
              You'll be redirected to Vestika to review and complete the import
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
