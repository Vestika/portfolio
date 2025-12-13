import React from 'react';
import { X, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeatureNotification {
  _id: string;
  title: string;
  message: string;
  link_url?: string;
  link_text?: string;
}

interface FeaturePopupProps {
  isOpen: boolean;
  onClose: () => void;
  notification: FeatureNotification | null;
}

export const FeaturePopup: React.FC<FeaturePopupProps> = ({ isOpen, onClose, notification }) => {
  if (!isOpen || !notification) return null;

  const handleLinkClick = () => {
    if (notification.link_url) {
      // Check if it's an external URL or internal route
      if (notification.link_url.startsWith('http://') || notification.link_url.startsWith('https://')) {
        window.open(notification.link_url, '_blank');
      } else {
        // Internal route - use window.location for now
        window.location.href = notification.link_url;
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-md w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sparkles size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                {notification.title}
              </h1>
              <p className="text-gray-400 text-sm">
                New Feature
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-gray-300 mb-6 text-sm leading-relaxed whitespace-pre-wrap">
            {notification.message}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {notification.link_url && (
              <Button
                onClick={handleLinkClick}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {notification.link_text || 'Check it out'}
                {(notification.link_url.startsWith('http://') || notification.link_url.startsWith('https://')) && (
                  <ExternalLink size={14} />
                )}
              </Button>
            )}
            <Button
              onClick={onClose}
              className={`${notification.link_url ? 'flex-1' : 'w-full'} bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors`}
            >
              {notification.link_url ? 'Maybe Later' : 'Got it'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
