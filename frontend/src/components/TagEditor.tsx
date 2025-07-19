import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { TagDefinition, TagValue, TagType, ScalarDataType } from '../types';
import { X, Plus, Minus } from 'lucide-react';

interface TagEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tagValue: TagValue) => Promise<void>;
  tagDefinition: TagDefinition;
  initialValue?: TagValue;
  symbol: string;
}

const TagEditor: React.FC<TagEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  tagDefinition,
  initialValue,
  symbol
}) => {
  const [value, setValue] = useState<TagValue>(() => ({
    tag_name: tagDefinition.name,
    tag_type: tagDefinition.tag_type,
    ...initialValue
  }));

  const [isSaving, setIsSaving] = useState(false);

  // Reset value when tag definition or initial value changes
  useEffect(() => {
    setValue({
      tag_name: tagDefinition.name,
      tag_type: tagDefinition.tag_type,
      ...initialValue
    });
  }, [tagDefinition, initialValue]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(value);
      onClose();
    } catch (error) {
      console.error('Error saving tag:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderEnumEditor = () => (
    <div className="space-y-2">
      <Label>Select Value</Label>
      <Select 
        value={value.enum_value || ""} 
        onValueChange={(val) => setValue(prev => ({ ...prev, enum_value: val }))}
      >
        <SelectTrigger className="bg-gray-700/30 border-gray-600/30">
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          {tagDefinition.enum_values?.map((option) => (
            <SelectItem key={option} value={option} className="text-gray-200">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderMapEditor = () => {
    const mapValue = value.map_value || {};
    
    const addKey = (key: string) => {
      setValue(prev => ({
        ...prev,
        map_value: { ...mapValue, [key]: 0 }
      }));
    };

    const updateValue = (key: string, val: number) => {
      setValue(prev => ({
        ...prev,
        map_value: { ...mapValue, [key]: val }
      }));
    };

    const removeKey = (key: string) => {
      const newMap = { ...mapValue };
      delete newMap[key];
      setValue(prev => ({ ...prev, map_value: newMap }));
    };

    return (
      <div className="space-y-4">
        <Label>Map Values ({tagDefinition.map_key_type})</Label>
        
        {Object.entries(mapValue).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400/30">
              {key}
            </Badge>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={val}
              onChange={(e) => updateValue(key, parseFloat(e.target.value))}
              className="flex-1 bg-gray-700/30 border-gray-600/30 text-gray-200"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeKey(key)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </Button>
          </div>
        ))}

        {tagDefinition.allowed_keys && (
          <div className="flex flex-wrap gap-2">
            {tagDefinition.allowed_keys
              .filter(key => !(key in mapValue))
              .map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => addKey(key)}
                  className="text-gray-300 hover:text-gray-100"
                >
                  <Plus size={14} className="mr-1" />
                  {key}
                </Button>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderScalarEditor = () => {
    const inputType = tagDefinition.scalar_data_type === ScalarDataType.DATE ? 'date' :
                     ['float', 'integer', 'percentage', 'currency'].includes(tagDefinition.scalar_data_type!) ? 'number' : 'text';

    return (
      <div className="space-y-2">
        <Label>
          Value
          {tagDefinition.scalar_data_type === ScalarDataType.PERCENTAGE && ' (%)'}
          {tagDefinition.scalar_data_type === ScalarDataType.CURRENCY && ' ($)'}
        </Label>
        <Input
          type={inputType}
          value={value.scalar_value || ""}
          onChange={(e) => setValue(prev => ({ 
            ...prev, 
            scalar_value: inputType === 'number' ? parseFloat(e.target.value) : e.target.value 
          }))}
          min={tagDefinition.min_value}
          max={tagDefinition.max_value}
          step={tagDefinition.scalar_data_type === ScalarDataType.PERCENTAGE ? "0.1" : "0.01"}
          className="bg-gray-700/30 border-gray-600/30 text-gray-200"
        />
        {(tagDefinition.min_value !== undefined || tagDefinition.max_value !== undefined) && (
          <p className="text-xs text-gray-400">
            Range: {tagDefinition.min_value ?? 'no min'} - {tagDefinition.max_value ?? 'no max'}
          </p>
        )}
      </div>
    );
  };

  const renderHierarchicalEditor = () => {
    const hierarchicalValue = value.hierarchical_value || [];
    const separator = tagDefinition.path_separator || ' > ';

    const addLevel = () => {
      setValue(prev => ({
        ...prev,
        hierarchical_value: [...hierarchicalValue, ""]
      }));
    };

    const updateLevel = (index: number, val: string) => {
      const newValue = [...hierarchicalValue];
      newValue[index] = val;
      setValue(prev => ({ ...prev, hierarchical_value: newValue }));
    };

    const removeLevel = (index: number) => {
      const newValue = hierarchicalValue.filter((_, i) => i !== index);
      setValue(prev => ({ ...prev, hierarchical_value: newValue }));
    };

    return (
      <div className="space-y-4">
        <Label>Hierarchical Path</Label>
        
        {hierarchicalValue.map((level, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Level {index + 1}</span>
            <Input
              value={level}
              onChange={(e) => updateLevel(index, e.target.value)}
              placeholder={`Enter level ${index + 1}...`}
              className="flex-1 bg-gray-700/30 border-gray-600/30 text-gray-200"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeLevel(index)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={addLevel}
            disabled={tagDefinition.max_depth ? hierarchicalValue.length >= tagDefinition.max_depth : false}
            className="text-gray-300 hover:text-gray-100"
          >
            <Plus size={14} className="mr-1" />
            Add Level
          </Button>
          
          {hierarchicalValue.length > 0 && (
            <div className="text-sm text-gray-400">
              Preview: {hierarchicalValue.join(separator)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBooleanEditor = () => (
    <div className="space-y-2">
      <Label>Value</Label>
      <Select 
        value={value.boolean_value?.toString() || ""} 
        onValueChange={(val) => setValue(prev => ({ ...prev, boolean_value: val === "true" }))}
      >
        <SelectTrigger className="bg-gray-700/30 border-gray-600/30">
          <SelectValue placeholder="Select true or false..." />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          <SelectItem value="true" className="text-gray-200">Yes / True</SelectItem>
          <SelectItem value="false" className="text-gray-200">No / False</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const renderTimeBasedEditor = () => {
    const timeValue = value.time_value || {};

    if (tagDefinition.time_format === "YYYY-MM-DD") {
      return (
        <div className="space-y-2">
          <Label>Date</Label>
          <Input
            type="date"
            value={timeValue.date || ""}
            onChange={(e) => setValue(prev => ({ 
              ...prev, 
              time_value: { ...timeValue, date: e.target.value }
            }))}
            className="bg-gray-700/30 border-gray-600/30 text-gray-200"
          />
        </div>
      );
    }

    if (tagDefinition.time_format === "frequency") {
      return (
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select 
            value={timeValue.frequency || ""} 
            onValueChange={(val) => setValue(prev => ({ 
              ...prev, 
              time_value: { ...timeValue, frequency: val }
            }))}
          >
            <SelectTrigger className="bg-gray-700/30 border-gray-600/30">
              <SelectValue placeholder="Select frequency..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="daily" className="text-gray-200">Daily</SelectItem>
              <SelectItem value="weekly" className="text-gray-200">Weekly</SelectItem>
              <SelectItem value="monthly" className="text-gray-200">Monthly</SelectItem>
              <SelectItem value="quarterly" className="text-gray-200">Quarterly</SelectItem>
              <SelectItem value="annually" className="text-gray-200">Annually</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Label>Date Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-sm">Start Date</Label>
            <Input
              type="date"
              value={timeValue.start_date || ""}
              onChange={(e) => setValue(prev => ({ 
                ...prev, 
                time_value: { ...timeValue, start_date: e.target.value }
              }))}
              className="bg-gray-700/30 border-gray-600/30 text-gray-200"
            />
          </div>
          <div>
            <Label className="text-sm">End Date</Label>
            <Input
              type="date"
              value={timeValue.end_date || ""}
              onChange={(e) => setValue(prev => ({ 
                ...prev, 
                time_value: { ...timeValue, end_date: e.target.value }
              }))}
              className="bg-gray-700/30 border-gray-600/30 text-gray-200"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderRelationshipEditor = () => {
    const relationshipValue = value.relationship_value || [];

    const addSymbol = () => {
      setValue(prev => ({
        ...prev,
        relationship_value: [...relationshipValue, ""]
      }));
    };

    const updateSymbol = (index: number, val: string) => {
      const newValue = [...relationshipValue];
      newValue[index] = val.toUpperCase();
      setValue(prev => ({ ...prev, relationship_value: newValue }));
    };

    const removeSymbol = (index: number) => {
      const newValue = relationshipValue.filter((_, i) => i !== index);
      setValue(prev => ({ ...prev, relationship_value: newValue }));
    };

    return (
      <div className="space-y-4">
        <Label>Related Symbols ({tagDefinition.relationship_type})</Label>
        
        {relationshipValue.map((symbol, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={symbol}
              onChange={(e) => updateSymbol(index, e.target.value)}
              placeholder="Enter symbol (e.g., AAPL)..."
              className="flex-1 bg-gray-700/30 border-gray-600/30 text-gray-200"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeSymbol(index)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addSymbol}
          className="text-gray-300 hover:text-gray-100"
        >
          <Plus size={14} className="mr-1" />
          Add Symbol
        </Button>
      </div>
    );
  };

  const renderEditor = () => {
    switch (tagDefinition.tag_type) {
      case TagType.ENUM:
        return renderEnumEditor();
      case TagType.MAP:
        return renderMapEditor();
      case TagType.SCALAR:
        return renderScalarEditor();
      case TagType.HIERARCHICAL:
        return renderHierarchicalEditor();
      case TagType.BOOLEAN:
        return renderBooleanEditor();
      case TagType.TIME_BASED:
        return renderTimeBasedEditor();
      case TagType.RELATIONSHIP:
        return renderRelationshipEditor();
      default:
        return <div>Unknown tag type</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-600 text-gray-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blue-200">
            Edit Tag: {tagDefinition.display_name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {tagDefinition.description}
            <br />
            <span className="text-sm font-mono text-gray-500">Symbol: {symbol}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {renderEditor()}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="text-gray-300 hover:text-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? 'Saving...' : 'Save Tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TagEditor; 