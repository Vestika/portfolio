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
    onChange(suggestion.symbol);
    setIsOpen(false);
    setHighlightedIndex(-1);
    // Small delay to ensure the value is set before focus moves
    setTimeout(() => {
      // Focus will naturally move to next cell via parent's key handling
    }, 0);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (value.trim() && value.trim().length >= 2) {
      fetchSuggestions(value.trim());
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Use setTimeout to allow click events on suggestions to fire first
    setTimeout(() => {
      // Only close if focus didn't move to the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(document.activeElement)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }, 150);
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

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={ref || inputRef}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className={className}
        autoComplete="off"
      />
      
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-[9999] w-full mt-1 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none animate-in",
            "min-w-[350px] max-h-60 overflow-y-auto"
          )}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.symbol}-${suggestion.symbol_type}`}
              className={cn(
                "relative flex cursor-pointer select-none items-center px-4 py-3 text-sm outline-none",
                "hover:bg-accent hover:text-accent-foreground",
                "border-b border-border/50 last:border-b-0",
                index === highlightedIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => selectSuggestion(suggestion)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{suggestion.symbol}</span>
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
                  {suggestion.market && (
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
      
      {isLoading && value.trim().length >= 2 && (
        <div 
          className={cn(
            "absolute z-[9999] w-full mt-1 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
            "min-w-[350px]"
          )}
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