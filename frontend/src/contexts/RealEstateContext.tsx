import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { LeverageMetrics, RealEstateType } from '../types/realEstate';

interface RealEstateState {
  location: string;
  rooms: number | null;
  sqm: number | null;
  type: RealEstateType;
  loanAmount: number | null;
  amountPaid: number | null;
  years: number | null;
  propertyValue: number | null;
  leverage: LeverageMetrics | null;
}

interface RealEstateContextValue extends RealEstateState {
  setLocation: (v: string) => void;
  setRooms: (v: number | null) => void;
  setSqm: (v: number | null) => void;
  setType: (v: RealEstateType) => void;
  setLoanAmount: (v: number | null) => void;
  setAmountPaid: (v: number | null) => void;
  setYears: (v: number | null) => void;
  setPropertyValue: (v: number | null) => void;
  setLeverage: (v: LeverageMetrics | null) => void;
}

const DEFAULT_STATE: RealEstateState = {
  location: '',
  rooms: null,
  sqm: null,
  type: 'sell',
  loanAmount: null,
  amountPaid: null,
  years: null,
  propertyValue: null,
  leverage: null,
};

const STORAGE_KEY = 'real_estate_state_v1';

const RealEstateContext = createContext<RealEstateContextValue | undefined>(undefined);

export const RealEstateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<RealEstateState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed } as RealEstateState;
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const value = useMemo<RealEstateContextValue>(() => ({
    ...state,
    setLocation: (v) => setState(s => ({ ...s, location: v })),
    setRooms: (v) => setState(s => ({ ...s, rooms: v })),
    setSqm: (v) => setState(s => ({ ...s, sqm: v })),
    setType: (v) => setState(s => ({ ...s, type: v })),
    setLoanAmount: (v) => setState(s => ({ ...s, loanAmount: v })),
    setAmountPaid: (v) => setState(s => ({ ...s, amountPaid: v })),
    setYears: (v) => setState(s => ({ ...s, years: v })),
    setPropertyValue: (v) => setState(s => ({ ...s, propertyValue: v })),
    setLeverage: (v) => setState(s => ({ ...s, leverage: v })),
  }), [state]);

  return (
    <RealEstateContext.Provider value={value}>
      {children}
    </RealEstateContext.Provider>
  );
};

export const useRealEstateContext = (): RealEstateContextValue => {
  const ctx = useContext(RealEstateContext);
  if (!ctx) throw new Error('useRealEstateContext must be used within RealEstateProvider');
  return ctx;
};

