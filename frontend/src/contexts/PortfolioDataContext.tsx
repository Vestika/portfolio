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
  historical_prices: Record<string, Array<{ date: string; price: number }>>;  // NEW: 7-day historical data
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
  historical_prices?: Record<string, Array<{ date: string; price: number }>>;  // NEW: 7-day historical data
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
  tags?: Record<string, any>;  // ← RESTORED: Include tags in holding data
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
  price: number;  // Price in base currency (converted)
  original_price?: number;  // Price in original currency (NEW)
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
  console.log('🏗️ [PORTFOLIO PROVIDER] Initializing PortfolioDataProvider (bulletproof version)');
  
  // State for ALL portfolios data
  const [allPortfoliosData, setAllPortfoliosData] = useState<AllPortfoliosData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Portfolio selection state
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  
  // Account selection state (per portfolio)
  const [selectedAccountNames, setSelectedAccountNames] = useState<string[]>([]);

  console.log('🏗️ [PORTFOLIO PROVIDER] Basic state initialized');

  // Removed complex useEffect hooks that were causing context initialization errors
  // Auto-selection is now handled directly in loadAllPortfoliosData()

  // Safety effect: Auto-select accounts if portfolio is selected but no accounts are selected
  React.useEffect(() => {
    if (selectedPortfolioId && allPortfoliosData?.portfolios?.[selectedPortfolioId] && selectedAccountNames.length === 0) {
      const accounts = allPortfoliosData.portfolios[selectedPortfolioId].accounts;
      if (accounts && accounts.length > 0) {
        const accountNames = accounts.map(acc => acc.account_name);
        console.log('🛡️ [PORTFOLIO CONTEXT] Safety auto-select accounts for portfolio:', selectedPortfolioId, accountNames);
        setSelectedAccountNames(accountNames);
      }
    }
  }, [selectedPortfolioId, allPortfoliosData, selectedAccountNames.length]);

  // Load ALL portfolios data function
  const loadAllPortfoliosData = useCallback(async () => {
    console.log('🌍 [PORTFOLIO CONTEXT] Loading ALL portfolios data');
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/portfolios/complete-data`);
      const data: AllPortfoliosData = response.data;
      
      // Calculate total historical price series across all portfolios
      const totalHistoricalSeries = Object.values(data.portfolios).reduce(
        (count: number, portfolio: any) => count + Object.keys(portfolio.historical_prices || {}).length,
        0
      );

      console.log('✅ [PORTFOLIO CONTEXT] ALL portfolios data loaded successfully:', {
        portfoliosCount: Object.keys(data.portfolios).length,
        portfolioIds: Object.keys(data.portfolios),
        globalSecurities: Object.keys(data.global_securities).length,
        globalQuotes: Object.keys(data.global_quotes).length,
        globalExchangeRates: Object.keys(data.global_exchange_rates).length,
        userTagLibrary: Object.keys(data.user_tag_library?.tag_definitions || {}).length,
        holdingTags: Object.keys(data.all_holding_tags || {}).length,
        holdingTagsSymbols: Object.keys(data.all_holding_tags || {}),
        optionsVesting: Object.keys(data.all_options_vesting || {}).length,
        historicalPriceSeries: totalHistoricalSeries,
        defaultPortfolio: data.user_preferences.default_portfolio_id,
        timestamp: data.computation_timestamp,
        sampleHoldingTag: Object.values(data.all_holding_tags || {})[0] || 'No holding tags found'
      });
      
      // Debug a sample holding tag structure
      if (data.all_holding_tags && Object.keys(data.all_holding_tags).length > 0) {
        const sampleSymbol = Object.keys(data.all_holding_tags)[0];
        const sampleHoldingTag = data.all_holding_tags[sampleSymbol];
        console.log(`🏷️ [PORTFOLIO CONTEXT] Sample holding tag structure for ${sampleSymbol}:`, {
          hasTagsObject: !!(sampleHoldingTag.tags),
          tagNames: Object.keys(sampleHoldingTag.tags || {}),
          sampleTagValue: sampleHoldingTag.tags ? Object.values(sampleHoldingTag.tags)[0] : 'No tags'
        });
      }

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

  // Current portfolio data in legacy format (bulletproof version)
  const currentPortfolioData = useMemo((): CompletePortfolioData | null => {
    if (!allPortfoliosData || !selectedPortfolioId) return null;
    
    const currentPortfolio = allPortfoliosData.portfolios?.[selectedPortfolioId];
    if (!currentPortfolio) return null;
    
    // Convert to legacy format with safe defaults
    return {
      portfolio_metadata: currentPortfolio.portfolio_metadata || {
        portfolio_id: selectedPortfolioId,
        portfolio_name: 'Unknown Portfolio',
        base_currency: 'USD',
        user_name: 'User',
        user_id: '',
        total_value: 0
      },
      accounts: currentPortfolio.accounts || [],
      securities: allPortfoliosData.global_securities || {},
      current_prices: currentPortfolio.current_prices || {},
      exchange_rates: allPortfoliosData.global_exchange_rates || {},
      live_quotes: allPortfoliosData.global_quotes || {},
      historical_prices: currentPortfolio.historical_prices || {},
      aggregation_data: [],
      computation_timestamp: currentPortfolio.computation_timestamp || new Date().toISOString()
    };
  }, [allPortfoliosData, selectedPortfolioId]);

  // Computed data based on selected portfolio and accounts (bulletproof version)
  const computedData = useMemo((): ComputedPortfolioData | null => {
    if (!currentPortfolioData) return null;
    
    console.log('🧮 [PORTFOLIO CONTEXT] Computing simple aggregations');
    
    // Use all accounts if none are selected
    const accountNamesToUse = selectedAccountNames.length > 0 
      ? selectedAccountNames 
      : currentPortfolioData.accounts.map(acc => acc.account_name);

    const selectedAccounts = currentPortfolioData.accounts.filter(account => 
      accountNamesToUse.includes(account.account_name)
    );

    const totalValue = selectedAccounts.reduce((sum, account) => sum + (account.account_total || 0), 0);

    // Aggregate holdings properly to avoid duplicates
    const holdingValues: Record<string, { value: number; units: number; accounts: any[] }> = {};
    
    selectedAccounts.forEach(account => {
      (account.holdings || []).forEach(holding => {
        if (!holdingValues[holding.symbol]) {
          holdingValues[holding.symbol] = { value: 0, units: 0, accounts: [] };
        }
        holdingValues[holding.symbol].value += holding.total_value || 0;
        holdingValues[holding.symbol].units += holding.units || 0;
        
        // Add account if not already present
        if (!holdingValues[holding.symbol].accounts.some(acc => acc.name === account.account_name)) {
          holdingValues[holding.symbol].accounts.push({
            name: account.account_name,
            type: account.account_type || 'unknown'
          });
        }
      });
    });

    console.log('🔍 [PORTFOLIO CONTEXT] Holdings aggregation check:', {
      totalAccountHoldings: selectedAccounts.reduce((sum, acc) => sum + (acc.holdings?.length || 0), 0),
      aggregatedSymbols: Object.keys(holdingValues),
      duplicateCheck: Object.keys(holdingValues).length === [...new Set(Object.keys(holdingValues))].length
    });

    // Generate chart data for Account Size Overview
    const accountData = selectedAccounts.map(account => ({
      label: account.account_name,
      value: Math.round((account.account_total || 0) * 100) / 100,
      percentage: totalValue > 0 ? Math.round(((account.account_total || 0) / totalValue * 100) * 100) / 100 : 0
    })).sort((a, b) => b.value - a.value);

    // Generate chart data for Holdings by Symbol
    const symbolData = Object.entries(holdingValues).map(([symbol, data]) => {
      const percentage = totalValue > 0 ? (data.value / totalValue * 100) : 0;
      return {
        label: symbol,
        value: Math.round(data.value * 100) / 100,
        percentage: Math.round(percentage * 100) / 100
      };
    }).sort((a, b) => b.value - a.value);

    const filteredAggregations = [
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

    // Create properly aggregated holdings table (no duplicates)
    const allHoldings = Object.entries(holdingValues).map(([symbol, data]) => {
      const security = currentPortfolioData.securities?.[symbol];
      const holdingTags = allPortfoliosData?.all_holding_tags?.[symbol];
      
      // Get security tags from the actual holding objects (restored from original logic)
      const firstAccountWithThisSymbol = selectedAccounts.find(account =>
        account.holdings?.some(h => h.symbol === symbol)
      );
      const holdingFromAccount = firstAccountWithThisSymbol?.holdings?.find(h => h.symbol === symbol);
      const securityTagsFromHolding = holdingFromAccount?.tags || {};
      
      // Combine tags properly: security tags + holding-specific tags
      let combinedTags: Record<string, any> = {};
      
      // Start with security tags from holding object (these were restored from original logic)
      if (securityTagsFromHolding && typeof securityTagsFromHolding === 'object') {
        combinedTags = { ...securityTagsFromHolding };
        if (Object.keys(securityTagsFromHolding).length > 0) {
          console.log(`🏷️ [PORTFOLIO CONTEXT] Security tags from holding for ${symbol}:`, Object.keys(securityTagsFromHolding));
        }
      }
      
      // Also check global securities for additional tags
      if (security?.tags && typeof security.tags === 'object') {
        combinedTags = { ...combinedTags, ...security.tags };
      }
      
      // Override with holding-specific tags (complex TagValue structures from MongoDB)
      if (holdingTags?.tags && typeof holdingTags.tags === 'object') {
        console.log(`🏷️ [PORTFOLIO CONTEXT] MongoDB holding tags for ${symbol}:`, {
          tagNames: Object.keys(holdingTags.tags),
          sampleTag: Object.keys(holdingTags.tags)[0] ? {
            name: Object.keys(holdingTags.tags)[0],
            structure: holdingTags.tags[Object.keys(holdingTags.tags)[0]]
          } : 'No tags'
        });
        
        // Merge MongoDB holding tags (they have the proper TagValue structure)
        combinedTags = { ...combinedTags, ...holdingTags.tags };
      }
      
      // Log final result
      if (Object.keys(combinedTags).length > 0) {
        console.log(`✅ [PORTFOLIO CONTEXT] Combined tags for ${symbol}:`, {
          tagCount: Object.keys(combinedTags).length,
          tagNames: Object.keys(combinedTags),
          tagSources: {
            fromHoldingObject: Object.keys(securityTagsFromHolding).length,
            fromGlobalSecurity: security?.tags ? Object.keys(security.tags).length : 0,
            fromMongoDB: holdingTags?.tags ? Object.keys(holdingTags.tags).length : 0
          },
          sampleTagStructure: Object.values(combinedTags)[0]
        });
      } else {
        console.log(`🔍 [PORTFOLIO CONTEXT] No tags found for ${symbol}:`, {
          holdingObjectTags: securityTagsFromHolding,
          globalSecurityTags: security?.tags,
          mongoDBTags: holdingTags?.tags
        });
      }
      
      // Get the original price in original currency from backend data
      const priceData = currentPortfolioData.current_prices?.[symbol];
      let originalPrice = data.units > 0 ? data.value / data.units : 0; // fallback to base currency calculation
      let originalCurrency = currentPortfolioData.portfolio_metadata?.base_currency || 'USD'; // fallback to base currency
      
      // If we have security and price data, use the direct original currency information
      if (security && priceData) {
        originalCurrency = security.currency || originalCurrency;
        
        // Use the backend-provided original_price if available (NEW: backend now sends this)
        if (priceData.original_price !== undefined) {
          originalPrice = priceData.original_price;
          console.log(`✅ [PORTFOLIO CONTEXT] Using backend original price for ${symbol}:`, {
            originalCurrency,
            originalPrice: priceData.original_price,
            baseCurrencyPrice: priceData.price
          });
        } else {
          // Fallback to reverse conversion if original_price not available
          if (security.currency !== currentPortfolioData.portfolio_metadata?.base_currency) {
            const exchangeRate = allPortfoliosData?.global_exchange_rates?.[security.currency];
            if (exchangeRate && exchangeRate !== 0) {
              // Reverse the conversion: base_currency_price / exchange_rate = original_currency_price
              originalPrice = priceData.price / exchangeRate;
            } else {
              // If no exchange rate, use the price as is (might be incorrect but better than crashing)
              originalPrice = priceData.price;
            }
          } else {
            // Same currency as base currency, use price as is
            originalPrice = priceData.price;
          }
          
          console.log(`💱 [PORTFOLIO CONTEXT] Fallback price conversion for ${symbol}:`, {
            originalCurrency,
            baseCurrency: currentPortfolioData.portfolio_metadata?.base_currency,
            baseCurrencyPrice: priceData.price,
            exchangeRate: allPortfoliosData?.global_exchange_rates?.[security.currency],
            calculatedOriginalPrice: originalPrice
          });
        }
      }
      
      return {
        symbol,
        security_type: security?.security_type || 'unknown', 
        name: security?.name || symbol,
        tags: combinedTags,
        total_units: data.units,
        original_price: originalPrice,
        original_currency: originalCurrency,
        value_per_unit: data.units > 0 ? data.value / data.units : 0,
        total_value: data.value,
        currency: currentPortfolioData.portfolio_metadata?.base_currency || 'USD',
        price_source: 'calculated',
        historical_prices: currentPortfolioData.historical_prices?.[symbol] || [],
        account_breakdown: data.accounts.map(acc => {
          // Find the actual account and holding data
          const account = selectedAccounts.find(account => account.account_name === acc.name);
          const accountHolding = account?.holdings?.find(h => h.symbol === symbol);
          
          return {
            account_name: acc.name,
            account_type: acc.type,
            units: accountHolding?.units || 0,
            value: accountHolding?.total_value || 0,
            owners: account?.owners || []
          };
        })
      };
    }).sort((a, b) => b.total_value - a.total_value);

    // Calculate tags summary
    const holdingsWithTags = allHoldings.filter(h => h.tags && Object.keys(h.tags).length > 0);
    
    console.log('✅ [PORTFOLIO CONTEXT] Computed data generated:', {
      selectedAccountsCount: selectedAccounts.length,
      totalValue: Math.round(totalValue * 100) / 100,
      chartsGenerated: filteredAggregations.length,
      chartTitles: filteredAggregations.map(agg => agg.chart_title),
      holdingsCount: allHoldings.length,
      holdingsWithTags: holdingsWithTags.length,
      holdingsWithHistoricalData: allHoldings.filter(h => h.historical_prices?.length > 0).length,
      uniqueSymbols: [...new Set(allHoldings.map(h => h.symbol))].length,
      duplicateSymbolsCheck: allHoldings.length === [...new Set(allHoldings.map(h => h.symbol))].length
    });

    return {
      selectedAccounts,
      filteredAggregations,
      totalValue: Math.round(totalValue * 100) / 100,
      holdingsTable: {
        base_currency: currentPortfolioData.portfolio_metadata?.base_currency || 'USD',
        holdings: allHoldings
      }
    };
  }, [currentPortfolioData, selectedAccountNames, allPortfoliosData]);

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

  // Tags utilities with error handling and debugging
  const getUserTagLibrary = useCallback(() => {
    try {
      const library = allPortfoliosData?.user_tag_library;
      if (!library) {
        console.log('🏷️ [PORTFOLIO CONTEXT] No tag library available, using empty fallback');
        return { user_id: '', tag_definitions: {}, template_tags: {} };
      }
      
      // Only log when we actually have tag definitions
      if (library.tag_definitions && Object.keys(library.tag_definitions).length > 0) {
        console.log('✅ [PORTFOLIO CONTEXT] Tag library loaded with definitions:', Object.keys(library.tag_definitions));
      }
      
      return library;
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getUserTagLibrary:', error);
      return { user_id: '', tag_definitions: {}, template_tags: {} };
    }
  }, [allPortfoliosData]);

  const getHoldingTagsBySymbol = useCallback((symbol: string) => {
    try {
      const result = allPortfoliosData?.all_holding_tags?.[symbol];
      // Only log for symbols that have tags to reduce noise
      if (result && result.tags && Object.keys(result.tags).length > 0) {
        console.log(`🏷️ [PORTFOLIO CONTEXT] Found holding tags for ${symbol}:`, Object.keys(result.tags));
      }
      return result;
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
    
    // Auto-select all accounts for the new portfolio (prevents infinite loading)
    if (allPortfoliosData?.portfolios?.[portfolioId]?.accounts) {
      const accountNames = allPortfoliosData.portfolios[portfolioId].accounts.map(acc => acc.account_name);
      console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting accounts for new portfolio:', accountNames);
      setSelectedAccountNames(accountNames);
    } else {
      // Reset account selection when portfolio changes (fallback)
      setSelectedAccountNames([]);
    }
  }, [selectedPortfolioId, allPortfoliosData]);

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
