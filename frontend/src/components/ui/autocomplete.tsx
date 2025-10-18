import React, { useState, useEffect, useRef } from 'react';
import { useSymbolAutocomplete, SymbolSuggestion } from '../../hooks/useSymbolAutocomplete';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Plus } from 'lucide-react';

interface AutocompleteProps {
  value: string;
  onSelect: (suggestion: SymbolSuggestion) => void;
  onClose: () => void;
  onAddCustom?: (searchTerm: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SymbolAutocomplete = React.forwardRef<HTMLInputElement, AutocompleteProps>(({
  placeholder = "e.g., AAPL",
  value,
  onSelect,
  onClose,
  onAddCustom,
  onKeyDown,
  className
}, ref) => {
  const [open, setOpen] = useState(true); // Default to open when rendered
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  
  const { suggestions, isLoading, fetchSuggestions, clearSuggestions } = useSymbolAutocomplete();
  
  // Sync inputValue with external value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (inputValue.trim()) {
      const timer = setTimeout(() => {
        fetchSuggestions(inputValue.trim());
      }, 150);
      return () => clearTimeout(timer);
    } else {
      clearSuggestions();
    }
  }, [inputValue, fetchSuggestions, clearSuggestions]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (!open) setOpen(true);
  };

  const selectSuggestion = (suggestion: SymbolSuggestion) => {
    onSelect(suggestion);
    setOpen(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (onKeyDown) onKeyDown(e);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      onClose();
    } else if (e.key === 'Tab') {
      setOpen(false);
      onClose();
    }
    
    if (onKeyDown) onKeyDown(e);
  };

  const getSymbolTypeColor = (type: string) => {
    switch (type) {
      case 'nyse':
      case 'nasdaq':
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
      case 'nyse': return 'NYSE';
      case 'nasdaq': return 'NASDAQ';
      case 'tase': return 'TASE';
      case 'currency': return 'Currency';
      case 'crypto': return 'Crypto';
      default: return type.toUpperCase();
    }
  };

  const getDisplaySymbol = (suggestion: SymbolSuggestion) => {
    if (suggestion.symbol_type === 'tase' && (suggestion as any).display_symbol) {
      return (suggestion as any).display_symbol;
    }
    
    let symbol = suggestion.symbol;
    
    if (symbol.toUpperCase().startsWith('NYSE:')) {
      return symbol.substring(5);
    }
    if (symbol.toUpperCase().startsWith('NASDAQ:')) {
      return symbol.substring(7);
    }
    if (symbol.toUpperCase().startsWith('TASE:')) {
      return symbol.substring(5);
    }
    if (symbol.toUpperCase().startsWith('FX:')) {
      return symbol.substring(3);
    }
    
    if (suggestion.symbol_type === 'crypto' && symbol.endsWith('-USD')) {
      return symbol.replace('-USD', '');
    }
    
    return symbol;
  };

  return (
    <Popover open={open && inputValue.trim().length > 0} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        onClose();
      }
    }}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <input
            ref={ref}
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              onClose();
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex h-auto w-full rounded-md border border-input bg-transparent px-3 py-3 text-sm shadow-sm transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[400px] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {isLoading && inputValue.trim().length >= 1 && suggestions.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm">Searching...</span>
            </div>
          ) : !isLoading && suggestions.length === 0 && inputValue.trim() ? (
            <div className="p-2">
              {onAddCustom ? (
                <div
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-4 py-3 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAddCustom(inputValue.trim());
                    setOpen(false);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20">
                      <Plus className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-blue-300">Add Custom Holding</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        "{inputValue.trim()}" not found - add as custom holding
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No symbols found.
                </div>
              )}
            </div>
          ) : (
            <div className="p-1">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${index}-${suggestion.symbol}-${suggestion.symbol_type}-${suggestion.currency}`}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-4 py-3 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "border-b border-border/50 last:border-b-0",
                    highlightedIndex === index && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => {
                    // Use onMouseDown to prevent blur from closing before selection
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
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
                      <div className="text-xs text-muted-foreground truncate">
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});

SymbolAutocomplete.displayName = "SymbolAutocomplete";
