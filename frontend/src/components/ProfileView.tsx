import React, { useState, useEffect } from 'react';
import { User, Globe, Save, Mail, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '../contexts/AuthContext';

interface ProfileViewProps {
  onBack: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to update profile
      console.log('Saving profile:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // TODO: Show success notification
    } catch (error) {
      console.error('Error saving profile:', error);
      // TODO: Show error notification
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20"></div>
        <div className="relative border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 py-8">
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
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
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
      </div>
    </div>
  );
};

export default ProfileView;
