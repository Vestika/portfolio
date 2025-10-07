import { useCallback } from 'react';
import api from '../utils/api';
import { RealEstateAutocompleteResponse, RealEstateEstimateResponse, RealEstateType, LeverageMetrics } from '../types/realEstate';

export const useRealEstate = () => {
  const getAutocomplete = useCallback(async (): Promise<RealEstateAutocompleteResponse> => {
    const { data } = await api.get('/api/real-estate/autocomplete');
    return data as RealEstateAutocompleteResponse;
  }, []);

  const estimatePrice = useCallback(async (params: { q: string; rooms?: number; type?: RealEstateType; sqm?: number }): Promise<RealEstateEstimateResponse> => {
    const { q, rooms, type = 'sell', sqm } = params;
    const { data } = await api.get('/api/real-estate/estimate', {
      params: { q, rooms, type, sqm }
    });
    return data as RealEstateEstimateResponse;
  }, []);

  const computeLeverage = useCallback((args: { propertyValue: number; debtOutstanding: number; amountAlreadyPaid?: number }): LeverageMetrics => {
    const { propertyValue, debtOutstanding } = args;
    const equity = Math.max(propertyValue - debtOutstanding, 0);
    const ltv = propertyValue > 0 ? Math.min(Math.max(debtOutstanding / propertyValue, 0), 1) : 0;
    const leverageMultiple = equity > 0 ? propertyValue / equity : Infinity;
    return { equity, ltv, leverageMultiple };
  }, []);

  return {
    getAutocomplete,
    estimatePrice,
    computeLeverage,
  };
};


