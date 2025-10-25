import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Image, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import { Button } from '@/components/ui/button';

export const UploadView: React.FC = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/api/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { session_id } = response.data;

      // Redirect to import page with session ID
      navigate(`/import?session=${session_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload size={48} />;

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText size={48} className="text-red-400" />;
      case 'csv':
        return <FileSpreadsheet size={48} className="text-green-400" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <Image size={48} className="text-blue-400" />;
      default:
        return <FileText size={48} className="text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Portfolio
          </Button>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Portfolio Statement</h1>
          <p className="text-gray-400">
            Upload a brokerage statement (PDF, CSV, or image) and we will extract your holdings automatically.
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-gray-800 rounded-lg p-8">
          <div className="border-2 border-dashed border-gray-500 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
            <div className="flex flex-col items-center space-y-4">
              {getFileIcon()}

              {selectedFile ? (
                <>
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-gray-400 text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setError(null);
                    }}
                    className="mt-2"
                    aria-label="Remove selected file and choose a different one"
                  >
                    Choose Different File
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-white font-medium mb-2">
                    Click to select or drag and drop
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    Supported formats: PDF, CSV, JPG, PNG
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.csv,image/jpeg,image/jpg,image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    aria-label="Upload portfolio statement file (PDF, CSV, JPG, or PNG)"
                  />
                  <label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Select File
                      </span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Upload Button */}
          {selectedFile && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                aria-label={uploading ? 'Uploading file in progress' : `Upload ${selectedFile.name} and extract holdings`}
              >
                {uploading ? 'Uploading...' : 'Upload and Extract'}
              </Button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-white font-medium mb-3">What happens next?</h2>
          <ol className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>Your file will be securely uploaded and processed by our AI</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>Holdings will be extracted from your statement (usually takes 5-15 seconds)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>You'll review and edit the extracted holdings before importing</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>Choose which portfolio and account to import into</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
