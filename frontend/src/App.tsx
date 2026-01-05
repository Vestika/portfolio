import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
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
import OnboardingFlow from './components/OnboardingFlow';
import { TopBar, NavigationView, ProfileSidebar } from './components/top-bar';
import { PortfolioView } from './components/PortfolioView';
import { NewsView } from './components/news';
import { CashFlowView } from './components/CashFlowView';
import { AIChatView } from './components/AIChatView';
import { ManageTagsView } from './components/ManageTagsView';
import { ToolsView } from './components/ToolsView';
import { ImportView } from './components/ImportView';
import { UploadView } from './components/UploadView';
import { ConfigGalleryView } from './components/ConfigGalleryView';
import { useAuth } from './contexts/AuthContext';
import { usePortfolioData } from './contexts/PortfolioDataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import { PopupManager } from './components/PopupManager';
// Removed floating feedback widget in favor of top bar modal
import { signOutUser } from './firebase';
import { useMixpanel } from './contexts/MixpanelContext';
import { trackPageView, trackSessionStart, trackSessionEnd } from './lib/mixpanel-events';
import {
  PortfolioMetadata,
  PortfolioData,
  HoldingsTableData,
} from './types';

const HEADER_HEIGHT = 128; // px, adjust if needed

// Helper to map pathname to NavigationView
const pathnameToView = (pathname: string): NavigationView | null => {
  // Handle /tools/* paths
  if (pathname.startsWith('/tools')) {
    return 'tools';
  }
  const viewMap: Record<string, NavigationView> = {
    '/portfolio': 'portfolios',
    '/portfolios': 'portfolios',
    '/cashflow': 'cashflow',
    '/news': 'news',
    '/analyst': 'analyst',
    '/tags': 'tags',
    '/config-gallery': 'config-gallery',
  };
  return viewMap[pathname] || null;
};

// Helper to map NavigationView to pathname
const viewToPathname = (view: NavigationView): string => {
  const pathMap: Record<NavigationView, string> = {
    'portfolios': '/portfolio',
    'cashflow': '/cashflow',
    'news': '/news',
    'analyst': '/analyst',
    'tags': '/tags',
    'tools': '/tools/tax-planner',
    'config-gallery': '/config-gallery',
  };
  return pathMap[view];
};

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're on the import or upload page
  const isImportPage = location.pathname === '/import';
  const isUploadPage = location.pathname === '/import/upload';

  // Derive activeView from URL pathname
  const activeView: NavigationView = pathnameToView(location.pathname) || 'portfolios';
  
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
    clearAllPortfoliosData,
    getAvailablePortfolios,
    getOptionsVestingByAccount,
    allPortfoliosData
  } = usePortfolioData();

  // Mixpanel tracking
  const { track, sessionId } = useMixpanel();
  const [sessionStartTime] = useState(() => Date.now());

  // Local state for UI
  const [isValueVisible, setIsValueVisible] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasCheckedPortfolios, setHasCheckedPortfolios] = useState(false);
  const [mainRSUVesting, setMainRSUVesting] = useState<Record<string, unknown>>({});
  const [mainOptionsVesting, setMainOptionsVesting] = useState<Record<string, unknown>>({});
  const [mainESPPPlans, setMainESPPPlans] = useState<Record<string, unknown>>({});
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

  // Get available portfolios from context (no separate API call needed)
  const availablePortfolios = getAvailablePortfolios();

  // Derive legacy data structures for compatibility with existing components
  // Memoize to prevent unnecessary re-renders of child components (especially charts)
  const portfolioMetadata: PortfolioMetadata | null = useMemo(() => {
    if (!currentPortfolioData) return null;
    return {
      base_currency: currentPortfolioData.portfolio_metadata?.base_currency || 'USD',
      user_name: currentPortfolioData.portfolio_metadata?.user_name || 'User',
      accounts: (currentPortfolioData.accounts || []).map((acc: any) => ({
        account_name: acc.account_name,
        account_type: acc.account_type,
        owners: acc.owners,
        holdings: (acc.holdings || []).map((h: any) => {
          const holding: any = {
            symbol: h.symbol,
            units: h.units,
            original_currency: h.original_currency,
            security_type: h.security_type,
            security_name: h.security_name
          };
          
          // Include custom holding fields if present
          if (h.is_custom) {
            holding.is_custom = true;
            holding.custom_price = h.custom_price;
            holding.custom_currency = h.custom_currency;
            holding.custom_name = h.custom_name;
          }
          
          return holding;
        }),
        rsu_plans: acc.rsu_plans || [],
        espp_plans: acc.espp_plans || [],
        options_plans: acc.options_plans || [],
        rsu_vesting_data: acc.rsu_vesting_data || [],
        account_properties: acc.account_properties || {},
        account_cash: acc.account_cash || {},
        isSelected: selectedAccountNames.includes(acc.account_name)
      }))
    };
  }, [currentPortfolioData, selectedAccountNames]);

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
    portfolioDataChartsCount: portfolioData ? portfolioData.length : 0,
    portfolioDataTitles: portfolioData ? portfolioData.map(chart => chart.chart_title) : [],
    holdingsDataCount: holdingsData ? holdingsData.holdings.length : 0,
    holdingsWithTags: holdingsData ? holdingsData.holdings.filter(h => h.tags && Object.keys(h.tags).length > 0).length : 0,
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
      setHasCheckedPortfolios(true);
      console.log('✅ [APP] App initialization completed');
    } catch (err) {
      console.error('❌ [APP] Failed to initialize app:', err);
      setHasCheckedPortfolios(true); // Still mark as checked even on error
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

  // Mixpanel: Track session start and end
  useEffect(() => {
    if (!user) return; // Only track for authenticated users

    trackSessionStart(sessionId);

    return () => {
      const sessionDuration = Date.now() - sessionStartTime;
      trackSessionEnd(sessionId, sessionDuration);
    };
  }, [user, sessionId, sessionStartTime]);

  // Mixpanel: Track page views
  useEffect(() => {
    if (!user) return; // Only track for authenticated users

    trackPageView(activeView, location.pathname);
  }, [location.pathname, activeView, user]);

  // No more individual portfolio loading! All data is loaded upfront


  useEffect(() => {
    // Only run when currentPortfolioData or selectedAccountNames changes
    if (!currentPortfolioData || !selectedPortfolioId) return;

    console.log('📈 [APP] Extracting RSU/Options data from current portfolio data (filtered by selected accounts)');
    
    // Filter accounts to only include selected accounts
    const filteredAccounts = (currentPortfolioData.accounts || []).filter((account: any) => 
      selectedAccountNames.includes(account.account_name)
    );
    
    // Extract RSU vesting data from selected accounts only
    const rsuVestingMap: Record<string, unknown> = {};
    filteredAccounts.forEach((account: any) => {
      if (account.account_type === 'company-custodian-account') {
        // Use RSU vesting data from current portfolio data (already computed by backend)
        const rsuData = account.rsu_vesting_data || [];
        console.log(`🔶 [APP] RSU vesting data for selected account ${account.account_name}:`, rsuData.length, 'plans');
        rsuVestingMap[account.account_name] = rsuData;
      }
    });
    setMainRSUVesting(rsuVestingMap);

    // Get Options vesting from context (no API calls needed!) - filtered by selected accounts
    const optionsVestingMap: Record<string, unknown> = {};
    const companyCustodianAccounts = filteredAccounts.filter(
      (account: any) => account.account_type === 'company-custodian-account'
    );
    
    companyCustodianAccounts.forEach((account: any) => {
      try {
        const optionsData = getOptionsVestingByAccount(selectedPortfolioId || "", account.account_name);
        optionsVestingMap[account.account_name] = optionsData?.plans || [];
        console.log(`⚡ [APP] Options vesting data for selected account ${account.account_name}:`, optionsData?.plans?.length || 0, 'plans');
      } catch (error) {
        console.log('⚠️ [APP] Using fallback empty options vesting for', account.account_name);
        optionsVestingMap[account.account_name] = [];
      }
    });
    
    console.log('📊 [APP] Using options vesting from context for', companyCustodianAccounts.length, 'selected company accounts (no API calls)');
    setMainOptionsVesting(optionsVestingMap);

    // Get ESPP plans from context - filtered by selected accounts
    const esppPlansMap: Record<string, unknown> = {};
    const companyCustodianAccountsForESPP = filteredAccounts.filter(
      (account: any) => account.account_type === 'company-custodian-account'
    );
    
    companyCustodianAccountsForESPP.forEach((account: any) => {
      try {
        const esppData = account.espp_plans || [];
        console.log(`🔶 [APP] ESPP plans for selected account ${account.account_name}:`, esppData.length, 'plans');
        esppPlansMap[account.account_name] = esppData;
      } catch (error) {
        console.error(`❌ [APP] Error processing ESPP plans for account ${account.account_name}:`, error);
        esppPlansMap[account.account_name] = [];
      }
    });
    
    console.log('📊 [APP] Using ESPP plans from context for', companyCustodianAccountsForESPP.length, 'selected company accounts (no API calls)');
    setMainESPPPlans(esppPlansMap);
  }, [currentPortfolioData, selectedPortfolioId, selectedAccountNames, getOptionsVestingByAccount]); // Updated: depend on selectedAccountNames

  const handleAccountsChange = (accountNames: string[]) => {
    console.log('🎯 [APP] Account selection changed - using new client-side filtering:', {
      newSelection: accountNames,
      previousSelection: selectedAccountNames,
      timestamp: new Date().toISOString()
    });

    // Mixpanel: Track account filtering
    track('account_filtered', {
      selected_accounts_count: accountNames.length,
      total_accounts_count: currentPortfolioData?.accounts.length || 0,
    });

    setSelectedAccountNames(accountNames);
    // No API call needed! Data is filtered locally in the context
  };

  const handleToggleVisibility = () => {
    setIsValueVisible(!isValueVisible);
  };

  const handlePortfolioChange = (portfolioId: string) => {
    console.log('🔄 [APP] Portfolio switched - instant update (no API call)');

    // Mixpanel: Track portfolio switch
    // Get full portfolio data from allPortfoliosData
    const fullPortfolio = allPortfoliosData?.portfolios?.[portfolioId];
    if (fullPortfolio) {
      const totalHoldings = fullPortfolio.accounts.reduce(
        (sum: number, account: any) => sum + (account.holdings?.length || 0),
        0
      );
      track('portfolio_switched', {
        holdings_count: totalHoldings,
        accounts_count: fullPortfolio.accounts.length,
      });
    }

    setSelectedPortfolioId(portfolioId);
  };

  const handlePortfolioCreated = async (newPortfolioId: string) => {
    try {
      console.log('🏗️ [APP] Portfolio created - refreshing ALL portfolios data');

      const isFirstPortfolio = availablePortfolios.length === 0;

      // Refresh ALL portfolios data to include the new portfolio
      await refreshAllPortfoliosData();

      // Mixpanel: Track portfolio creation
      track('portfolio_created', {
        portfolio_count: availablePortfolios.length + 1,
        is_first_portfolio: isFirstPortfolio,
      });

      // Mixpanel: Track onboarding milestone if first portfolio
      if (isFirstPortfolio) {
        track('onboarding_first_portfolio_created');
      }

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

      // Mixpanel: Track account creation
      track('account_created', {
        portfolio_accounts_count: (currentPortfolioData?.accounts.length || 0) + 1,
      });
    } catch (err) {
      console.error('❌ [APP] Error refreshing after account addition:', err);
    }
  };

  const handlePortfolioDeleted = async (deletedPortfolioId: string) => {
    // Refresh ALL portfolios data since portfolio was deleted
    console.log('🗑️ [APP] Portfolio deleted - refreshing ALL portfolios data');
    try {
      // Mixpanel: Track portfolio deletion
      track('portfolio_deleted', {
        remaining_portfolios: availablePortfolios.length - 1,
      });

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
      // Mixpanel: Track account deletion
      track('account_deleted', {
        remaining_accounts: (currentPortfolioData?.accounts.length || 1) - 1,
      });

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
      // Mixpanel: Track sign out
      track('auth_sign_out');

      // Clear all portfolio data before signing out to prevent data leakage
      console.log('🚪 [APP] Signing out - clearing portfolio data');
      clearAllPortfoliosData();
      setIsInitialized(false);
      setHasCheckedPortfolios(false);
      await signOutUser();
      // Note: Mixpanel.reset() is called in AuthContext when user becomes null
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileClick = () => {
    setIsProfileSidebarOpen(true);
  };

  const handleViewChange = (view: NavigationView) => {
    navigate(viewToPathname(view));
  };





  // Show loading screen while auth is loading
  if (authLoading) return <LoadingScreen />;

  // Show login screen if user is not authenticated
  if (!user) return <Login />;

  // Handle /import/upload route - show upload page without portfolio context requirements
  if (isUploadPage) {
    return (
      <NotificationProvider>
        <UserProfileProvider>
          <PopupManager />
          <UploadView />
        </UserProfileProvider>
      </NotificationProvider>
    );
  }

  // Handle /import route - show import page without portfolio context requirements
  if (isImportPage) {
    return (
      <NotificationProvider>
        <UserProfileProvider>
          <PopupManager />
          <ImportView />
        </UserProfileProvider>
      </NotificationProvider>
    );
  }

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
  
  // Show generic loading screen during initial portfolio check
  if (isLoading && !hasCheckedPortfolios && !portfolioError) {
    return <LoadingScreen />;
  }
  
  // Handle empty state when no portfolios exist
  // Only show onboarding if data has loaded AND confirmed no portfolios exist
  const showEmptyState = !isLoading && !portfolioError && allPortfoliosData && availablePortfolios.length === 0;
  
  // Show onboarding flow for new users with no portfolios
  if (showEmptyState) {
    return (
      <OnboardingFlow 
        user={user} 
        onPortfolioCreated={handlePortfolioCreated}
      />
    );
  }
  
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
    <NotificationProvider>
      <UserProfileProvider>
        <PopupManager />
        <div className="flex flex-col min-h-screen bg-gray-900 text-white relative">
        {/* Top Bar Navigation */}
        <TopBar 
          activeView={activeView} 
          onViewChange={handleViewChange}
          onProfileClick={handleProfileClick}
        />
      
            {/* Sticky Header Section - only show for portfolios view */}
      {location.pathname === '/portfolio' && (
        <div
          className="sticky z-30 bg-gray-900"
          style={{ top: '37px', height: HEADER_HEIGHT, minHeight: HEADER_HEIGHT }}
        >
          {(!displayMetadata || (isLoading && hasCheckedPortfolios)) ? (
            <PortfolioHeaderSkeleton />
          ) : (
            <>
              <AccountSelector
                portfolioMetadata={displayMetadata}
                onAccountsChange={handleAccountsChange}
                onToggleVisibility={handleToggleVisibility}
                isValueVisible={isValueVisible}
                availableFiles={availablePortfolios}
                selectedFile={selectedPortfolioId || ""}
                onPortfolioChange={handlePortfolioChange}  // Tracks portfolio switch
                onPortfolioCreated={handlePortfolioCreated}
                onAccountAdded={handleAccountAdded}
                onPortfolioDeleted={handlePortfolioDeleted}
                onAccountDeleted={handleAccountDeleted}
                onDefaultPortfolioSet={handleDefaultPortfolioSet}
                globalPrices={allPortfoliosData?.global_current_prices || {}}
              />
              <PortfolioSummary
                accounts={displayMetadata.accounts}
                selectedAccountNames={selectedAccountNames}
                baseCurrency={displayMetadata.base_currency}
                isValueVisible={isValueVisible}
                globalPrices={allPortfoliosData?.global_current_prices || {}}
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
            <Routes>
              {/* Main views */}
              <Route
                path="/portfolio"
                element={
                  (() => {
                    const shouldShowSkeleton = !portfolioMetadata || !portfolioData || (isLoading && hasCheckedPortfolios);
                    return shouldShowSkeleton ? (
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
                        mainESPPPlans={mainESPPPlans}
                        globalPrices={allPortfoliosData?.global_current_prices || {}}
                        selectedAccountNames={selectedAccountNames}
                      />
                    );
                  })()
                }
              />
              <Route
                path="/cashflow"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
                    : <CashFlowView />
                }
              />
              <Route
                path="/news"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <NewsViewSkeleton />
                    : <NewsView />
                }
              />
              <Route
                path="/analyst"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <AIChatViewSkeleton />
                    : <AIChatView />
                }
              />
              <Route
                path="/tags"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ManageTagsViewSkeleton />
                    : <ManageTagsView />
                }
              />
              <Route
                path="/tools"
                element={<Navigate to="/tools/tax-planner" replace />}
              />
              <Route
                path="/tools/tax-planner"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ToolsView />
                }
              />
              <Route
                path="/tools/compound"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ToolsView />
                }
              />
              <Route
                path="/tools/scenario"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ToolsView />
                }
              />
              <Route
                path="/tools/fire"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ToolsView />
                }
              />
              <Route
                path="/tools/mortgage-invest"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ToolsView />
                }
              />
              <Route
                path="/tools/buy-or-rent"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ToolsView />
                }
              />
              <Route
                path="/config-gallery"
                element={
                  (!portfolioMetadata || (isLoading && hasCheckedPortfolios))
                    ? <ViewTransitionSkeleton />
                    : <ConfigGalleryView />
                }
              />

              {/* Default redirect to portfolio */}
              <Route path="/" element={<Navigate to="/portfolio" replace />} />

              {/* Catch-all redirect to portfolio for any unknown routes */}
              <Route path="*" element={<Navigate to="/portfolio" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      
      {/* Profile Sidebar */}
      <ProfileSidebar 
        isOpen={isProfileSidebarOpen}
        onClose={() => setIsProfileSidebarOpen(false)}
        onSignOut={handleSignOut}
        onToggleVisibility={handleToggleVisibility}
        isValueVisible={isValueVisible}
      />
      </div>
      </UserProfileProvider>
    </NotificationProvider>
  );
};

export default App;
