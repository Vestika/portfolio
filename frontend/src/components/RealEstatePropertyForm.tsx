import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RealEstateLocationAutocomplete } from './RealEstateLocationAutocomplete';
import { X, Loader2, AlertCircle } from 'lucide-react';
import RealEstateAPI, { RealEstateAutocompleteResponse } from '../utils/real-estate-api';

export interface RealEstateProperty {
  symbol: string; // User-provided name
  units: number; // Always 1 for real estate
  is_custom: boolean;
  custom_price: number;
  custom_currency: string;
  custom_name: string;
  property_metadata: {
    location: string;
    rooms: number;
    sqm: number;
    pricing_method: 'estimated' | 'custom';
    estimated_price?: number;
    estimation_params?: {
      query: string;
      type: 'sell' | 'rent';
      rooms: number;
    };
  };
}

interface RealEstatePropertyFormProps {
  properties: RealEstateProperty[];
  onChange: (properties: RealEstateProperty[]) => void;
}

interface PropertyFormState {
  property_name: string;
  location: string;
  rooms: string;
  sqm: string;
  pricing_method: 'estimated' | 'custom';
  custom_price_per_sqm: string;
  custom_currency: string;
  estimated_price?: number;
  available_room_prices?: Record<string, number>;
  is_estimating: boolean;
  estimation_error?: string;
}

const EMPTY_PROPERTY: PropertyFormState = {
  property_name: '',
  location: '',
  rooms: '',
  sqm: '',
  pricing_method: 'estimated',
  custom_price_per_sqm: '',
  custom_currency: 'ILS',
  is_estimating: false,
};

const RealEstatePropertyForm: React.FC<RealEstatePropertyFormProps> = ({ properties, onChange }) => {
  const [formStates, setFormStates] = useState<PropertyFormState[]>([EMPTY_PROPERTY]);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  const [autocompleteData, setAutocompleteData] = useState<RealEstateAutocompleteResponse | null>(null);
  const locationRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Load autocomplete data on mount
  useEffect(() => {
    const loadAutocomplete = async () => {
      try {
        const data = await RealEstateAPI.fetchRealEstateAutocomplete();
        setAutocompleteData(data);
      } catch (error) {
        console.error('Failed to load location autocomplete:', error);
      }
    };
    loadAutocomplete();
  }, []);

  // Auto-fetch estimation when all required fields are filled (debounced)
  useEffect(() => {
    const timeoutIds: number[] = [];

    formStates.forEach((state, index) => {
      if (
        state.pricing_method === 'estimated' &&
        state.location &&
        state.rooms &&
        state.sqm &&
        !state.is_estimating &&
        !state.estimated_price &&
        !state.estimation_error // Don't retry if already failed
      ) {
        // Debounce the estimation to prevent immediate trigger while typing
        const timeoutId = setTimeout(() => {
          fetchEstimate(index);
        }, 500); // 500ms delay
        timeoutIds.push(timeoutId);
      }
    });

    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [formStates]);

  const fetchEstimate = async (index: number) => {
    const state = formStates[index];
    const rooms = parseInt(state.rooms);
    const sqm = parseInt(state.sqm);

    if (!state.location || isNaN(rooms) || isNaN(sqm)) return;

    // Set estimating state
    updateFormState(index, { is_estimating: true, estimation_error: undefined });

    try {
      const response = await RealEstateAPI.fetchRealEstateEstimate(
        state.location,
        rooms,
        'sell', // Always use 'sell' since rental is not supported
        sqm
      );

      // Get price for the selected number of rooms
      const estimatedPrice = response.prices[rooms.toString()];

      updateFormState(index, {
        is_estimating: false,
        estimated_price: estimatedPrice,
        available_room_prices: response.prices,
        estimation_error: estimatedPrice ? undefined : 'No estimate available for this configuration',
      });
    } catch (error) {
      console.error('Estimation failed:', error);
      const errorMessage = error instanceof Error
        ? error.message.includes('CORS') || error.message.includes('Network')
          ? 'Unable to connect to estimation service. Please try custom pricing or check your connection.'
          : `Estimation failed: ${error.message}`
        : 'Failed to fetch estimate. Please try custom pricing.';

      updateFormState(index, {
        is_estimating: false,
        estimation_error: errorMessage,
      });
    }
  };

  const updateFormState = (index: number, updates: Partial<PropertyFormState>) => {
    const newStates = [...formStates];
    newStates[index] = { ...newStates[index], ...updates };
    setFormStates(newStates);

    // Convert to RealEstateProperty array and notify parent
    convertToProperties(newStates);
  };

  const convertToProperties = (states: PropertyFormState[]) => {
    const validProperties: RealEstateProperty[] = states
      .filter(state => {
        // Must have name, location, rooms, sqm
        if (!state.property_name || !state.location || !state.rooms || !state.sqm) return false;

        // Must have price (either estimated or custom)
        if (state.pricing_method === 'estimated') {
          return !!state.estimated_price;
        } else {
          return !!state.custom_price_per_sqm;
        }
      })
      .map(state => {
        const rooms = parseInt(state.rooms);
        const sqm = parseInt(state.sqm);

        let totalPrice: number;
        let currency: string;

        if (state.pricing_method === 'estimated' && state.estimated_price) {
          totalPrice = state.estimated_price;
          currency = 'ILS'; // API returns ILS
        } else {
          const pricePerSqm = parseFloat(state.custom_price_per_sqm);
          totalPrice = pricePerSqm * sqm;
          currency = state.custom_currency;
        }

        return {
          symbol: state.property_name,
          units: 1,
          is_custom: true,
          custom_price: totalPrice,
          custom_currency: currency,
          custom_name: state.property_name,
          property_metadata: {
            location: state.location,
            rooms,
            sqm,
            pricing_method: state.pricing_method,
            ...(state.pricing_method === 'estimated' && state.estimated_price ? {
              estimated_price: state.estimated_price,
              estimation_params: {
                query: state.location,
                type: 'sell' as const,
                rooms,
              },
            } : {}),
          },
        };
      });

    onChange(validProperties);
  };

  const addProperty = () => {
    setFormStates([...formStates, { ...EMPTY_PROPERTY }]);
  };

  const removeProperty = (index: number) => {
    if (formStates.length > 1) {
      const newStates = formStates.filter((_, i) => i !== index);
      setFormStates(newStates);
      convertToProperties(newStates);
    }
  };

  const renderPropertyRow = (state: PropertyFormState, index: number) => {
    const rooms = parseInt(state.rooms);
    const sqm = parseInt(state.sqm);
    const isComplete = state.property_name && state.location && !isNaN(rooms) && !isNaN(sqm);

    let calculatedValue = 0;
    if (state.pricing_method === 'estimated' && state.estimated_price) {
      calculatedValue = state.estimated_price;
    } else if (state.pricing_method === 'custom' && state.custom_price_per_sqm && !isNaN(sqm)) {
      calculatedValue = parseFloat(state.custom_price_per_sqm) * sqm;
    }

    return (
      <div key={index} className="border rounded-lg p-4 bg-muted/20 space-y-4">
        {/* Row Header */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Property {index + 1}
            {isComplete && (
              <span className="ml-2 text-xs text-green-400">
                ✓ Complete
              </span>
            )}
          </Label>
          {formStates.length > 1 && (
            <Button
              type="button"
              onClick={() => removeProperty(index)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Property Name */}
        <div className="grid gap-2">
          <Label htmlFor={`property-name-${index}`}>Property Name *</Label>
          <Input
            id={`property-name-${index}`}
            value={state.property_name}
            onChange={(e) => updateFormState(index, { property_name: e.target.value })}
            placeholder="e.g., My Tel Aviv Apartment"
          />
        </div>

        {/* Location */}
        <div className="grid gap-2">
          <Label htmlFor={`location-${index}`}>Location *</Label>
          {editingLocationIndex === index ? (
            <RealEstateLocationAutocomplete
              value={state.location}
              onSelect={(location) => {
                updateFormState(index, { location, estimated_price: undefined });
                setEditingLocationIndex(null);
              }}
              onClose={() => setEditingLocationIndex(null)}
              placeholder="Search city or neighborhood..."
              autocompleteData={autocompleteData || undefined}
              ref={(el) => {
                locationRefs.current[index] = el;
                if (el) setTimeout(() => el.focus(), 10);
              }}
            />
          ) : (
            <div
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm cursor-pointer hover:bg-muted/30"
              onClick={() => setEditingLocationIndex(index)}
            >
              {state.location || <span className="text-muted-foreground">Click to select location...</span>}
            </div>
          )}
        </div>

        {/* Rooms and Square Meters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`rooms-${index}`}>Rooms *</Label>
            <Input
              id={`rooms-${index}`}
              type="number"
              min="1"
              value={state.rooms}
              onChange={(e) => updateFormState(index, { rooms: e.target.value, estimated_price: undefined, estimation_error: undefined })}
              placeholder="e.g., 3"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`sqm-${index}`}>Square Meters *</Label>
            <Input
              id={`sqm-${index}`}
              type="number"
              min="1"
              value={state.sqm}
              onChange={(e) => updateFormState(index, { sqm: e.target.value, estimated_price: undefined, estimation_error: undefined })}
              placeholder="e.g., 95"
            />
          </div>
        </div>

        {/* Pricing Method Selection */}
        <div className="grid gap-3 border-t pt-4">
          <Label>Pricing Method *</Label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`pricing-${index}`}
                checked={state.pricing_method === 'estimated'}
                onChange={() => updateFormState(index, { pricing_method: 'estimated', estimated_price: undefined })}
                className="rounded-full"
              />
              <span className="text-sm">Use Price Estimation</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`pricing-${index}`}
                checked={state.pricing_method === 'custom'}
                onChange={() => updateFormState(index, { pricing_method: 'custom' })}
                className="rounded-full"
              />
              <span className="text-sm">Enter Custom Price</span>
            </label>
          </div>
        </div>

        {/* Pricing Method: Estimation */}
        {state.pricing_method === 'estimated' && (
          <div className="grid gap-3 bg-blue-500/5 border border-blue-400/20 rounded-md p-3">
            <div className="text-sm text-muted-foreground mb-2">
              Property value will be estimated using market data for sale prices.
            </div>

            {state.is_estimating && (
              <div className="flex items-center gap-2 text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Fetching estimate...</span>
              </div>
            )}

            {state.estimation_error && (
              <div className="grid gap-3 bg-red-500/10 border border-red-400/30 rounded-md p-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{state.estimation_error}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Clear error and retry
                      updateFormState(index, { estimation_error: undefined, estimated_price: undefined });
                    }}
                    className="h-8 text-xs"
                  >
                    Retry Estimation
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Switch to custom pricing
                      updateFormState(index, { pricing_method: 'custom', estimation_error: undefined });
                    }}
                    className="h-8 text-xs"
                  >
                    Use Custom Price Instead
                  </Button>
                </div>
              </div>
            )}

            {state.estimated_price && (
              <div className="grid gap-2">
                <Label className="text-green-400">Estimated Price</Label>
                <div className="text-2xl font-bold text-green-300">
                  {state.estimated_price.toLocaleString()} ILS
                </div>
                {state.available_room_prices && Object.keys(state.available_room_prices).length > 1 && (
                  <div className="text-xs text-gray-400">
                    Other options: {Object.entries(state.available_room_prices)
                      .filter(([r]) => r !== state.rooms)
                      .map(([r, p]) => `${r} rooms: ${p.toLocaleString()} ILS`)
                      .join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pricing Method: Custom */}
        {state.pricing_method === 'custom' && (
          <div className="grid gap-3 bg-purple-500/5 border border-purple-400/20 rounded-md p-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`price-per-sqm-${index}`}>Price per Sqm *</Label>
                <Input
                  id={`price-per-sqm-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={state.custom_price_per_sqm}
                  onChange={(e) => updateFormState(index, { custom_price_per_sqm: e.target.value })}
                  placeholder="e.g., 33000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`currency-${index}`}>Currency *</Label>
                <Select
                  value={state.custom_currency}
                  onValueChange={(value) => updateFormState(index, { custom_currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ILS">ILS (₪)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {calculatedValue > 0 && (
              <div className="grid gap-2">
                <Label className="text-purple-400">Total Value</Label>
                <div className="text-2xl font-bold text-purple-300">
                  {calculatedValue.toLocaleString()} {state.custom_currency}
                </div>
                <div className="text-xs text-gray-400">
                  {state.custom_price_per_sqm} {state.custom_currency}/sqm × {sqm} sqm
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Properties</Label>
        <Button
          type="button"
          onClick={addProperty}
          variant="outline"
          size="sm"
          className="h-8"
        >
          <X className="h-3 w-3 mr-1 rotate-45" />
          Add Property
        </Button>
      </div>

      <div className="space-y-4">
        {formStates.map((state, index) => renderPropertyRow(state, index))}
      </div>

      {properties.length === 0 && formStates.every(s => !s.property_name) && (
        <div className="text-sm text-gray-400 text-center py-4">
          Add your first property by filling out the form above
        </div>
      )}
    </div>
  );
};

export default RealEstatePropertyForm;
