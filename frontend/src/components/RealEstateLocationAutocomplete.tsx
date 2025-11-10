import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Plus } from 'lucide-react';

interface LocationSuggestion {
  value: string;
  type: 'city' | 'neighborhood';
}

interface RealEstateLocationAutocompleteProps {
  value: string;
  onSelect: (location: string) => void;
  onClose: () => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autocompleteData?: { cities: string[]; cities_and_neighborhoods: string[] };
}

export const RealEstateLocationAutocomplete = React.forwardRef<HTMLInputElement, RealEstateLocationAutocompleteProps>((
  {
    placeholder = "Search location...",
    value,
    onSelect,
    onClose,
    onKeyDown,
    className,
    autocompleteData,
  },
  ref
) => {
  const [open, setOpen] = useState(true);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync inputValue with external value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Generate suggestions based on input
  useEffect(() => {
    if (!inputValue.trim() || !autocompleteData) {
      setSuggestions([]);
      return;
    }

    const searchTerm = inputValue.toLowerCase();
    const matches: LocationSuggestion[] = [];

    // Search in cities
    autocompleteData.cities.forEach(city => {
      if (city.toLowerCase().includes(searchTerm)) {
        matches.push({ value: city, type: 'city' });
      }
    });

    // Search in neighborhoods (higher priority for exact matches)
    autocompleteData.cities_and_neighborhoods.forEach(location => {
      if (location.toLowerCase().includes(searchTerm)) {
        matches.push({ value: location, type: 'neighborhood' });
      }
    });

    // Sort: neighborhoods first, then by relevance
    matches.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'neighborhood' ? -1 : 1;
      }
      // Prioritize matches at the start of the string
      const aIndex = a.value.toLowerCase().indexOf(searchTerm);
      const bIndex = b.value.toLowerCase().indexOf(searchTerm);
      return aIndex - bIndex;
    });

    // Limit to top 8 results
    setSuggestions(matches.slice(0, 8));
  }, [inputValue, autocompleteData]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (!open) setOpen(true);
  };

  const selectSuggestion = (location: string) => {
    onSelect(location);
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
      selectSuggestion(suggestions[highlightedIndex].value);
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

  const handleCustomLocation = () => {
    // User wants to use their custom input as the location
    if (inputValue.trim()) {
      onSelect(inputValue.trim());
      setOpen(false);
      onClose();
    }
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
          {suggestions.length === 0 && inputValue.trim() ? (
            <div className="p-2">
              <div
                className="relative flex cursor-pointer select-none items-center rounded-sm px-4 py-3 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCustomLocation();
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20">
                    <Plus className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-blue-300">Use Custom Location</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      "{inputValue.trim()}" not found - use as custom location
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-1">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${index}-${suggestion.value}`}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-4 py-3 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "border-b border-border/50 last:border-b-0",
                    highlightedIndex === index && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion.value);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{suggestion.value}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full border",
                          suggestion.type === 'neighborhood'
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800"
                            : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                        )}>
                          {suggestion.type === 'neighborhood' ? 'Neighborhood' : 'City'}
                        </span>
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

RealEstateLocationAutocomplete.displayName = "RealEstateLocationAutocomplete";
