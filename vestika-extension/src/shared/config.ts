// Environment configuration

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  vestikaAppUrl: import.meta.env.VITE_VESTIKA_APP_URL || 'http://localhost:5173',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Log config in development
if (config.isDevelopment) {
  console.log('[Config] Environment:', {
    apiUrl: config.apiUrl,
    vestikaAppUrl: config.vestikaAppUrl,
    mode: import.meta.env.MODE,
  });
}
