import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  PortfolioSelectorProps,
} from './types';

const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  files = [],
  selectedFile,
  onFileChange,
  userName,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!files || files.length === 0) {
    return <h1 className="text-2xl font-bold text-white">{userName}'s Portfolio</h1>;
  }

  const selectedFileDisplay = files.find(file => file.filename === selectedFile)?.display_name || 'Portfolio';

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer inline-flex items-baseline"
      >
        <h1 className="text-2xl font-bold">
          {userName}'s Portfolio
          <ChevronDown
            size={16}
            className={`inline-block ml-1 mb-1 opacity-40 transition-all duration-200 ${
              isOpen ? 'rotate-180 opacity-80' : ''
            } hover:opacity-80`}
          />
        </h1>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-40">
            <div className="py-1 border border-gray-700 rounded-lg shadow-sm bg-gray-800">
              {files.map((file) => (
                <button
                  key={file.filename}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150
                    ${selectedFile === file.filename 
                      ? 'text-blue-400 bg-gray-700/50 font-bold' 
                      : 'text-gray-300 bg-gray-800/50 hover:bg-gray-700/30'}`}
                  onClick={() => {
                    onFileChange(file.filename);
                    setIsOpen(false);
                  }}
                >
                  {file.display_name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PortfolioSelector;