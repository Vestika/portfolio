import React, { useState, useEffect } from 'react';
import { X, LogOut, Check, AlertTriangle, Trash2, Shield, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from '../../contexts/AuthContext';
import { useConsent } from '../../contexts/ConsentContext';
import api, { deleteAccount } from '../../utils/api';
import GoogleProfilePicture from './GoogleProfilePicture';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

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
  const { consentStatus, updateConsent, isLoading: isConsentLoading } = useConsent();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    timezone: 'UTC',
  });

  // Account deletion state
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState('');

  // Privacy section collapse state
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);

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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeletionError('');

    try {
      await deleteAccount(confirmText);

      // Success: Sign out and redirect
      await signOut(auth);

      // Clear all local state
      localStorage.clear();
      sessionStorage.clear();

      // Redirect to login with deletion success message
      window.location.href = '/?account_deleted=true';

    } catch (error: any) {
      console.error('Account deletion error:', error);
      setDeletionError(
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        'Failed to delete account. Please try again or contact support.'
      );
      setIsDeleting(false);
    }
  };

  const resetDeletionModal = () => {
    setShowDeletionModal(false);
    setShowFinalConfirm(false);
    setConfirmText('');
    setDeletionError('');
  };

  const handleAnalyticsConsentChange = async (checked: boolean) => {
    try {
      await updateConsent(checked, consentStatus?.marketing_consent);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to update analytics consent:', error);
      setSaveStatus('error');
      setErrorMessage('Failed to update consent');
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 5000);
    }
  };

  const handleMarketingConsentChange = async (checked: boolean) => {
    try {
      await updateConsent(consentStatus?.analytics_consent, checked);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to update marketing consent:', error);
      setSaveStatus('error');
      setErrorMessage('Failed to update consent');
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 5000);
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

                  {/* Privacy Preferences - Collapsible */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
                      className="flex items-center justify-between w-full py-2 group"
                    >
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-blue-400" />
                        <Label className="text-gray-300 text-sm font-medium cursor-pointer group-hover:text-white transition-colors">
                          Privacy & Consent
                        </Label>
                      </div>
                      {isPrivacyExpanded ? (
                        <ChevronDown size={16} className="text-gray-400 group-hover:text-gray-300 transition-colors" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-300 transition-colors" />
                      )}
                    </button>

                    {isPrivacyExpanded && (
                      <div className="space-y-4 pl-6 pt-2">
                        {/* Analytics Consent */}
                        <div className="flex items-center justify-between py-2">
                          <div className="space-y-0.5 flex-1 pr-4">
                            <Label className="text-gray-300 text-sm">Analytics & Performance</Label>
                            <p className="text-xs text-gray-500">
                              Help us improve Vestika with usage analytics
                            </p>
                          </div>
                          <Switch
                            checked={consentStatus?.analytics_consent ?? false}
                            onCheckedChange={handleAnalyticsConsentChange}
                            disabled={isConsentLoading}
                          />
                        </div>

                        {/* Marketing Consent */}
                        <div className="flex items-center justify-between py-2">
                          <div className="space-y-0.5 flex-1 pr-4">
                            <Label className="text-gray-300 text-sm">Marketing Communications</Label>
                            <p className="text-xs text-gray-500">
                              Receive updates about new features and tips
                            </p>
                          </div>
                          <Switch
                            checked={consentStatus?.marketing_consent ?? false}
                            onCheckedChange={handleMarketingConsentChange}
                            disabled={isConsentLoading}
                          />
                        </div>

                        {/* Privacy Policy Link */}
                        <Link
                          to="/privacy-policy"
                          onClick={onClose}
                          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <span>Privacy Policy</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <Separator className="bg-gray-800" />

                {/* Danger Zone */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider">Danger Zone</h3>

                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <p className="text-sm text-gray-300 font-medium">
                          Delete Account
                        </p>
                        <p className="text-xs text-gray-400">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => setShowDeletionModal(true)}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm"
                    >
                      <Trash2 size={14} className="mr-2" />
                      Delete My Account
                    </Button>
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

      {/* Account Deletion Modal */}
      <Dialog open={showDeletionModal} onOpenChange={(open) => !open && resetDeletionModal()}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-400" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              {!showFinalConfirm
                ? "This action cannot be undone. Please confirm you want to delete your account."
                : "Are you absolutely sure? This is your last chance to cancel."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!showFinalConfirm ? (
              <>
                {/* Warning List */}
                <Alert className="bg-red-500/10 border-red-500/20">
                  <AlertTriangle size={16} className="text-red-400" />
                  <AlertDescription className="text-red-400 text-xs space-y-2">
                    <p className="font-semibold">All of the following will be permanently deleted:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>All your portfolios and holdings</li>
                      <li>All your tags and custom charts</li>
                      <li>All your chat history</li>
                      <li>Your account will be closed immediately</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Type DELETE Confirmation */}
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">
                    Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="DELETE"
                    className="bg-gray-800 border-gray-700 text-white font-mono"
                    disabled={isDeleting}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={resetDeletionModal}
                    variant="outline"
                    className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setShowFinalConfirm(true)}
                    disabled={confirmText !== 'DELETE' || isDeleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Continue to Delete
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Final Confirmation */}
                <Alert className="bg-yellow-500/10 border-yellow-500/20">
                  <AlertTriangle size={16} className="text-yellow-400" />
                  <AlertDescription className="text-yellow-400 text-sm">
                    <p className="font-semibold">Final Warning</p>
                    <p className="text-xs mt-1">
                      This is your last chance. Once you click "Yes, Delete My Account",
                      your data will be immediately and permanently deleted.
                    </p>
                  </AlertDescription>
                </Alert>

                {/* Error Message */}
                {deletionError && (
                  <Alert className="bg-red-500/10 border-red-500/20">
                    <X size={16} className="text-red-400" />
                    <AlertDescription className="text-red-400 text-xs">
                      {deletionError}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Final Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setShowFinalConfirm(false)}
                    variant="outline"
                    className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                    disabled={isDeleting}
                  >
                    Go Back
                  </Button>
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete My Account'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileSidebar;

