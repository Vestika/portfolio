import { useState, useRef, useCallback } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

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
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache to avoid duplicate API calls
  const cacheRef = useRef<Map<string, SymbolSuggestion[]>>(new Map());
  const lastQueryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Clear suggestions if query is too short
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Don't fetch if query hasn't changed
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

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Update refs
    lastQueryRef.current = trimmedQuery;
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const url = `${apiUrl}/symbols/autocomplete?q=${encodeURIComponent(trimmedQuery)}`;
      const response = await fetch(url, { signal: abortControllerRef.current.signal });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the results
      cacheRef.current.set(trimmedQuery, data);
      
      // Only update if this is still the current query
      if (trimmedQuery === lastQueryRef.current) {
        setSuggestions(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
    lastQueryRef.current = '';
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions,
    clearSuggestions,
  };
}; 