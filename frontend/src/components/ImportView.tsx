import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';

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
  created_at: string;
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

  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(true); // New: track extraction status
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ExtractionSession | null>(null);
  const [holdings, setHoldings] = useState<ExtractedHolding[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);

  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('taxable-brokerage');

  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    loadSession();
    loadPortfolios();
  }, [sessionId]);

  async function loadSession() {
    try {
      const response = await api.get(`/api/extension/sessions/${sessionId}`);
      const sessionData = response.data;

      setSession(sessionData);

      // Check extraction status
      if (sessionData.status === 'processing') {
        // Still extracting, poll again in 2 seconds
        setExtracting(true);
        setTimeout(() => loadSession(), 2000);
      } else if (sessionData.status === 'completed') {
        // Extraction complete
        setExtracting(false);
        setHoldings(sessionData.extracted_holdings || []);
        setLoading(false);
      } else if (sessionData.status === 'failed') {
        // Extraction failed
        setExtracting(false);
        setError(sessionData.error_message || 'Extraction failed');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load session');
      setExtracting(false);
      setLoading(false);
    }
  }

  async function loadPortfolios() {
    try {
      const response = await api.get('/portfolios/raw');
      const data = response.data;
      if (data && data.portfolios) {
        const portfoliosArray = Object.entries(data.portfolios).map(([id, portfolio]: [string, any]) => ({
          id,
          portfolio_name: portfolio.portfolio_name || portfolio.name || id,
          base_currency: portfolio.base_currency || 'USD',
          accounts: portfolio.accounts || []
        }));
        setPortfolios(portfoliosArray);

        // Auto-select first portfolio
        if (portfoliosArray.length > 0) {
          setSelectedPortfolioId(portfoliosArray[0].id);
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
      // Create portfolio if needed
      let portfolioId = selectedPortfolioId;
      if (!portfolioId && newPortfolioName) {
        const response = await api.post('/portfolio', {
          portfolio_name: newPortfolioName,
          base_currency: 'USD'
        });
        portfolioId = response.data.portfolio_id;
      }

      if (!portfolioId) {
        throw new Error('Please select a portfolio or create a new one');
      }

      // Prepare import request
      const importData: any = {
        session_id: sessionId,
        portfolio_id: portfolioId,
        replace_holdings: false
      };

      if (selectedAccountId) {
        importData.account_id = selectedAccountId;
      } else if (newAccountName) {
        importData.account_name = newAccountName;
        importData.account_type = newAccountType;
      }

      await api.post('/api/extension/import', importData);

      setSuccess(true);
      setImporting(false);

      // Redirect to portfolios after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Import failed');
      setImporting(false);
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
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-red-400 text-center mb-4">❌ Error</div>
          <p className="text-gray-300 text-center">{error}</p>
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
          <p className="text-gray-300">Redirecting to your portfolio...</p>
        </div>
      </div>
    );
  }

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId);
  const availableAccounts = selectedPortfolio?.accounts || [];

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Review Import</h1>
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
            <button
              onClick={handleAddHolding}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              + Add Holding
            </button>
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
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="SYMBOL"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        value={holding.units}
                        onChange={(e) => handleEditHolding(index, 'units', e.target.value)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-right"
                        step="0.01"
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
                      <button
                        onClick={() => handleDeleteHolding(index)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
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
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
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
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mt-2"
              />
            )}
          </div>

          {/* Account Selection */}
          <div className="mb-4">
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              disabled={!selectedPortfolioId}
            >
              <option value="">-- Create New Account --</option>
              {availableAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {!selectedAccountId && selectedPortfolioId && (
              <>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Enter new account name (optional)"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mt-2"
                />
                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mt-2"
                >
                  <option value="taxable-brokerage">Taxable Brokerage</option>
                  <option value="ira">IRA</option>
                  <option value="401k">401(k)</option>
                  <option value="roth-ira">Roth IRA</option>
                  <option value="company-custodian-account">Company Account</option>
                </select>
              </>
            )}
            <p className="text-gray-500 text-xs mt-2">
              {selectedAccountId
                ? 'Holdings will be merged into the selected account'
                : 'A new account will be created with an auto-generated name if left empty'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleImport}
            disabled={importing || holdings.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {importing ? 'Importing...' : `Import ${holdings.length} Holding(s)`}
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
