import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RealEstateLocationAutocomplete, SelectedLocation } from './RealEstateLocationAutocomplete';
import { X, Loader2, AlertCircle, Building2, MapPin, Home } from 'lucide-react';
import RealEstateAPI, { LocationType } from '../utils/real-estate-api';

export interface RealEstateProperty {
  symbol: string; // User-provided name
  units: number; // Always 1 for real estate
  is_custom: boolean;
  custom_price: number;
  custom_currency: string;
  custom_name: string;
  property_metadata: {
    location: string;
    location_type?: LocationType;
    city?: string;
    neighborhood?: string;
    street?: string;
    rooms: number;
    sqm: number;
    pricing_method: 'estimated' | 'custom';
    estimated_price?: number;
    avg_price_per_sqm?: number;
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
  location_type: LocationType;
  city: string;
  neighborhood?: string;
  street?: string;
  rooms: string;
  sqm: string;
  pricing_method: 'estimated' | 'custom';
  custom_price_per_sqm: string;
  custom_currency: string;
  estimated_price?: number;
  avg_price_per_sqm?: number;
  typical_sqm_used?: number;
  available_room_prices?: Record<string, number>;
  is_estimating: boolean;
  estimation_error?: string;
}

// Typical sqm per room count for Israeli apartments
const TYPICAL_SQM_BY_ROOMS: Record<string, number> = {
  '2': 60,
  '3': 80,
  '4': 105,
  '5': 135,
  '6': 160,
};

const EMPTY_PROPERTY: PropertyFormState = {
  property_name: '',
  location: '',
  location_type: 'city',
  city: '',
  rooms: '',
  sqm: '',
  pricing_method: 'estimated',
  custom_price_per_sqm: '',
  custom_currency: 'ILS',
  is_estimating: false,
};

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

const RealEstatePropertyForm: React.FC<RealEstatePropertyFormProps> = ({ properties, onChange }) => {
  const [formStates, setFormStates] = useState<PropertyFormState[]>([EMPTY_PROPERTY]);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const locationRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Initialize form states from properties prop (for editing existing properties)
  useEffect(() => {
    if (initialized) return;

    if (properties && properties.length > 0) {
      const initialStates: PropertyFormState[] = properties.map(property => {
        const metadata = property.property_metadata;
        return {
          property_name: property.custom_name || property.symbol || '',
          location: metadata?.location || '',
          location_type: (metadata?.location_type as LocationType) || 'city',
          city: metadata?.city || metadata?.location || '',
          neighborhood: metadata?.neighborhood,
          street: metadata?.street,
          rooms: metadata?.rooms?.toString() || '',
          sqm: metadata?.sqm?.toString() || '',
          pricing_method: metadata?.pricing_method || 'estimated',
          custom_price_per_sqm: metadata?.pricing_method === 'custom' && metadata?.sqm
            ? (property.custom_price / metadata.sqm).toString()
            : '',
          custom_currency: property.custom_currency || 'ILS',
          estimated_price: metadata?.pricing_method === 'estimated' ? property.custom_price : undefined,
          avg_price_per_sqm: metadata?.avg_price_per_sqm,
          is_estimating: false,
        };
      });
      setFormStates(initialStates);
      setInitialized(true);
    } else {
      setInitialized(true);
    }
  }, [properties, initialized]);

  // Auto-fetch estimation when all required fields are filled (debounced)
  // Skip if we already have room prices or estimated price (from initial load)
  useEffect(() => {
    if (!initialized) return;

    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    formStates.forEach((state, index) => {
      const hasExistingPrice = state.estimated_price || (state.available_room_prices && Object.keys(state.available_room_prices).length > 0);

      if (
        state.pricing_method === 'estimated' &&
        state.location &&
        state.city &&
        state.rooms &&
        state.sqm &&
        !state.is_estimating &&
        !hasExistingPrice &&
        !state.estimation_error
      ) {
        const timeoutId = setTimeout(() => {
          fetchEstimate(index);
        }, 500);
        timeoutIds.push(timeoutId);
      }
    });

    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [formStates, initialized]);

  const fetchEstimate = async (index: number) => {
    const state = formStates[index];
    const rooms = parseInt(state.rooms);
    const sqm = parseInt(state.sqm);

    if (!state.city || isNaN(rooms) || isNaN(sqm)) return;

    updateFormState(index, { is_estimating: true, estimation_error: undefined });

    try {
      const response = await RealEstateAPI.fetchRealEstateEstimateV2(
        state.location_type,
        state.city,
        {
          street: state.street,
          neighborhood: state.neighborhood,
          rooms,
          sqm,
        }
      );

      // Get price - prefer estimated_total (sqm-adjusted) over raw room price
      let estimatedPrice: number | undefined;
      let avgPricePerSqm: number | undefined;
      let typicalSqmUsed: number | undefined;

      if (response.estimated_total) {
        // Use sqm-adjusted price (available for both streets and city/neighborhood)
        estimatedPrice = response.estimated_total;
        avgPricePerSqm = response.avg_price_per_sqm;
        typicalSqmUsed = response.typical_sqm_used;
      } else if (response.prices[rooms.toString()]) {
        // Exact room match - use it
        estimatedPrice = response.prices[rooms.toString()];
      } else if (Object.keys(response.prices).length > 0) {
        // No exact room match but we have other room prices - fallback to 4 rooms or first available
        const fallbackOrder = ['4', '3', '5', '2', '6'];
        let fallbackRoom: string | undefined;
        for (const room of fallbackOrder) {
          if (response.prices[room]) {
            fallbackRoom = room;
            break;
          }
        }
        if (!fallbackRoom) {
          fallbackRoom = Object.keys(response.prices)[0];
        }
        if (fallbackRoom) {
          const fallbackPrice = response.prices[fallbackRoom];
          const fallbackTypicalSqm = TYPICAL_SQM_BY_ROOMS[fallbackRoom] || 105;
          avgPricePerSqm = Math.round(fallbackPrice / fallbackTypicalSqm);
          estimatedPrice = avgPricePerSqm * sqm;
          typicalSqmUsed = fallbackTypicalSqm;
        }
      } else if (response.median_price) {
        // Last resort: use median price
        estimatedPrice = response.median_price;
      }

      updateFormState(index, {
        is_estimating: false,
        estimated_price: estimatedPrice,
        avg_price_per_sqm: avgPricePerSqm,
        typical_sqm_used: typicalSqmUsed,
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

    convertToProperties(newStates);
  };

  const convertToProperties = (states: PropertyFormState[]) => {
    const validProperties: RealEstateProperty[] = states
      .filter(state => {
        if (!state.property_name || !state.location || !state.rooms || !state.sqm) return false;

        if (state.pricing_method === 'estimated') {
          // Valid if we have room prices (to calculate price per sqm) or estimated_price
          return !!(state.available_room_prices && state.available_room_prices[state.rooms]) || !!state.estimated_price;
        } else {
          return !!state.custom_price_per_sqm;
        }
      })
      .map(state => {
        const rooms = parseInt(state.rooms);
        const sqm = parseInt(state.sqm);

        let totalPrice: number;
        let currency: string;
        let avgPricePerSqm: number | undefined;

        if (state.pricing_method === 'estimated') {
          // Calculate price per sqm from room price if not provided by API
          avgPricePerSqm = state.avg_price_per_sqm;
          if (!avgPricePerSqm && state.available_room_prices && state.rooms) {
            const roomPrice = state.available_room_prices[state.rooms];
            const typicalSqm = TYPICAL_SQM_BY_ROOMS[state.rooms];
            if (roomPrice && typicalSqm) {
              avgPricePerSqm = Math.round(roomPrice / typicalSqm);
            }
          }

          // Calculate total price based on actual sqm
          if (avgPricePerSqm) {
            totalPrice = avgPricePerSqm * sqm;
          } else {
            totalPrice = state.estimated_price || 0;
          }
          currency = 'ILS';
        } else {
          const pricePerSqm = parseFloat(state.custom_price_per_sqm);
          totalPrice = pricePerSqm * sqm;
          avgPricePerSqm = pricePerSqm;
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
            location_type: state.location_type,
            city: state.city,
            neighborhood: state.neighborhood,
            street: state.street,
            rooms,
            sqm,
            pricing_method: state.pricing_method,
            ...(state.pricing_method === 'estimated' ? {
              estimated_price: totalPrice,
              avg_price_per_sqm: avgPricePerSqm,
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

  const handleLocationSelect = (index: number, location: string, locationData?: SelectedLocation) => {
    const updates: Partial<PropertyFormState> = {
      location,
      estimated_price: undefined,
      estimation_error: undefined,
      available_room_prices: undefined,
      avg_price_per_sqm: undefined,
    };

    if (locationData) {
      updates.location_type = locationData.type;
      updates.city = locationData.city;
      updates.neighborhood = locationData.neighborhood;
      updates.street = locationData.street;
    } else {
      // Custom location - treat as city
      updates.location_type = 'city';
      updates.city = location;
      updates.neighborhood = undefined;
      updates.street = undefined;
    }

    updateFormState(index, updates);
    setEditingLocationIndex(null);
  };

  const renderPropertyRow = (state: PropertyFormState, index: number) => {
    const rooms = parseInt(state.rooms);
    const sqm = parseInt(state.sqm);
    const isComplete = state.property_name && state.location && !isNaN(rooms) && !isNaN(sqm);

    // Calculate price per sqm - either from API or derive from room price
    let pricePerSqm: number | undefined = state.avg_price_per_sqm;
    let typicalSqm: number | undefined = state.typical_sqm_used;

    // If no price per sqm from API but we have room prices, calculate it
    if (!pricePerSqm && state.available_room_prices && state.rooms) {
      const roomPrice = state.available_room_prices[state.rooms];
      typicalSqm = TYPICAL_SQM_BY_ROOMS[state.rooms];
      if (roomPrice && typicalSqm) {
        pricePerSqm = Math.round(roomPrice / typicalSqm);
      }
    }

    // Calculate estimated value based on price per sqm and actual sqm
    let calculatedValue = 0;
    if (state.pricing_method === 'estimated') {
      if (pricePerSqm && !isNaN(sqm)) {
        calculatedValue = pricePerSqm * sqm;
      } else if (state.estimated_price) {
        calculatedValue = state.estimated_price;
      }
    } else if (state.pricing_method === 'custom' && state.custom_price_per_sqm && !isNaN(sqm)) {
      calculatedValue = parseFloat(state.custom_price_per_sqm) * sqm;
    }

    const locationTypeLabel = {
      city: 'City',
      neighborhood: 'Neighborhood',
      street: 'Street',
    }[state.location_type] || 'Location';

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
              onSelect={(location: string, locationData?: SelectedLocation) => handleLocationSelect(index, location, locationData)}
              onClose={() => setEditingLocationIndex(null)}
              placeholder="Search city, neighborhood, or street..."
              ref={(el) => {
                locationRefs.current[index] = el;
                if (el) setTimeout(() => el.focus(), 10);
              }}
            />
          ) : (
            <div
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm cursor-pointer hover:bg-muted/30 items-center gap-2"
              onClick={() => setEditingLocationIndex(index)}
            >
              {state.location ? (
                <>
                  <LocationTypeIcon type={state.location_type} className="h-4 w-4 text-muted-foreground" />
                  <span>{state.location}</span>
                  <span className="text-xs text-muted-foreground ml-auto">({locationTypeLabel})</span>
                </>
              ) : (
                <span className="text-muted-foreground">Click to select location...</span>
              )}
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
              onChange={(e) => updateFormState(index, { rooms: e.target.value, estimated_price: undefined, avg_price_per_sqm: undefined, typical_sqm_used: undefined, estimation_error: undefined })}
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
              onChange={(e) => updateFormState(index, { sqm: e.target.value })}
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
              {state.location_type === 'street' ? (
                <>Property value estimated using transaction data from <strong>{state.street}</strong> street.</>
              ) : (
                <>Property value estimated using market data for sale prices.</>
              )}
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
                      updateFormState(index, { pricing_method: 'custom', estimation_error: undefined });
                    }}
                    className="h-8 text-xs"
                  >
                    Use Custom Price Instead
                  </Button>
                </div>
              </div>
            )}

            {(calculatedValue > 0 || state.estimated_price) && (
              <div className="grid gap-2">
                <Label className="text-green-400">Estimated Price</Label>
                <div className="text-2xl font-bold text-green-300">
                  {(calculatedValue || state.estimated_price || 0).toLocaleString()} ILS
                </div>

                {/* Show price per sqm calculation */}
                {pricePerSqm && !isNaN(sqm) && (
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div>
                      <span className="text-green-400 font-medium">{pricePerSqm.toLocaleString()} ILS/sqm</span>
                      {' × '}{sqm} sqm = {calculatedValue.toLocaleString()} ILS
                    </div>
                    {typicalSqm && (
                      <div className="text-muted-foreground">
                        (Price/sqm derived from {state.rooms}-room avg price ÷ typical {typicalSqm} sqm)
                      </div>
                    )}
                  </div>
                )}

                {/* Show other room options if available */}
                {state.available_room_prices && Object.keys(state.available_room_prices).length > 1 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Other options: {Object.entries(state.available_room_prices)
                      .filter(([r]) => r !== state.rooms)
                      .slice(0, 3)
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
