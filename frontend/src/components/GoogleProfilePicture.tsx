import React from 'react';

// Material-UI style default profile icon component
const DefaultProfileIcon: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-400"
    >
      <path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        fill="currentColor"
      />
      <path
        d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z"
        fill="currentColor"
      />
    </svg>
  );
};

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
  const containerClasses = `${config.container} rounded-full overflow-hidden relative ${className}`;

  // Helper function to get fallback URLs if the enhanced URL fails
  const getFallbackURLs = (url: string, targetSize: number): string[] => {
    if (!url.includes('googleusercontent.com')) return [url];
    
    const fallbackSizes = [targetSize, 128, 96, 64];
    return fallbackSizes.map(size => url.replace(/s\d+(-c)?/, `s${size}`));
  };

  // If we have a photo URL, display it
  if (photoURL) {
    const fallbackURLs = getFallbackURLs(photoURL, config.resolution);
    const [currentUrlIndex, setCurrentUrlIndex] = React.useState(0);
    const [imageError, setImageError] = React.useState(false);
    
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const currentUrl = fallbackURLs[currentUrlIndex];
      console.warn('🖼️ Google profile picture failed to load:', currentUrl);
      
      // Try next fallback URL
      if (currentUrlIndex < fallbackURLs.length - 1) {
        console.log('🖼️ Trying next fallback URL...');
        setCurrentUrlIndex(currentUrlIndex + 1);
      } else {
        // All URLs failed, show fallback icon
        console.warn('🖼️ All Google profile picture URLs failed, showing fallback icon');
        setImageError(true);
        if (showFallback) {
          (e.target as HTMLImageElement).style.display = 'none';
        }
      }
    };
    
    const handleImageLoad = () => {
      const currentUrl = fallbackURLs[currentUrlIndex];
      console.log('🖼️ Google profile picture loaded successfully:', currentUrl);
      setImageError(false);
    };
    
    return (
      <div className={containerClasses}>
        {!imageError && (
          <img
            key={currentUrlIndex} // Force re-render when URL changes
            src={fallbackURLs[currentUrlIndex]}
            alt={displayName || 'Profile'}
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ 
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
        )}
        {showFallback && (
          <div className={`absolute inset-0 flex items-center justify-center ${imageError ? '' : 'hidden'}`}>
            <DefaultProfileIcon size={config.icon} />
          </div>
        )}
      </div>
    );
  }

  // Fallback to default icon
  if (showFallback) {
    return (
      <div className={containerClasses}>
        <div className="absolute inset-0 flex items-center justify-center">
          <DefaultProfileIcon size={config.icon} />
        </div>
      </div>
    );
  }

  // If no fallback should be shown and no photo URL, return null
  return null;
};

export default GoogleProfilePicture;