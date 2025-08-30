import React, { useState, useEffect } from 'react';
import api from './utils/api';
import AccountSelector from './AccountSelector';
import PortfolioSummary from './PortfolioSummary';
import LoadingScreen from './LoadingScreen';
import Login from './components/Login';
import { TopBar, NavigationView } from './components/TopBar';
import { PortfolioView } from './components/PortfolioView';
import { ExploreView } from './components/ExploreView';
import { NewsView } from './components/NewsView';
import { AIChatView } from './components/AIChatView';
import { ManageTagsView } from './components/ManageTagsView';
import { ToolsView } from './components/ToolsView';
import { useAuth } from './contexts/AuthContext';
import { signOutUser } from './firebase';
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo,
  PortfolioData,
  HoldingsTableData,
} from './types';

function isAxiosErrorWithStatus(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object') return false;
  const maybeResponse = (err as { response?: { status?: number } }).response;
  return !!(
    maybeResponse &&
    typeof maybeResponse === 'object' &&
    'status' in maybeResponse &&
    maybeResponse.status === status
  );
}

const HEADER_HEIGHT = 128; // px, adjust if needed

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

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

  const [mainRSUVesting, setMainRSUVesting] = useState<Record<string, unknown>>({});
  const [mainOptionsVesting, setMainOptionsVesting] = useState<Record<string, unknown>>({});
  const [activeView, setActiveView] = useState<NavigationView>('portfolios');

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


  useEffect(() => {
    if (!portfolioMetadata || !selectedPortfolioId) return;

    // Extract RSU vesting data from portfolio metadata (now included in the response)
    const vestingMap: Record<string, any> = {};
    (portfolioMetadata.accounts || []).forEach((account) => {
      const type = account.account_type || account.account_properties?.type;
      if (type === 'company-custodian-account') {
        // Use RSU vesting data from portfolio metadata if available
        vestingMap[account.account_name] = account.rsu_vesting_data || [];
      }
    });
    setMainRSUVesting(vestingMap);

    // Fetch Options vesting for all company-custodian-accounts in the selected portfolio
    const fetchAllOptionsVesting = async () => {
      const vestingMap: Record<string, unknown> = {};
      await Promise.all(
        (portfolioMetadata.accounts || []).map(async (account) => {
          const type = account.account_type || account.account_properties?.type;
          if (type === 'company-custodian-account') {
            try {
              const res = await api.get(`/portfolio/${selectedPortfolioId}/accounts/${encodeURIComponent(account.account_name)}/options-vesting`);
              vestingMap[account.account_name] = (res.data && res.data.plans) || [];
            } catch {
              vestingMap[account.account_name] = [];
            }
          }
        })
      );
      setMainOptionsVesting(vestingMap);
    };

    fetchAllOptionsVesting();
  }, [portfolioMetadata, selectedPortfolioId]);

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
  
  // For portfolios view, we need to handle empty state
  const showEmptyState = availablePortfolios.length === 0;
  
  // Create mock metadata for empty state to keep UI working
  const mockMetadata: PortfolioMetadata = {
    base_currency: 'USD',
    user_name: user?.displayName || user?.email || 'User',
    accounts: []
  };
  
  const displayMetadata = showEmptyState ? mockMetadata : portfolioMetadata;
  
  // For non-portfolio views, we don't need to check portfolio data
  if (activeView === 'portfolios' && !displayMetadata) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white relative">
      {/* Top Bar Navigation */}
      <TopBar 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />
      
            {/* Sticky Header Section - only show for portfolios view */}
      {activeView === 'portfolios' && displayMetadata && (
        <div
          className="sticky z-30 bg-gray-900"
          style={{ top: '37px', height: HEADER_HEIGHT, minHeight: HEADER_HEIGHT }}
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
      )}

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Main View Content */}
        <div
          className="flex-1 transition-all duration-300 w-full"

        >
          <main className="flex-1">
            {activeView === 'portfolios' && (
              <PortfolioView
                portfolioMetadata={portfolioMetadata}
                portfolioData={portfolioData}
                holdingsData={holdingsData}
                availablePortfolios={availablePortfolios}
                isValueVisible={isValueVisible}
                mainRSUVesting={mainRSUVesting}
                mainOptionsVesting={mainOptionsVesting}
              />
            )}
            {activeView === 'explore' && <ExploreView />}
            {activeView === 'news' && <NewsView />}
            {activeView === 'analyst' && <AIChatView />}
            {activeView === 'tags' && <ManageTagsView />}
            {activeView === 'tools' && <ToolsView />}
          </main>
        </div>


      </div>
    </div>
  );
};

export default App;