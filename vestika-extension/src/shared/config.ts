// Environment configuration
import { logger } from './utils';

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'https://api.vestika.io',
  vestikaAppUrl: import.meta.env.VITE_VESTIKA_APP_URL || 'https://app.vestika.io',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // Logging configuration
  logging: {
    enabled: import.meta.env.DEV,
    logApiCalls: true,
    logAutoSync: true,
    logBadgeChanges: true,
  }
};

// Initialize logger with dev mode
if (config.isDevelopment) {
  logger.setDevMode(true);
}

// Log config in development
if (config.isDevelopment) {
  console.log('[Config] Environment:', {
    apiUrl: config.apiUrl,
    vestikaAppUrl: config.vestikaAppUrl,
    mode: import.meta.env.MODE,
    logging: config.logging,
  });
}
