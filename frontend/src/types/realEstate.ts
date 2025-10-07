export type RealEstateType = 'sell' | 'rent';

export interface RealEstateAutocompleteResponse {
  cities: string[];
  cities_and_neighborhoods: string[];
}

export interface RealEstateEstimateResponse {
  query: string;
  type: RealEstateType;
  rooms?: number | null;
  prices: Record<string, number | null>;
  sqm?: number | null;
}

export interface LeverageMetrics {
  equity: number;
  ltv: number; // 0..1
  leverageMultiple: number; // propertyValue / equity
}


