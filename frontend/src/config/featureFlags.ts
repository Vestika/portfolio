export const isRealEstateEnabled = (): boolean => {
  const raw = import.meta.env.VITE_FEATURE_REAL_ESTATE;
  return false;//String(raw).toLowerCase() === 'true';
};


