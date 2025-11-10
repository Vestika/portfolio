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

/**
 * Fetch autocomplete lists for cities and neighborhoods
 */
export const fetchRealEstateAutocomplete = async (): Promise<RealEstateAutocompleteResponse> => {
  const response = await api.get('/api/real-estate/autocomplete');
  return response.data;
};

/**
 * Fetch price estimate for a property
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

const RealEstateAPI = {
  fetchRealEstateAutocomplete,
  fetchRealEstateEstimate,
};

export default RealEstateAPI;
