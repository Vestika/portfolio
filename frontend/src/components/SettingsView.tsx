import React, { useState } from 'react';
import { Settings, Bell, Shield, Eye, EyeOff, Save, Volume2, VolumeX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface SettingsViewProps {
  onBack: () => void;
  onToggleVisibility: () => void;
  isValueVisible: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onBack, onToggleVisibility, isValueVisible }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    // Notification settings
    emailNotifications: true,
    pushNotifications: true,
    priceAlerts: true,
    newsUpdates: false,
    earningsAlerts: true,
    
    // Privacy settings
    profileVisibility: 'private',
    dataSharing: false,
    analyticsTracking: true,
    
    // Sound settings
    soundEnabled: true,
    volume: 50,
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to save settings
      console.log('Saving settings:', settings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // TODO: Show success notification
    } catch (error) {
      console.error('Error saving settings:', error);
      // TODO: Show error notification
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-blue-600/20 to-purple-600/20"></div>
        <div className="relative border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-blue-600 shadow-lg">
                <Settings size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Settings
                </h1>
                <p className="text-gray-400 mt-1">Customize your experience</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        
        {/* Notification Settings */}
        <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl text-white flex items-center">
              <Bell size={24} className="mr-3 text-blue-400" />
              Notifications
            </CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Email Notifications</Label>
                  <p className="text-gray-400">Receive notifications via email</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                />
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Push Notifications</Label>
                  <p className="text-gray-400">Receive push notifications in browser</p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => updateSetting('pushNotifications', checked)}
                />
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Price Alerts</Label>
                  <p className="text-gray-400">Get notified when your holdings reach target prices</p>
                </div>
                <Switch
                  checked={settings.priceAlerts}
                  onCheckedChange={(checked) => updateSetting('priceAlerts', checked)}
                />
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">News Updates</Label>
                  <p className="text-gray-400">Receive news about your holdings</p>
                </div>
                <Switch
                  checked={settings.newsUpdates}
                  onCheckedChange={(checked) => updateSetting('newsUpdates', checked)}
                />
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Earnings Alerts</Label>
                  <p className="text-gray-400">Get notified about upcoming earnings</p>
                </div>
                <Switch
                  checked={settings.earningsAlerts}
                  onCheckedChange={(checked) => updateSetting('earningsAlerts', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl text-white flex items-center">
              <Shield size={24} className="mr-3 text-green-400" />
              Privacy & Security
            </CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Control your privacy and data sharing preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Profile Visibility</Label>
                  <p className="text-gray-400">Control who can see your profile</p>
                </div>
                <select
                  value={settings.profileVisibility}
                  onChange={(e) => updateSetting('profileVisibility', e.target.value)}
                  className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                >
                  <option value="private" className="bg-gray-700">Private</option>
                  <option value="friends" className="bg-gray-700">Friends Only</option>
                  <option value="public" className="bg-gray-700">Public</option>
                </select>
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Data Sharing</Label>
                  <p className="text-gray-400">Allow sharing of anonymized data for product improvement</p>
                </div>
                <Switch
                  checked={settings.dataSharing}
                  onCheckedChange={(checked) => updateSetting('dataSharing', checked)}
                />
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Analytics Tracking</Label>
                  <p className="text-gray-400">Help us improve the app with usage analytics</p>
                </div>
                <Switch
                  checked={settings.analyticsTracking}
                  onCheckedChange={(checked) => updateSetting('analyticsTracking', checked)}
                />
              </div>
              
              <Separator className="bg-gray-600/50" />
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Hide Portfolio Values</Label>
                  <p className="text-gray-400">Hide monetary values for privacy</p>
                </div>
                <Button
                  onClick={onToggleVisibility}
                  variant="outline"
                  className="border-gray-600/50 text-gray-300 hover:bg-gray-700/50 px-6 py-2"
                >
                  {isValueVisible ? <EyeOff size={18} className="mr-2" /> : <Eye size={18} className="mr-2" />}
                  {isValueVisible ? 'Hide' : 'Show'} Values
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sound Settings */}
        <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl text-white flex items-center">
              {settings.soundEnabled ? <Volume2 size={24} className="mr-3 text-yellow-400" /> : <VolumeX size={24} className="mr-3 text-gray-400" />}
              Sound & Audio
            </CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Configure audio notifications and alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                <div className="space-y-1">
                  <Label className="text-gray-200 text-lg font-medium">Sound Notifications</Label>
                  <p className="text-gray-400">Play sounds for notifications and alerts</p>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
                />
              </div>
              
              {settings.soundEnabled && (
                <>
                  <Separator className="bg-gray-600/50" />
                  <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                    <div className="space-y-4">
                      <Label className="text-gray-200 text-lg font-medium">Volume</Label>
                      <div className="flex items-center space-x-4">
                        <VolumeX size={20} className="text-gray-400" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.volume}
                          onChange={(e) => updateSetting('volume', parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
                          style={{
                            background: `linear-gradient(to right, #eab308 0%, #eab308 ${settings.volume}%, #4b5563 ${settings.volume}%, #4b5563 100%)`
                          }}
                        />
                        <Volume2 size={20} className="text-gray-400" />
                        <span className="text-gray-300 text-lg font-medium w-16">{settings.volume}%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-8">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-10 py-4 h-14 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Saving Settings...
              </>
            ) : (
              <>
                <Save size={20} className="mr-3" />
                Save All Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
