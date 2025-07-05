import React, { useState, useEffect } from 'react';
import api from './utils/api';
import PieChart from './PieChart';
import AccountSelector from './AccountSelector';
import PortfolioSummary from './PortfolioSummary';
import LoadingScreen from './LoadingScreen';
import HoldingsTable from './HoldingsTable';
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

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, []);

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
      <div className="flex justify-end p-4">
        <button
          onClick={handleSignOut}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign Out
        </button>
      </div>
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
  );
};

export default App;