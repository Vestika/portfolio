import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { useSymbolAutocomplete, SymbolSuggestion } from '../../hooks/useSymbolAutocomplete';
import { cn } from '../../lib/utils';

interface AutocompleteProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const SymbolAutocomplete = React.forwardRef<HTMLInputElement, AutocompleteProps>(({
  placeholder = "e.g., AAPL",
  value,
  onChange,
  onKeyDown,
  className,
  inputRef
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const { suggestions, isLoading, fetchSuggestions, clearSuggestions } = useSymbolAutocomplete();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number>();

  // Debounced search with improved logic
  useEffect(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Only search if we have a query and dropdown is open
    if (value.trim() && isOpen) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(value.trim());
      }, 300);
    } else if (!value.trim()) {
      clearSuggestions();
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [value, isOpen, fetchSuggestions, clearSuggestions]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        selectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
    
    // Call the parent's onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const selectSuggestion = (suggestion: SymbolSuggestion) => {
    onChange(suggestion.symbol);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (value.trim() && value.trim().length >= 2) {
      fetchSuggestions(value.trim());
    }
  };

  const getSymbolTypeColor = (type: string) => {
    switch (type) {
      case 'nyse':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'tase':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'currency':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'crypto':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSymbolTypeLabel = (type: string) => {
    switch (type) {
      case 'nyse':
        return 'NYSE';
      case 'tase':
        return 'TASE';
      case 'currency':
        return 'Currency';
      case 'crypto':
        return 'Crypto';
      default:
        return type.toUpperCase();
    }
  };

        return (
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={ref || inputRef}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onFocus={handleInputFocus}
        className={className}
        autoComplete="off"
      />
      


      {suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl max-h-60 overflow-y-auto"
          style={{
            minWidth: '350px'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.symbol}-${suggestion.symbol_type}`}
              className={cn(
                "px-4 py-3 cursor-pointer transition-colors",
                "hover:bg-gray-700/80 border-b border-gray-700/50 last:border-b-0",
                index === highlightedIndex && "bg-gray-700"
              )}
              onClick={() => selectSuggestion(suggestion)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{suggestion.symbol}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border",
                      getSymbolTypeColor(suggestion.symbol_type)
                    )}>
                      {getSymbolTypeLabel(suggestion.symbol_type)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 truncate">
                    {suggestion.name}
                  </div>
                  {suggestion.short_name && suggestion.short_name !== suggestion.name && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {suggestion.short_name}
                    </div>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <div className="text-sm font-medium text-white">
                    {suggestion.currency}
                  </div>
                  {suggestion.market && (
                    <div className="text-xs text-gray-400">
                      {suggestion.market}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isLoading && value.trim().length >= 2 && (
        <div 
          className="absolute z-[9999] w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl p-4"
          style={{
            minWidth: '350px'
          }}
        >
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="ml-2 text-sm text-gray-300">Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
});

SymbolAutocomplete.displayName = "SymbolAutocomplete"; 