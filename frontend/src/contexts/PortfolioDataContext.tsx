import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import api from '../utils/api';

// Helper function to compare arrays
const arraysEqual = (a: string[], b: string[]) => {
  return a.length === b.length && a.every((val, index) => val === b[index]);
};

// Autocomplete symbol interface
export interface AutocompleteSymbol {
  symbol: string;
  name: string;
  symbol_type: string;
  currency: string;
  short_name: string;
  market: string;
  sector: string;
  search_terms?: string[];
  display_symbol?: string; // For merged TASE symbols: "006 TEVA"
}

// Autocomplete data response interface  
export interface AutocompleteDataResponse {
  autocomplete_data: AutocompleteSymbol[];
  total_symbols: number;
  computation_timestamp: string;
}

// Types for the complete portfolio data structure (ALL portfolios)
export interface AllPortfoliosData {
  portfolios: Record<string, SinglePortfolioData>;
  global_securities: Record<string, SecurityData>;
  global_current_prices: Record<string, PriceData>;
  global_historical_prices: Record<string, Array<{ date: string; price: number }>>;
  global_logos: Record<string, string | null>; // NEW: Global logos by symbol
    global_earnings_data: Record<string, Array<{
    date: string;
    epsActual?: number;
    epsEstimate?: number;
    hour: 'amc' | 'bmo';
    quarter: number;
    revenueActual?: number;
    revenueEstimate?: number;
    symbol: string;
    year: number;
  }>>;
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
  };
  accounts: AccountData[];
  computation_timestamp: string;
}

// Legacy interface for backward compatibility
export interface CompletePortfolioData {
  portfolio_metadata: {
    portfolio_id: string;
    portfolio_name: string;
    base_currency: string;
    user_name: string;
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
  original_currency: string;
  security_type: string;
  security_name: string;
  logo?: string;  // ← Added logo property to match backend data
}

export interface SecurityData {
  symbol: string;
  name: string;
  security_type: string;
  currency: string;
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
  autocompleteData: AutocompleteSymbol[];
  isLoading: boolean;
  isAutocompleteLoading: boolean;
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
  refreshTagsOnly: () => Promise<void>;
  
  // Utilities
  getAccountByName: (name: string, portfolioId?: string) => AccountData | undefined;
  getSecurityBySymbol: (symbol: string) => SecurityData | undefined;
  getPriceBySymbol: (symbol: string) => PriceData | undefined;
  getPercentChange: (symbol: string) => number;
  
  // Tags utilities
  getUserTagLibrary: () => any | null;
  getHoldingTagsBySymbol: (symbol: string) => any | undefined;
  
  // NEW: Logo utilities
  getLogoBySymbol: (symbol: string) => string | null;
  
  // NEW: Earnings utilities
  getEarningsBySymbol: (symbol: string) => Array<{
    date: string;
    epsActual?: number;
    epsEstimate?: number;
    hour: 'amc' | 'bmo';
    quarter: number;
    revenueActual?: number;
    revenueEstimate?: number;
    symbol: string;
    year: number;
  }> | undefined;
  
  // Options utilities
  getOptionsVestingByAccount: (portfolioId: string, accountName: string) => any | undefined;

  // Portfolio utilities
  getAvailablePortfolios: () => Array<{ portfolio_id: string; portfolio_name: string; display_name: string }>;
  
  // NEW: Autocomplete utilities
  getAutocompleteData: () => AutocompleteSymbol[];
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
  const resolveFrontendCalc = (): boolean => {
    try {
      const fromEnv = (import.meta as any)?.env?.VITE_FRONTEND_CALC;
      const fromLS = typeof window !== 'undefined' ? window.localStorage.getItem('FRONTEND_CALC') : null;
      const fromQS = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('frontend_calc') : null;
      const raw = ((fromQS ?? fromLS ?? fromEnv) ?? '').toString().trim().toLowerCase();
      const enabled = raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
      console.log('🧪 [PORTFOLIO CONTEXT] FRONTEND_CALC resolved:', { fromEnv, fromLS, fromQS, raw, enabled });
      return enabled;
    } catch {
      return false;
    }
  };
  const FRONTEND_CALC = resolveFrontendCalc();
  
  // State for ALL portfolios data
  const [allPortfoliosData, setAllPortfoliosData] = useState<AllPortfoliosData | null>(null);
  const [autocompleteData, setAutocompleteData] = useState<AutocompleteSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
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

  // Load ALL portfolios data and autocomplete data in parallel
  const loadAllPortfoliosData = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoading) {
      console.log('🔒 [PORTFOLIO CONTEXT] Request already in progress, skipping duplicate call');
      return;
    }

    console.log('🌍 [PORTFOLIO CONTEXT] Loading ALL portfolios data and autocomplete data in parallel');
    setIsLoading(true);
    setIsAutocompleteLoading(true);
    setError(null);

    try {
      // Use frontend-side calculation flow when enabled
      if (FRONTEND_CALC) {
        console.log('🧪 [PORTFOLIO CONTEXT] FRONTEND_CALC enabled - using /portfolios/raw + /prices/batch');
        const [rawResp, autocompleteResponse] = await Promise.all([
          api.get(`/portfolios/raw`),
          api.get(`/autocomplete`)
        ]);

        const raw = rawResp.data as any;
        const autocompleteDataResponse: AutocompleteDataResponse = autocompleteResponse.data;

        // Determine base currency to convert prices into (use default portfolio base or first portfolio)
        const portfolioIds: string[] = Object.keys(raw?.portfolios || {});
        const defaultId: string | null = raw?.user_preferences?.default_portfolio_id || null;
        const selectedId: string | null = (defaultId && portfolioIds.includes(defaultId)) ? defaultId : (portfolioIds[0] || null);
        const targetBaseCurrency: string = (selectedId && raw.portfolios[selectedId]?.portfolio_metadata?.base_currency) || 'USD';

        // Gather all unique symbols across all portfolios
        const allSymbolsSet = new Set<string>();
        portfolioIds.forEach(pid => {
          const accounts = raw.portfolios[pid]?.accounts || [];
          accounts.forEach((acc: any) => {
            (acc.holdings || []).forEach((h: any) => {
              if (h?.symbol) allSymbolsSet.add(String(h.symbol).toUpperCase());
            });
          });
        });
        const allSymbols = Array.from(allSymbolsSet);

        // Fetch latest prices for all symbols
        const pricesResp = allSymbols.length > 0
          ? await api.post(`/prices/batch`, { symbols: allSymbols, base_currency: targetBaseCurrency, fresh: false })
          : { data: { prices: {} } };

        const pricesData = (pricesResp.data?.prices || {}) as Record<string, { price: number; currency?: string; last_updated?: string }>;

        // Simple FX map with sensible defaults for USD/ILS (minimal change for quick testing)
        const fxByPair: Record<string, { rate: number }> = {
          'USDUSD': { rate: 1 },
          'ILSILS': { rate: 1 },
          'USDILS': { rate: 3.4 },
          'ILSUSD': { rate: 1 / 3.4 },
        };

        const convertToBase = (value: number, fromCurrency?: string): number => {
          const from = (fromCurrency || '').toUpperCase();
          const base = (targetBaseCurrency || '').toUpperCase();
          if (!Number.isFinite(value)) return 0;
          if (!from || from === base) return value;
          const fx = fxByPair[`${from}${base}`];
          return fx && fx.rate > 0 ? value * fx.rate : value;
        };

        // Build global_current_prices in target base currency, retaining original_price
        const global_current_prices: Record<string, any> = {};
        Object.entries(pricesData).forEach(([sym, pr]) => {
          const originalPrice = pr?.price ?? 0;
          const originalCurrency = (pr?.currency || targetBaseCurrency).toUpperCase();
          const converted = convertToBase(originalPrice, originalCurrency);
          global_current_prices[sym] = {
            price: converted,
            original_price: originalPrice,
            currency: originalCurrency,
            last_updated: pr?.last_updated || new Date().toISOString()
          };
        });

        const portfolioData: AllPortfoliosData = {
          portfolios: raw?.portfolios || {},
          global_securities: raw?.global_securities || {},
          global_current_prices,
          global_historical_prices: {},
          global_logos: {},
          global_earnings_data: {},
          user_tag_library: raw?.user_preferences ? { tag_definitions: {}, template_tags: {} } : { tag_definitions: {}, template_tags: {} },
          all_holding_tags: {},
          all_options_vesting: {},
          user_preferences: raw?.user_preferences || { preferred_currency: targetBaseCurrency, default_portfolio_id: selectedId },
          computation_timestamp: new Date().toISOString(),
        } as any;

        // Log and set
        const totalHistoricalSeries = Object.keys(portfolioData.global_historical_prices || {}).length;
        console.log('✅ [PORTFOLIO CONTEXT] ALL data (frontend calc) loaded successfully:', {
          portfoliosCount: Object.keys(portfolioData.portfolios).length,
          portfolioIds,
          globalSecurities: Object.keys(portfolioData.global_securities || {}).length,
          globalCurrentPrices: Object.keys(portfolioData.global_current_prices || {}).length,
          globalHistoricalPrices: Object.keys(portfolioData.global_historical_prices || {}).length,
          autocompleteData: autocompleteDataResponse.total_symbols,
          historicalPriceSeries: totalHistoricalSeries,
          defaultPortfolio: portfolioData.user_preferences.default_portfolio_id,
          timestamp: portfolioData.computation_timestamp,
        });

        setAllPortfoliosData(portfolioData);
        setAutocompleteData(autocompleteDataResponse.autocomplete_data);

        // Auto-select portfolio and accounts
        if (portfolioIds.length > 0) {
          const portfolioToSelect = selectedId || portfolioIds[0];
          console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting portfolio after load (frontend calc):', portfolioToSelect);
          setSelectedPortfolioId(portfolioToSelect);
          setTimeout(() => {
            const portfolio = portfolioData.portfolios[portfolioToSelect];
            if (portfolio?.accounts) {
              const accountNames = portfolio.accounts.map((acc: any) => acc.account_name);
              console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting accounts after load (frontend calc):', accountNames);
              setSelectedAccountNames(accountNames);
            }
          }, 50);
        }
      } else {
        // Existing backend aggregation path (default)
        // Fetch both endpoints in parallel for maximum performance
        const [portfolioResponse, autocompleteResponse] = await Promise.all([
          api.get(`/portfolios/complete-data`),
          api.get(`/autocomplete`)
        ]);

        const portfolioData: AllPortfoliosData = portfolioResponse.data;
        const autocompleteDataResponse: AutocompleteDataResponse = autocompleteResponse.data;
      
      // Calculate total historical price series (now global)
      const totalHistoricalSeries = Object.keys(portfolioData.global_historical_prices || {}).length;

      // Check for duplicates in autocomplete data (one-time global check)
      if (autocompleteDataResponse.autocomplete_data && autocompleteDataResponse.autocomplete_data.length > 0) {
        const symbolCounts = new Map<string, number>();
        autocompleteDataResponse.autocomplete_data.forEach(symbol => {
          const key = `${symbol.symbol}-${symbol.symbol_type}`;
          symbolCounts.set(key, (symbolCounts.get(key) || 0) + 1);
        });
        const duplicates = Array.from(symbolCounts.entries()).filter(([, count]) => count > 1);
        if (duplicates.length > 0) {
          console.warn(`⚠️ [PORTFOLIO CONTEXT] Found ${duplicates.length} duplicate symbols in backend data - this should be fixed at the backend level`);
        } else {
          console.log(`✅ [PORTFOLIO CONTEXT] Autocomplete data verified clean - no duplicates found`);
        }
      }

      console.log('✅ [PORTFOLIO CONTEXT] ALL data loaded successfully:', {
        portfoliosCount: Object.keys(portfolioData.portfolios).length,
        portfolioIds: Object.keys(portfolioData.portfolios),
        globalSecurities: Object.keys(portfolioData.global_securities).length,
        globalCurrentPrices: Object.keys(portfolioData.global_current_prices || {}).length,
        globalHistoricalPrices: Object.keys(portfolioData.global_historical_prices || {}).length,
        globalEarningsData: Object.keys(portfolioData.global_earnings_data || {}).length,
        earningsSymbols: Object.keys(portfolioData.global_earnings_data || {}),
        userTagLibrary: Object.keys(portfolioData.user_tag_library?.tag_definitions || {}).length,
        holdingTags: Object.keys(portfolioData.all_holding_tags || {}).length,
        holdingTagsSymbols: Object.keys(portfolioData.all_holding_tags || {}),
        optionsVesting: Object.keys(portfolioData.all_options_vesting || {}).length,
        autocompleteData: autocompleteDataResponse.total_symbols, // NEW: Log autocomplete data count
        historicalPriceSeries: totalHistoricalSeries,
        defaultPortfolio: portfolioData.user_preferences.default_portfolio_id,
        timestamp: portfolioData.computation_timestamp,
        sampleHoldingTag: Object.values(portfolioData.all_holding_tags || {})[0] || 'No holding tags found'
      });
      
      // Debug a sample holding tag structure
      if (portfolioData.all_holding_tags && Object.keys(portfolioData.all_holding_tags).length > 0) {
        const sampleSymbol = Object.keys(portfolioData.all_holding_tags)[0];
        const sampleHoldingTag = portfolioData.all_holding_tags[sampleSymbol];
        console.log(`🏷️ [PORTFOLIO CONTEXT] Sample holding tag structure for ${sampleSymbol}:`, {
          hasTagsObject: !!(sampleHoldingTag.tags),
          tagNames: Object.keys(sampleHoldingTag.tags || {}),
          sampleTagValue: sampleHoldingTag.tags ? Object.values(sampleHoldingTag.tags)[0] : 'No tags'
        });
      }

        // Set both portfolio data and autocomplete data
        setAllPortfoliosData(portfolioData);
        setAutocompleteData(autocompleteDataResponse.autocomplete_data);
        
        // Auto-select portfolio and accounts after data loads
        if (portfolioData.portfolios && Object.keys(portfolioData.portfolios).length > 0) {
          const portfolioIds = Object.keys(portfolioData.portfolios);
          const defaultId = portfolioData.user_preferences?.default_portfolio_id;
          const portfolioToSelect = (defaultId && portfolioIds.includes(defaultId)) ? defaultId : portfolioIds[0];
          
          console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting portfolio after load:', portfolioToSelect);
          setSelectedPortfolioId(portfolioToSelect);
          
          // Auto-select all accounts for the selected portfolio
          setTimeout(() => {
            const portfolio = portfolioData.portfolios[portfolioToSelect];
            if (portfolio?.accounts) {
              const accountNames = portfolio.accounts.map((acc: any) => acc.account_name);
              console.log('🎯 [PORTFOLIO CONTEXT] Auto-selecting accounts after load:', accountNames);
              setSelectedAccountNames(accountNames);
            }
          }, 50);
        }
      }
      
    } catch (err: any) {
      console.error('❌ [PORTFOLIO CONTEXT] Error loading data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load portfolios data');
    } finally {
      setIsLoading(false);
      setIsAutocompleteLoading(false);
    }
  }, [isLoading]);

  // Refresh all portfolios data
  const refreshAllPortfoliosData = useCallback(async () => {
    console.log('🔄 [PORTFOLIO CONTEXT] Refreshing all portfolios and autocomplete data');
    await loadAllPortfoliosData();
  }, [loadAllPortfoliosData]);

  // Refresh only tags (lightweight, no loading state)
  const refreshTagsOnly = useCallback(async () => {
    if (!allPortfoliosData) {
      console.warn('⚠️ [PORTFOLIO CONTEXT] Cannot refresh tags - no portfolio data loaded');
      return;
    }

    console.log('🏷️ [PORTFOLIO CONTEXT] Refreshing tags only (lightweight refresh)');
    
    try {
      // Fetch updated tags in parallel
      const [tagLibraryResponse, holdingTagsResponse] = await Promise.all([
        api.get(`/tags/library`),
        api.get(`/holdings/tags`)
      ]);

      const updatedTagLibrary = tagLibraryResponse.data;
      const updatedHoldingTagsList = holdingTagsResponse.data;

      // Convert holding tags array to map by symbol
      const updatedHoldingTagsMap: Record<string, any> = {};
      updatedHoldingTagsList.forEach((holdingTags: any) => {
        if (holdingTags.symbol) {
          updatedHoldingTagsMap[holdingTags.symbol] = holdingTags;
        }
      });

      // Update only the tags in the existing data
      setAllPortfoliosData(prevData => {
        if (!prevData) return prevData;
        
        return {
          ...prevData,
          user_tag_library: updatedTagLibrary,
          all_holding_tags: updatedHoldingTagsMap
        };
      });

      console.log('✅ [PORTFOLIO CONTEXT] Tags refreshed successfully:', {
        tagDefinitions: Object.keys(updatedTagLibrary?.tag_definitions || {}).length,
        holdingTagsCount: Object.keys(updatedHoldingTagsMap).length,
        updatedSymbols: Object.keys(updatedHoldingTagsMap)
      });
    } catch (error: any) {
      console.error('❌ [PORTFOLIO CONTEXT] Error refreshing tags:', error);
      // Don't throw - just log the error, UI will continue working with old tags
    }
  }, [allPortfoliosData]);

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
        user_name: 'User'
      },
      accounts: currentPortfolio.accounts || [],
      securities: allPortfoliosData.global_securities || {},
      current_prices: allPortfoliosData.global_current_prices || {},
      exchange_rates: {}, // Removed - no longer needed since original_price provided directly
      live_quotes: {}, // Removed - calculated from current/historical prices
      historical_prices: allPortfoliosData.global_historical_prices || {},
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

    const totalValue = selectedAccounts.reduce((sum, account) => {
      const accountTotal = (account.holdings || []).reduce((accSum, holding) => {
        const security = allPortfoliosData?.global_securities?.[holding.symbol];
        const priceData = allPortfoliosData?.global_current_prices?.[holding.symbol];
        if (!security || !priceData) return accSum;

        // Calculate value: units * price_in_base_currency
        const holdingValue = holding.units * priceData.price;
        return accSum + holdingValue;
      }, 0);
      return sum + accountTotal;
    }, 0);

    // Aggregate holdings properly to avoid duplicates
    const holdingValues: Record<string, { value: number; units: number; accounts: any[] }> = {};
    
    selectedAccounts.forEach(account => {
      (account.holdings || []).forEach(holding => {
        if (!holdingValues[holding.symbol]) {
          holdingValues[holding.symbol] = { value: 0, units: 0, accounts: [] };
        }

        // Calculate value dynamically
        const security = allPortfoliosData?.global_securities?.[holding.symbol];
        const priceData = allPortfoliosData?.global_current_prices?.[holding.symbol];
        const holdingValue = (security && priceData) ? holding.units * priceData.price : 0;

        holdingValues[holding.symbol].value += holdingValue;
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
    const accountData = selectedAccounts.map(account => {
      const accountTotal = (account.holdings || []).reduce((sum, holding) => {
        const security = allPortfoliosData?.global_securities?.[holding.symbol];
        const priceData = allPortfoliosData?.global_current_prices?.[holding.symbol];
        const holdingValue = (security && priceData) ? holding.units * priceData.price : 0;
        return sum + holdingValue;
      }, 0);

      return {
        label: account.account_name,
        value: Math.round(accountTotal * 100) / 100,
        percentage: totalValue > 0 ? Math.round((accountTotal / totalValue * 100) * 100) / 100 : 0
      };
    }).sort((a, b) => b.value - a.value);

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
      const security = allPortfoliosData?.global_securities?.[symbol];
      const holdingTags = allPortfoliosData?.all_holding_tags?.[symbol];
      const priceData = allPortfoliosData?.global_current_prices?.[symbol];

      // Get tags from MongoDB holding tags only (security tags removed from global_securities)
      let combinedTags: Record<string, any> = {};
      
      // Use holding-specific tags (complex TagValue structures from MongoDB)
      if (holdingTags?.tags && typeof holdingTags.tags === 'object') {
        console.log(`🏷️ [PORTFOLIO CONTEXT] MongoDB holding tags for ${symbol}:`, {
          tagNames: Object.keys(holdingTags.tags),
          sampleTag: Object.keys(holdingTags.tags)[0] ? {
            name: Object.keys(holdingTags.tags)[0],
            structure: holdingTags.tags[Object.keys(holdingTags.tags)[0]]
          } : 'No tags'
        });
        
        // Use MongoDB holding tags (they have the proper TagValue structure)
        combinedTags = { ...holdingTags.tags };
      }
      
      // Log final result
      if (Object.keys(combinedTags).length > 0) {
        console.log(`✅ [PORTFOLIO CONTEXT] Combined tags for ${symbol}:`, {
          tagCount: Object.keys(combinedTags).length,
          tagNames: Object.keys(combinedTags),
          tagSources: {
            fromMongoDB: holdingTags?.tags ? Object.keys(holdingTags.tags).length : 0
          },
          sampleTagStructure: Object.values(combinedTags)[0]
        });
      }

      // Calculate prices and values dynamically
      let originalPrice = 0;
      let originalCurrency = currentPortfolioData?.portfolio_metadata?.base_currency || 'USD';
      let valuePerUnit = 0;

      if (security && priceData) {
        originalCurrency = security.currency || originalCurrency;

        // Use the backend-provided original_price (always available now)
        originalPrice = priceData.original_price || priceData.price;

        valuePerUnit = priceData.price; // Value per unit in base currency
      }

      return {
        symbol,
        security_type: security?.security_type || 'unknown', 
        name: security?.name || symbol,
        tags: combinedTags,
        total_units: data.units,
        original_price: originalPrice,
        original_currency: originalCurrency,
        value_per_unit: valuePerUnit,
        total_value: data.value,
        currency: currentPortfolioData?.portfolio_metadata?.base_currency || 'USD',
        price_source: 'calculated',
        historical_prices: allPortfoliosData?.global_historical_prices?.[symbol] || [],
        logo: allPortfoliosData?.global_logos?.[symbol] || null,
        account_breakdown: data.accounts.map(acc => {
          // Find the actual account and holding data
          const account = selectedAccounts.find(account => account.account_name === acc.name);
          const accountHolding = account?.holdings?.find(h => h.symbol === symbol);
          
          // Calculate value for this account's portion
          const accountHoldingValue = (accountHolding && priceData) ? accountHolding.units * priceData.price : 0;

          return {
            account_name: acc.name,
            account_type: acc.type,
            units: accountHolding?.units || 0,
            value: accountHoldingValue,
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

  const getPriceBySymbol = useCallback((symbol: string): PriceData | undefined => {
    try {
      if (!allPortfoliosData) return undefined;
      return allPortfoliosData.global_current_prices?.[symbol];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getPriceBySymbol:', error);
      return undefined;
    }
  }, [allPortfoliosData]);

  const getPercentChange = useCallback((symbol: string): number => {
    try {
      const historicalPrices = allPortfoliosData?.global_historical_prices?.[symbol];

      if (!historicalPrices || historicalPrices.length < 2) {
        return 0;
      }

      // Compare last two historical entries (more reliable than mixing current + historical)
      const yesterdayPrice = historicalPrices[historicalPrices.length - 2]?.price;
      const todayPrice = historicalPrices[historicalPrices.length - 1]?.price;

      if (!yesterdayPrice || yesterdayPrice === 0 || !todayPrice || todayPrice === 0) {
        return 0;
      }

      return ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error calculating percent change:', error);
      return 0;
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

  // NEW: Logo utilities with error handling
  const getLogoBySymbol = useCallback((symbol: string): string | null => {
    try {
      return allPortfoliosData?.global_logos?.[symbol] || null;
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getLogoBySymbol:', error);
      return null;
    }
  }, [allPortfoliosData]);

  // NEW: Earnings utilities with error handling
  const getEarningsBySymbol = useCallback((symbol: string) => {
    try {
      return allPortfoliosData?.global_earnings_data?.[symbol] || [];
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getEarningsBySymbol:', error);
      return [];
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

  // NEW: Autocomplete utilities (memoized for performance)
  const getAutocompleteData = useCallback((): AutocompleteSymbol[] => {
    try {
      return autocompleteData;
    } catch (error) {
      console.error('❌ [PORTFOLIO CONTEXT] Error in getAutocompleteData:', error);
      return [];
    }
  }, [autocompleteData]);

  const value: PortfolioDataContextType = {
    allPortfoliosData,
    autocompleteData,
    isLoading,
    isAutocompleteLoading,
    error,
    selectedPortfolioId,
    setSelectedPortfolioId: setSelectedPortfolioIdWithLogging,
    selectedAccountNames,
    setSelectedAccountNames: setSelectedAccountNamesWithLogging,
    currentPortfolioData,
    computedData,
    loadAllPortfoliosData,
    refreshAllPortfoliosData,
    refreshTagsOnly,
    getAccountByName,
    getSecurityBySymbol,
    getPriceBySymbol,
    getPercentChange,
    getUserTagLibrary,
    getHoldingTagsBySymbol,
    getLogoBySymbol,
    getEarningsBySymbol,
    getOptionsVestingByAccount,
    getAvailablePortfolios,
    getAutocompleteData
  };
  
  console.log('✅ [PORTFOLIO PROVIDER] Context value created successfully');

  return (
    <PortfolioDataContext.Provider value={value}>
      {children}
    </PortfolioDataContext.Provider>
  );
};
