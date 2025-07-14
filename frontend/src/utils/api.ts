import axios from 'axios';
import { auth } from '../firebase';

const apiUrl = import.meta.env.VITE_API_URL;



// Create axios instance
const api = axios.create({
  baseURL: apiUrl,
});

// Function to get auth token with proper error handling
const getAuthToken = async (): Promise<string | null> => {

  try {
    const user = auth.currentUser;
    console.log('Current user:', user); // Debug log
    
    if (user) {
      const token = await user.getIdToken();
      console.log('Got token for user:', user.email); // Debug log
      return token;
    }
    
    console.log('No current user, waiting for auth state...'); // Debug log
    
    // If no current user, wait for auth state to be established
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user); // Debug log
        unsubscribe();
        if (user) {
          try {
            const token = await user.getIdToken();
            console.log('Got token after auth state change:', user.email); // Debug log
            resolve(token);
          } catch (error) {
            console.error('Error getting token:', error);
            resolve(null);
          }
        } else {
          console.log('No user after auth state change'); // Debug log
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Error in getAuthToken:', error);
    return null;
  }
};

// Request interceptor to add Firebase auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access');
      // You could redirect to login here if needed
    }
    return Promise.reject(error);
  }
);

export default api; 