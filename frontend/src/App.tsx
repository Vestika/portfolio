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
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo,
  PortfolioData,
  HoldingsTableData,
} from './types';
import { 
  IconButton, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText 
} from '@mui/material';
import { 
  Person, 
  Settings, 
  Logout,
  Chat,
  Close
} from '@mui/icons-material';

// Type guard for axios-like errors
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
  const getDefaultPortfolio = async (userName: string): Promise<string | null> => {
    try {
      const response = await api.get(`/user/${encodeURIComponent(userName)}/default-portfolio`);
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
        setError('No portfolios available');
        setIsLoading(false);
        return;
      }

      // Get user name from the first portfolio to determine default
      const tempMetadata = await api.get(`/portfolio?portfolio_id=${portfolios[0].portfolio_id}`);
      const userName = tempMetadata.data.user_name;
      
      // Check for default portfolio
      const defaultPortfolioId = await getDefaultPortfolio(userName);
      
      let portfolioToSelect = portfolios[0].portfolio_id; // fallback to first
      
      if (defaultPortfolioId && portfolios.some((p: PortfolioFile) => p.portfolio_id === defaultPortfolioId)) {
        portfolioToSelect = defaultPortfolioId;
        console.log(`Loading default portfolio: ${defaultPortfolioId}`);
      } else {
        console.log(`No default portfolio found for user ${userName}, using first portfolio`);
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
    // Refresh available portfolios
    await fetchAvailablePortfolios();
    // Switch to the new portfolio
    setSelectedPortfolioId(newPortfolioId);
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
  if (error) return <div>{error}</div>;
  if (!portfolioMetadata || !portfolioData) return null;

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Person Icon Dropdown - Positioned at top right */}
      <div className="fixed top-4 right-4 z-50">
        <IconButton
          onClick={handleMenuOpen}
          sx={{
            color: 'white',
            backgroundColor: 'rgba(55, 65, 81, 0.8)',
            backdropFilter: 'blur(8px)',
            '&:hover': {
              backgroundColor: 'rgba(55, 65, 81, 1)',
            },
          }}
        >
          <Person />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              backgroundColor: '#374151',
              color: 'white',
              '& .MuiMenuItem-root:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            },
          }}
        >
          <MenuItem onClick={handleProfileClick}>
            <ListItemIcon>
              <Person sx={{ color: 'white' }} />
            </ListItemIcon>
            <ListItemText>Profile</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleSettingsClick}>
            <ListItemIcon>
              <Settings sx={{ color: 'white' }} />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleSignOutClick}>
            <ListItemIcon>
              <Logout sx={{ color: 'white' }} />
            </ListItemIcon>
            <ListItemText>Sign Out</ListItemText>
          </MenuItem>
        </Menu>
      </div>

      {/* AI Chat Toggle Button - Positioned at top right, next to person icon */}
      <div className="fixed top-4 right-16 z-50">
        <IconButton
          onClick={toggleAIChat}
          sx={{
            color: 'white',
            backgroundColor: isAIChatOpen ? 'rgba(59, 130, 246, 0.8)' : 'rgba(55, 65, 81, 0.8)',
            backdropFilter: 'blur(8px)',
            '&:hover': {
              backgroundColor: isAIChatOpen ? 'rgba(59, 130, 246, 1)' : 'rgba(55, 65, 81, 1)',
            },
          }}
        >
          {isAIChatOpen ? <Close /> : <Chat />}
        </IconButton>
      </div>

      {/* Sticky Header Section */}
      <div
        className="sticky top-0 z-30 bg-gray-900"
        style={{ height: HEADER_HEIGHT, minHeight: HEADER_HEIGHT }}
      >
        <AccountSelector
          portfolioMetadata={portfolioMetadata}
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
        />
        <PortfolioSummary
          accounts={portfolioMetadata.accounts}
          selectedAccountNames={selectedAccounts}
          baseCurrency={portfolioMetadata.base_currency}
          isValueVisible={isValueVisible}
        />
      </div>

      {/* Main Content Area - Adjusts based on chat visibility */}
      <div className="flex">
        {/* Portfolio Data Section */}
        <div
          className="flex-1 transition-all duration-300"
          style={{
            marginRight: isAIChatOpen ? `${chatWidth}px` : '0px',
          }}
        >
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {portfolioData.map(chart => (
                <PieChart
                  key={chart.chart_title}
                  title={`<b>${chart.chart_title}</b>${
                    isValueVisible
                      ? ` <span class="text-xs text-gray-400 ml-1">
                          ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                            chart.chart_total
                          )}
                          (${portfolioMetadata.base_currency})
                          </span>`
                      : ''
                  }`}
                  data={chart.chart_data}
                  total={chart.chart_total}
                  baseCurrency={portfolioMetadata.base_currency}
                  hideValues={!isValueVisible}
                />
              ))}
            </div>
            {holdingsData && (
              <div className="mt-8">
                <HoldingsTable
                  data={holdingsData}
                  isValueVisible={isValueVisible}
                />
              </div>
            )}
          </div>
        </div>

        {/* AI Chat Sidebar */}
        <div
          className={`fixed right-0 transition-transform duration-300 transform ${
            isAIChatOpen ? 'translate-x-0' : 'translate-x-full'
          } z-40`}
          style={{
            width: `${chatWidth}px`,
            top: HEADER_HEIGHT,
            height: `calc(100vh - ${HEADER_HEIGHT}px)`
          }}
        >
          {/* Resize Handle */}
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 w-1 h-full bg-gray-600 cursor-col-resize hover:bg-blue-500 transition-colors"
            onMouseDown={handleMouseDown}
          />
          <div className="h-full p-4">
            <AIChat
              portfolioId={selectedPortfolioId}
              portfolioName={availablePortfolios.find(p => p.portfolio_id === selectedPortfolioId)?.portfolio_name || 'Portfolio'}
              isOpen={isAIChatOpen}
              onClose={() => setIsAIChatOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;