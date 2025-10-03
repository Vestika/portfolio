import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { useSymbolAutocomplete, SymbolSuggestion } from '../../hooks/useSymbolAutocomplete';
import { cn } from '../../lib/utils';

interface AutocompleteProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSelection?: (value: string) => void; // Called specifically when a suggestion is selected
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const SymbolAutocomplete = React.forwardRef<HTMLInputElement, AutocompleteProps>(({
  placeholder = "e.g., AAPL",
  value,
  onChange,
  onSelection,
  onKeyDown,
  onBlur,
  className}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const { suggestions, isLoading, fetchSuggestions, clearSuggestions } = useSymbolAutocomplete();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search with improved logic (optimized for local search)
  useEffect(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Only search if we have a query and dropdown is open
    if (value.trim() && isOpen) {
      // Optimized debounce timeout for performance balance
      debounceTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(value.trim());
      }, 150); // Balanced timeout to prevent excessive computation while maintaining good UX
    } else if (!value.trim()) {
      clearSuggestions();
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [value, isOpen, fetchSuggestions, clearSuggestions]);

  // Handle clicks outside to close dropdown (fixed to not interfere with suggestion clicks)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      console.log(`🖱️ [AUTOCOMPLETE] Outside click detected, target:`, target.className);
      
      // Don't close if clicking on a suggestion item
      if (target.closest('.autocomplete-dropdown')) {
        console.log(`🖱️ [AUTOCOMPLETE] Click on suggestion detected, not closing`);
        return;
      }
      
      // Use requestAnimationFrame to defer DOM operations and prevent forced reflow
      requestAnimationFrame(() => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          console.log(`🖱️ [AUTOCOMPLETE] Outside click confirmed, closing dropdown`);
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      });
    };

    if (isOpen) {
      // Use mouseup instead of mousedown to allow click events to fire first
      document.addEventListener('mouseup', handleClickOutside, { passive: true });
    }

    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    console.log(`🌀 [AUTOCOMPLETE] Input blur event fired, value: "${e.target.value}"`);
    
    const trimmedValue = e.target.value.trim();
    if (trimmedValue && trimmedValue !== value) {
      // Normalize to uppercase when user finishes typing
      onChange(trimmedValue.toUpperCase());
    }
    
    // Close dropdown after a delay to allow for clicks on suggestions
    setTimeout(() => {
      console.log(`🌀 [AUTOCOMPLETE] Closing dropdown after blur delay`);
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200); // Increased delay to ensure click events fire first
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
        return; // Don't call parent's onKeyDown for Enter when selecting
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return; // Don't call parent's onKeyDown for Escape
    } else if (e.key === 'Tab') {
      // Close dropdown when tabbing to next field
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
    
    // Call the parent's onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const selectSuggestion = (suggestion: SymbolSuggestion) => {
    console.log(`🎯 [AUTOCOMPLETE] selectSuggestion called:`, { symbol: suggestion.symbol, name: suggestion.name, type: suggestion.symbol_type });
    
    // Clean up the symbol based on type - preserve full format for currencies and crypto
    let finalSymbol = suggestion.symbol;
    
    // For currencies and crypto, keep the full symbol to avoid conflicts
    if (suggestion.symbol_type === 'currency' || suggestion.symbol_type === 'crypto') {
      // Keep FX:USD and BTC-USD as-is to avoid conflicts
      finalSymbol = suggestion.symbol.toUpperCase();
    }
    // For stock symbols, remove exchange prefixes as before
    else {
      // For NYSE symbols, remove "NYSE:" prefix
      if (finalSymbol.toUpperCase().startsWith('NYSE:')) {
        finalSymbol = finalSymbol.substring(5); // Remove "NYSE:" (5 chars)
      }
      
      // For NASDAQ symbols, remove "NASDAQ:" prefix  
      if (finalSymbol.toUpperCase().startsWith('NASDAQ:')) {
        finalSymbol = finalSymbol.substring(7); // Remove "NASDAQ:" (7 chars)
      }
      
      // For TASE symbols, remove "TASE:" prefix first, then extract number part
      if (finalSymbol.toUpperCase().startsWith('TASE:')) {
        finalSymbol = finalSymbol.substring(5); // Remove "TASE:" (5 chars)
      }
      
      // For TASE symbols, extract only the number part
      if (suggestion.symbol_type === 'tase' && finalSymbol.includes('.')) {
        const parts = finalSymbol.split('.');
        finalSymbol = parts[0]; // Take only the number part before the dot
      }
      
      // Always normalize to uppercase for consistency
      finalSymbol = finalSymbol.toUpperCase();
    }
    
    console.log(`🎯 [AUTOCOMPLETE] Setting final symbol: "${finalSymbol}" (type: ${suggestion.symbol_type})`);
    
    onChange(finalSymbol);
    
    // Call onSelection callback if provided (specifically for autocomplete selections)
    if (onSelection) {
      console.log(`🎯 [AUTOCOMPLETE] Calling onSelection with: "${finalSymbol}"`);
      onSelection(finalSymbol);
    }
    
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    // Use requestAnimationFrame to avoid forced reflow on focus
    requestAnimationFrame(() => {
      setIsOpen(true);
      if (value.trim()) {
        fetchSuggestions(value.trim());
      }
    });
  };

  const getSymbolTypeColor = (type: string) => {
    switch (type) {
      case 'nyse':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800';
      case 'tase':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800';
      case 'currency':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-800';
      case 'crypto':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800';
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

  // Clean symbol for display (remove prefixes, use display_symbol for merged TASE)
  const getDisplaySymbol = (suggestion: SymbolSuggestion) => {
    // For TASE symbols, use display_symbol if available (merged format like "006 TEVA")
    if (suggestion.symbol_type === 'tase' && (suggestion as any).display_symbol) {
      return (suggestion as any).display_symbol;
    }
    
    let symbol = suggestion.symbol;
    
    // Remove exchange prefixes
    if (symbol.toUpperCase().startsWith('NYSE:')) {
      return symbol.substring(5); // Remove "NYSE:"
    }
    if (symbol.toUpperCase().startsWith('NASDAQ:')) {
      return symbol.substring(7); // Remove "NASDAQ:"
    }
    if (symbol.toUpperCase().startsWith('TASE:')) {
      return symbol.substring(5); // Remove "TASE:"
    }
    if (symbol.toUpperCase().startsWith('FX:')) {
      return symbol.substring(3); // Remove "FX:" for clean currency display
    }
    
    // For crypto symbols, remove -USD suffix for cleaner display
    if (suggestion.symbol_type === 'crypto' && symbol.endsWith('-USD')) {
      return symbol.replace('-USD', '');
    }
    
    return symbol;
  };

  // Check if we should show market info (avoid repetition with badges)
  const shouldShowMarket = (symbolType: string, market: string) => {
    // Don't show market for NYSE/NASDAQ/TASE since we have badges
    if (symbolType === 'nyse' || symbolType === 'nasdaq' || symbolType === 'tase') {
      return false;
    }
    return market && market.trim() !== '';
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onFocus={handleInputFocus}
        onBlur={(e) => {
          handleInputBlur(e);
          if (onBlur) onBlur(e);
        }}
        className={className}
        autoComplete="off"
      />
      
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-[9999] w-full mt-1 rounded-md border bg-popover p-0 text-popover-foreground shadow-lg outline-none",
            "max-h-80 overflow-y-auto autocomplete-suggestions-dropdown"
          )}
          style={{
            minWidth: '350px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent',
            // Use transform for better performance instead of animate-in classes
            opacity: 1,
            transform: 'scale(1)',
            transition: 'opacity 0.15s ease-out, transform 0.15s ease-out'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${index}-${suggestion.symbol}-${suggestion.symbol_type}-${suggestion.currency}`}
              className={cn(
                "relative flex cursor-pointer select-none items-center px-4 py-3 text-sm outline-none autocomplete-dropdown",
                "hover:bg-accent hover:text-accent-foreground",
                "border-b border-border/50 last:border-b-0",
                index === highlightedIndex && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => {
                // Prevent blur event from firing when clicking suggestion
                e.preventDefault();
                console.log(`🖱️ [AUTOCOMPLETE] Suggestion mousedown:`, suggestion.symbol);
                selectSuggestion(suggestion);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{getDisplaySymbol(suggestion)}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border",
                      getSymbolTypeColor(suggestion.symbol_type)
                    )}>
                      {getSymbolTypeLabel(suggestion.symbol_type)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {suggestion.name}
                  </div>
                  {suggestion.short_name && suggestion.short_name !== suggestion.name && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {suggestion.short_name}
                    </div>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <div className="text-sm font-medium">
                    {suggestion.currency}
                  </div>
                  {shouldShowMarket(suggestion.symbol_type, suggestion.market) && (
                    <div className="text-xs text-muted-foreground">
                      {suggestion.market}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isLoading && value.trim().length >= 1 && !suggestions.length && (
        <div 
          className={cn(
            "absolute z-[9999] w-full mt-1 rounded-md border bg-popover p-4 text-popover-foreground shadow-lg"
          )}
          style={{
            minWidth: '350px',
            // Consistent positioning to prevent layout shifts
            opacity: 1,
            transform: 'scale(1)'
          }}
        >
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm">Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
});

SymbolAutocomplete.displayName = "SymbolAutocomplete"; 