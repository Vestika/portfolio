export const isRealEstateEnabled = (): boolean => {
  const raw = import.meta.env.VITE_FEATURE_REAL_ESTATE;
  return String(raw).toLowerCase() === 'true';
};


