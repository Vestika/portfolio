import React, { useState, useEffect, useRef } from 'react';
import api from './utils/api';
import PieChart from './PieChart';
import AccountSelector from './AccountSelector';
import PortfolioSummary from './PortfolioSummary';
import LoadingScreen from './LoadingScreen';
import HoldingsTable from './HoldingsTable';
import AIChat from './components/AIChat';
import Login from './components/Login';
import { useAuth } from './contexts/AuthContext';
import { signOutUser } from './firebase';
import { useAIChatFlag } from './hooks/useFeatureFlag';
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo,
  PortfolioData,
  HoldingsTableData,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAxiosErrorWithStatus(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeResponse = (err as any).response;
  return (
    maybeResponse &&
    typeof maybeResponse === 'object' &&
    'status' in maybeResponse &&
    maybeResponse.status === status
  );
}

const HEADER_HEIGHT = 128; // px, adjust if needed

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const aiChatEnabled = useAIChatFlag();
  const [portfolioMetadata, setPortfolioMetadata] = useState<PortfolioMetadata | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValueVisible, setIsValueVisible] = useState(true);
  const [availablePortfolios, setAvailablePortfolios] = useState<PortfolioFile[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [holdingsData, setHoldingsData] = useState<HoldingsTableData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Get default portfolio from backend API
  const getDefaultPortfolio = async (): Promise<string | null> => {
    try {
      const response = await api.get(`/default-portfolio`);
      return response.data.default_portfolio_id;
    } catch (error) {
      console.error('Failed to fetch default portfolio:', error);
      return null;
    }
  };

  const fetchAvailablePortfolios = async () => {
    try {
      const response = await api.get(`/portfolios`);
      const portfolios = response.data || [];
      setAvailablePortfolios(portfolios);
      return portfolios;
    } catch (err) {
      console.error('Failed to fetch available portfolios:', err);
      setAvailablePortfolios([]);
      setError('Failed to fetch available portfolios');
      return [];
    }
  };

  // Initialize the app with proper default portfolio logic
  const initializeApp = async () => {
    try {
      setIsLoading(true);
      
      // First, fetch available portfolios
      const portfolios = await fetchAvailablePortfolios();
      
      if (portfolios.length === 0) {
        // No portfolios found - this is fine, user will create one manually
        console.log('No portfolios found - showing empty state');
        setIsLoading(false);
        return;
      }
      
      // Check for default portfolio
      const defaultPortfolioId = await getDefaultPortfolio();
      
      let portfolioToSelect = portfolios[0].portfolio_id; // fallback to first
      
      if (defaultPortfolioId && portfolios.some((p: PortfolioFile) => p.portfolio_id === defaultPortfolioId)) {
        portfolioToSelect = defaultPortfolioId;
        console.log(`Loading default portfolio: ${defaultPortfolioId}`);
      } else {
        console.log(`No default portfolio found for user, using first portfolio`);
      }
      
      setSelectedPortfolioId(portfolioToSelect);
      setIsInitialized(true);
      
    } catch (err) {
      console.error('Failed to initialize app:', err);
      setError('Failed to initialize application');
      setIsLoading(false);
    }
  };

  const fetchPortfolioMetadata = async () => {
    if (!selectedPortfolioId) {
      console.warn('No portfolio selected, skipping metadata fetch');
      return;
    }
    
    try {
      const metadata = await api.get(`/portfolio?portfolio_id=${selectedPortfolioId}`);
      setPortfolioMetadata(metadata.data);
      setSelectedAccounts(metadata.data.accounts.map((acc: AccountInfo) => acc.account_name));
      return metadata.data;
    } catch (err: unknown) {
      if (isAxiosErrorWithStatus(err, 404)) {
        // Portfolio not found, try to select first available portfolio
        console.error(`Portfolio ${selectedPortfolioId} not found`);
        
        if (availablePortfolios.length > 0) {
          const firstPortfolio = availablePortfolios[0];
          setSelectedPortfolioId(firstPortfolio.portfolio_id);
          return; // Let the useEffect handle the retry
        }
      }
      setError('Failed to fetch portfolio metadata');
      throw err;
    }
  };

  const fetchPortfolioBreakdown = async (accountNames: string[] | null = null) => {
    if (!selectedPortfolioId) {
      console.warn('No portfolio selected, skipping breakdown fetch');
      return;
    }
    
    try {
      const params = new URLSearchParams();
      params.append('portfolio_id', selectedPortfolioId);
      if (accountNames) {
        accountNames.forEach(name => params.append('account_names', name));
      }

      // Make both API calls in parallel instead of sequential
      const [breakdownResponse, holdingsResponse] = await Promise.all([
        api.get(`/portfolio/breakdown?${params}`),
        api.get(`/portfolio/holdings?${params}`)
      ]);

      setPortfolioData(breakdownResponse.data);
      setHoldingsData(holdingsResponse.data);
      setIsLoading(false);
    } catch (err: unknown) {
      if (isAxiosErrorWithStatus(err, 404)) {
        // Portfolio not found, try to select first available portfolio
        console.error(`Portfolio ${selectedPortfolioId} not found in breakdown`);
        
        if (availablePortfolios.length > 0) {
          const firstPortfolio = availablePortfolios[0];
          setSelectedPortfolioId(firstPortfolio.portfolio_id);
          return; // Let the useEffect handle the retry
        }
      }
      setError('Failed to fetch portfolio breakdown');
      setTimeout(() => { setIsLoading(false); }, 300);
    }
  };

    useEffect(() => {
        if (!authLoading && user && !isInitialized) {
            initializeApp();
        }
    }, [authLoading, user, isInitialized]);

  // Load portfolio data when portfolio selection changes (after initialization)
  useEffect(() => {
    const loadPortfolioData = async () => {
      if (!selectedPortfolioId || !isInitialized) return;
      
      try {
        setIsLoading(true);
        await fetchPortfolioMetadata();
        await fetchPortfolioBreakdown(null);
      } catch (err) {
        console.error(err);
      }
    };

    loadPortfolioData();
  }, [selectedPortfolioId, isInitialized]);

  const handleAccountsChange = (accountNames: string[]) => {
    setSelectedAccounts(accountNames);
    fetchPortfolioBreakdown(accountNames);
  };

  const handleToggleVisibility = () => {
    setIsValueVisible(!isValueVisible);
  };

  const handlePortfolioCreated = async (newPortfolioId: string) => {
    try {
      // Refresh available portfolios
      await fetchAvailablePortfolios();
      
      // If this was the first portfolio, initialize the app
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Switch to the new portfolio - the useEffect will handle loading the data
      setSelectedPortfolioId(newPortfolioId);
      
    } catch (err) {
      console.error('Failed to handle portfolio creation:', err);
    }
  };

  const handleAccountAdded = async () => {
    // Refresh the current portfolio metadata and data
    try {
      setIsLoading(true);
      await fetchPortfolioMetadata();
      await fetchPortfolioBreakdown(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePortfolioDeleted = async (deletedPortfolioId: string) => {
    // Refresh available portfolios
    const portfolios = await fetchAvailablePortfolios();
    // If the deleted portfolio was the selected one, switch to the first available
    if (deletedPortfolioId === selectedPortfolioId) {
      if (portfolios.length > 0) {
        setSelectedPortfolioId(portfolios[0].portfolio_id);
      } else {
        setSelectedPortfolioId("");
      }
    }
  };

  const handleAccountDeleted = async () => {
    // Refresh the current portfolio metadata and data
    try {
      setIsLoading(true);
      await fetchPortfolioMetadata();
      await fetchPortfolioBreakdown(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDefaultPortfolioSet = (portfolioId: string) => {
    // The backend update is already handled in the PortfolioSelector component
    // We could add additional logic here if needed, such as showing a notification
    console.log(`Portfolio ${portfolioId} set as default`);
    
    // Optionally, we could show a success notification here
    // For now, just log the success
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    // TODO: Implement profile functionality
    console.log('Profile clicked');
  };

  const handleSettingsClick = () => {
    handleMenuClose();
    // TODO: Implement settings functionality
    console.log('Settings clicked');
  };

  const handleSignOutClick = async () => {
    handleMenuClose();
    await handleSignOut();
  };

  const toggleAIChat = () => {
    setIsAIChatOpen(!isAIChatOpen);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 600) { // Min 280px, Max 600px
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Show loading screen while auth is loading
  if (authLoading) return <LoadingScreen />;

  // Show login screen if user is not authenticated
  if (!user) return <Login />;

  // Show loading screen while app is loading
  if (isLoading) return <LoadingScreen />;
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              initializeApp();
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // When no portfolios exist, still show the normal layout with topbar
  // but display empty content areas instead of hiding everything
  const showEmptyState = availablePortfolios.length === 0;
  
  // Create mock metadata for empty state to keep UI working
  const mockMetadata: PortfolioMetadata = {
    base_currency: 'USD',
    user_name: user?.displayName || user?.email || 'User',
    accounts: []
  };
  
  const displayMetadata = showEmptyState ? mockMetadata : portfolioMetadata;
  const displayData = showEmptyState ? [] : portfolioData;
  
  if (!displayMetadata || (!showEmptyState && !displayData)) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Sticky Header Section */}
      <div
        className="sticky top-0 z-30 bg-gray-900 px-4 sm:px-6 lg:px-8"
        style={{ height: HEADER_HEIGHT, minHeight: HEADER_HEIGHT }}
      >
        <AccountSelector
          portfolioMetadata={displayMetadata}
          onAccountsChange={handleAccountsChange}
          onToggleVisibility={handleToggleVisibility}
          availableFiles={availablePortfolios}
          selectedFile={selectedPortfolioId}
          onPortfolioChange={setSelectedPortfolioId}
          onPortfolioCreated={handlePortfolioCreated}
          onAccountAdded={handleAccountAdded}
          onPortfolioDeleted={handlePortfolioDeleted}
          onAccountDeleted={handleAccountDeleted}
          onDefaultPortfolioSet={handleDefaultPortfolioSet}
          // New props for the moved buttons
          aiChatEnabled={aiChatEnabled}
          isAIChatOpen={isAIChatOpen}
          onToggleAIChat={toggleAIChat}
          anchorEl={anchorEl}
          onMenuOpen={handleMenuOpen}
          onMenuClose={handleMenuClose}
          onProfileClick={handleProfileClick}
          onSettingsClick={handleSettingsClick}
          onSignOutClick={handleSignOutClick}
        />
        <PortfolioSummary
          accounts={displayMetadata.accounts}
          selectedAccountNames={selectedAccounts}
          baseCurrency={displayMetadata.base_currency}
          isValueVisible={isValueVisible}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Portfolio Data Section */}
        <div
          className="flex-1 transition-all duration-300"
          style={{
            marginRight: aiChatEnabled && isAIChatOpen && window.innerWidth >= 1024 ? `${chatWidth}px` : '0px',
          }}
        >
          <main className="flex-1">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {showEmptyState ? (
                // Empty state content
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center max-w-md">
                    <div className="text-6xl mb-6">📊</div>
                    <h2 className="text-2xl font-bold text-white mb-4">Welcome to Your Portfolio Dashboard</h2>
                    <p className="text-gray-300 mb-6">
                      You don't have any portfolios yet. Create your first portfolio using the dropdown menu above to start tracking your investments.
                    </p>
                    <div className="text-left space-y-2 text-sm text-gray-400 bg-gray-800 p-4 rounded-lg">
                      <p className="font-medium text-white mb-2">Getting Started:</p>
                      <p>• Click the dropdown above to create a portfolio</p>
                      <p>• Add accounts (bank, brokerage, retirement)</p>
                      <p>• Track stocks, bonds, ETFs, and cash holdings</p>
                      <p>• View performance analytics and breakdowns</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Normal portfolio content
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                  {displayData && displayData.map(chart => (
                    <PieChart
                      key={chart.chart_title}
                      title={`<b>${chart.chart_title}</b>${
                        isValueVisible
                          ? ` <span class="text-xs text-gray-400 ml-1">
                              ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                                chart.chart_total
                              )}
                              (${displayMetadata.base_currency})
                              </span>`
                          : ''
                      }`}
                      data={chart.chart_data}
                      total={chart.chart_total}
                      baseCurrency={displayMetadata.base_currency}
                      hideValues={!isValueVisible}
                    />
                  ))}
                </div>
              )}
              {holdingsData && !showEmptyState && (
                <div className="mt-8">
                  <HoldingsTable
                    data={holdingsData}
                    isValueVisible={isValueVisible}
                  />
                </div>
              )}
            </div>
          </main>
        </div>

        {/* AI Chat Sidebar */}
        {aiChatEnabled && isAIChatOpen && (
          <div
            className={`fixed inset-0 z-40 transition-transform duration-300 transform ${
              isAIChatOpen ? 'translate-x-0' : 'translate-x-full'
            } lg:relative lg:translate-x-0 lg:inset-y-0`}
            style={{
              width: window.innerWidth < 1024 ? '100%' : `${chatWidth}px`,
              top: 0,
              height: '100vh',
            }}
          >
            <div
              ref={resizeRef}
              onMouseDown={handleMouseDown}
              className={`absolute left-0 top-0 w-1.5 h-full bg-gray-700 cursor-col-resize hover:bg-blue-500 transition-colors ${
                isResizing ? 'bg-blue-600' : ''
              }`}
              style={{ zIndex: 50 }}
            />
            <div className="h-full bg-gray-800" style={{ width: '100%' }}>
              <AIChat />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;