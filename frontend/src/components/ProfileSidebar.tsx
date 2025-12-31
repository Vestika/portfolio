import React, { useState, useEffect } from 'react';
import { X, LogOut, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import GoogleProfilePicture from './GoogleProfilePicture';
import { useUserProfile } from '../contexts/UserProfileContext';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onToggleVisibility?: () => void;
  isValueVisible?: boolean;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ 
  isOpen, 
  onClose, 
  onSignOut,
  onToggleVisibility,
  isValueVisible 
}) => {
  const { user } = useAuth();
  const { refreshProfile, googleProfileData } = useUserProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    timezone: 'UTC',
  });

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

  // Load profile data when sidebar opens
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        const response = await api.get('/profile');
        setFormData({
          displayName: response.data.display_name || googleProfileData?.displayName || '',
          email: response.data.email || googleProfileData?.email || user?.email || '',
          timezone: response.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } catch (error) {
        console.error('Error loading profile:', error);
        setFormData({
          displayName: googleProfileData?.displayName || user?.displayName || '',
          email: googleProfileData?.email || user?.email || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [isOpen, user, googleProfileData]);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('idle');
    setErrorMessage('');
    
    try {
      await api.put('/profile', {
        display_name: formData.displayName,
        timezone: formData.timezone,
      });
      
      refreshProfile();
      setSaveStatus('success');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error saving:', error);
      setSaveStatus('error');
      setErrorMessage(error.response?.data?.detail || 'Failed to save');
      
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 5000);
    } finally {
      setIsLoading(false);
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
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-screen w-80 bg-gray-900 border-l border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Account</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-8 space-y-6">
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                <span className="text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                {/* Profile Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Profile</h3>
                  
                  {/* Profile Picture */}
                  <div className="flex justify-center py-4">
                    <GoogleProfilePicture
                      photoURL={googleProfileData?.photoURL}
                      displayName={googleProfileData?.displayName}
                      size="lg"
                    />
                  </div>

                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-gray-300 text-sm">
                      Display Name
                    </Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      className="bg-gray-800 border-gray-700 text-white text-sm"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300 text-sm">
                      Email
                    </Label>
                    <Input
                      id="email"
                      value={formData.email}
                      disabled
                      className="bg-gray-800/50 border-gray-700 text-gray-500 text-sm cursor-not-allowed"
                    />
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-gray-300 text-sm">
                      Timezone
                    </Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 max-h-60 z-[60]">
                        {timezones.map(tz => (
                          <SelectItem key={tz} value={tz} className="text-white text-sm">
                            {formatTimezone(tz)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Messages */}
                  {saveStatus === 'success' && (
                    <Alert className="bg-green-500/10 border-green-500/20">
                      <Check size={16} className="text-green-400" />
                      <AlertDescription className="text-green-400 text-sm">
                        Saved successfully
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {saveStatus === 'error' && (
                    <Alert className="bg-red-500/10 border-red-500/20">
                      <X size={16} className="text-red-400" />
                      <AlertDescription className="text-red-400 text-sm">
                        {errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Update Button */}
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="w-full bg-white text-gray-900 hover:bg-gray-100 text-sm"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>

                <Separator className="bg-gray-800" />

                {/* Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Settings</h3>
                  
                  {/* Display Settings */}
                  {onToggleVisibility && (
                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label className="text-gray-300 text-sm">Show Values</Label>
                        <p className="text-xs text-gray-500">Display portfolio values</p>
                      </div>
                      <Switch
                        checked={isValueVisible}
                        onCheckedChange={onToggleVisibility}
                      />
                    </div>
                  )}

                  <Separator className="bg-gray-700" />

                  {/* Coming Soon */}
                  <div className="flex items-center justify-between py-2 opacity-50">
                    <div className="space-y-0.5">
                      <Label className="text-gray-300 text-sm">More Settings</Label>
                      <p className="text-xs text-gray-500">Coming soon</p>
                    </div>
                    <Switch disabled checked={false} />
                  </div>
                </div>

                <Separator className="bg-gray-800" />

                {/* Sign Out */}
                <div>
                  <Button
                    onClick={onSignOut}
                    variant="ghost"
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sign Out
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSidebar;

