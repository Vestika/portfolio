import { useState, useRef, useCallback } from 'react';
import { usePortfolioData } from '../contexts/PortfolioDataContext';

export interface SymbolSuggestion {
  symbol: string;
  name: string;
  symbol_type: string;
  currency: string;
  short_name: string;
  market: string;
  sector: string;
  display_symbol?: string; // For merged TASE symbols: "006 TEVA"
}

export const useSymbolAutocomplete = () => {
  const { getAutocompleteData } = usePortfolioData();
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for search results to avoid recomputation
  const cacheRef = useRef<Map<string, SymbolSuggestion[]>>(new Map());
  const lastQueryRef = useRef<string>('');

  // Get the autocomplete data from context (simple and stable)
  const autocompleteData = getAutocompleteData();

  // Helper function to calculate edit distance for fuzzy matching
  const editDistance = useCallback((s1: string, s2: string): number => {
    if (s1.length > s2.length) [s1, s2] = [s2, s1];
    const distances = Array.from({ length: s1.length + 1 }, (_, i) => i);
    
    for (let i2 = 0; i2 < s2.length; i2++) {
      const distances_ = [i2 + 1];
      for (let i1 = 0; i1 < s1.length; i1++) {
        if (s1[i1] === s2[i2]) {
          distances_.push(distances[i1]);
        } else {
          distances_.push(1 + Math.min(distances[i1], distances[i1 + 1], distances_[distances_.length - 1]));
        }
      }
      distances.splice(0, distances.length, ...distances_);
    }
    return distances[s1.length];
  }, []);

  // Enhanced local search function with better prioritization and performance
  const searchSymbolsLocally = useCallback((query: string): SymbolSuggestion[] => {
    const trimmedQuery = query.trim().toLowerCase();
    
    if (!trimmedQuery) {
      return [];
    }
    
    if (autocompleteData.length === 0) {
      return [];
    }
    
    const results: SymbolSuggestion[] = [];
    const isNumeric = /^\d+$/.test(trimmedQuery);
    
    // Performance optimization: limit processing to prevent UI blocking
    let processedCount = 0;
    const maxProcessingTime = 80; // Increased from 40ms to ensure important symbols get processed
    const startTime = performance.now();
    
    // Pre-sort autocomplete data to prioritize likely matches
    const sortedData = [...autocompleteData].sort((a, b) => {
      const aBaseSymbol = a.symbol.toLowerCase()
        .replace(/^(nyse:|nasdaq:|tase:|fx:)/, '')
        .replace(/\.ta$/, '')
        .replace(/-usd$/, '');
      const bBaseSymbol = b.symbol.toLowerCase()
        .replace(/^(nyse:|nasdaq:|tase:|fx:)/, '')
        .replace(/\.ta$/, '')
        .replace(/-usd$/, '');
      
      // For numeric queries, prioritize TASE symbols
      if (isNumeric) {
        if (a.symbol_type === 'tase' && b.symbol_type !== 'tase') return -1;
        if (a.symbol_type !== 'tase' && b.symbol_type === 'tase') return 1;
      }
      
      // HIGHEST PRIORITY: Exact matches and symbols starting with query
      const aExactMatch = aBaseSymbol.toLowerCase() === trimmedQuery || a.symbol.toLowerCase() === trimmedQuery;
      const bExactMatch = bBaseSymbol.toLowerCase() === trimmedQuery || b.symbol.toLowerCase() === trimmedQuery;
      const aStartsWithQuery = aBaseSymbol.toLowerCase().startsWith(trimmedQuery);
      const bStartsWithQuery = bBaseSymbol.toLowerCase().startsWith(trimmedQuery);
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      if (aStartsWithQuery && !bStartsWithQuery) return -1;
      if (!aStartsWithQuery && bStartsWithQuery) return 1;
      
      // If both start with query or both don't, sort by length (shorter first)
      if ((aStartsWithQuery && bStartsWithQuery) || (!aStartsWithQuery && !bStartsWithQuery)) {
        return aBaseSymbol.length - bBaseSymbol.length;
      }
      
      return 0;
    });
    
    for (const symbol of sortedData) {
      // Check if we've exceeded processing time budget
      if (processedCount % 1000 === 0 && processedCount > 0) {
        if (performance.now() - startTime > maxProcessingTime) {
          // Keep timeout warning for performance monitoring
          console.warn(`⚠️ [AUTOCOMPLETE] Search timeout after ${processedCount} symbols`);
          break;
        }
      }
      processedCount++;
      
      const symbolLower = symbol.symbol.toLowerCase();
      const nameLower = symbol.name.toLowerCase();
      const shortNameLower = (symbol.short_name || '').toLowerCase();
      const displaySymbolLower = (symbol.display_symbol || '').toLowerCase();
      
      // Extract base symbol for comparison (remove prefixes/suffixes including crypto -USD)
      const baseSymbol = symbolLower
        .replace(/^(nyse:|nasdaq:|tase:|fx:)/, '')  // Remove exchange prefixes
        .replace(/\.ta$/, '')                       // Remove TASE suffix  
        .replace(/-usd$/, '');                      // Remove crypto suffix
      
      let matches = false;
      let score = 0;
      let matchReason = '';
      
      // === HIGHEST PRIORITY MATCHES (1000+) ===
      
      // 1. Exact symbol match (highest priority)
      if (symbolLower === trimmedQuery || baseSymbol === trimmedQuery) {
        matches = true;
        score = 2000;
        matchReason = 'exact_symbol';
      }
      // 2. Exact display symbol match (for TASE)
      else if (displaySymbolLower && displaySymbolLower === trimmedQuery) {
        matches = true;
        score = 1900;
        matchReason = 'exact_display';
      }
      
      // === HIGH PRIORITY MATCHES (1500-1800) ===
      
      // 3. Symbol starts with query - MUCH higher priority for short queries
      else if (baseSymbol.startsWith(trimmedQuery)) {
        matches = true;
        // Give massive boost for short queries to ensure TSLA shows up for "T", "TS"
        if (trimmedQuery.length <= 2) {
          score = 1800 - (baseSymbol.length - trimmedQuery.length); // Prefer shorter symbols
        } else {
          score = 1700 - (baseSymbol.length - trimmedQuery.length);
        }
        matchReason = 'symbol_starts';
      }
      // 4. Full symbol starts with query (with prefixes)
      else if (symbolLower.startsWith(trimmedQuery)) {
        matches = true;
        score = 1600;
        matchReason = 'full_symbol_starts';
      }
      
      // === NUMERIC TASE PRIORITY (1400-1500) ===
      
      // 5. TASE numeric ID exact match
      else if (isNumeric && symbol.symbol_type === 'tase') {
        // Check if the base symbol (number part) matches
        const taseNumericPart = baseSymbol.replace(/\.ta$/, '');
        if (taseNumericPart === trimmedQuery || 
            (symbol.search_terms && symbol.search_terms.some(term => term === trimmedQuery))) {
          matches = true;
          score = 1500;
          matchReason = 'tase_numeric_exact';
        }
        // Check if numeric part starts with query
        else if (taseNumericPart.startsWith(trimmedQuery)) {
          matches = true;
          score = 1400 - (taseNumericPart.length - trimmedQuery.length);
          matchReason = 'tase_numeric_starts';
        }
      }
      
      // === MEDIUM-HIGH PRIORITY (1000-1300) ===
      
      // 6. Name starts with query
      else if (nameLower.startsWith(trimmedQuery) || shortNameLower.startsWith(trimmedQuery)) {
        matches = true;
        score = 1200;
        matchReason = 'name_starts';
      }
      // 7. Display symbol starts with query (TASE)
      else if (displaySymbolLower && displaySymbolLower.startsWith(trimmedQuery)) {
        matches = true;
        score = 1100;
        matchReason = 'display_starts';
      }
      // 8. TASE display symbol word starts (e.g., "629014 TEVA" matching "T")
      else if (symbol.symbol_type === 'tase' && displaySymbolLower && 
               displaySymbolLower.split(' ').some(part => part.startsWith(trimmedQuery))) {
        matches = true;
        score = 1000;
        matchReason = 'tase_word_starts';
      }
      
      // === MEDIUM PRIORITY (600-900) ===
      
      // 9. Symbol contains query (be more selective here)
      else if (baseSymbol.includes(trimmedQuery) && trimmedQuery.length >= 2) {
        matches = true;
        score = 800;
        matchReason = 'symbol_contains';
      }
      // 10. Name contains query
      else if ((nameLower.includes(trimmedQuery) || shortNameLower.includes(trimmedQuery)) && 
               trimmedQuery.length >= 2) {
        matches = true;
        score = 700;
        matchReason = 'name_contains';
      }
      // 11. Search terms match (improved)
      else if (symbol.search_terms && trimmedQuery.length >= 2) {
        const exactTermMatch = symbol.search_terms.some(term => term.toLowerCase() === trimmedQuery);
        const startsTermMatch = symbol.search_terms.some(term => term.toLowerCase().startsWith(trimmedQuery));
        const containsTermMatch = symbol.search_terms.some(term => term.toLowerCase().includes(trimmedQuery));
        
        if (exactTermMatch) {
          matches = true;
          score = 900;
          matchReason = 'search_term_exact';
        } else if (startsTermMatch) {
          matches = true;
          score = 750;
          matchReason = 'search_term_starts';
        } else if (containsTermMatch) {
          matches = true;
          score = 650;
          matchReason = 'search_term_contains';
        }
      }
      
      // === LOW PRIORITY - FUZZY MATCHING (200-400) ===
      // Only do fuzzy matching for longer queries and if we don't have enough results
      else if (trimmedQuery.length >= 3 && results.length < 10) {
        const editDistanceSymbol = editDistance(trimmedQuery, baseSymbol);
        
        // Much more restrictive fuzzy matching
        const maxEdits = trimmedQuery.length >= 5 ? 2 : 1;
        if (editDistanceSymbol <= maxEdits && editDistanceSymbol < trimmedQuery.length * 0.4) {
          matches = true;
          score = 400 - (editDistanceSymbol * 100);
          matchReason = 'fuzzy_match';
        }
      }
      
      // Special boost for numeric queries matching TASE symbols
      if (isNumeric && symbol.symbol_type === 'tase' && matches) {
        score += 300; // Boost TASE symbols for numeric queries
      }
      
      // Special penalty for very long symbols when query is short
      if (trimmedQuery.length <= 2 && baseSymbol.length > 6) {
        score -= 100;
      }
      
      if (matches) {
        results.push({
          symbol: symbol.symbol,
          name: symbol.name,
          symbol_type: symbol.symbol_type,
          currency: symbol.currency,
          short_name: symbol.short_name,
          market: symbol.market,
          sector: symbol.sector,
          display_symbol: symbol.display_symbol,
          score,
          matchReason
        } as SymbolSuggestion & { score: number; matchReason: string });
        
        // Early exit if we have enough high-quality results
        if (results.length >= 50) {
          break;
        }
      }
    }

    // Sort by score (descending) then by symbol length (shorter first), then by symbol name
    results.sort((a, b) => {
      const aScore = (a as any).score;
      const bScore = (b as any).score;
      if (aScore !== bScore) return bScore - aScore;
      
      // For same scores, prefer shorter symbols (with proper prefix stripping)
      const aBaseLen = a.symbol.toLowerCase()
        .replace(/^(nyse:|nasdaq:|tase:|fx:)/, '')
        .replace(/\.ta$/, '')
        .replace(/-usd$/, '').length;
      const bBaseLen = b.symbol.toLowerCase()
        .replace(/^(nyse:|nasdaq:|tase:|fx:)/, '')
        .replace(/\.ta$/, '')
        .replace(/-usd$/, '').length;
      if (aBaseLen !== bBaseLen) return aBaseLen - bBaseLen;
      
      return a.symbol.localeCompare(b.symbol);
    });

    // Enhanced deduplication for TASE symbols - prefer merged symbols over string-only
    const deduplicatedResults = [];
    const seenKeys = new Set<string>();
    const taseCompanyMap = new Map<string, any>(); // Track TASE symbols by company name
    
    // First pass: identify TASE symbols and group by company name
    for (const result of results) {
      if (result.symbol_type === 'tase') {
        const companyName = result.name.toLowerCase();
        if (!taseCompanyMap.has(companyName)) {
          taseCompanyMap.set(companyName, []);
        }
        taseCompanyMap.get(companyName)!.push(result);
      }
    }
    
    // Second pass: deduplicate, preferring merged TASE symbols
    for (const result of results) {
      if (result.symbol_type === 'tase') {
        const companyName = result.name.toLowerCase();
        const companySymbols = taseCompanyMap.get(companyName) || [];
        
        // If there are multiple TASE symbols for same company, prefer the merged one
        if (companySymbols.length > 1) {
          const mergedSymbol = companySymbols.find((s: any) => s.display_symbol && s.display_symbol.includes(' '));
          const stringOnlySymbol = companySymbols.find((s: any) => !s.display_symbol && !s.symbol.split('.')[0].match(/^\d+$/));
          
          // Skip string-only symbol if we have a merged version
          if (mergedSymbol && stringOnlySymbol && result === stringOnlySymbol) {
            continue;
          }
        }
      }
      
      // Regular deduplication
      const key = `${result.symbol}-${result.symbol_type}-${result.currency}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduplicatedResults.push(result);
      }
    }

    // Remove score and matchReason properties and limit results
    const finalResults = deduplicatedResults.slice(0, 20).map((item: any) => {
      const { score, matchReason, ...rest } = item;
      return rest;
    });
    
    return finalResults;
  }, [autocompleteData, editDistance]);

  const fetchSuggestions = useCallback((query: string) => {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Clear suggestions if query is empty
    if (!trimmedQuery) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Don't search if query hasn't changed
    if (trimmedQuery === lastQueryRef.current) {
      return;
    }

    // Check cache first
    if (cacheRef.current.has(trimmedQuery)) {
      const cachedResults = cacheRef.current.get(trimmedQuery)!;
      setSuggestions(cachedResults);
      setIsLoading(false);
      return;
    }

    // Update refs
    lastQueryRef.current = trimmedQuery;

    setIsLoading(true);
    setError(null);

    try {
      // Perform local search
      const results = searchSymbolsLocally(query);
      
      // Cache the results
      cacheRef.current.set(trimmedQuery, results);
      
      // Only update if this is still the current query
      if (trimmedQuery === lastQueryRef.current) {
        setSuggestions(results);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during local search');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchSymbolsLocally]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
    lastQueryRef.current = '';
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions,
    clearSuggestions,
  };
}; 