export const isRealEstateEnabled = (): boolean => {
  const raw = import.meta.env.VITE_FEATURE_REAL_ESTATE;
  return true;//String(raw).toLowerCase() === 'true';
};


