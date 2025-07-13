import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { getChatAutocomplete, AutocompleteSuggestion } from '../utils/ai-api';

interface TaggingInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTagSelect?: (tag: AutocompleteSuggestion) => void;
  disabled?: boolean;
  placeholder?: string;
}

const TaggingInput: React.FC<TaggingInputProps> = ({
  value,
  onChange,
  onSend,
  onTagSelect,
  disabled = false,
  placeholder = "Ask about your portfolio..."
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentTag, setCurrentTag] = useState<{ type: string; query: string; startPos: number } | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce function for autocomplete
  const debounce = (func: (query: string, tagType: string) => Promise<void>, delay: number) => {
    let timeoutId: number;
    return (query: string, tagType: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(query, tagType), delay);
    };
  };

  // Parse current tag at cursor position
  const parseCurrentTag = (text: string, position: number) => {
    // Look for @ tags
    const atMatch = text.slice(0, position).match(/@([a-zA-Z0-9_\s]*)$/);
    if (atMatch) {
      return {
        type: '@',
        query: atMatch[1],
        startPos: position - atMatch[0].length
      };
    }

    // Look for $ tags
    const dollarMatch = text.slice(0, position).match(/\$([A-Z]*)$/);
    if (dollarMatch) {
      return {
        type: '$',
        query: dollarMatch[1],
        startPos: position - dollarMatch[0].length
      };
    }

    return null;
  };

  // Fetch autocomplete suggestions
  const fetchSuggestions = async (query: string, tagType: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const results = await getChatAutocomplete(query, tagType);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newPosition = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(newPosition);

    // Parse current tag
    const tag = parseCurrentTag(newValue, newPosition);
    setCurrentTag(tag);

    if (tag) {
      debouncedFetchSuggestions(tag.query, tag.type);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    if (!currentTag) return;

    const beforeTag = value.slice(0, currentTag.startPos);
    const afterTag = value.slice(cursorPosition);
    
    // For @ tags, use the display name but store the ID in a data attribute
    // For $ tags, use the symbol
    const displayName = currentTag.type === '@' ? suggestion.name : (suggestion.symbol || suggestion.name);
    
    const newValue = beforeTag + currentTag.type + displayName + afterTag;
    onChange(newValue);

    // Call onTagSelect callback to track selected tags
    if (onTagSelect) {
      onTagSelect(suggestion);
    }

    // Set cursor position after the inserted tag
    const newPosition = currentTag.startPos + currentTag.type.length + displayName.length;
    
    // Focus input and set cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);

    setShowSuggestions(false);
    setCurrentTag(null);
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        // Select first suggestion
        handleSuggestionClick(suggestions[0]);
      } else {
        onSend();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setCurrentTag(null);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setCurrentTag(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
      />
      
      {/* Autocomplete Suggestions */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.id}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200 border-b border-gray-600 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-400 font-medium">
                    {currentTag?.type === '@' ? '@' : '$'}
                  </span>
                  <span className="font-medium">
                    {suggestion.symbol || suggestion.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                    {suggestion.type}
                  </span>
                  {suggestion.symbol && (
                    <span className="text-xs text-gray-400">
                      {suggestion.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaggingInput; 