import React, { useState, useEffect, useCallback } from 'react';
import AccountSelector from './AccountSelector';
import PortfolioSummary from './PortfolioSummary';
import LoadingScreen from './LoadingScreen';
import { 
  PortfolioHeaderSkeleton, 
  PortfolioMainSkeleton, 
  ViewTransitionSkeleton,
  ManageTagsViewSkeleton,
  AIChatViewSkeleton,
  NewsViewSkeleton
} from './components/PortfolioSkeleton';
import Login from './components/Login';
import { TopBar, NavigationView } from './components/TopBar';
import { PortfolioView } from './components/PortfolioView';
import { ExploreView } from './components/ExploreView';
import { NewsView } from './components/NewsView';
import { AIChatView } from './components/AIChatView';
import { ManageTagsView } from './components/ManageTagsView';
import { ToolsView } from './components/ToolsView';
import { useAuth } from './contexts/AuthContext';
import { usePortfolioData } from './contexts/PortfolioDataContext';
import { signOutUser } from './firebase';
import {
  PortfolioMetadata,
  PortfolioData,
  HoldingsTableData,
} from './types';

const HEADER_HEIGHT = 128; // px, adjust if needed

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  
  // Use the new ALL portfolios data context
  const { 
    isLoading: portfolioLoading, 
    error: portfolioError, 
    selectedPortfolioId,
    setSelectedPortfolioId,
    selectedAccountNames,
    setSelectedAccountNames,
    currentPortfolioData,
    computedData,
    loadAllPortfoliosData,
    refreshAllPortfoliosData,
    getAvailablePortfolios,
    getOptionsVestingByAccount
  } = usePortfolioData();

  // Local state for UI and navigation
  const [isValueVisible, setIsValueVisible] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mainRSUVesting, setMainRSUVesting] = useState<Record<string, unknown>>({});
  const [mainOptionsVesting, setMainOptionsVesting] = useState<Record<string, unknown>>({});
  const [activeView, setActiveView] = useState<NavigationView>('portfolios');

  // Get available portfolios from context (no separate API call needed)
  const availablePortfolios = getAvailablePortfolios();

  // Derive legacy data structures for compatibility with existing components
  const portfolioMetadata: PortfolioMetadata | null = currentPortfolioData ? {
    base_currency: currentPortfolioData.portfolio_metadata?.base_currency || 'USD',
    user_name: currentPortfolioData.portfolio_metadata?.user_name || 'User',
    accounts: (currentPortfolioData.accounts || []).map((acc: any) => ({
      account_name: acc.account_name,
      account_total: acc.account_total,
      account_type: acc.account_type,
      owners: acc.owners,
      holdings: (acc.holdings || []).map((h: any) => ({ symbol: h.symbol, units: h.units })),
      rsu_plans: acc.rsu_plans || [],
      espp_plans: acc.espp_plans || [],
      options_plans: acc.options_plans || [],
      rsu_vesting_data: acc.rsu_vesting_data || [],
      account_properties: acc.account_properties || {},
      account_cash: acc.account_cash || {},
      isSelected: selectedAccountNames.includes(acc.account_name)
    }))
  } : null;

  const portfolioData: PortfolioData | null = computedData ? computedData.filteredAggregations : null;
  const holdingsData: HoldingsTableData | null = computedData ? computedData.holdingsTable : null;
  
  // Combined loading state
  const isLoading = portfolioLoading;
  
  console.log('📊 [APP] Derived data state:', {
    hasCurrentPortfolioData: !!currentPortfolioData,
    hasComputedData: !!computedData,
    hasPortfolioMetadata: !!portfolioMetadata,
    hasPortfolioData: !!portfolioData,
    hasHoldingsData: !!holdingsData,
    isLoading,
    portfolioError,
    selectedPortfolioId,
    selectedAccountNamesCount: selectedAccountNames.length,
    availablePortfoliosLength: availablePortfolios.length
  });

  // Initialize the app with new ALL portfolios approach
  const initializeApp = useCallback(async () => {
    try {
      console.log('🚀 [APP] Initializing app with ALL portfolios data flow');
      await loadAllPortfoliosData();
      setIsInitialized(true);
      console.log('✅ [APP] App initialization completed');
    } catch (err) {
      console.error('❌ [APP] Failed to initialize app:', err);
      // Error handling is now managed by the context
    }
  }, [loadAllPortfoliosData]);

    useEffect(() => {
        console.log('🔄 [APP] Auth state check:', { authLoading, hasUser: !!user, isInitialized });
        if (!authLoading && user && !isInitialized) {
            console.log('👤 [APP] User authenticated, initializing app');
            initializeApp();
        }
    }, [authLoading, user, isInitialized, initializeApp]);

  // No more individual portfolio loading! All data is loaded upfront


  useEffect(() => {
    // Only run when currentPortfolioData changes (not when accounts are selected)
    if (!currentPortfolioData || !selectedPortfolioId) return;

    console.log('📈 [APP] Extracting RSU/Options data from current portfolio data');
    
    // Extract RSU vesting data from current portfolio data (already included in the response)
    const rsuVestingMap: Record<string, unknown> = {};
    (currentPortfolioData.accounts || []).forEach((account: any) => {
      if (account.account_type === 'company-custodian-account') {
        // Use RSU vesting data from current portfolio data (already computed by backend)
        const rsuData = account.rsu_vesting_data || [];
        console.log(`🔶 [APP] RSU vesting data for ${account.account_name}:`, rsuData.length, 'plans');
        rsuVestingMap[account.account_name] = rsuData;
      }
    });
    setMainRSUVesting(rsuVestingMap);

    // Get Options vesting from context (no API calls needed!)
    const optionsVestingMap: Record<string, unknown> = {};
    const companyCustodianAccounts = (currentPortfolioData.accounts || []).filter(
      (account: any) => account.account_type === 'company-custodian-account'
    );
    
    companyCustodianAccounts.forEach((account: any) => {
      try {
        const optionsData = getOptionsVestingByAccount(selectedPortfolioId || "", account.account_name);
        optionsVestingMap[account.account_name] = optionsData?.plans || [];
      } catch (error) {
        console.log('⚠️ [APP] Using fallback empty options vesting for', account.account_name);
        optionsVestingMap[account.account_name] = [];
      }
    });
    
    console.log('📊 [APP] Using options vesting from context for', companyCustodianAccounts.length, 'company accounts (no API calls)');
    setMainOptionsVesting(optionsVestingMap);
  }, [currentPortfolioData, selectedPortfolioId, getOptionsVestingByAccount]); // Updated: depend on currentPortfolioData

  const handleAccountsChange = (accountNames: string[]) => {
    console.log('🎯 [APP] Account selection changed - using new client-side filtering:', {
      newSelection: accountNames,
      previousSelection: selectedAccountNames,
      timestamp: new Date().toISOString()
    });
    setSelectedAccountNames(accountNames);
    // No API call needed! Data is filtered locally in the context
  };

  const handleToggleVisibility = () => {
    setIsValueVisible(!isValueVisible);
  };

  const handlePortfolioCreated = async (newPortfolioId: string) => {
    try {
      console.log('🏗️ [APP] Portfolio created - refreshing ALL portfolios data');
      
      // Refresh ALL portfolios data to include the new portfolio
      await refreshAllPortfoliosData();
      
      // If this was the first portfolio, the context will auto-initialize
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Switch to the new portfolio (instant, no API call)
      setSelectedPortfolioId(newPortfolioId);
      
    } catch (err) {
      console.error('❌ [APP] Failed to handle portfolio creation:', err);
    }
  };

  const handleAccountAdded = async () => {
    // Refresh ALL portfolios data since account was added
    console.log('🏦 [APP] Account added - refreshing ALL portfolios data');
    try {
      await refreshAllPortfoliosData();
    } catch (err) {
      console.error('❌ [APP] Error refreshing after account addition:', err);
    }
  };

  const handlePortfolioDeleted = async (deletedPortfolioId: string) => {
    // Refresh ALL portfolios data since portfolio was deleted
    console.log('🗑️ [APP] Portfolio deleted - refreshing ALL portfolios data');
    try {
      await refreshAllPortfoliosData();
      
      // If the deleted portfolio was the selected one, context will auto-select another
      if (deletedPortfolioId === selectedPortfolioId) {
        console.log('📌 [APP] Deleted portfolio was selected - context will auto-select new one');
        // Context will handle auto-selection in its useEffect
      }
    } catch (err) {
      console.error('❌ [APP] Error refreshing after portfolio deletion:', err);
    }
  };

  const handleAccountDeleted = async () => {
    // Refresh ALL portfolios data since account was deleted
    console.log('🗑️ [APP] Account deleted - refreshing ALL portfolios data');
    try {
      await refreshAllPortfoliosData();
    } catch (err) {
      console.error('❌ [APP] Error refreshing after account deletion:', err);
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

  // Do not block UI during portfolio loading; show skeletons instead
  
  if (portfolioError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-4">Portfolio Loading Error</h2>
          <p className="text-gray-300 mb-6">{portfolioError}</p>
          
          <button
            onClick={() => {
              console.log('🔄 [APP] Retrying portfolio initialization');
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
  
  // Handle empty state when no portfolios exist
  const showEmptyState = availablePortfolios.length === 0;
  
  // Create mock metadata for empty state to keep UI working
  const mockMetadata: PortfolioMetadata = {
    base_currency: 'USD',
    user_name: user?.displayName || user?.email || 'User',
    accounts: []
  };
  
  const displayMetadata = showEmptyState ? mockMetadata : portfolioMetadata;
  
  console.log('🎭 [APP] Render state:', {
    showEmptyState,
    isLoading,
    hasPortfolioMetadata: !!portfolioMetadata,
    hasCurrentPortfolioData: !!currentPortfolioData,
    hasComputedData: !!computedData,
    hasPortfolioData: !!portfolioData,
    hasHoldingsData: !!holdingsData,
    selectedPortfolioId,
    selectedAccountNamesCount: selectedAccountNames.length,
    availablePortfoliosCount: availablePortfolios.length,
    isInitialized,
    portfolioError,
    authLoading,
    hasUser: !!user,
    willShowSkeleton: isLoading || !displayMetadata,
    willShowPortfolioView: !!portfolioMetadata && !!portfolioData && !isLoading
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white relative">
      {/* Top Bar Navigation */}
      <TopBar 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />
      
            {/* Sticky Header Section - only show for portfolios view */}
      {activeView === 'portfolios' && (
        <div
          className="sticky z-30 bg-gray-900"
          style={{ top: '37px', height: HEADER_HEIGHT, minHeight: HEADER_HEIGHT }}
        >
          {isLoading || !displayMetadata ? (
            <PortfolioHeaderSkeleton />
          ) : (
            <>
              <AccountSelector
                portfolioMetadata={displayMetadata}
                onAccountsChange={handleAccountsChange}
                onToggleVisibility={handleToggleVisibility}
                availableFiles={availablePortfolios}
                selectedFile={selectedPortfolioId || ""}
                onPortfolioChange={setSelectedPortfolioId}  // Now instant, no API call!
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
                selectedAccountNames={selectedAccountNames}
                baseCurrency={displayMetadata.base_currency}
                isValueVisible={isValueVisible}
              />
            </>
          )}
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
              (() => {
                const shouldShowSkeleton = isLoading || !portfolioMetadata || !portfolioData;
                console.log('🎯 [APP] Main content loading decision:', {
                  isLoading,
                  hasPortfolioMetadata: !!portfolioMetadata,
                  hasPortfolioData: !!portfolioData,
                  shouldShowSkeleton,
                  willShowPortfolioView: !shouldShowSkeleton
                });
                return shouldShowSkeleton;
              })() ? (
                <PortfolioMainSkeleton />
              ) : (
                <PortfolioView
                  portfolioMetadata={portfolioMetadata}
                  portfolioData={portfolioData}
                  holdingsData={holdingsData}
                  availablePortfolios={availablePortfolios}
                  isValueVisible={isValueVisible}
                  mainRSUVesting={mainRSUVesting}
                  mainOptionsVesting={mainOptionsVesting}
                />
              )
            )}
            {activeView === 'explore' && (
              isLoading ? <ViewTransitionSkeleton /> : <ExploreView />
            )}
            {activeView === 'news' && (
              isLoading ? <NewsViewSkeleton /> : <NewsView />
            )}
            {activeView === 'analyst' && (
              isLoading ? <AIChatViewSkeleton /> : <AIChatView />
            )}
            {activeView === 'tags' && (
              isLoading ? <ManageTagsViewSkeleton /> : <ManageTagsView />
            )}
            {activeView === 'tools' && (
              isLoading ? <ViewTransitionSkeleton /> : <ToolsView />
            )}
          </main>
        </div>


      </div>
    </div>
  );
};

export default App;