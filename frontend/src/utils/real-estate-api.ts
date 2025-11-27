import api from './api';

export interface RealEstateAutocompleteResponse {
  cities: string[];
  cities_and_neighborhoods: string[];
}

export interface RealEstateEstimateResponse {
  query: string;
  type: 'sell' | 'rent';
  rooms: number | null;
  prices: Record<string, number>;
  sqm: number | null;
}

// New search types
export type LocationType = 'city' | 'neighborhood' | 'street';

export interface LocationSearchResult {
  type: LocationType;
  name: string;
  display_name: string;
  city: string;
  neighborhood?: string;
  street?: string;
  median_price?: number;
  total_deals?: number;
  date_range?: string;
}

export interface LocationSearchResponse {
  results: LocationSearchResult[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  summary?: {
    total_results: number;
    cities_count: number;
    neighborhoods_count: number;
    streets_count: number;
  };
}

export interface EstimateV2Response {
  location_type: LocationType;
  city: string;
  street?: string;
  neighborhood?: string;
  prices: Record<string, number>;
  median_price?: number;
  avg_price_per_sqm?: number;
  estimated_total?: number;
  total_deals?: number;
  typical_sqm_used?: number;
}

/**
 * Fetch autocomplete lists for cities and neighborhoods (legacy)
 */
export const fetchRealEstateAutocomplete = async (): Promise<RealEstateAutocompleteResponse> => {
  const response = await api.get('/api/real-estate/autocomplete');
  return response.data;
};

/**
 * Search for locations with real-time market data
 * Supports cities, neighborhoods, and streets
 */
export const searchRealEstateLocations = async (
  query: string,
  options: {
    page?: number;
    perPage?: number;
    minDeals?: number;
    locationType?: 'all' | LocationType;
  } = {}
): Promise<LocationSearchResponse> => {
  const params: Record<string, string | number> = {
    q: query,
  };

  if (options.page !== undefined) {
    params.page = options.page;
  }
  if (options.perPage !== undefined) {
    params.per_page = options.perPage;
  }
  if (options.minDeals !== undefined) {
    params.min_deals = options.minDeals;
  }
  if (options.locationType !== undefined) {
    params.location_type = options.locationType;
  }

  const response = await api.get('/api/real-estate/search', { params });
  return response.data;
};

/**
 * Fetch price estimate for a property (legacy)
 * @param query - City or neighborhood name
 * @param rooms - Number of rooms (optional)
 * @param type - Property type: 'sell' or 'rent'
 * @param sqm - Square meters (optional)
 */
export const fetchRealEstateEstimate = async (
  query: string,
  rooms?: number,
  type: 'sell' | 'rent' = 'sell',
  sqm?: number
): Promise<RealEstateEstimateResponse> => {
  const params: Record<string, string | number> = {
    q: query,
    type,
  };

  if (rooms !== undefined) {
    params.rooms = rooms;
  }

  if (sqm !== undefined) {
    params.sqm = sqm;
  }

  const response = await api.get('/api/real-estate/estimate', { params });
  return response.data;
};

/**
 * Fetch price estimate using the enhanced v2 endpoint
 * Works with search results for more granular pricing (including streets)
 */
export const fetchRealEstateEstimateV2 = async (
  locationType: LocationType,
  city: string,
  options: {
    street?: string;
    neighborhood?: string;
    rooms?: number;
    sqm?: number;
  } = {}
): Promise<EstimateV2Response> => {
  const params: Record<string, string | number> = {
    location_type: locationType,
    city,
  };

  if (options.street !== undefined) {
    params.street = options.street;
  }
  if (options.neighborhood !== undefined) {
    params.neighborhood = options.neighborhood;
  }
  if (options.rooms !== undefined) {
    params.rooms = options.rooms;
  }
  if (options.sqm !== undefined) {
    params.sqm = options.sqm;
  }

  const response = await api.get('/api/real-estate/estimate-v2', { params });
  return response.data;
};

const RealEstateAPI = {
  fetchRealEstateAutocomplete,
  searchRealEstateLocations,
  fetchRealEstateEstimate,
  fetchRealEstateEstimateV2,
};

export default RealEstateAPI;
