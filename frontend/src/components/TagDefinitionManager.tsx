import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { TagDefinition, TagType, ScalarDataType } from '../types';
import TagAPI from '../utils/tag-api';
import { Plus, X, Check, ArrowRight, Sparkles } from 'lucide-react';

interface TagDefinitionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tagDefinition: TagDefinition) => Promise<void>;
  onTemplateSelectedForImmediate?: (tagName: string) => Promise<void>;
  existingDefinition?: TagDefinition;
}

interface TemplateTagsResponse {
  templates: Record<string, TagDefinition>;
}

const TAG_TYPE_INFO = {
  [TagType.ENUM]: {
    name: "Categorical",
    description: "Choose from a predefined list of values",
    icon: "🏷️",
    examples: "Investment strategy, Sector, Risk level"
  },
  [TagType.MAP]: {
    name: "Weighted Exposure",
    description: "Key-value pairs with percentage weights",
    icon: "🗺️",
    examples: "Geographic exposure, ESG factors, Sector allocation"
  },
  [TagType.SCALAR]: {
    name: "Single Value",
    description: "A single number, percentage, or date",
    icon: "📊",
    examples: "Risk score, Annual dividend, Target price"
  },
  [TagType.HIERARCHICAL]: {
    name: "Hierarchical Path",
    description: "Nested categories with multiple levels",
    icon: "🌳",
    examples: "Investment goals, Strategy classification"
  },
  [TagType.BOOLEAN]: {
    name: "Yes/No Flag",
    description: "Simple true/false value",
    icon: "✅",
    examples: "ESG compliant, Tax deferred, Under restriction"
  },
  [TagType.TIME_BASED]: {
    name: "Time/Date",
    description: "Dates, frequencies, or time periods",
    icon: "⏰",
    examples: "Hold until date, Review frequency, Purchase date"
  },
  [TagType.RELATIONSHIP]: {
    name: "Related Holdings",
    description: "Links to other symbols in your portfolio",
    icon: "🔗",
    examples: "Hedged by, Strategy group, Underlying asset"
  }
};

const SCALAR_TYPE_INFO = {
  [ScalarDataType.FLOAT]: "Decimal number (e.g., 2.5, 10.75)",
  [ScalarDataType.INTEGER]: "Whole number (e.g., 1, 5, 10)",
  [ScalarDataType.PERCENTAGE]: "Percentage value (e.g., 3.5%)",
  [ScalarDataType.CURRENCY]: "Money amount (e.g., $250.00)",
  [ScalarDataType.DATE]: "Date value (e.g., 2024-12-31)",
  [ScalarDataType.STRING]: "Text value (e.g., 'Growth Stock')"
};

const TagDefinitionManager: React.FC<TagDefinitionManagerProps> = ({
  isOpen,
  onClose,
  onSave,
  onTemplateSelectedForImmediate,
  existingDefinition
}) => {
  const [step, setStep] = useState<'type' | 'template' | 'config'>('type');
  const [selectedType, setSelectedType] = useState<TagType | null>(null);
  const [templateTags, setTemplateTags] = useState<Record<string, TagDefinition>>({});
  const [definition, setDefinition] = useState<Partial<TagDefinition>>({
    name: '',
    display_name: '',
    description: '',
    tag_type: TagType.ENUM,
    ...existingDefinition
  });
  const [enumValues, setEnumValues] = useState<string[]>(existingDefinition?.enum_values || []);
  const [mapKeys, setMapKeys] = useState<string[]>(existingDefinition?.allowed_keys || []);
  const [isSaving, setIsSaving] = useState(false);

  // Load template tags when component opens
  React.useEffect(() => {
    if (isOpen && Object.keys(templateTags).length === 0) {
      TagAPI.getTemplateTags().then(response => {
        setTemplateTags(response.templates);
      }).catch(error => {
        console.error('Error loading template tags:', error);
      });
    }
  }, [isOpen, templateTags]);

  const resetForm = () => {
    setStep('type');
    setSelectedType(null);
    setDefinition({
      name: '',
      display_name: '',
      description: '',
      tag_type: TagType.ENUM
    });
    setEnumValues([]);
    setMapKeys([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTypeSelect = (type: TagType) => {
    setSelectedType(type);
    setDefinition(prev => ({ ...prev, tag_type: type }));
    setStep('template');
  };

  const handleTemplateSelect = async (template: TagDefinition) => {
    setIsSaving(true);
    try {
      // Use template as-is without modification
      const templateDefinition: TagDefinition = {
        ...template,
        name: template.name, // Keep the original template name
        user_id: 'current_user', // This will be set by the API
      };

      await onSave(templateDefinition);
      
      // If we have a callback for immediate use, call it instead of just closing
      if (onTemplateSelectedForImmediate) {
        await onTemplateSelectedForImmediate(template.name);
      }
      
      handleClose();
    } catch (error) {
      console.error('Error saving template tag:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipTemplates = () => {
    setStep('config');
  };

  const getRelevantTemplates = (): TagDefinition[] => {
    if (!selectedType) return [];
    return Object.values(templateTags).filter(template => template.tag_type === selectedType);
  };

  const addEnumValue = () => {
    setEnumValues([...enumValues, '']);
  };

  const updateEnumValue = (index: number, value: string) => {
    const newValues = [...enumValues];
    newValues[index] = value;
    setEnumValues(newValues);
  };

  const removeEnumValue = (index: number) => {
    setEnumValues(enumValues.filter((_, i) => i !== index));
  };

  const addMapKey = () => {
    setMapKeys([...mapKeys, '']);
  };

  const updateMapKey = (index: number, value: string) => {
    const newKeys = [...mapKeys];
    newKeys[index] = value;
    setMapKeys(newKeys);
  };

  const removeMapKey = (index: number) => {
    setMapKeys(mapKeys.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalDefinition: TagDefinition = {
        ...definition,
        name: definition.name!,
        display_name: definition.display_name!,
        tag_type: definition.tag_type!,
        user_id: 'current_user', // This will be set by the API
        enum_values: selectedType === TagType.ENUM ? enumValues.filter(v => v.trim()) : undefined,
        allowed_keys: selectedType === TagType.MAP ? mapKeys.filter(k => k.trim()) : undefined,
      } as TagDefinition;

      await onSave(finalDefinition);
      handleClose();
    } catch (error) {
      console.error('Error saving tag definition:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTypeSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Choose Tag Type</h3>
        <p className="text-sm text-gray-400">Select the type of data this tag will store</p>
      </div>
      
      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
        {Object.entries(TAG_TYPE_INFO).map(([type, info]) => (
          <Card 
            key={type}
            className="bg-gray-700/20 border-gray-600/30 cursor-pointer hover:bg-gray-700/40 transition-colors"
            onClick={() => handleTypeSelect(type as TagType)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{info.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-200">{info.name}</h4>
                  <p className="text-sm text-gray-400 mb-1">{info.description}</p>
                  <p className="text-xs text-gray-500">Examples: {info.examples}</p>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderTemplateSelection = () => {
    const relevantTemplates = getRelevantTemplates();
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep('type')}
            disabled={isSaving}
            className="text-gray-400"
          >
            ← Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{TAG_TYPE_INFO[selectedType!]?.icon}</span>
            <h3 className="text-lg font-semibold text-gray-200">
              Choose Template or Create Custom
            </h3>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-400">
            {onTemplateSelectedForImmediate 
              ? `Templates will be added and configured for this holding, or create a custom ${TAG_TYPE_INFO[selectedType!]?.name.toLowerCase()} tag`
              : `Templates will be added as-is, or create a custom ${TAG_TYPE_INFO[selectedType!]?.name.toLowerCase()} tag`
            }
          </p>
        </div>

        {relevantTemplates.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-yellow-400" />
              <h4 className="font-medium text-gray-200">Available Templates</h4>
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
              {relevantTemplates.map((template) => (
                <Card 
                  key={template.name}
                  className={`bg-gray-700/20 border-gray-600/30 transition-colors ${
                    isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700/40'
                  }`}
                  onClick={() => !isSaving && handleTemplateSelect(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{TAG_TYPE_INFO[template.tag_type]?.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-200">{template.display_name}</h4>
                        <p className="text-sm text-gray-400">{template.description}</p>
                        <Badge variant="outline" className="mt-1 text-xs bg-yellow-600/20 text-yellow-300 border-yellow-400/30">
                          Template
                        </Badge>
                      </div>
                      {isSaving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      ) : (
                        <ArrowRight size={16} className="text-gray-400" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-600/30 pt-4">
          <Card 
            className={`bg-gray-700/20 border-gray-600/30 transition-colors border-dashed ${
              isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700/40'
            }`}
            onClick={() => !isSaving && handleSkipTemplates()}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-center">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Plus size={16} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-400">Create Custom {TAG_TYPE_INFO[selectedType!]?.name}</h4>
                  <p className="text-xs text-gray-400">Define your own configuration</p>
                </div>
                <ArrowRight size={16} className="text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderTypeSpecificConfig = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case TagType.ENUM:
        return (
          <div className="space-y-4">
            <Label>Allowed Values</Label>
            {enumValues.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={value}
                  onChange={(e) => updateEnumValue(index, e.target.value)}
                  placeholder="Enter option..."
                  className="flex-1 bg-gray-700/30 border-gray-600/30 text-gray-200"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeEnumValue(index)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addEnumValue}
              className="text-gray-300 hover:text-gray-100"
            >
              <Plus size={14} className="mr-1" />
              Add Option
            </Button>
          </div>
        );

      case TagType.MAP:
        return (
          <div className="space-y-4">
            <div>
              <Label>Key Type Description</Label>
              <Input
                value={definition.map_key_type || ''}
                onChange={(e) => setDefinition(prev => ({ ...prev, map_key_type: e.target.value }))}
                placeholder="e.g., 'country', 'sector', 'factor'"
                className="bg-gray-700/30 border-gray-600/30 text-gray-200"
              />
            </div>
            <div>
              <Label>Allowed Keys (Optional)</Label>
              {mapKeys.map((key, index) => (
                <div key={index} className="flex items-center gap-2 mt-2">
                  <Input
                    value={key}
                    onChange={(e) => updateMapKey(index, e.target.value)}
                    placeholder="Enter key..."
                    className="flex-1 bg-gray-700/30 border-gray-600/30 text-gray-200"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeMapKey(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addMapKey}
                className="text-gray-300 hover:text-gray-100 mt-2"
              >
                <Plus size={14} className="mr-1" />
                Add Key
              </Button>
            </div>
          </div>
        );

      case TagType.SCALAR:
        return (
          <div className="space-y-4">
            <div>
              <Label>Data Type</Label>
              <Select 
                value={definition.scalar_data_type || ''} 
                onValueChange={(value) => setDefinition(prev => ({ ...prev, scalar_data_type: value as ScalarDataType }))}
              >
                <SelectTrigger className="bg-gray-700/30 border-gray-600/30">
                  <SelectValue placeholder="Select data type..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {Object.entries(SCALAR_TYPE_INFO).map(([type, description]) => (
                    <SelectItem key={type} value={type} className="text-gray-200">
                      <div>
                        <div className="font-medium">{type}</div>
                        <div className="text-xs text-gray-400">{description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {definition.scalar_data_type && ['float', 'integer', 'percentage', 'currency'].includes(definition.scalar_data_type) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Minimum Value (Optional)</Label>
                  <Input
                    type="number"
                    value={definition.min_value || ''}
                    onChange={(e) => setDefinition(prev => ({ ...prev, min_value: parseFloat(e.target.value) }))}
                    placeholder="No minimum"
                    className="bg-gray-700/30 border-gray-600/30 text-gray-200"
                  />
                </div>
                <div>
                  <Label>Maximum Value (Optional)</Label>
                  <Input
                    type="number"
                    value={definition.max_value || ''}
                    onChange={(e) => setDefinition(prev => ({ ...prev, max_value: parseFloat(e.target.value) }))}
                    placeholder="No maximum"
                    className="bg-gray-700/30 border-gray-600/30 text-gray-200"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case TagType.HIERARCHICAL:
        return (
          <div className="space-y-4">
            <div>
              <Label>Maximum Depth (Optional)</Label>
              <Input
                type="number"
                min="1"
                value={definition.max_depth || ''}
                onChange={(e) => setDefinition(prev => ({ ...prev, max_depth: parseInt(e.target.value) }))}
                placeholder="Unlimited depth"
                className="bg-gray-700/30 border-gray-600/30 text-gray-200"
              />
            </div>
            <div>
              <Label>Path Separator</Label>
              <Input
                value={definition.path_separator || ' > '}
                onChange={(e) => setDefinition(prev => ({ ...prev, path_separator: e.target.value }))}
                className="bg-gray-700/30 border-gray-600/30 text-gray-200"
              />
            </div>
          </div>
        );

      case TagType.TIME_BASED:
        return (
          <div className="space-y-4">
            <div>
              <Label>Time Format</Label>
              <Select 
                value={definition.time_format || ''} 
                onValueChange={(value) => setDefinition(prev => ({ ...prev, time_format: value }))}
              >
                <SelectTrigger className="bg-gray-700/30 border-gray-600/30">
                  <SelectValue placeholder="Select time format..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="YYYY-MM-DD" className="text-gray-200">Single Date (YYYY-MM-DD)</SelectItem>
                  <SelectItem value="frequency" className="text-gray-200">Frequency (daily, weekly, etc.)</SelectItem>
                  <SelectItem value="range" className="text-gray-200">Date Range (start to end)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case TagType.RELATIONSHIP:
        return (
          <div className="space-y-4">
            <div>
              <Label>Relationship Type</Label>
              <Input
                value={definition.relationship_type || ''}
                onChange={(e) => setDefinition(prev => ({ ...prev, relationship_type: e.target.value }))}
                placeholder="e.g., 'hedged_by', 'strategy_group', 'underlying'"
                className="bg-gray-700/30 border-gray-600/30 text-gray-200"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderConfiguration = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep('type')}
          className="text-gray-400"
        >
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{TAG_TYPE_INFO[selectedType!]?.icon}</span>
          <h3 className="text-lg font-semibold text-gray-200">
            Configure {TAG_TYPE_INFO[selectedType!]?.name} Tag
          </h3>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Tag Name *</Label>
          <Input
            value={definition.name || ''}
            onChange={(e) => setDefinition(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
            placeholder="e.g., investment_strategy"
            className="bg-gray-700/30 border-gray-600/30 text-gray-200"
          />
          <p className="text-xs text-gray-500 mt-1">Use lowercase with underscores (auto-formatted)</p>
        </div>

        <div>
          <Label>Display Name *</Label>
          <Input
            value={definition.display_name || ''}
            onChange={(e) => setDefinition(prev => ({ ...prev, display_name: e.target.value }))}
            placeholder="e.g., Investment Strategy"
            className="bg-gray-700/30 border-gray-600/30 text-gray-200"
          />
        </div>

        <div>
          <Label>Description (Optional)</Label>
          <Input
            value={definition.description || ''}
            onChange={(e) => setDefinition(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this tag represents..."
            className="bg-gray-700/30 border-gray-600/30 text-gray-200"
          />
        </div>

        {renderTypeSpecificConfig()}
      </div>
    </div>
  );

  const canSave = definition.name && definition.display_name && definition.tag_type;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-800 border-gray-600 text-gray-200 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-blue-200">
            {existingDefinition ? 'Edit Tag Definition' : 'Create Custom Tag'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 'type' && 'Choose the type of data this tag will store'}
            {step === 'template' && 'Use a template or create custom configuration'}
            {step === 'config' && 'Configure the tag properties and constraints'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'type' && renderTypeSelection()}
          {step === 'template' && renderTemplateSelection()}
          {step === 'config' && renderConfiguration()}
        </div>

        {step === 'config' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              className="text-gray-300 hover:text-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? 'Saving...' : existingDefinition ? 'Update Tag' : 'Create Tag'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TagDefinitionManager; 