import axios from 'axios';
import { auth } from '../firebase';

const apiUrl = import.meta.env.VITE_API_URL;



// Create axios instance
const api = axios.create({
  baseURL: apiUrl,
});

// Token cache to avoid unnecessary token requests
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let lastLoggedToken: string | null = null;

// Function to get auth token with caching
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      cachedToken = null;
      tokenExpiry = 0;
      return null;
    }

    // Check if we have a valid cached token (with 5 minute buffer before expiry)
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (cachedToken && tokenExpiry > now + bufferTime) {
      return cachedToken;
    }

    // Get fresh token (Firebase handles refresh automatically)
    const token = await user.getIdToken(false); // false = don't force refresh unless needed
    
    if (token) {
      // Log token only when it changes
      if (token !== lastLoggedToken) {
        console.log('🔑 New Bearer Token:', token);
        lastLoggedToken = token;
      }
      
      // Parse token to get expiry time
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenExpiry = payload.exp * 1000; // Convert to milliseconds
        cachedToken = token;
      } catch (error) {
        console.error('Error parsing token:', error);
        // Fallback: cache for 50 minutes (typical Firebase token lifetime)
        tokenExpiry = now + (50 * 60 * 1000);
        cachedToken = token;
      }
    }
    
    return token;
  } catch (error) {
    console.error('Error in getAuthToken:', error);
    cachedToken = null;
    tokenExpiry = 0;
    return null;
  }
};

// Clear token cache when auth state changes
auth.onAuthStateChanged((user) => {
  if (!user) {
    cachedToken = null;
    tokenExpiry = 0;
    lastLoggedToken = null;
  }
});

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

// ============================================================================
// Account Deletion API
// ============================================================================

export interface DeleteAccountRequest {
  confirmation: string; // Must be "DELETE"
}

export interface DeleteAccountResponse {
  success: boolean;
  audit_id: string;
  message: string;
}

/**
 * Permanently delete user account and all associated data.
 *
 * Complies with Israeli Privacy Law Amendment 13 ("right to be forgotten").
 *
 * @param confirmation - Must be exactly "DELETE" to confirm
 * @returns Promise with deletion result
 * @throws Error if confirmation invalid or deletion fails
 */
export const deleteAccount = async (
  confirmation: string
): Promise<DeleteAccountResponse> => {
  const response = await api.post<DeleteAccountResponse>(
    '/me/delete-account',
    { confirmation }
  );
  return response.data;
};

export default api; 