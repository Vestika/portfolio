import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

/**
 * UserProfileContext provides user profile data with authentication safeguards.
 * 
 * Authentication Flow:
 * 1. Waits for AuthContext to finish loading
 * 2. Verifies user is authenticated and has valid UID
 * 3. Only then makes API calls to /profile/ endpoint
 * 4. Handles authentication errors gracefully
 */

interface UserProfile {
  user_id: string;
  display_name?: string;
  email: string;
  timezone: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updatedProfile: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
  profileImageUrl: string | undefined;
  displayName: string;
  isAuthenticated: boolean;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

// Helper function to construct full image URL
const getFullImageUrl = (imageUrl: string | undefined): string | undefined => {
  if (!imageUrl) return undefined;
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) return imageUrl;
  
  // If it's a relative path, prepend the API base URL from the centralized api instance
  const apiUrl = api.defaults.baseURL;
  const fullUrl = `${apiUrl}${imageUrl}`;
  console.log('🖼️ Full Image URL:', fullUrl);
  return fullUrl;
};

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    // Wait for auth to finish loading before making any decisions
    if (authLoading) {
      console.log('🔄 [UserProfileContext] Auth still loading, waiting...');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      console.log('🔄 [UserProfileContext] No authenticated user, skipping profile load');
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // Additional check to ensure user has valid authentication
    if (!user.uid) {
      console.warn('🔄 [UserProfileContext] User exists but has no UID, skipping profile load');
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 [UserProfileContext] Loading profile for authenticated user:', user.uid);
      
      const response = await api.get('/profile/');
      setProfile(response.data);
      console.log('🔄 [UserProfileContext] Profile loaded successfully:', response.data);
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      
      // Handle specific error cases
      if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
        console.warn('🔄 [UserProfileContext] Unauthorized access - user may need to re-authenticate');
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view this profile.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = (updatedProfile: Partial<UserProfile>) => {
    if (profile) {
      const newProfile = { ...profile, ...updatedProfile };
      setProfile(newProfile);
      console.log('🔄 [UserProfileContext] Profile updated locally:', newProfile);
    }
  };

  const refreshProfile = async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('🔄 [UserProfileContext] Cannot refresh profile - auth still loading');
      setError('Authentication still loading');
      return;
    }

    // Check authentication before attempting to refresh
    if (!user || !user.uid) {
      console.log('🔄 [UserProfileContext] Cannot refresh profile - user not authenticated');
      setError('Authentication required to refresh profile');
      return;
    }
    
    console.log('🔄 [UserProfileContext] Refreshing profile for authenticated user...');
    await loadProfile();
  };

  useEffect(() => {
    loadProfile();
  }, [user, authLoading]);

  const profileImageUrl = getFullImageUrl(profile?.profile_image_url);
  
  // Check if user is properly authenticated
  const isAuthenticated = !!(user && user.uid);
  
  // Debug: Log when profileImageUrl changes
  useEffect(() => {
    console.log('🔄 [UserProfileContext] profileImageUrl updated:', profileImageUrl);
  }, [profileImageUrl]);

  // Debug: Log authentication status
  useEffect(() => {
    console.log('🔄 [UserProfileContext] Authentication status:', { 
      isAuthenticated, 
      hasUser: !!user, 
      hasUid: !!(user?.uid) 
    });
  }, [isAuthenticated, user]);

  const value: UserProfileContextType = {
    profile,
    isLoading,
    error,
    updateProfile,
    refreshProfile,
    profileImageUrl,
    displayName: profile?.display_name || user?.displayName || 'User',
    isAuthenticated
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
