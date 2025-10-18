import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../shared/api';
import type { Portfolio, ExtractedHolding } from '../shared/types';
import './popup.css';

function Popup() {
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: any;
  }>({ isAuthenticated: false, user: null });
  const [loading, setLoading] = useState(true);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [configName, setConfigName] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [selector, setSelector] = useState('');
  const [pickingElement, setPickingElement] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSaveConfigDialog, setShowSaveConfigDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHoldings, setPreviewHoldings] = useState<ExtractedHolding[]>([]);

  useEffect(() => {
    checkAuth();
    loadPageInfo();
    loadSavedState();
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      loadPortfolios();
    }
  }, [authState.isAuthenticated]);

  // Save selector to storage when it changes
  useEffect(() => {
    if (selector) {
      chrome.storage.local.set({ lastSelector: selector });
    }
  }, [selector]);

  useEffect(() => {
    // Auto-select account based on domain matching when portfolio is selected
    if (selectedPortfolioId && portfolios.length > 0 && currentUrl) {
      const portfolio = portfolios.find(p => p.id === selectedPortfolioId);
      if (portfolio && portfolio.accounts) {
        const urlDomain = new URL(currentUrl).hostname;
        const matchedAccount = portfolio.accounts.find(acc =>
          acc.url && new URL(acc.url).hostname === urlDomain
        );
        if (matchedAccount) {
          setSelectedAccountId(matchedAccount.id);
        }
      }
    }
  }, [selectedPortfolioId, portfolios, currentUrl]);

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

      const url = new URL(tab.url);
      const domain = url.hostname;
      const path = url.pathname;

      // Auto-fill name from domain + path
      setConfigName(`${domain}${path}`);

      // Auto-fill URL from window.location.href
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

  async function loadPortfolios() {
    try {
      const data = await api.getPortfolios();
      if (data && data.portfolios) {
        // Convert portfolios object to array
        const portfoliosArray: Portfolio[] = Object.entries(data.portfolios).map(([id, portfolio]: [string, any]) => ({
          id,
          portfolio_name: portfolio.portfolio_name || portfolio.name || id,
          base_currency: portfolio.base_currency || 'USD',
          accounts: portfolio.accounts || []
        }));

        setPortfolios(portfoliosArray);
        // Auto-select first portfolio if available
        if (portfoliosArray.length > 0) {
          setSelectedPortfolioId(portfoliosArray[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading portfolios:', err);
      setError('Failed to load portfolios');
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

      // Check if we need to request permission for this URL
      const url = new URL(tab.url);
      const origin = `${url.protocol}//${url.host}/*`;

      // Request permission if not already granted
      const hasPermission = await chrome.permissions.contains({
        origins: [origin]
      });

      if (!hasPermission) {
        const granted = await chrome.permissions.request({
          origins: [origin]
        });

        if (!granted) {
          throw new Error('Permission denied for this site');
        }
      }

      // Clear previous selector
      setSelector('');
      await chrome.storage.local.set({
        lastSelector: '',
        pickerActive: true
      });

      // Inject element picker inline (to avoid file path issues)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Check if already injected
          if ((window as any).__VESTIKA_PICKER_INJECTED__) {
            return;
          }
          (window as any).__VESTIKA_PICKER_INJECTED__ = true;

          // Inline element picker implementation
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
            console.log('[Element Picker] Click detected, isPickerActive:', isPickerActive);

            if (!isPickerActive) {
              console.log('[Element Picker] Picker not active, ignoring click');
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const target = event.target as HTMLElement;
            console.log('[Element Picker] Click target:', target);

            if (target === pickerOverlay || target.classList.contains('vestika-picker-overlay')) {
              console.log('[Element Picker] Clicked on overlay, ignoring');
              return;
            }

            const selector = generateSelector(target);
            console.log('[Element Picker] Generated selector:', selector);

            // Stop picker first
            stopPicker();

            // Then save (async operations after stopping picker to avoid delays)
            setTimeout(() => {
              chrome.storage.local.set({
                lastSelector: selector,
                pickerActive: false
              }).then(() => {
                console.log('[Element Picker] Selector saved to storage:', selector);
              });

              chrome.runtime.sendMessage({
                type: 'ELEMENT_SELECTED',
                payload: { selector }
              }).catch(() => console.log('[Element Picker] Message sent (popup may be closed)'));
            }, 0);
          }

          function handleKeyDown(event: KeyboardEvent) {
            if (!isPickerActive || event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            stopPicker();

            chrome.storage.local.set({ pickerActive: false });
            chrome.runtime.sendMessage({ type: 'ELEMENT_PICKER_CANCELLED' })
              .catch(() => console.log('[Element Picker] Cancelled'));
          }

          function startPicker() {
            if (isPickerActive) return;
            console.log('[Element Picker] Starting...');
            isPickerActive = true;

            injectStyles();

            pickerOverlay = document.createElement('div');
            pickerOverlay.className = 'vestika-picker-overlay';
            document.body.appendChild(pickerOverlay);

            document.addEventListener('mousemove', handleMouseMove, true);
            document.addEventListener('click', handleClick, true);
            document.addEventListener('keydown', handleKeyDown, true);

            console.log('[Element Picker] Started');
          }

          function stopPicker() {
            if (!isPickerActive) return;
            console.log('[Element Picker] Stopping...');
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
            console.log('[Element Picker] Stopped');
          }

          // Listen for messages
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

          console.log('[Element Picker] Injected and ready');
        }
      });

      // Small delay to ensure script is loaded
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send message to start picker
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });

      // Close popup so user can see the page
      window.close();
    } catch (err: any) {
      console.error('Error starting element picker:', err);
      setError(`Failed to start element picker: ${err.message}`);
      setPickingElement(false);
    }
  }

  async function handleCaptureAndImport() {
    setError(null);
    setSuccess(null);

    if (!selector) {
      setError('Please select an element using the element picker');
      return;
    }

    setExtracting(true);

    try {
      // Create new portfolio if needed
      let portfolioId = selectedPortfolioId;
      if (!portfolioId) {
        if (!newPortfolioName) {
          setError('Please enter a portfolio name or select an existing one');
          setExtracting(false);
          return;
        }
        const createPortfolioResponse = await api.createPortfolio(newPortfolioName);
        portfolioId = createPortfolioResponse.portfolio_id;
        setSuccess(`Created new portfolio: ${newPortfolioName}`);

        // Reload portfolios
        await loadPortfolios();
        setSelectedPortfolioId(portfolioId);
      }

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

      // Call extract API (without configId since we're doing quick import)
      const extractResponse = await api.extractHoldings(
        htmlResult.html,
        '', // No config ID for quick import
        portfolioId
      );

      setExtracting(false);

      // Show preview of extracted holdings
      setPreviewHoldings(extractResponse.holdings);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message);
      setExtracting(false);
      setImporting(false);
    }
  }

  async function handleConfirmImport() {
    setImporting(true);
    setError(null);

    try {
      // Use the portfolio ID that was created/selected during extraction
      const portfolioId = selectedPortfolioId;
      if (!portfolioId) {
        throw new Error('No portfolio selected');
      }

      // Prepare import request with validated/edited holdings
      const importRequest: any = {
        portfolio_id: portfolioId,
        holdings: previewHoldings.map((h: ExtractedHolding) => ({
          symbol: h.symbol,
          units: h.units,
        })),
        replace_holdings: false, // Merge by default
      };

      // Add account info
      if (selectedAccountId) {
        importRequest.account_id = selectedAccountId;
      } else if (newAccountName) {
        importRequest.account_name = newAccountName;
        importRequest.account_type = 'taxable-brokerage';
      } else {
        const url = new URL(currentUrl);
        importRequest.account_name = `Import from ${url.hostname}`;
        importRequest.account_type = 'taxable-brokerage';
      }

      const importResponse = await api.importHoldings(importRequest);

      setSuccess(`Imported ${importResponse.imported_holdings_count} holdings!`);
      setImporting(false);
      setShowPreview(false);

      // Show dialog to save as configuration
      setShowSaveConfigDialog(true);
    } catch (err: any) {
      setError(err.message);
      setImporting(false);
    }
  }

  function handleEditHolding(index: number, field: 'symbol' | 'units', value: string | number) {
    const updated = [...previewHoldings];
    if (field === 'symbol') {
      updated[index].symbol = value as string;
    } else {
      updated[index].units = parseFloat(value as string) || 0;
    }
    setPreviewHoldings(updated);
  }

  function handleDeleteHolding(index: number) {
    setPreviewHoldings(previewHoldings.filter((_, i) => i !== index));
  }

  function handleAddHolding() {
    setPreviewHoldings([
      ...previewHoldings,
      { symbol: '', units: 0, confidence_score: 1.0 }
    ]);
  }

  async function handleSaveAsConfig() {
    try {
      setError(null);

      if (!configName) {
        throw new Error('Please enter a configuration name');
      }

      if (!selector) {
        throw new Error('No selector available to save');
      }

      // Create shared config
      const sharedConfig = await api.createSharedConfig({
        name: configName,
        url: currentUrl,
        full_url: true,
        selector,
        is_public: false,
      });

      // Create private config linking to portfolio/account
      await api.createPrivateConfig({
        extension_config_id: sharedConfig.id,
        portfolio_id: selectedPortfolioId,
        account_id: selectedAccountId || undefined,
        auto_sync: false,
      });

      setSuccess('Configuration saved successfully!');
      setShowSaveConfigDialog(false);
    } catch (err: any) {
      setError(`Failed to save configuration: ${err.message}`);
    }
  }

  function openVestika() {
    const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'http://localhost:5173';
    chrome.tabs.create({ url: vestikaUrl });
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
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

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId);
  const availableAccounts = selectedPortfolio?.accounts || [];
  const currentDomain = currentUrl ? getDomainFromUrl(currentUrl) : '';

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
        {success && <div className="alert alert-success">{success}</div>}

        {showPreview ? (
          <div className="preview-dialog">
            <h3>Review Extracted Holdings</h3>
            <p>Please review and edit the extracted holdings before importing:</p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '12px', marginBottom: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Symbol</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Units</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Confidence</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {previewHoldings.map((holding, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="text"
                          value={holding.symbol}
                          onChange={(e) => handleEditHolding(index, 'symbol', e.target.value)}
                          style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '3px' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          value={holding.units}
                          onChange={(e) => handleEditHolding(index, 'units', e.target.value)}
                          style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '3px', textAlign: 'right' }}
                          step="0.01"
                        />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: holding.confidence_score > 0.8 ? '#d4edda' : holding.confidence_score > 0.5 ? '#fff3cd' : '#f8d7da',
                          color: holding.confidence_score > 0.8 ? '#155724' : holding.confidence_score > 0.5 ? '#856404' : '#721c24',
                          fontSize: '10px'
                        }}>
                          {(holding.confidence_score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteHolding(index)}
                          style={{ padding: '2px 8px', fontSize: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleAddHolding}
              style={{ marginBottom: '12px', fontSize: '12px' }}
              className="btn-secondary"
            >
              + Add Holding
            </button>

            <div style={{ marginTop: '12px', padding: '8px', background: '#e7f3ff', borderRadius: '4px', fontSize: '11px' }}>
              <strong>Total:</strong> {previewHoldings.length} holding(s)
            </div>

            <div className="actions" style={{ marginTop: '12px' }}>
              <button
                onClick={handleConfirmImport}
                disabled={importing || previewHoldings.length === 0}
                className="btn-primary"
              >
                {importing ? 'Importing...' : `Confirm & Import ${previewHoldings.length} Holding(s)`}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : showSaveConfigDialog ? (
          <div className="save-config-dialog">
            <h3>Save as Configuration?</h3>
            <p>Would you like to save this import configuration for future use?</p>

            <div className="form-group">
              <label>Configuration Name</label>
              <input
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="e.g., Schwab Portfolio"
              />
            </div>

            <div className="actions">
              <button onClick={handleSaveAsConfig} className="btn-primary">
                Save Configuration
              </button>
              <button onClick={() => setShowSaveConfigDialog(false)} className="btn-secondary">
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="quick-import-form">
            <h3>Quick Import</h3>

            {/* Portfolio Selection */}
            <div className="form-group">
              <label>Portfolio *</label>
              <select
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
              >
                <option value="">-- Create New Portfolio --</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.portfolio_name}
                  </option>
                ))}
              </select>
              {!selectedPortfolioId && (
                <input
                  type="text"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  placeholder="Enter new portfolio name"
                  style={{ marginTop: '8px' }}
                />
              )}
              <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                {selectedPortfolioId ? 'Selected existing portfolio' : 'Leave empty to create new portfolio'}
              </small>
            </div>

            {/* Account Selection */}
            <div className="form-group">
              <label>Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="">-- Create New Account --</option>
                {availableAccounts.map((a) => {
                  const accountDomain = a.url ? getDomainFromUrl(a.url) : '';
                  const isMatched = accountDomain === currentDomain;
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name} {isMatched ? '✓ matched' : ''}
                    </option>
                  );
                })}
              </select>
              {!selectedAccountId && (
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Enter new account name (optional)"
                  style={{ marginTop: '8px' }}
                />
              )}
              <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                {selectedAccountId
                  ? 'Will merge into selected account'
                  : newAccountName
                  ? 'Will create new account with this name'
                  : 'Auto-generated from current page if left empty'
                }
              </small>
            </div>

            {/* Element Picker */}
            <div className="form-group">
              <label>Element Selector *</label>
              <button
                onClick={handleStartPicker}
                disabled={pickingElement}
                className="btn-secondary"
                style={{ width: '100%' }}
              >
                {pickingElement ? 'Picking... (ESC to cancel)' : 'Pick Element from Page'}
              </button>
              {selector && (
                <div style={{ marginTop: '8px', padding: '8px', background: '#f0f0f0', borderRadius: '4px', border: '1px solid #4CAF50' }}>
                  <div style={{ fontSize: '11px', color: '#4CAF50', marginBottom: '4px', fontWeight: 'bold' }}>
                    ✓ Element Selected
                  </div>
                  <input
                    type="text"
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder="CSS selector"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
                    readOnly
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
              <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                Click button to visually select the holdings table or element
              </small>
            </div>

            {/* Import Button */}
            <div className="actions">
              <button
                onClick={handleCaptureAndImport}
                disabled={extracting || importing || !selector}
                className="btn-primary"
              >
                {extracting ? 'Extracting...' : importing ? 'Importing...' : 'Import Now'}
              </button>
              <button onClick={openOptions} className="btn-secondary">
                Manage Configs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to extract domain from URL
function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// Mount React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
