import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Check, ChevronDown } from 'lucide-react';

export interface ComboBoxOption {
  value: string;
  label: string;
}

interface ComboBoxProps {
  options: ComboBoxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowCustom?: boolean;
  emptyMessage?: string;
}

export const ComboBox: React.FC<ComboBoxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  className,
  disabled = false,
  allowCustom = true,
  emptyMessage = 'No options available'
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search when dropdown opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightedIndex(-1);
    }
  }, [open]);

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption?.label || value || '';

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setSearch('');
  };

  const handleCustomInput = () => {
    if (allowCustom && search.trim()) {
      onChange(search.trim());
      setOpen(false);
      setSearch('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (allowCustom && search.trim()) {
        handleCustomInput();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          onClick={() => !disabled && setOpen(true)}
        >
          <span className={cn(!displayValue && 'text-gray-400')}>
            {displayValue || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-gray-800 border-gray-600"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex flex-col">
          {/* Search/Custom Input */}
          <div className="p-2 border-b border-gray-700">
            <input
              ref={inputRef}
              type="text"
              placeholder={allowCustom ? 'Search or type custom value...' : 'Search...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'flex h-9 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white',
                'placeholder:text-gray-400',
                'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
              )}
              autoComplete="off"
            />
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                {search && allowCustom ? (
                  <button
                    type="button"
                    className="text-blue-400 hover:text-blue-300"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCustomInput();
                    }}
                  >
                    Use "{search}"
                  </button>
                ) : (
                  emptyMessage
                )}
              </div>
            ) : (
              <div className="p-1">
                {filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-white outline-none transition-colors',
                      'hover:bg-gray-700',
                      highlightedIndex === index && 'bg-gray-700',
                      option.value === value && 'bg-blue-900/30'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(option.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        option.value === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom value hint */}
          {allowCustom && search && filteredOptions.length > 0 && (
            <div className="border-t border-gray-700 p-2 text-xs text-gray-400 text-center">
              Press Enter to use custom value "{search}"
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};