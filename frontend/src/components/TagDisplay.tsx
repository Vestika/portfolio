import React from 'react';
import { Badge } from './ui/badge';
import { TagValue, TagType } from '../types';

interface TagDisplayProps {
  tags: Record<string, TagValue>;
  maxTags?: number;
  compact?: boolean;
  onTagClick?: (tagName: string, tagValue: TagValue) => void;
}

const TagDisplay: React.FC<TagDisplayProps> = ({ 
  tags, 
  maxTags = 5, 
  compact = false,
  onTagClick 
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

        return (
          <Badge
            key={tagName}
            variant="outline"
            className={`${getTagColor(tagValue)} cursor-pointer hover:opacity-80 transition-opacity text-xs`}
            onClick={() => onTagClick?.(tagName, tagValue)}
            title={`${formatTagName(tagName)}: ${displayValue}`}
          >
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