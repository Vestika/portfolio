import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Plus, Loader2, Building2, MapPin, Home } from 'lucide-react';
import RealEstateAPI, { LocationSearchResult, LocationType } from '../utils/real-estate-api';

export interface SelectedLocation {
  displayName: string;
  type: LocationType;
  city: string;
  neighborhood?: string;
  street?: string;
  medianPrice?: number;
  totalDeals?: number;
}

interface RealEstateLocationAutocompleteProps {
  value: string;
  onSelect: (location: string, locationData?: SelectedLocation) => void;
  onClose: () => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Legacy prop - still supported for backwards compatibility
  autocompleteData?: { cities: string[]; cities_and_neighborhoods: string[] };
}

const LocationTypeIcon: React.FC<{ type: LocationType; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'city':
      return <Building2 className={className} />;
    case 'neighborhood':
      return <MapPin className={className} />;
    case 'street':
      return <Home className={className} />;
    default:
      return <MapPin className={className} />;
  }
};

const LocationTypeBadge: React.FC<{ type: LocationType }> = ({ type }) => {
  const config = {
    city: {
      label: 'City',
      bg: 'bg-blue-100 dark:bg-blue-900',
      text: 'text-blue-800 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
    neighborhood: {
      label: 'Neighborhood',
      bg: 'bg-green-100 dark:bg-green-900',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
    street: {
      label: 'Street',
      bg: 'bg-purple-100 dark:bg-purple-900',
      text: 'text-purple-800 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
    },
  };

  const c = config[type];
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border', c.bg, c.text, c.border)}>
      {c.label}
    </span>
  );
};

export const RealEstateLocationAutocomplete = React.forwardRef<HTMLInputElement, RealEstateLocationAutocompleteProps>((
  {
    placeholder = "Search location...",
    value,
    onSelect,
    onClose,
    onKeyDown,
    className,
  },
  ref
) => {
  const [open, setOpen] = useState(true);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync inputValue with external value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await RealEstateAPI.searchRealEstateLocations(query.trim(), {
        perPage: 10,
      });
      setSearchResults(response.results || []);
    } catch (error) {
      console.error('Location search failed:', error);
      setSearchError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Trigger search on input change with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (inputValue.trim().length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(inputValue);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue, performSearch]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (!open) setOpen(true);
  };

  const selectResult = (result: LocationSearchResult) => {
    const locationData: SelectedLocation = {
      displayName: result.display_name,
      type: result.type,
      city: result.city,
      neighborhood: result.neighborhood,
      street: result.street,
      medianPrice: result.median_price,
      totalDeals: result.total_deals,
    };
    onSelect(result.display_name, locationData);
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
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectResult(searchResults[highlightedIndex]);
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
    if (inputValue.trim()) {
      // Custom location - just use the text as city name
      const locationData: SelectedLocation = {
        displayName: inputValue.trim(),
        type: 'city',
        city: inputValue.trim(),
      };
      onSelect(inputValue.trim(), locationData);
      setOpen(false);
      onClose();
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M`;
    }
    if (price >= 1000) {
      return `${(price / 1000).toFixed(0)}K`;
    }
    return price.toLocaleString();
  };

  const showPopover = open && inputValue.trim().length >= 2;

  return (
    <Popover open={showPopover} onOpenChange={(isOpen) => {
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
              // Delay close to allow click on results
              setTimeout(() => {
                setOpen(false);
                onClose();
              }, 200);
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
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[450px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div ref={listRef} className="max-h-96 overflow-y-auto">
          {/* Loading state */}
          {isSearching && searchResults.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching locations...</span>
            </div>
          )}

          {/* Error state */}
          {searchError && (
            <div className="p-4 text-center text-sm text-red-400">
              {searchError}
            </div>
          )}

          {/* No results - offer custom location */}
          {!isSearching && !searchError && searchResults.length === 0 && inputValue.trim().length >= 2 && (
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
                      "{inputValue.trim()}" - use as custom location
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="p-1">
              {searchResults.map((result, index) => (
                <div
                  key={`${result.type}-${result.name}-${index}`}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-4 py-3 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "border-b border-border/50 last:border-b-0",
                    highlightedIndex === index && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectResult(result);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-start gap-3 w-full">
                    {/* Icon */}
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full mt-0.5",
                      result.type === 'city' && "bg-blue-500/20",
                      result.type === 'neighborhood' && "bg-green-500/20",
                      result.type === 'street' && "bg-purple-500/20"
                    )}>
                      <LocationTypeIcon
                        type={result.type}
                        className={cn(
                          "w-4 h-4",
                          result.type === 'city' && "text-blue-400",
                          result.type === 'neighborhood' && "text-green-400",
                          result.type === 'street' && "text-purple-400"
                        )}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{result.display_name}</span>
                        <LocationTypeBadge type={result.type} />
                      </div>

                      {/* Market data */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {result.median_price && (
                          <span className="text-green-400">
                            ~{formatPrice(result.median_price)} ILS
                          </span>
                        )}
                        {result.total_deals && (
                          <span>
                            {result.total_deals.toLocaleString()} deals
                          </span>
                        )}
                        {result.date_range && (
                          <span className="text-muted-foreground/70">
                            {result.date_range}
                          </span>
                        )}
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
