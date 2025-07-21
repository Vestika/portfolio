import React from 'react';
import { Badge } from './ui/badge';
import { TagValue, TagType } from '../types';
import { X } from 'lucide-react';

interface TagDisplayProps {
  tags: Record<string, TagValue>;
  maxTags?: number;
  compact?: boolean;
  onTagClick?: (tagName: string, tagValue: TagValue) => void;
  activeFilter?: string | null;
  onRemoveTag?: (tagName: string) => void; // Add remove callback
  showRemoveButtons?: boolean; // Control when to show remove buttons
}

const TagDisplay: React.FC<TagDisplayProps> = ({ 
  tags, 
  maxTags = 5, 
  compact = false,
  onTagClick,
  activeFilter,
  onRemoveTag,
  showRemoveButtons = false
}) => {
  const tagEntries = Object.entries(tags);
  const displayTags = maxTags && maxTags > 0 ? tagEntries.slice(0, maxTags) : tagEntries;
  const hiddenCount = tagEntries.length - displayTags.length;

  const getTagDisplayValue = (tagValue: TagValue): string => {
    switch (tagValue.tag_type) {
      case TagType.ENUM:
        return tagValue.enum_value || '';
      
      case TagType.MAP:
        if (!tagValue.map_value) return '';
        if (compact) {
          const entries = Object.entries(tagValue.map_value);
          if (entries.length === 1) {
            const [key, value] = entries[0];
            return `${key}: ${(value * 100).toFixed(0)}%`;
          }
          return `${entries.length} entries`;
        }
        return Object.entries(tagValue.map_value)
          .map(([key, value]) => `${key}: ${(value * 100).toFixed(0)}%`)
          .join(', ');
      
      case TagType.SCALAR:
        if (tagValue.scalar_value === undefined || tagValue.scalar_value === null) return '';
        return String(tagValue.scalar_value);
      
      case TagType.HIERARCHICAL:
        if (!tagValue.hierarchical_value || tagValue.hierarchical_value.length === 0) return '';
        if (compact && tagValue.hierarchical_value.length > 2) {
          return `${tagValue.hierarchical_value[0]} > ... > ${tagValue.hierarchical_value[tagValue.hierarchical_value.length - 1]}`;
        }
        return tagValue.hierarchical_value.join(' > ');
      
      case TagType.BOOLEAN:
        return tagValue.boolean_value ? 'Yes' : 'No';
      
      case TagType.TIME_BASED:
        if (!tagValue.time_value) return '';
        if (tagValue.time_value.date) return tagValue.time_value.date;
        if (tagValue.time_value.frequency) return tagValue.time_value.frequency;
        if (tagValue.time_value.start_date && tagValue.time_value.end_date) {
          return compact 
            ? `${tagValue.time_value.start_date} - ${tagValue.time_value.end_date}`
            : `${tagValue.time_value.start_date} to ${tagValue.time_value.end_date}`;
        }
        return JSON.stringify(tagValue.time_value);
      
      case TagType.RELATIONSHIP:
        if (!tagValue.relationship_value || tagValue.relationship_value.length === 0) return '';
        if (compact && tagValue.relationship_value.length > 2) {
          return `${tagValue.relationship_value[0]} +${tagValue.relationship_value.length - 1}`;
        }
        return tagValue.relationship_value.join(', ');
      
      default:
        return '';
    }
  };

  const getTagColor = (tagValue: TagValue): string => {
    switch (tagValue.tag_type) {
      case TagType.ENUM:
        return 'bg-blue-500/20 text-blue-200 border-blue-400/30';
      case TagType.MAP:
        return 'bg-green-500/20 text-green-200 border-green-400/30';
      case TagType.SCALAR:
        return 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30';
      case TagType.HIERARCHICAL:
        return 'bg-purple-500/20 text-purple-200 border-purple-400/30';
      case TagType.BOOLEAN:
        return tagValue.boolean_value 
          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
          : 'bg-gray-500/20 text-gray-200 border-gray-400/30';
      case TagType.TIME_BASED:
        return 'bg-orange-500/20 text-orange-200 border-orange-400/30';
      case TagType.RELATIONSHIP:
        return 'bg-pink-500/20 text-pink-200 border-pink-400/30';
      default:
        return 'bg-gray-500/20 text-gray-200 border-gray-400/30';
    }
  };

  const formatTagName = (tagName: string): string => {
    return tagName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleTagClick = (tagName: string, tagValue: TagValue) => {
    // Always allow tag clicking for filtering, regardless of remove buttons
    if (onTagClick) {
      onTagClick(tagName, tagValue);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, tagName: string) => {
    e.stopPropagation();
    onRemoveTag?.(tagName);
  };

  if (tagEntries.length === 0) {
    return (
      <span className="text-xs text-gray-500 italic">No tags</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map(([tagName, tagValue]) => {
        const displayValue = getTagDisplayValue(tagValue);
        if (!displayValue) return null;

        const isActive = activeFilter === tagName;
        
        return (
          <Badge
            key={tagName}
            variant="outline"
            className={`${getTagColor(tagValue)} transition-all text-xs group ${
              showRemoveButtons 
                ? 'pr-1' // Less padding when showing remove button
                : (onTagClick ? 'cursor-pointer' : '')
            } ${
              isActive 
                ? 'ring-2 ring-blue-400 ring-opacity-60 shadow-lg scale-105' 
                : (!showRemoveButtons && onTagClick ? 'hover:opacity-80 hover:scale-105' : '')
            }`}
            onClick={() => handleTagClick(tagName, tagValue)}
            title={
              showRemoveButtons 
                ? `${formatTagName(tagName)}: ${displayValue}${isActive ? ' (Click to clear filter)' : (onTagClick ? ' (Click to filter)' : '')}` 
                : `${formatTagName(tagName)}: ${displayValue}${isActive ? ' (Click to clear filter)' : (onTagClick ? ' (Click to filter)' : '')}`
            }
          >
            <div className="flex items-center gap-1">
              <div className="flex items-center">
                {compact ? (
                  <>
                    <span className="font-medium">{formatTagName(tagName).split(' ')[0]}</span>
                    {displayValue && (
                      <>
                        <span className="mx-1">:</span>
                        <span className="truncate max-w-16">{displayValue}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-medium">{formatTagName(tagName)}</span>
                    {displayValue && (
                      <>
                        <span className="mx-1">:</span>
                        <span>{displayValue}</span>
                      </>
                    )}
                  </>
                )}
              </div>
              
              {showRemoveButtons && onRemoveTag && (
                <button
                  onClick={(e) => handleRemoveClick(e, tagName)}
                  className="ml-1 p-0.5 rounded-full hover:bg-red-500/20 transition-colors opacity-60 hover:opacity-100"
                  title={`Remove ${formatTagName(tagName)} tag`}
                >
                  <X size={10} className="text-red-400" />
                </button>
              )}
            </div>
          </Badge>
        );
      })}
      
      {hiddenCount > 0 && (
        <Badge
          variant="outline"
          className="bg-gray-600/20 text-gray-300 border-gray-500/30 text-xs"
          title={`${hiddenCount} more tags`}
        >
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
};

export default TagDisplay; 