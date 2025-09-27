import React, { useState, useEffect } from 'react';
import { User, Globe, Save, Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import ProfileImageUpload from './ProfileImageUpload';
import { useUserProfile } from '../contexts/UserProfileContext';

// Helper function to construct full image URL
const getFullImageUrl = (imageUrl: string | undefined): string | undefined => {
  if (!imageUrl) return undefined;
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) return imageUrl;
  
  // If it's a relative path, prepend the API base URL
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${apiUrl}${imageUrl}`;
};

interface ProfileViewProps {
  onBackToPortfolio: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ onBackToPortfolio }) => {
  const { user } = useAuth();
  const { refreshProfile } = useUserProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    timezone: 'UTC',
    profileImageUrl: '',
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Asia/Jerusalem',
    'Europe/Moscow',
    'America/Sao_Paulo',
    'Pacific/Auckland'
  ];

  // Load profile data on component mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        const response = await api.get('/profile/');
        setFormData({
          displayName: response.data.display_name || '',
          email: response.data.email || user?.email || '',
          timezone: response.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          profileImageUrl: response.data.profile_image_url || '',
        });
        
        // Debug: Log the profile image URL
        if (response.data.profile_image_url) {
          console.log('🖼️ Profile image URL from API:', response.data.profile_image_url);
          console.log('🖼️ Full image URL:', getFullImageUrl(response.data.profile_image_url));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        // Set fallback values
        setFormData({
          displayName: user?.displayName || '',
          email: user?.email || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          profileImageUrl: '',
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('idle');
    setErrorMessage('');
    setImageError('');
    
    try {
      let imageUrl = formData.profileImageUrl;
      
      // Upload image first if there's a selected file
      if (selectedImageFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', selectedImageFile);
        
        const imageResponse = await api.post('/profile/image', formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        imageUrl = imageResponse.data.image_url;
        console.log('Profile image uploaded successfully:', imageResponse.data);
        console.log('🖼️ Image URL from upload:', imageUrl);
        console.log('🖼️ Full image URL after upload:', getFullImageUrl(imageUrl));
      }
      
      // Update profile with all data including the new image URL
      const response = await api.put('/profile', {
        display_name: formData.displayName,
        timezone: formData.timezone,
        profile_image_url: imageUrl,
      });
      
      // Update form data with the new image URL
      setFormData(prev => ({
        ...prev,
        profileImageUrl: imageUrl
      }));
      
      // Clear selected file since it's now saved
      setSelectedImageFile(null);
      
      // Refresh the global profile data so the image appears in navigation
      refreshProfile();
      
      setSaveStatus('success');
      console.log('Profile saved successfully:', response.data);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
      
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setSaveStatus('error');
      setErrorMessage(error.response?.data?.detail || 'Failed to save profile');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (file: File | null) => {
    setSelectedImageFile(file);
    setImageError('');
  };

  const handleImageDelete = async () => {
    try {
      // If there's a current image, delete it from the server
      if (formData.profileImageUrl) {
        await api.delete('/profile/image');
        console.log('🗑️ [PROFILE IMAGE] Deleted image from server');
      }
      
      // Clear local state
      setSelectedImageFile(null);
      setFormData(prev => ({
        ...prev,
        profileImageUrl: ''
      }));
      setImageError('');
      
      // Refresh the global profile data
      refreshProfile();
      
      console.log('🧹 [PROFILE IMAGE] Cleared local image state');
    } catch (error: any) {
      console.error('Error deleting profile image:', error);
      setImageError(error.response?.data?.detail || 'Failed to delete image');
    }
  };

  const formatTimezone = (tz: string) => {
    try {
      const now = new Date();
      const offset = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'longOffset'
      }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || '';
      
      return `${tz} (${offset})`;
    } catch {
      return tz;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20"></div>
        <div className="relative border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
                  <User size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Profile Settings
                  </h1>
                  <p className="text-gray-400 mt-1">Manage your personal information</p>
                </div>
              </div>
              
              {/* Modern Back to Portfolio Button */}
              <Button
                onClick={onBackToPortfolio}
                variant="outline"
                className="group flex items-center space-x-2 bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/70 hover:border-gray-500/70 hover:text-white transition-all duration-200 px-4 py-2 rounded-lg backdrop-blur-sm"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
                <span className="font-medium">Back to Portfolio</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {isLoadingProfile ? (
          <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                <span className="text-gray-300">Loading profile...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-white flex items-center">
                <User size={24} className="mr-3 text-blue-400" />
                Personal Information
              </CardTitle>
              <CardDescription className="text-gray-400 text-lg">
                Update your profile details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
            {/* Profile Image Upload */}
            <div className="space-y-3">
              <Label className="text-gray-300 text-sm font-medium flex items-center">
                <User size={16} className="mr-2 text-blue-400" />
                Profile Image
              </Label>
              <ProfileImageUpload
                currentImageUrl={getFullImageUrl(formData.profileImageUrl)}
                onImageSelect={handleImageSelect}
                onImageDelete={handleImageDelete}
                isLoading={isLoading}
                error={imageError}
              />
            </div>

            {/* Display Name */}
            <div className="space-y-3">
              <Label htmlFor="displayName" className="text-gray-300 text-sm font-medium flex items-center">
                <User size={16} className="mr-2 text-blue-400" />
                Display Name
              </Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20 h-12 text-lg"
                placeholder="Enter your display name"
              />
            </div>

            {/* Email */}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-gray-300 text-sm font-medium flex items-center">
                <Mail size={16} className="mr-2 text-green-400" />
                Email Address
              </Label>
              <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                <span className="text-white text-lg">{formData.email}</span>
                <span className="text-gray-400 text-sm ml-3">(Read-only)</span>
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-3">
              <Label htmlFor="timezone" className="text-gray-300 text-sm font-medium flex items-center">
                <Globe size={16} className="mr-2 text-purple-400" />
                Timezone
              </Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full p-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 h-12 text-sm"
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz} className="bg-gray-700 text-sm">
                    {formatTimezone(tz)}
                  </option>
                ))}
              </select>
            </div>

              {/* Status Messages */}
              {saveStatus === 'success' && (
                <div className="flex items-center space-x-2 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <CheckCircle size={20} className="text-green-400" />
                  <span className="text-green-300">Profile saved successfully!</span>
                </div>
              )}
              
              {saveStatus === 'error' && (
                <div className="flex items-center space-x-2 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <AlertCircle size={20} className="text-red-400" />
                  <span className="text-red-300">{errorMessage}</span>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-6">
                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 h-12 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={20} className="mr-3" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
