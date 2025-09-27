import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, User, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ProfileImageUploadProps {
  currentImageUrl?: string;
  onImageSelect: (file: File | null) => void;
  onImageDelete: () => void;
  isLoading?: boolean;
  error?: string;
}

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({
  currentImageUrl,
  onImageSelect,
  onImageDelete,
  isLoading = false,
  error
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type - support common image formats
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      console.error('❌ [PROFILE IMAGE] Invalid file type:', file.type);
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      console.error('❌ [PROFILE IMAGE] File too large:', file.size, 'bytes');
      return;
    }

    // Clean up previous preview URL to prevent memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      console.log('🧹 [PROFILE IMAGE] Cleaned up previous preview URL');
    }

    // Create new preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    console.log('🖼️ [PROFILE IMAGE] Created new preview URL for:', file.name);

    // Notify parent component about the selected file
    onImageSelect(file);
  };

  const handleRemoveImage = () => {
    // Clean up preview URL to prevent memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      console.log('🧹 [PROFILE IMAGE] Cleaned up preview URL on remove');
    }
    setPreviewUrl(null);
    onImageDelete();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        console.log('🧹 [PROFILE IMAGE] Cleaned up preview URL on unmount');
      }
    };
  }, [previewUrl]);

  const displayImage = previewUrl || currentImageUrl;

  return (
    <div className="space-y-4">
      {/* Image Display */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-600 bg-gray-700 flex items-center justify-center">
            {displayImage ? (
              <img
                src={displayImage}
                alt="Profile"
                className="w-full h-full object-cover"
                style={{ objectFit: 'cover' }}
                onError={(e) => {
                  console.error('🖼️ Image failed to load:', displayImage);
                  console.error('🖼️ Error event:', e);
                }}
                onLoad={() => {
                  console.log('🖼️ Image loaded successfully:', displayImage);
                }}
              />
            ) : (
              <User size={48} className="text-gray-400" />
            )}
          </div>
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <Card className="bg-gray-700/30 border-gray-600/30">
        <CardContent className="p-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-gray-500 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/tiff,image/svg+xml"
              onChange={handleFileInput}
              className="hidden"
            />
            
            <div className="space-y-3">
              <div className="flex justify-center">
                {dragActive ? (
                  <Upload size={32} className="text-blue-400" />
                ) : (
                  <Camera size={32} className="text-gray-400" />
                )}
              </div>
              
              <div>
                <p className="text-gray-300 text-sm">
                  {dragActive ? 'Drop your image here' : 'Drag & drop an image here, or click to select'}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  JPEG, PNG, GIF, WebP, BMP, TIFF, SVG up to 5MB
                </p>
              </div>
              
              <Button
                onClick={handleClick}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="bg-gray-600/50 border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                <Upload size={16} className="mr-2" />
                Choose File
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {displayImage && (
        <div className="flex justify-center space-x-2">
          <Button
            onClick={handleClick}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="bg-gray-600/50 border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white"
          >
            <Camera size={16} className="mr-2" />
            Change Image
          </Button>
          
          <Button
            onClick={handleRemoveImage}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="bg-red-600/20 border-red-500/30 text-red-300 hover:bg-red-600/30 hover:text-red-200"
          >
            <X size={16} className="mr-2" />
            Remove
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default ProfileImageUpload;
