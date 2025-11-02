import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Button } from '@/components/ui/button';
import { ConfigCreatorView } from './ConfigCreatorView';
import { ComboBox } from './ui/combobox';
import { usePortfolioData } from '../contexts/PortfolioDataContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, FileText, Download, Eye, Upload } from 'lucide-react';

interface SharedConfig {
  config_id: string;
  site_name: string;
  url_pattern: string;
  selector?: string;
  full_page: boolean;
  creator_name?: string;
  verified: boolean;
  status: 'active' | 'under_review' | 'deprecated';
  enabled_users_count?: number;
  successful_imports_count?: number;
  created_at: string;
  is_public?: boolean;
  visibility?: 'public' | 'private';
  is_owner?: boolean;
}

interface Portfolio {
  id: string;
  portfolio_name: string;
  accounts?: Account[];
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface EnabledConfig {
  config_id: string;
  mode: 'manual' | 'auto';
  portfolio_name?: string;
  account_name?: string;
}

export const ConfigGalleryView: React.FC = () => {
  // Portfolio data comes from PortfolioDataContext
  const {
    allPortfoliosData,
    loadAllPortfoliosData,
    isLoading: isPortfolioDataLoading,
  } = usePortfolioData();

  const [configs, setConfigs] = useState<SharedConfig[]>([]);
  const [enabledConfigs, setEnabledConfigs] = useState<EnabledConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [highlightedConfigId, setHighlightedConfigId] = useState<string | null>(null);

  // Config enablement modal state
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [enableMode, setEnableMode] = useState<'manual' | 'auto'>('auto'); // Track which mode user chose
  const [selectedConfig, setSelectedConfig] = useState<SharedConfig | null>(null);
  const [selectedPortfolioName, setSelectedPortfolioName] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);

  // Config view/edit state
  const [viewingConfig, setViewingConfig] = useState<SharedConfig | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Check sessionStorage for config creator trigger
  const shouldOpenCreator = sessionStorage.getItem('openConfigCreator') === 'true';
  const sourceUrl = sessionStorage.getItem('configCreatorSourceUrl') || undefined;
  const [showCreator, setShowCreator] = useState(shouldOpenCreator);
  const [creatorVisibility, setCreatorVisibility] = useState<'public' | 'private'>('public');

  useEffect(() => {
    loadConfigs();
    loadEnabledConfigs();

    // Clear sessionStorage flags after reading
    if (shouldOpenCreator) {
      sessionStorage.removeItem('openConfigCreator');
    }
    const storedVisibilityValue = sessionStorage.getItem('configCreatorVisibility');
    if (storedVisibilityValue) {
      setCreatorVisibility(storedVisibilityValue === 'private' ? 'private' : 'public');
      sessionStorage.removeItem('configCreatorVisibility');
    }

  }, [shouldOpenCreator]);

  useEffect(() => {
    if (!highlightedConfigId) return;
    const timeout = window.setTimeout(() => setHighlightedConfigId(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [highlightedConfigId]);

  // Ensure portfolio data is available (mirrors ImportView auto-population)
  useEffect(() => {
    if (!allPortfoliosData && !isPortfolioDataLoading) {
      loadAllPortfoliosData().catch((err: unknown) => {
        console.error('Failed to load portfolio data for config gallery:', err);
      });
    }
  }, [allPortfoliosData, isPortfolioDataLoading, loadAllPortfoliosData]);

  // Transform portfolio data into local shape once loaded
  useEffect(() => {
    if (!allPortfoliosData?.portfolios) {
      setPortfolios([]);
      return;
    }

    const mappedPortfolios: Portfolio[] = Object.values(allPortfoliosData.portfolios).map(portfolio => ({
      id: portfolio.portfolio_metadata.portfolio_id,
      portfolio_name: portfolio.portfolio_metadata.portfolio_name,
      accounts: (portfolio.accounts || []).map(account => ({
        id: `${portfolio.portfolio_metadata.portfolio_id}::${account.account_name}`,
        name: account.account_name,
        type: account.account_type,
      }))
    }));

    setPortfolios(mappedPortfolios);
  }, [allPortfoliosData]);

  async function loadConfigs() {
    try {
      const response = await api.get('/api/import/configs');
      setConfigs(response.data.configs || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load configs');
      setLoading(false);
    }
  }

  async function loadEnabledConfigs() {
    try {
      const response = await api.get('/api/import/configs/enabled');
      setEnabledConfigs(response.data.enabled_configs || []);
    } catch (err: any) {
      console.error('Failed to load enabled configs:', err);
    }
  }

  function handleEnableClick(config: SharedConfig, mode: 'manual' | 'auto') {
    setSelectedConfig(config);
    setEnableMode(mode);
    setSelectedPortfolioName('');
    setSelectedAccountName('');
    setEnableError(null);
    setShowEnableModal(true);
  }

  // When auto-sync modal opens, preselect first available portfolio/account
  useEffect(() => {
    if (!showEnableModal || enableMode !== 'auto') return;
    if (selectedPortfolioName || portfolios.length === 0) return;

    setSelectedPortfolioName(portfolios[0].portfolio_name);
  }, [showEnableModal, enableMode, portfolios, selectedPortfolioName]);

  // Keep account selection in sync with chosen portfolio when auto mode is active
  useEffect(() => {
    if (!showEnableModal || enableMode !== 'auto') return;

    const portfolio = portfolios.find(p => p.portfolio_name === selectedPortfolioName);
    const accounts = portfolio?.accounts || [];

    if (accounts.length === 0) {
      setSelectedAccountName('');
      return;
    }

    const alreadySelected = accounts.some(acc => acc.name === selectedAccountName);
    if (!selectedAccountName || !alreadySelected) {
      setSelectedAccountName(accounts[0].name);
    }
  }, [showEnableModal, enableMode, portfolios, selectedPortfolioName, selectedAccountName]);

  async function handleEnableManual() {
    if (!selectedConfig) return;

    setEnabling(true);
    setEnableError(null);

    try {
      // Just enable the config for manual use - no portfolio/account needed
      await api.post('/api/import/configs/enable', {
        config_id: selectedConfig.config_id,
        mode: 'manual',
      });

      // Success - close modal and reload configs
      setShowEnableModal(false);
      setEnabling(false);
      alert(`Config enabled for ${selectedConfig.site_name}!\n\nYou can now use this config for manual imports in the extension.`);
      loadEnabledConfigs();
    } catch (err: any) {
      setEnableError(err.message || 'Failed to enable config');
      setEnabling(false);
    }
  }

  async function handleEnableAutoSync() {
    if (!selectedConfig || !selectedPortfolioName || !selectedAccountName) {
      setEnableError('Please select both portfolio and account');
      return;
    }

    const selectedPortfolio = portfolios.find(p => p.portfolio_name === selectedPortfolioName);
    if (!selectedPortfolio?.id) {
      setEnableError('Selected portfolio is missing an id');
      return;
    }

    setEnabling(true);
    setEnableError(null);

    try {
      await api.post('/api/import/configs/enable', {
        config_id: selectedConfig.config_id,
        mode: 'auto',
        portfolio_id: selectedPortfolio.id,
        account_name: selectedAccountName,
      });

      // Success - close modal and reload configs
      setShowEnableModal(false);
      setEnabling(false);
      alert(`Auto-sync enabled for ${selectedConfig.site_name}!\n\nWhen you visit matching URLs, the extension will automatically extract and import your holdings.`);
      loadEnabledConfigs();
    } catch (err: any) {
      setEnableError(err.message || 'Failed to enable auto-sync');
      setEnabling(false);
    }
  }

  async function handleDisable(config: SharedConfig) {
    const enabledConfig = enabledConfigs.find(ec => ec.config_id === config.config_id);
    if (!enabledConfig) return;

    const confirmMessage = enabledConfig.mode === 'auto'
      ? `Disable auto-sync for ${config.site_name}?\n\nThis will stop automatic extraction for this site.`
      : `Disable config for ${config.site_name}?\n\nThis config will no longer be available in the extension.`;

    if (!confirm(confirmMessage)) return;

    try {
      await api.post('/api/import/configs/disable', {
        config_id: config.config_id,
      });

      alert(`Config disabled for ${config.site_name}`);
      loadEnabledConfigs();
    } catch (err: any) {
      alert(`Failed to disable: ${err.message || 'Unknown error'}`);
    }
  }

  function handleSubmitEnable() {
    if (enableMode === 'manual') {
      handleEnableManual();
    } else {
      handleEnableAutoSync();
    }
  }

  function handleViewConfig(config: SharedConfig) {
    setViewingConfig(config);
  }

  function handleExportConfig(config: SharedConfig) {
    const exportData = {
      config_id: config.config_id,
      site_name: config.site_name,
      url_pattern: config.url_pattern,
      selector: config.selector,
      full_page: config.full_page,
      status: config.status,
      visibility: config.visibility || (config.is_public === false ? 'private' : 'public'),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.site_name.replace(/\s+/g, '_')}_config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    setImportFile(null);
    setImportError(null);
    setShowImportModal(true);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setImportError('Please select a valid JSON file');
        setImportFile(null);
        return;
      }
      setImportFile(file);
      setImportError(null);
    }
  }

  async function handleImportConfig() {
    if (!importFile) {
      setImportError('Please select a file to import');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const fileContent = await importFile.text();
      const configData = JSON.parse(fileContent);

      // Validate required fields
      if (!configData.site_name || !configData.url_pattern) {
        setImportError('Invalid config file: missing required fields (site_name, url_pattern)');
        setImporting(false);
        return;
      }

      // Test regex pattern
      try {
        new RegExp(configData.url_pattern);
      } catch (err) {
        setImportError('Invalid URL pattern: must be a valid regular expression');
        setImporting(false);
        return;
      }

      // Import the config
      await api.post('/api/import/configs', {
        site_name: configData.site_name,
        url_pattern: configData.url_pattern,
        full_page: configData.full_page ?? true,
        selector: configData.selector,
        is_public: configData.visibility === 'public',
        verified: false,
        status: 'active',
        enabled_users_count: 0,
        successful_imports_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      setImporting(false);
      setShowImportModal(false);
      alert(`Config "${configData.site_name}" imported successfully!`);
      loadConfigs(); // Reload configs to show the new one
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setImportError('Invalid JSON file format');
      } else {
        setImportError(err.message || 'Failed to import config');
      }
      setImporting(false);
    }
  }

  const filteredConfigs = configs.filter(config => {
    const matchesSearch = config.site_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          config.url_pattern.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || config.status === filterStatus;
    const visibility = config.visibility || (config.is_public === false ? 'private' : 'public');
    const matchesVisibility = filterVisibility === 'all' || visibility === filterVisibility;
    return matchesSearch && matchesStatus && matchesVisibility;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-white text-center">Loading configurations...</div>
        </div>
      </div>
    );
  }

  // If showing creator or viewing a config, render it instead
  if (showCreator || viewingConfig) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => {
              setShowCreator(false);
              setViewingConfig(null);
            }}
            variant="secondary"
            className="mb-6"
          >
            ← Back to Gallery
          </Button>
          <ConfigCreatorView
            onSuccess={() => {
              setShowCreator(false);
              setViewingConfig(null);
              sessionStorage.removeItem('configCreatorSourceUrl'); // Clear stored URL
              loadConfigs();
            }}
            initialSourceUrl={sourceUrl}
            initialVisibility={creatorVisibility}
            viewingConfig={viewingConfig || undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Extension Configs</h1>
            <p className="text-gray-400">
              Browse and enable prebuilt configurations for automatic portfolio extraction
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleImportClick}
              variant="secondary"
              className="whitespace-nowrap"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Config
            </Button>
            <Button
              onClick={() => {
                setCreatorVisibility('public');
                setShowCreator(true);
              }}
              className="whitespace-nowrap"
            >
              + Create Config
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Search by site name or URL
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Filter by status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="under_review">Under Review</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Visibility
              </label>
              <select
                value={filterVisibility}
                onChange={(e) => setFilterVisibility(e.target.value as 'all' | 'public' | 'private')}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Configs</option>
                <option value="public">Public Only</option>
                <option value="private">Private Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Config Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConfigs.map((config) => {
            const enabledConfig = enabledConfigs.find(ec => ec.config_id === config.config_id);
            const isEnabled = !!enabledConfig;
            const isHighlighted = config.config_id === highlightedConfigId;

            return (
              <div
                key={config.config_id}
                className={`bg-gray-800 rounded-lg p-6 border transition-colors ${
                  isEnabled ? 'border-blue-500' : 'border-gray-700 hover:border-blue-500'
                } ${isHighlighted ? 'ring-2 ring-purple-400 shadow-purple-500/30' : ''}`}
              >
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-white">{config.site_name}</h3>

                    {/* Three-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent data-[state=open]:bg-gray-700 data-[state=open]:text-white"
                          aria-label="Config options"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-gray-300">
                        <DropdownMenuItem
                          onClick={() => handleViewConfig(config)}
                          className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white cursor-pointer"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Config
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExportConfig(config)}
                          className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white cursor-pointer"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export Config
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Creator and badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {config.creator_name && (
                      <p className="text-gray-400 text-sm">by {config.creator_name}</p>
                    )}
                    {config.visibility === 'private' && (
                      <span className="text-purple-300 text-xs font-semibold bg-purple-900/30 px-2 py-1 rounded">
                        Private
                      </span>
                    )}
                    {config.verified && (
                      <span className="text-green-400 text-xs font-semibold bg-green-900/30 px-2 py-1 rounded">
                        ✓ Verified
                      </span>
                    )}
                    {isEnabled && (
                      <span className="text-blue-400 text-xs font-semibold bg-blue-900/30 px-2 py-1 rounded">
                        {enabledConfig.mode === 'auto' ? '⚡ Auto-Sync' : '✓ Enabled'}
                      </span>
                    )}
                  </div>
                </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-700 rounded p-3">
                  <div className="text-gray-400 text-xs mb-1">Enabled Users</div>
                  <div className="text-white font-semibold">{(config.enabled_users_count ?? 0).toLocaleString()}</div>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <div className="text-gray-400 text-xs mb-1">Imports Completed</div>
                  <div className="text-white font-semibold">
                    {(config.successful_imports_count ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="mb-4">
                <div className="text-gray-400 text-xs mb-1">URL Pattern</div>
                <code className="text-gray-300 text-xs bg-gray-700 px-2 py-1 rounded block overflow-x-auto">
                  {config.url_pattern}
                </code>
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  config.status === 'active'
                    ? 'bg-green-900/30 text-green-400'
                    : config.status === 'under_review'
                    ? 'bg-yellow-900/30 text-yellow-400'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {config.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Actions */}
              {isEnabled ? (
                <div className="space-y-2">
                  {enabledConfig.mode === 'auto' && enabledConfig.portfolio_name && (
                    <div className="text-xs text-gray-400 bg-gray-700/50 rounded p-2">
                      <div>Portfolio: {enabledConfig.portfolio_name}</div>
                      <div>Account: {enabledConfig.account_name}</div>
                    </div>
                  )}
                  <Button
                    onClick={() => handleDisable(config)}
                    size="sm"
                    variant="secondary"
                    className="w-full"
                  >
                    Disable
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEnableClick(config, 'manual')}
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    disabled={config.status !== 'active'}
                  >
                    Enable
                  </Button>
                  <Button
                    onClick={() => handleEnableClick(config, 'auto')}
                    size="sm"
                    className="flex-1"
                    disabled={config.status !== 'active'}
                  >
                    Auto-Sync
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        </div>

        {filteredConfigs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No configurations found matching your criteria.</p>
            <Button onClick={() => setShowCreator(true)}>
              + Create Your First Config
            </Button>
          </div>
        )}

        {/* Import Config Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-lg w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">Import Configuration</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Error Display */}
                {importError && (
                  <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{importError}</p>
                  </div>
                )}

                {/* File Upload */}
                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-2">
                    Select Config File
                  </label>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="w-full text-gray-300 bg-gray-700 border border-gray-500 rounded px-3 py-2 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                  />
                  {importFile && (
                    <p className="text-green-400 text-sm mt-2">
                      ✓ Selected: {importFile.name}
                    </p>
                  )}
                </div>

                {/* Info */}
                <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    Import a previously exported config JSON file. The config will be validated and added to your library.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <Button
                  onClick={handleImportConfig}
                  disabled={importing || !importFile}
                  className="flex-1"
                >
                  {importing ? 'Importing...' : 'Import Config'}
                </Button>
                <Button
                  onClick={() => setShowImportModal(false)}
                  variant="secondary"
                  disabled={importing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enable Config / Auto-Sync Modal */}
        {showEnableModal && selectedConfig && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-lg w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">
                  {enableMode === 'manual' ? 'Enable Config' : 'Enable Auto-Sync'}
                </h2>
                <button
                  onClick={() => setShowEnableModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Config Info */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">
                    {enableMode === 'manual' ? 'Enabling config for:' : 'Enabling auto-sync for:'}
                  </div>
                  <div className="text-white font-semibold text-lg">{selectedConfig.site_name}</div>
                  <code className="text-gray-300 text-xs bg-gray-900 px-2 py-1 rounded block overflow-x-auto mt-2">
                    {selectedConfig.url_pattern}
                  </code>
                </div>

                {/* Error Display */}
                {enableError && (
                  <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{enableError}</p>
                  </div>
                )}

                {/* Auto-Sync Mode: Portfolio & Account Selection */}
                {enableMode === 'auto' && (
                  <>
                    {/* Portfolio Selection */}
                    <div>
                      <label className="block text-gray-400 text-sm font-medium mb-2">
                        Select Portfolio *
                      </label>
                      <ComboBox
                        options={portfolios.map(p => ({
                          value: p.portfolio_name,
                          label: p.portfolio_name
                        }))}
                        value={selectedPortfolioName}
                        onChange={setSelectedPortfolioName}
                        placeholder="Choose portfolio..."
                        emptyMessage="No portfolios found"
                      />
                    </div>

                    {/* Account Selection */}
                    <div>
                      <label className="block text-gray-400 text-sm font-medium mb-2">
                        Select Account *
                      </label>
                      <ComboBox
                        options={
                          portfolios
                            .find(p => p.portfolio_name === selectedPortfolioName)
                            ?.accounts?.map(a => ({
                              value: a.name,
                              label: a.name
                            })) || []
                        }
                        value={selectedAccountName}
                        onChange={setSelectedAccountName}
                        placeholder="Choose account..."
                        emptyMessage={selectedPortfolioName ? "No accounts in this portfolio" : "Select a portfolio first"}
                        disabled={!selectedPortfolioName}
                      />
                    </div>
                  </>
                )}

                {/* Info */}
                <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    {enableMode === 'manual'
                      ? 'This config will be available in the extension. You can manually trigger extraction when visiting matching URLs.'
                      : 'When you visit URLs matching this pattern, the extension will automatically extract holdings and save them to the selected account.'}
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <Button
                  onClick={handleSubmitEnable}
                  disabled={enabling || (enableMode === 'auto' && (!selectedPortfolioName || !selectedAccountName))}
                  className="flex-1"
                >
                  {enabling
                    ? 'Enabling...'
                    : enableMode === 'manual'
                      ? 'Enable Config'
                      : 'Enable Auto-Sync'}
                </Button>
                <Button
                  onClick={() => setShowEnableModal(false)}
                  variant="secondary"
                  disabled={enabling}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
