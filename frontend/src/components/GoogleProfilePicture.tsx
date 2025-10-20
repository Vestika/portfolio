import React from 'react';
import { User } from 'lucide-react';

interface GoogleProfilePictureProps {
  photoURL?: string | null;
  displayName?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const GoogleProfilePicture: React.FC<GoogleProfilePictureProps> = ({
  photoURL,
  displayName,
  size = 'md',
  className = '',
  showFallback = true
}) => {
  // Size configurations
  const sizeConfig = {
    sm: { container: 'w-8 h-8', icon: 16, resolution: 64 },
    md: { container: 'w-12 h-12', icon: 24, resolution: 96 },
    lg: { container: 'w-16 h-16', icon: 32, resolution: 128 },
    xl: { container: 'w-32 h-32', icon: 48, resolution: 256 }
  };

  const config = sizeConfig[size];
  const containerClasses = `${config.container} rounded-full overflow-hidden border-2 border-gray-600 bg-gray-700 flex items-center justify-center ${className}`;

  // Helper function to enhance Google profile picture URL for higher resolution
  const enhanceGooglePhotoURL = (url: string, targetSize: number): string => {
    // Google profile picture URLs can be enhanced by modifying the size parameter
    // Common patterns: s64, s96, s128, s256, s512, etc.
    if (url.includes('googleusercontent.com')) {
      // Replace size parameter with higher resolution
      return url.replace(/s\d+/, `s${targetSize}`);
    }
    return url;
  };

  // If we have a photo URL, display it
  if (photoURL) {
    const enhancedURL = enhanceGooglePhotoURL(photoURL, config.resolution);
    
    return (
      <div className={containerClasses}>
        <img
          src={enhancedURL}
          alt={displayName || 'Profile'}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.warn('🖼️ Google profile picture failed to load:', enhancedURL);
            // If image fails to load and we should show fallback, we'll let the parent handle it
            if (showFallback) {
              // Hide the image and show fallback
              (e.target as HTMLImageElement).style.display = 'none';
            }
          }}
          onLoad={() => {
            console.log('🖼️ Google profile picture loaded successfully:', enhancedURL);
          }}
        />
        {showFallback && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700" style={{ display: 'none' }}>
            <User size={config.icon} className="text-gray-400" />
          </div>
        )}
      </div>
    );
  }

  // Fallback to default icon
  if (showFallback) {
    return (
      <div className={containerClasses}>
        <User size={config.icon} className="text-gray-400" />
      </div>
    );
  }

  // If no fallback should be shown and no photo URL, return null
  return null;
};

export default GoogleProfilePicture;