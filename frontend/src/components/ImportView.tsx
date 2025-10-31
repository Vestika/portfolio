import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { ComboBox, ComboBoxOption } from './ui/combobox';
import { Button } from '@/components/ui/button';

interface ExtractedHolding {
  symbol: string;
  units: number;
  cost_basis?: number;
  security_name?: string;
  confidence_score: number;
}

interface ExtractionSession {
  session_id: string;
  user_id: string;
  status: 'processing' | 'completed' | 'failed' | 'requires_review';
  extracted_holdings: ExtractedHolding[];
  extraction_metadata: {
    model_used: string;
    timestamp: string;
    html_size_bytes: number;
    extraction_time_ms: number;
    holdings_count: number;
  };
  source_url?: string;
  selector?: string;
  error_message?: string;

  // Auto-sync fields
  auto_sync?: boolean;
  private_config_id?: string;
  previous_holdings?: any[];
  conflict_detected?: boolean;
  conflict_reason?: string;

  created_at: string;
}

interface SharedConfig {
  config_id: string;
  site_name: string;
  url_pattern: string;
  creator_name?: string;
  verified: boolean;
  usage_count: number;
  success_rate: number;
}

interface Portfolio {
  id: string;
  portfolio_name: string;
  base_currency: string;
  accounts?: Account[];
}

interface Account {
  id: string;
  name: string;
  type: string;
}

export const ImportView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const configId = searchParams.get('config');

  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(true); // New: track extraction status
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ExtractionSession | null>(null);
  const [config, setConfig] = useState<SharedConfig | null>(null);
  const [holdings, setHoldings] = useState<ExtractedHolding[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);

  const [selectedPortfolioName, setSelectedPortfolioName] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('bank-account');

  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [enablingAutoSync, setEnablingAutoSync] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [showConfigSuggestion, setShowConfigSuggestion] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Check user preference for config suggestion
  useEffect(() => {
    const hideConfigSuggestion = localStorage.getItem('hideConfigCreationSuggestion') === 'true';
    setShowConfigSuggestion(!hideConfigSuggestion);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    loadSession();
    loadPortfolios();

    // Load config if provided
    if (configId) {
      loadConfig();
    }
  }, [sessionId, configId]);

  async function loadSession() {
    try {
      const response = await api.get(`/api/import/sessions/${sessionId}`);
      const sessionData = response.data;

      setSession(sessionData);

      // Check extraction status
      if (sessionData.status === 'processing') {
        // Still extracting, poll again in 2 seconds
        setExtracting(true);
        setTimeout(() => loadSession(), 2000);
      } else if (sessionData.status === 'completed' || sessionData.status === 'requires_review') {
        // Extraction complete (or has conflicts)
        setExtracting(false);
        setHoldings(sessionData.extracted_holdings || []);
        setLoading(false);

        // Send conflict badge if status is requires_review
        if (sessionData.status === 'requires_review' && sessionData.conflict_detected) {
          // Notify extension (if available)
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: 'EXTRACTION_CONFLICT' }).catch(() => {
              // Extension not available, that's ok
            });
          }
        }
      } else if (sessionData.status === 'failed') {
        // Extraction failed
        setExtracting(false);
        setError(sessionData.error_message || 'Extraction failed');
        setLoading(false);
      }
    } catch (err: any) {
      // Check if session expired (404 or specific error message)
      if (err.response?.status === 404 || err.message?.includes('not found')) {
        setError('Session expired. Sessions are valid for 24 hours. Please extract data again from the extension.');
        setExtracting(false);
        setLoading(false);
      } else {
        setError(err.message || 'Failed to load session');
        setExtracting(false);
        setLoading(false);
      }
    }
  }

  async function loadConfig() {
    try {
      const response = await api.get(`/api/import/configs/${configId}`);
      setConfig(response.data);
    } catch (err: any) {
      console.error('Failed to load config:', err);
      // Config loading is not critical, just log it
    }
  }

  async function loadPortfolios() {
    try {
      const response = await api.get('/portfolios/raw');
      const data = response.data;
      if (data && data.portfolios) {
        const portfoliosArray = Object.entries(data.portfolios).map(([id, portfolioData]: [string, any]) => {
          // Extract portfolio metadata
          const metadata = portfolioData.portfolio_metadata || {};

          // Extract accounts with their names
          const accounts = (portfolioData.accounts || []).map((account: any, index: number) => ({
            id: account.account_name || `account_${index}`,
            name: account.account_name || `Account ${index + 1}`,
            type: account.account_type || 'taxable-brokerage'
          }));

          return {
            id: metadata.portfolio_id || id,
            portfolio_name: metadata.portfolio_name || 'Unnamed Portfolio',
            base_currency: metadata.base_currency || 'USD',
            accounts
          };
        });

        setPortfolios(portfoliosArray);

        // Auto-select first portfolio
        if (portfoliosArray.length > 0) {
          setSelectedPortfolioName(portfoliosArray[0].portfolio_name);
        }
      }
    } catch (err: any) {
      console.error('Error loading portfolios:', err);
    }
  }

  function handleEditHolding(index: number, field: 'symbol' | 'units', value: string | number) {
    const updated = [...holdings];
    if (field === 'symbol') {
      updated[index].symbol = value as string;
    } else {
      updated[index].units = parseFloat(value as string) || 0;
    }
    setHoldings(updated);
  }

  function handleDeleteHolding(index: number) {
    setHoldings(holdings.filter((_, i) => i !== index));
  }

  function handleAddHolding() {
    setHoldings([
      ...holdings,
      { symbol: '', units: 0, confidence_score: 1.0 }
    ]);
  }

  async function handleImport() {
    setError(null);
    setImporting(true);

    try {
      if (!selectedPortfolioName) {
        throw new Error('Please select or enter a portfolio name');
      }

      // Find existing portfolio by name or create new one
      let selectedPortfolio = portfolios.find(p => p.portfolio_name === selectedPortfolioName);
      let portfolioId = selectedPortfolio?.id;

      if (!portfolioId) {
        // Create new portfolio with the entered name
        const response = await api.post('/portfolio', {
          portfolio_name: selectedPortfolioName,
          base_currency: 'USD'
        });
        portfolioId = response.data.portfolio_id;
      }

      // Prepare import request
      const importData: any = {
        session_id: sessionId,
        portfolio_id: portfolioId,
        replace_holdings: true  // Always override (not used in backend anymore, but kept for compatibility)
      };

      // Handle account selection/creation
      if (selectedAccountName) {
        // Backend will check if account exists and override, or create new
        importData.account_name = selectedAccountName;

        // Check if account is new to determine if we need to send account_type
        const existingAccount = selectedPortfolio?.accounts?.find(a => a.name === selectedAccountName);
        if (!existingAccount) {
          // New account - send account_type
          importData.account_type = newAccountType;
        }
      }
      // If no account name provided, backend will auto-generate one

      await api.post('/api/import/holdings', importData);

      setSuccess(true);
      setImporting(false);

      // Clear any extension badge
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' }).catch(() => {});
      }

      // Only auto-redirect if NOT showing config suggestion
      // If showing suggestion, user needs time to read and decide
      const hideConfigSuggestion = localStorage.getItem('hideConfigCreationSuggestion') === 'true';
      const willShowSuggestion = !configId && session?.source_url && !hideConfigSuggestion;

      if (!willShowSuggestion) {
        // Redirect to portfolios after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
      // If showing suggestion, user will navigate via "Share Config" or "Maybe Later" buttons

    } catch (err: any) {
      setError(err.message || 'Import failed');
      setImporting(false);
    }
  }

  function handleShareConfig() {
    if (!session?.source_url) return;

    // Save preference if "don't show again" is checked
    if (dontShowAgain) {
      localStorage.setItem('hideConfigCreationSuggestion', 'true');
    }

    // Store URL and flag in sessionStorage
    sessionStorage.setItem('configCreatorSourceUrl', session.source_url);
    sessionStorage.setItem('openConfigCreator', 'true');

    // Navigate to home
    window.location.href = '/';
  }

  function handleMaybeLater() {
    // Save preference if "don't show again" is checked
    if (dontShowAgain) {
      localStorage.setItem('hideConfigCreationSuggestion', 'true');
    }

    // Hide the suggestion and redirect to portfolio
    setShowConfigSuggestion(false);

    // Redirect after a short delay so user sees the card disappear
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }

  async function handleEnableAutoSync() {
    if (!sessionId || !selectedPortfolioName || !config) return;

    setEnablingAutoSync(true);

    try {
      const portfolioId = portfolios.find(p => p.portfolio_name === selectedPortfolioName)?.id;

      await api.post('/api/import/configs/enable', {
        session_id: sessionId,
        config_id: config.config_id,
        mode: 'auto',
        portfolio_id: portfolioId,
        account_name: selectedAccountName || undefined,
        account_type: newAccountType,
        notification_preference: 'notification_only' // Default to notification mode
      });

      setAutoSyncEnabled(true);
      setEnablingAutoSync(false);
    } catch (err: any) {
      console.error('Auto-sync enable error:', err);
      setEnablingAutoSync(false);
    }
  }

  if (loading || extracting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-blue-400 text-6xl mb-4">
            <div className="animate-spin inline-block w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full"></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {extracting ? 'Extracting Holdings...' : 'Loading...'}
          </h2>
          <p className="text-gray-300">
            {extracting
              ? 'Our AI is analyzing your portfolio data. This usually takes 5-15 seconds.'
              : 'Loading import session...'}
          </p>
          {session?.source_url && (
            <p className="text-gray-500 text-xs mt-4">
              Source: {session.source_url}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error && !session) {
    // Session expired or failed to load
    const isExpired = error.includes('expired') || error.includes('24 hours');

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-red-400 text-6xl text-center mb-4">
            {isExpired ? '⏰' : '❌'}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            {isExpired ? 'Session Expired' : 'Error'}
          </h2>
          <p className="text-gray-300 text-center mb-6">{error}</p>
          {isExpired && (
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 text-sm text-blue-300">
              <p className="font-medium mb-2">To extract data again:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Navigate to your brokerage site</li>
                <li>Click the Vestika extension icon</li>
                <li>Click "Extract Data" or pick elements manually</li>
              </ol>
            </div>
          )}
          <Button
            onClick={() => window.location.href = '/'}
            className="w-full mt-4"
          >
            Return to Portfolio
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-green-400 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Import Successful!</h2>

          {/* Auto-sync offer (only if config was used) */}
          {config && !autoSyncEnabled && (
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mt-6 mb-4 text-left">
              <h3 className="text-blue-300 font-semibold mb-2">Want automatic updates?</h3>
              <p className="text-gray-300 text-sm mb-4">
                Enable auto-sync to automatically update your portfolio when you visit {config.site_name}.
                A notification will appear when updates are ready.
              </p>
              <Button
                onClick={handleEnableAutoSync}
                disabled={enablingAutoSync}
                size="sm"
                className="w-full"
              >
                {enablingAutoSync ? 'Enabling...' : 'Enable Auto-Sync'}
              </Button>
            </div>
          )}

          {autoSyncEnabled && (
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mt-6 mb-4">
              <p className="text-green-300 text-sm">
                ✓ Auto-sync enabled for {config?.site_name}!<br />
                Next time you visit, we'll automatically extract your holdings.
              </p>
            </div>
          )}

          {/* Config creation suggestion (only if no config was used and user hasn't hidden it) */}
          {!config && session?.source_url && showConfigSuggestion && (
            <div className="bg-purple-900/20 border border-purple-500 rounded-lg p-5 mt-6 mb-4 text-left">
              <h3 className="text-purple-300 font-semibold mb-3 text-base">
                💡 Help the Vestika Community
              </h3>
              <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                You just manually imported holdings from <strong className="text-white">{new URL(session.source_url).hostname}</strong>.
                By creating an extraction config, you can:
              </p>
              <ul className="text-gray-300 text-sm mb-4 space-y-1 ml-4 list-disc">
                <li>Make future imports from this site automatic</li>
                <li>Enable auto-sync to keep your portfolio updated</li>
                <li>Help other Vestika users import from {new URL(session.source_url).hostname}</li>
              </ul>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="dontShowAgain"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                <label htmlFor="dontShowAgain" className="text-gray-400 text-xs cursor-pointer">
                  Don't show this again
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleShareConfig}
                  size="sm"
                  className="flex-1"
                >
                  Share Config
                </Button>
                <Button
                  onClick={handleMaybeLater}
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          )}

          {/* Only show redirect message if NOT showing config suggestion OR if auto-sync was enabled */}
          {(!showConfigSuggestion || autoSyncEnabled || config) && (
            <p className="text-gray-300 text-sm mt-4">
              {autoSyncEnabled ? 'Redirecting to your portfolio...' : 'Redirecting in 2 seconds...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Prepare options for ComboBoxes
  const portfolioOptions: ComboBoxOption[] = portfolios.map(p => ({
    value: p.portfolio_name,
    label: p.portfolio_name
  }));

  const selectedPortfolio = portfolios.find(p => p.portfolio_name === selectedPortfolioName);
  const accountOptions: ComboBoxOption[] = (selectedPortfolio?.accounts || []).map(a => ({
    value: a.name,
    label: a.name
  }));

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Review Import</h1>

          {/* Config info banner */}
          {config && (
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-green-400 text-lg">✓</span>
                <div className="flex-1">
                  <p className="text-green-300 text-sm font-medium">
                    Extracted from <strong>{config.site_name}</strong> using {config.creator_name ? `${config.creator_name}'s` : 'a'} configuration
                  </p>
                  {config.verified && (
                    <p className="text-green-400 text-xs mt-1">✓ Verified configuration</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Conflict warning */}
          {session?.status === 'requires_review' && session.conflict_detected && (
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-yellow-300 text-sm font-medium">
                    Significant changes detected
                  </p>
                  <p className="text-yellow-200 text-xs mt-1">
                    {session.conflict_reason || 'The new holdings differ significantly from your previous import. Please review carefully.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-gray-400 text-sm">
            Review the extracted holdings and select where to import them
          </p>
          {session?.source_url && (
            <p className="text-gray-500 text-xs mt-2">
              Source: {session.source_url}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Holdings Table */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">
              Extracted Holdings ({holdings.length})
            </h2>
            <Button
              onClick={handleAddHolding}
              size="sm"
              aria-label="Add new holding to the list"
            >
              + Add Holding
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium py-3 px-4">Symbol</th>
                  <th className="text-right text-gray-400 font-medium py-3 px-4">Units</th>
                  <th className="text-center text-gray-400 font-medium py-3 px-4">Confidence</th>
                  <th className="text-center text-gray-400 font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding, index) => (
                  <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={holding.symbol}
                        onChange={(e) => handleEditHolding(index, 'symbol', e.target.value)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="SYMBOL"
                        aria-label={`Symbol for holding ${index + 1}`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        value={holding.units}
                        onChange={(e) => handleEditHolding(index, 'units', e.target.value)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        step="0.01"
                        aria-label={`Units for holding ${index + 1}`}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          holding.confidence_score > 0.8
                            ? 'bg-green-900/30 text-green-400'
                            : holding.confidence_score > 0.5
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}
                      >
                        {(holding.confidence_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        onClick={() => handleDeleteHolding(index)}
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete holding ${holding.symbol || index + 1}`}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {holdings.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No holdings to import. Add some using the button above.
            </div>
          )}
        </div>

        {/* Import Configuration */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Import Destination</h2>

          {/* Portfolio Selection */}
          <div className="mb-4">
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Portfolio *
            </label>
            <ComboBox
              options={portfolioOptions}
              value={selectedPortfolioName}
              onChange={(value) => {
                setSelectedPortfolioName(value);
                // Reset account selection when portfolio changes
                setSelectedAccountName('');
              }}
              placeholder="Select or type portfolio name..."
              allowCustom={true}
              emptyMessage="No portfolios found. Type to create new."
            />
            <p className="text-gray-500 text-xs mt-2">
              {selectedPortfolio
                ? 'Importing to existing portfolio'
                : selectedPortfolioName
                ? `Will create new portfolio "${selectedPortfolioName}"`
                : 'Select an existing portfolio or type a new name'}
            </p>
          </div>

          {/* Account Selection */}
          <div className="mb-4">
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Account
            </label>
            <ComboBox
              options={accountOptions}
              value={selectedAccountName}
              onChange={setSelectedAccountName}
              placeholder="Select or type account name..."
              allowCustom={true}
              disabled={!selectedPortfolioName}
              emptyMessage="No accounts found. Type to create new."
            />

            {/* Account Type Selection - only shown when creating new account */}
            {selectedAccountName && !selectedPortfolio?.accounts?.find(a => a.name === selectedAccountName) && (
              <div className="mt-2">
                <label htmlFor="account-type" className="block text-gray-400 text-xs font-medium mb-1">
                  Account Type
                </label>
                <select
                  id="account-type"
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  aria-label="Select account type for new account"
                >
                  <option value="bank-account">Bank Account</option>
                  <option value="investment-account">Investment Account</option>
                  <option value="education-fund">Education Fund</option>
                  <option value="retirement-account">Retirement Account</option>
                  <option value="company-custodian-account">Company Custodian Account</option>
                </select>
              </div>
            )}

            <p className="text-gray-500 text-xs mt-2">
              {selectedAccountName && selectedPortfolio?.accounts?.find(a => a.name === selectedAccountName)
                ? '⚠️  WARNING: All existing holdings in this account will be OVERRIDDEN (replaced)'
                : selectedAccountName
                ? `Will create new account "${selectedAccountName}"`
                : 'Select an existing account or type a new name (optional)'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleImport}
            disabled={importing || holdings.length === 0}
            size="lg"
            className="flex-1"
            aria-label={importing ? 'Importing holdings in progress' : `Import ${holdings.length} holdings to portfolio`}
          >
            {importing ? 'Importing...' : `Import ${holdings.length} Holding(s)`}
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="secondary"
            size="lg"
            aria-label="Cancel import and return to portfolio"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
