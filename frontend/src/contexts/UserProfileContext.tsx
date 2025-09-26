import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

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
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

// Helper function to construct full image URL
const getFullImageUrl = (imageUrl: string | undefined): string | undefined => {
  if (!imageUrl) return undefined;
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) return imageUrl;
  
  // If it's a relative path, prepend the API base URL
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${apiUrl}${imageUrl}`;
};

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/profile');
      setProfile(response.data);
      console.log('🔄 [UserProfileContext] Profile loaded:', response.data);
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      setError(err.response?.data?.detail || 'Failed to load profile');
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
    console.log('🔄 [UserProfileContext] Refreshing profile...');
    await loadProfile();
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const profileImageUrl = getFullImageUrl(profile?.profile_image_url);
  
  // Debug: Log when profileImageUrl changes
  useEffect(() => {
    console.log('🔄 [UserProfileContext] profileImageUrl updated:', profileImageUrl);
  }, [profileImageUrl]);

  const value: UserProfileContextType = {
    profile,
    isLoading,
    error,
    updateProfile,
    refreshProfile,
    profileImageUrl,
    displayName: profile?.display_name || user?.displayName || 'User'
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
