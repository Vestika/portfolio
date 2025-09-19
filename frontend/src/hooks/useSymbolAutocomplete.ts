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

  // Enhanced local search function with performance optimizations
  const searchSymbolsLocally = useCallback((query: string): SymbolSuggestion[] => {
    const trimmedQuery = query.trim().toLowerCase();
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }

    // Reduced logging frequency to prevent console spam
    if (trimmedQuery.length === 2) {
      console.log(`🔍 [AUTOCOMPLETE] Starting search in ${autocompleteData.length} symbols`);
    }
    
    const results: SymbolSuggestion[] = [];
    const isNumeric = /^\d+$/.test(trimmedQuery);
    
    // Performance optimization: limit processing to prevent UI blocking
    let processedCount = 0;
    const maxProcessingTime = 40; // Target under 50ms Chrome threshold
    const startTime = performance.now();
    
    for (const symbol of autocompleteData) {
      // Check if we've exceeded processing time budget
      if (processedCount % 1000 === 0 && processedCount > 0) {
        if (performance.now() - startTime > maxProcessingTime) {
          console.warn(`⚠️ [AUTOCOMPLETE] Search time budget exceeded, processed ${processedCount}/${autocompleteData.length} symbols`);
          break;
        }
      }
      processedCount++;
      const symbolLower = symbol.symbol.toLowerCase();
      const nameLower = symbol.name.toLowerCase();
      const shortNameLower = (symbol.short_name || '').toLowerCase();
      
      // Extract base symbol for comparison (remove prefixes/suffixes)
      const baseSymbol = symbolLower.replace(/^(nyse:|nasdaq:)/, '').replace(/\.ta$/, '');
      
      let matches = false;
      let score = 0;
      
      // 1. Exact symbol match (highest priority)
      if (symbolLower === trimmedQuery || baseSymbol === trimmedQuery) {
        matches = true;
        score = 1000;
      }
      // 2. Symbol starts with query
      else if (symbolLower.startsWith(trimmedQuery) || baseSymbol.startsWith(trimmedQuery)) {
        matches = true;
        score = 900;
      }
      // 3. Name starts with query
      else if (nameLower.startsWith(trimmedQuery) || shortNameLower.startsWith(trimmedQuery)) {
        matches = true;
        score = 800;
      }
      // 4. Symbol contains query
      else if (symbolLower.includes(trimmedQuery) || baseSymbol.includes(trimmedQuery)) {
        matches = true;
        score = 700;
      }
      // 5. Name contains query
      else if (nameLower.includes(trimmedQuery) || shortNameLower.includes(trimmedQuery)) {
        matches = true;
        score = 600;
      }
      // 6. Search terms match
      else if (symbol.search_terms?.some(term => 
        term.toLowerCase().includes(trimmedQuery) || trimmedQuery.includes(term.toLowerCase())
      )) {
        matches = true;
        score = 500;
      }
      // 7. Fuzzy match on symbol (up to 2 edits for short symbols) - expensive operation, limit usage
      else if (trimmedQuery.length >= 3 && results.length < 15) { // Only do fuzzy matching if we need more results
        const editDistanceSymbol = editDistance(trimmedQuery, baseSymbol);
        const editDistanceFull = editDistance(trimmedQuery, symbolLower);
        const minEditDistance = Math.min(editDistanceSymbol, editDistanceFull);
        
        if (minEditDistance <= 2 && minEditDistance < trimmedQuery.length / 2) {
          matches = true;
          score = 400 - (minEditDistance * 50); // Lower score for more edits
        }
      }
      // 8. Numeric match for Israeli securities
      if (isNumeric && (symbol.symbol.includes(trimmedQuery) || 
          (symbol as any).tase_id === trimmedQuery || 
          (symbol as any).numeric_id === trimmedQuery)) {
        matches = true;
        score = Math.max(score, 850); // High priority for numeric matches
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
          score
        } as SymbolSuggestion & { score: number });
        
        // Early exit if we have enough high-quality results
        if (results.length >= 50) {
          break;
        }
      }
    }

    // Sort by score (descending) then by symbol name
    results.sort((a, b) => {
      const aScore = (a as any).score;
      const bScore = (b as any).score;
      if (aScore !== bScore) return bScore - aScore;
      return a.symbol.localeCompare(b.symbol);
    });

    // Deduplicate results based on symbol + symbol_type + currency combination
    const deduplicatedResults = [];
    const seenKeys = new Set<string>();
    
    for (const result of results) {
      const key = `${result.symbol}-${result.symbol_type}-${result.currency}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduplicatedResults.push(result);
      }
    }

    // Remove score property and limit results
    const finalResults = deduplicatedResults.slice(0, 20).map((item: any) => {
      const { score, ...rest } = item;
      return rest;
    });
    
    const duplicatesRemoved = results.length - deduplicatedResults.length;
    const searchTime = performance.now() - startTime;
    
    // Only log if there are results or duplicates were removed
    if (finalResults.length > 0 || duplicatesRemoved > 0) {
      console.log(`✅ [AUTOCOMPLETE] Found ${finalResults.length} matches in ${searchTime.toFixed(1)}ms${duplicatesRemoved > 0 ? ` (removed ${duplicatesRemoved} duplicates)` : ''}`);
    }
    return finalResults;
  }, [autocompleteData, editDistance]);

  const fetchSuggestions = useCallback((query: string) => {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Clear suggestions if query is too short
    if (!trimmedQuery || trimmedQuery.length < 2) {
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