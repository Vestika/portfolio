import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { TagDefinition, TagValue, HoldingTags, TagLibrary, TagType } from '../types';
import TagEditor from './TagEditor';
import TagDisplay from './TagDisplay';
import TagAPI from '../utils/tag-api';
import { Edit, Plus, Trash2, Tag } from 'lucide-react';

interface HoldingTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  portfolioId?: string;
  onTagsUpdated?: () => void;
}

const HoldingTagManager: React.FC<HoldingTagManagerProps> = ({
  isOpen,
  onClose,
  symbol,
  portfolioId,
  onTagsUpdated
}) => {
  const [tagLibrary, setTagLibrary] = useState<TagLibrary | null>(null);
  const [holdingTags, setHoldingTags] = useState<HoldingTags | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState<{ definition: TagDefinition; value?: TagValue } | null>(null);

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, symbol, portfolioId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [library, tags] = await Promise.all([
        TagAPI.getUserTagLibrary(),
        TagAPI.getHoldingTags(symbol, portfolioId)
      ]);
      setTagLibrary(library);
      setHoldingTags(tags);
    } catch (error) {
      console.error('Error loading tag data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = (tagName: string) => {
    if (!tagLibrary) return;
    
    const tagDefinition = tagLibrary.tag_definitions[tagName] || tagLibrary.template_tags[tagName];
    if (tagDefinition) {
      setEditingTag({ definition: tagDefinition });
    }
  };

  const handleEditTag = (tagName: string) => {
    if (!tagLibrary || !holdingTags) return;

    const tagDefinition = tagLibrary.tag_definitions[tagName] || tagLibrary.template_tags[tagName];
    const tagValue = holdingTags.tags[tagName];
    
    if (tagDefinition && tagValue) {
      setEditingTag({ definition: tagDefinition, value: tagValue });
    }
  };

  const handleSaveTag = async (tagValue: TagValue) => {
    try {
      const updatedTags = await TagAPI.setHoldingTag(symbol, tagValue.tag_name, tagValue, portfolioId);
      setHoldingTags(updatedTags);
      onTagsUpdated?.();
    } catch (error) {
      console.error('Error saving tag:', error);
      throw error;
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!confirm(`Are you sure you want to remove the tag "${tagName}"?`)) return;

    try {
      await TagAPI.removeHoldingTag(symbol, tagName, portfolioId);
      if (holdingTags) {
        const updatedTags = { ...holdingTags };
        delete updatedTags.tags[tagName];
        setHoldingTags(updatedTags);
        onTagsUpdated?.();
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const getAvailableTags = (): TagDefinition[] => {
    if (!tagLibrary || !holdingTags) return [];
    
    const allDefinitions = { ...tagLibrary.template_tags, ...tagLibrary.tag_definitions };
    const usedTagNames = Object.keys(holdingTags.tags);
    
    return Object.values(allDefinitions).filter(def => !usedTagNames.includes(def.name));
  };

  const getCurrentTags = (): Array<{ definition: TagDefinition; value: TagValue }> => {
    if (!tagLibrary || !holdingTags) return [];
    
    const allDefinitions = { ...tagLibrary.template_tags, ...tagLibrary.tag_definitions };
    
    return Object.entries(holdingTags.tags)
      .map(([tagName, tagValue]) => ({
        definition: allDefinitions[tagName],
        value: tagValue
      }))
      .filter(item => item.definition);
  };

  const getTagTypeIcon = (tagType: TagType) => {
    switch (tagType) {
      case TagType.ENUM: return '🏷️';
      case TagType.MAP: return '🗺️';
      case TagType.SCALAR: return '📊';
      case TagType.HIERARCHICAL: return '🌳';
      case TagType.BOOLEAN: return '✅';
      case TagType.TIME_BASED: return '⏰';
      case TagType.RELATIONSHIP: return '🔗';
      default: return '🏷️';
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-800 border-gray-600 text-gray-200 max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-400">Loading tags...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-800 border-gray-600 text-gray-200 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-200">
              <Tag size={20} />
              Manage Tags for {symbol}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add, edit, or remove tags for this holding. Tags help organize and analyze your portfolio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Tags */}
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-3">Current Tags</h3>
              {getCurrentTags().length === 0 ? (
                <div className="text-center p-8 text-gray-500 bg-gray-700/20 rounded-lg">
                  <Tag size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No tags assigned to this holding</p>
                  <p className="text-sm">Add tags below to organize and categorize this investment</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getCurrentTags().map(({ definition, value }) => (
                    <Card key={definition.name} className="bg-gray-700/20 border-gray-600/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getTagTypeIcon(definition.tag_type)}</span>
                            <div>
                              <CardTitle className="text-sm text-gray-200">{definition.display_name}</CardTitle>
                              <CardDescription className="text-xs">{definition.description}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTag(definition.name)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveTag(definition.name)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <TagDisplay
                          tags={{ [definition.name]: value }}
                          maxTags={1}
                          compact={false}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Tag */}
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-3">Add New Tag</h3>
              {getAvailableTags().length === 0 ? (
                <div className="text-center p-6 text-gray-500 bg-gray-700/20 rounded-lg">
                  <p>All available tags are already assigned to this holding</p>
                  <p className="text-sm">Create new tag definitions in your tag library to add more tags</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getAvailableTags().map((definition) => (
                    <Card 
                      key={definition.name} 
                      className="bg-gray-700/20 border-gray-600/30 cursor-pointer hover:bg-gray-700/30 transition-colors"
                      onClick={() => handleAddTag(definition.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getTagTypeIcon(definition.tag_type)}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-200 truncate">{definition.display_name}</h4>
                            <p className="text-xs text-gray-400 truncate">{definition.description}</p>
                            <Badge variant="outline" className="mt-1 text-xs bg-gray-600/20 text-gray-300 border-gray-500/30">
                              {definition.tag_type}
                            </Badge>
                          </div>
                          <Plus size={16} className="text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Editor Dialog */}
      {editingTag && (
        <TagEditor
          isOpen={true}
          onClose={() => setEditingTag(null)}
          onSave={handleSaveTag}
          tagDefinition={editingTag.definition}
          initialValue={editingTag.value}
          symbol={symbol}
        />
      )}
    </>
  );
};

export default HoldingTagManager; 