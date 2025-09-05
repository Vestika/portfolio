import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import api from '../utils/api';

// Helper function to compare arrays
const arraysEqual = (a: string[], b: string[]) => {
  return a.length === b.length && a.every((val, index) => val === b[index]);
};

// Types for the complete portfolio data structure (ALL portfolios)
export interface AllPortfoliosData {
  portfolios: Record<string, SinglePortfolioData>;
  global_securities: Record<string, SecurityData>;
  global_quotes: Record<string, QuoteData>;
  global_exchange_rates: Record<string, number>;
  user_tag_library: any; // TagLibrary type from backend
  all_holding_tags: Record<string, any>; // HoldingTags by symbol
  all_options_vesting: Record<string, Record<string, any>>; // portfolio_id -> account_name -> vesting data
  user_preferences: {
    preferred_currency: string;
    default_portfolio_id: string | null;
  };
  computation_timestamp: string;
}

export interface SinglePortfolioData {
  portfolio_metadata: {
    portfolio_id: string;
    portfolio_name: string;
    base_currency: string;
    user_name: string;
    user_id: string;
    total_value: number;
  };
  accounts: AccountData[];
  current_prices: Record<string, PriceData>;
  computation_timestamp: string;
}

// Legacy interface for backward compatibility
export interface CompletePortfolioData {
  portfolio_metadata: {
    portfolio_id: string;
    portfolio_name: string;
    base_currency: string;
    user_name: string;
    user_id: string;
    total_value: number;
  };
  accounts: AccountData[];
  securities: Record<string, SecurityData>;
  current_prices: Record<string, PriceData>;
  exchange_rates: Record<string, number>;
  live_quotes: Record<string, QuoteData>;
  aggregation_data: AggregationData[];
  computation_timestamp: string;
}

export interface AccountData {
  account_name: string;
  account_type: string;
  owners: string[];
  account_total: number;
  holdings: HoldingData[];
  rsu_plans: any[];
  espp_plans: any[];
  options_plans: any[];
  rsu_vesting_data: any[];
  account_cash: Record<string, number>;
  account_properties: Record<string, any>;
}

export interface HoldingData {
  symbol: string;
  units: number;
  value_per_unit: number;
  total_value: number;
  original_currency: string;
  security_type: string;
  security_name: string;
  is_virtual?: boolean;
}

export interface SecurityData {
  symbol: string;
  name: string;
  security_type: string;
  currency: string;
  tags: Record<string, any>;
  unit_price?: number;
}

export interface PriceData {
  price: number;
  currency: string;
  last_updated: string;
}

export interface QuoteData {
  symbol: string;
  current_price: number;
  percent_change: number;
  last_updated: string;
}

export interface AggregationData {
  chart_title: string;
  chart_total: number;
  chart_data: Array<{
    label: string;
    value: number;
    percentage: number;
    units?: number;
    accounts?: Array<{ name: string; type: string }>;
  }>;
}

// Computed data interfaces (filtered by selected accounts)
export interface ComputedPortfolioData {
  selectedAccounts: AccountData[];
  filteredAggregations: AggregationData[];
  totalValue: number;
  holdingsTable: any; // Will be computed from selected accounts
}

interface PortfolioDataContextType {
  // Raw data (ALL portfolios)
  allPortfoliosData: AllPortfoliosData | null;
  isLoading: boolean;
  error: string | null;
  
  // Portfolio selection state
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: (portfolioId: string) => void;
  
  // Account selection state
  selectedAccountNames: string[];
  setSelectedAccountNames: (accountNames: string[]) => void;
  
  // Computed data (reactive to portfolio + account selection)
  currentPortfolioData: CompletePortfolioData | null; // Current portfolio in legacy format
  computedData: ComputedPortfolioData | null;
  
  // Actions
  loadAllPortfoliosData: () => Promise<void>;
  refreshAllPortfoliosData: () => Promise<void>;
  
  // Utilities
  getAccountByName: (name: string, portfolioId?: string) => AccountData | undefined;
  getSecurityBySymbol: (symbol: string) => SecurityData | undefined;
  getPriceBySymbol: (symbol: string, portfolioId?: string) => PriceData | undefined;
  getQuoteBySymbol: (symbol: string) => QuoteData | undefined;
  
  // Tags utilities
  getUserTagLibrary: () => any | null;
  getHoldingTagsBySymbol: (symbol: string) => any | undefined;
  
  // Options utilities
  getOptionsVestingByAccount: (portfolioId: string, accountName: string) => any | undefined;
  
  // Portfolio utilities
  getAvailablePortfolios: () => Array<{ portfolio_id: string; portfolio_name: string; display_name: string }>;
}

const PortfolioDataContext = createContext<PortfolioDataContextType | undefined>(undefined);

export const usePortfolioData = () => {
  const context = useContext(PortfolioDataContext);
  
  if (context === undefined) {
    console.error('❌ [PORTFOLIO HOOK] Context is undefined! Provider not found in component tree');
    throw new Error('usePortfolioData must be used within a PortfolioDataProvider');
  }
  return context;
};

interface PortfolioDataProviderProps {
  children: React.ReactNode;
}

export const PortfolioDataProvider: React.FC<PortfolioDataProviderProps> = ({ children }) => {
  console.log('🏗️ [PORTFOLIO PROVIDER] Starting full-featured PortfolioDataProvider');
  
  // State for ALL portfolios data
  const [allPortfoliosData, setAllPortfoliosData] = useState<AllPortfoliosData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Portfolio selection state
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  
  // Account selection state (per portfolio)
  const [selectedAccountNames, setSelectedAccountNames] = useState<string[]>([]);

  console.log('🏗️ [PORTFOLIO PROVIDER] State hooks initialized successfully');

  // Removed complex useEffect hooks that were causing context initialization errors
  // Auto-selection is now handled directly in loadAllPortfoliosData()

  // Load ALL portfolios data function
  const loadAllPortfoliosData = useCallback(async () => {
    console.log('🌍 [PORTFOLIO CONTEXT] Loading ALL portfolios data');
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/portfolios/complete-data`);
      const data: AllPortfoliosData = response.data;
      
      console.log('✅ [PORTFOLIO CONTEXT] ALL portfolios data loaded successfully:', {
        portfoliosCount: Object.keys(data.portfolios).length,
        portfolioIds: Object.keys(data.portfolios),
        globalSecurities: Object.keys(data.global_securities).length,
        globalQuotes: Object.keys(data.global_quotes).length,
        globalExchangeRates: Object.keys(data.global_exchange_rates).length,
        userTagLibrary: Object.keys(data.user_tag_library?.tag_definitions || {}).length,
        holdingTags: Object.keys(data.all_holding_tags || {}).length,
        optionsVesting: Object.keys(data.all_options_vesting || {}).length,
        defaultPortfolio: data.user_preferences.default_portfolio_id,
        timestamp: data.computation_timestamp,
        tagLibraryStructure: data.user_tag_library ? Object.keys(data.user_tag_library) : [],
        sampleHoldingTag: Object.values(data.all_holding_tags || {})[0] || 'No holding tags'
      });

      setAllPortfoliosData(data);
      
      // Auto-select portfolio and accounts after data loads
      if (data.portfolios && Object.keys(data.portfolios).length > 0) {
        const portfolioIds = Object.keys(data.portfolios);
        const defaultId = data.user_preferences?.default_portfolio_id;
        const portfolioToSelect = (defaultId && portfolioIds.includes(defaultId)) ? defaultId : portfolioIds[0];
        
        console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting portfolio after load:', portfolioToSelect);
        setSelectedPortfolioId(portfolioToSelect);
        
        // Auto-select all accounts for the selected portfolio
        setTimeout(() => {
          const portfolio = data.portfolios[portfolioToSelect];
          if (portfolio?.accounts) {
            const accountNames = portfolio.accounts.map((acc: any) => acc.account_name);
            console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting accounts after load:', accountNames);
            setSelectedAccountNames(accountNames);
          }
        }, 50);
      }
      
      setIsLoading(false);
      
    } catch (err: any) {
      console.error('❌ [PORTFOLIO CONTEXT] Error loading all portfolios data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load portfolios data');
      setIsLoading(false);
    }
  }, []);

  // Refresh all portfolios data
  const refreshAllPortfoliosData = useCallback(async () => {
    console.log('🔄 [PORTFOLIO CONTEXT] Refreshing all portfolios data');
    await loadAllPortfoliosData();
  }, [loadAllPortfoliosData]);

  // Current portfolio data in legacy format (for backward compatibility)
  const currentPortfolioData = useMemo((): CompletePortfolioData | null => {
    try {
      if (!allPortfoliosData || !selectedPortfolioId) return null;
      
      const currentPortfolio = allPortfoliosData.portfolios[selectedPortfolioId];
      if (!currentPortfolio) return null;
      
      // Convert to legacy format
      return {
        portfolio_metadata: currentPortfolio.portfolio_metadata,
        accounts: currentPortfolio.accounts,
        securities: allPortfoliosData.global_securities || {},
        current_prices: currentPortfolio.current_prices || {},
        exchange_rates: allPortfoliosData.global_exchange_rates || {},
        live_quotes: allPortfoliosData.global_quotes || {},
        aggregation_data: [], // Will be computed below
        computation_timestamp: currentPortfolio.computation_timestamp
      };
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error creating currentPortfolioData:', error);
      return null;
    }
  }, [allPortfoliosData, selectedPortfolioId]);

  // Computed data based on selected portfolio and accounts
  const computedData = useMemo((): ComputedPortfolioData | null => {
    try {
      if (!allPortfoliosData || !selectedPortfolioId || selectedAccountNames.length === 0) {
        console.log('🔄 [PORTFOLIO CONTEXT] No computed data - missing data, portfolio, or accounts selected');
        return null;
      }

      const currentPortfolio = allPortfoliosData.portfolios[selectedPortfolioId];
      if (!currentPortfolio) {
        console.log('🔄 [PORTFOLIO CONTEXT] No computed data - selected portfolio not found:', selectedPortfolioId);
        return null;
      }

      console.log('🧮 [PORTFOLIO CONTEXT] Computing filtered data for portfolio:', selectedPortfolioId, 'accounts:', selectedAccountNames, 'out of', currentPortfolio.accounts.map(a => a.account_name));

    // Filter selected accounts from current portfolio
    const selectedAccounts = currentPortfolio.accounts.filter(account => 
      selectedAccountNames.includes(account.account_name)
    );

    // Calculate total value of selected accounts
    const totalValue = selectedAccounts.reduce((sum, account) => sum + account.account_total, 0);

    // Generate aggregations for selected accounts only
    const holdingValues: Record<string, { value: number; units: number; accounts: any[] }> = {};
    
    selectedAccounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!holdingValues[holding.symbol]) {
          holdingValues[holding.symbol] = { value: 0, units: 0, accounts: [] };
        }
        holdingValues[holding.symbol].value += holding.total_value;
        holdingValues[holding.symbol].units += holding.units;
        
        // Add account if not already present
        if (!holdingValues[holding.symbol].accounts.some(acc => acc.name === account.account_name)) {
          holdingValues[holding.symbol].accounts.push({
            name: account.account_name,
            type: account.account_type
          });
        }
      });
    });

    // Generate chart data for Holdings by Symbol
    const symbolData = Object.entries(holdingValues).map(([symbol, data]) => {
      const percentage = totalValue > 0 ? (data.value / totalValue * 100) : 0;
      return {
        label: symbol,
        value: Math.round(data.value * 100) / 100,
        percentage: Math.round(percentage * 100) / 100
        // Remove extra properties that ChartDataItem doesn't expect
      };
    }).sort((a, b) => b.value - a.value);

    // Generate chart data for Account Size Overview
    const accountData = selectedAccounts.map(account => {
      const percentage = totalValue > 0 ? (account.account_total / totalValue * 100) : 0;
      return {
        label: account.account_name,
        value: Math.round(account.account_total * 100) / 100,
        percentage: Math.round(percentage * 100) / 100
      };
    }).sort((a, b) => b.value - a.value);

    const filteredAggregations: AggregationData[] = [
      {
        chart_title: "Account Size Overview",
        chart_total: Math.round(totalValue * 100) / 100,
        chart_data: accountData
      },
      {
        chart_title: "Holdings Aggregation By Symbol",
        chart_total: Math.round(totalValue * 100) / 100,
        chart_data: symbolData.slice(0, 20) // Top 20
      }
    ];

    // Generate holdings table data with proper structure
    const holdingsTableHoldings = Object.entries(holdingValues).map(([symbol, data]) => {
      const security = allPortfoliosData?.global_securities?.[symbol];
      const price = currentPortfolio?.current_prices?.[symbol];
      
      return {
        symbol,
        security_type: security?.security_type || 'unknown',
        name: security?.name || symbol,
        tags: security?.tags || {},
        total_units: data.units,
        original_price: price?.price || 0,
        original_currency: price?.currency || currentPortfolio?.portfolio_metadata?.base_currency || 'USD',
        value_per_unit: data.units > 0 ? data.value / data.units : 0,
        total_value: data.value,
        currency: currentPortfolio?.portfolio_metadata?.base_currency || 'USD',
        price_source: 'calculated',
        historical_prices: [], // Could be populated if needed
        account_breakdown: data.accounts.map(acc => ({
          account_name: acc.name,
          account_type: acc.type,
          units: selectedAccounts
            .find(account => account.account_name === acc.name)
            ?.holdings.find(h => h.symbol === symbol)?.units || 0,
          value: selectedAccounts
            .find(account => account.account_name === acc.name)
            ?.holdings.find(h => h.symbol === symbol)?.total_value || 0,
          owners: selectedAccounts
            .find(account => account.account_name === acc.name)?.owners || []
        }))
      };
    }).sort((a, b) => b.total_value - a.total_value);

    console.log('📊 [PORTFOLIO CONTEXT] Holdings table data generated:', {
      portfolioId: selectedPortfolioId,
      totalHoldings: holdingsTableHoldings.length,
      stocksAndETFs: holdingsTableHoldings.filter(h => ['stock', 'etf'].includes(h.security_type.toLowerCase())).length,
      securityTypes: [...new Set(holdingsTableHoldings.map(h => h.security_type))],
      symbols: holdingsTableHoldings.map(h => h.symbol),
      uniqueSymbols: [...new Set(holdingsTableHoldings.map(h => h.symbol))].sort()
    });

    const holdingsTable = {
      base_currency: currentPortfolio.portfolio_metadata.base_currency,
      holdings: holdingsTableHoldings
    };

    const result = {
      selectedAccounts,
      filteredAggregations,
      totalValue: Math.round(totalValue * 100) / 100,
      holdingsTable
    };

    console.log('✅ [PORTFOLIO CONTEXT] Computed data generated:', {
      selectedAccountsCount: result.selectedAccounts.length,
      totalValue: result.totalValue,
      holdingsCount: result.holdingsTable.holdings.length,
      aggregationsCount: result.filteredAggregations.length,
      chartTitles: result.filteredAggregations.map(agg => agg.chart_title),
      chartDataSizes: result.filteredAggregations.map(agg => agg.chart_data.length)
    });

      return result;
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error creating computedData:', error);
      return null;
    }
  }, [allPortfoliosData, selectedPortfolioId, selectedAccountNames]);

  // Utility functions with error handling
  const getAccountByName = useCallback((name: string, portfolioId?: string): AccountData | undefined => {
    try {
      if (!allPortfoliosData) return undefined;
      const targetPortfolioId = portfolioId || selectedPortfolioId;
      if (!targetPortfolioId) return undefined;
      const portfolio = allPortfoliosData.portfolios[targetPortfolioId];
      return portfolio?.accounts.find(acc => acc.account_name === name);
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getAccountByName:', error);
      return undefined;
    }
  }, [allPortfoliosData, selectedPortfolioId]);

  const getSecurityBySymbol = useCallback((symbol: string): SecurityData | undefined => {
    try {
      return allPortfoliosData?.global_securities[symbol];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getSecurityBySymbol:', error);
      return undefined;
    }
  }, [allPortfoliosData]);

  const getPriceBySymbol = useCallback((symbol: string, portfolioId?: string): PriceData | undefined => {
    try {
      if (!allPortfoliosData) return undefined;
      const targetPortfolioId = portfolioId || selectedPortfolioId;
      if (!targetPortfolioId) return undefined;
      const portfolio = allPortfoliosData.portfolios[targetPortfolioId];
      return portfolio?.current_prices[symbol];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getPriceBySymbol:', error);
      return undefined;
    }
  }, [allPortfoliosData, selectedPortfolioId]);

  const getQuoteBySymbol = useCallback((symbol: string): QuoteData | undefined => {
    try {
      return allPortfoliosData?.global_quotes?.[symbol];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getQuoteBySymbol:', error);
      return undefined;
    }
  }, [allPortfoliosData]);

  const getAvailablePortfolios = useCallback(() => {
    try {
      if (!allPortfoliosData) return [];
      return Object.values(allPortfoliosData.portfolios).map(portfolio => ({
        portfolio_id: portfolio.portfolio_metadata.portfolio_id,
        portfolio_name: portfolio.portfolio_metadata.portfolio_name,
        display_name: portfolio.portfolio_metadata.portfolio_name
      }));
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getAvailablePortfolios:', error);
      return [];
    }
  }, [allPortfoliosData]);

  // Tags utilities with error handling
  const getUserTagLibrary = useCallback(() => {
    try {
      const library = allPortfoliosData?.user_tag_library;
      if (!library) {
        console.log('🏷️ [PORTFOLIO CONTEXT] Tag library not available, returning fallback');
        return { user_id: '', tag_definitions: {}, template_tags: {} };
      }
      return library;
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getUserTagLibrary:', error);
      return { user_id: '', tag_definitions: {}, template_tags: {} };
    }
  }, [allPortfoliosData]);

  const getHoldingTagsBySymbol = useCallback((symbol: string) => {
    try {
      return allPortfoliosData?.all_holding_tags?.[symbol];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getHoldingTagsBySymbol:', error);
      return undefined;
    }
  }, [allPortfoliosData]);

  // Options utilities with error handling
  const getOptionsVestingByAccount = useCallback((portfolioId: string, accountName: string) => {
    try {
      return allPortfoliosData?.all_options_vesting?.[portfolioId]?.[accountName];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getOptionsVestingByAccount:', error);
      return undefined;
    }
  }, [allPortfoliosData]);

  // Custom setSelectedAccountNames with logging
  const setSelectedAccountNamesWithLogging = useCallback((accountNames: string[]) => {
    console.log('🔄 [PORTFOLIO CONTEXT] Account selection changed:', {
      portfolioId: selectedPortfolioId,
      previous: selectedAccountNames,
      new: accountNames,
      willTriggerRecomputation: true,
      willChangeHoldings: !arraysEqual(selectedAccountNames, accountNames),
      timestamp: new Date().toISOString()
    });
    setSelectedAccountNames(accountNames);
  }, [selectedAccountNames, selectedPortfolioId]);

  // Custom setSelectedPortfolioId with logging
  const setSelectedPortfolioIdWithLogging = useCallback((portfolioId: string) => {
    console.log('🏢 [PORTFOLIO CONTEXT] Portfolio selection changed (INSTANT):', {
      previous: selectedPortfolioId,
      new: portfolioId,
      willTriggerRecomputation: true,
      timestamp: new Date().toISOString()
    });
    setSelectedPortfolioId(portfolioId);
    // Reset account selection when portfolio changes
    setSelectedAccountNames([]);
  }, [selectedPortfolioId]);

  const value: PortfolioDataContextType = {
    allPortfoliosData,
    isLoading,
    error,
    selectedPortfolioId,
    setSelectedPortfolioId: setSelectedPortfolioIdWithLogging,
    selectedAccountNames,
    setSelectedAccountNames: setSelectedAccountNamesWithLogging,
    currentPortfolioData,
    computedData,
    loadAllPortfoliosData,
    refreshAllPortfoliosData,
    getAccountByName,
    getSecurityBySymbol,
    getPriceBySymbol,
    getQuoteBySymbol,
    getUserTagLibrary,
    getHoldingTagsBySymbol,
    getOptionsVestingByAccount,
    getAvailablePortfolios
  };
  
  console.log('✅ [PORTFOLIO PROVIDER] Context value created successfully');

  return (
    <PortfolioDataContext.Provider value={value}>
      {children}
    </PortfolioDataContext.Provider>
  );
};
