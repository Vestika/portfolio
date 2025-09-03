import { useFeature } from '@growthbook/growthbook-react';
import { FEATURE_FLAGS } from '../lib/growthbook';

export const useFeatureFlag = (flagName: keyof typeof FEATURE_FLAGS) => {
  const feature = useFeature(flagName);
  return feature.value;
};

// Convenience hook for the aiChat feature flag
export const useAIChatFlag = () => {
  const feature = useFeature('aiChat');
  return feature.value;
}; 

export const useFrontendPortfolioCalcFlag = () => {
  const feature = useFeature('frontendPortfolioCalc');
  return true;
};