import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { TagDefinition, TagValue, HoldingTags, TagLibrary, TagType } from '../types';
import TagEditor from './TagEditor';
import TagDisplay from './TagDisplay';
import TagDefinitionManager from './TagDefinitionManager';
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
  const [allHoldingTags, setAllHoldingTags] = useState<HoldingTags[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState<{ definition: TagDefinition; value?: TagValue } | null>(null);
  const [definitionManager, setDefinitionManager] = useState<{ isOpen: boolean; definition?: TagDefinition }>({ isOpen: false });

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, symbol, portfolioId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [library, tags, allTags] = await Promise.all([
        TagAPI.getUserTagLibrary(),
        TagAPI.getHoldingTags(symbol, portfolioId),
        TagAPI.getAllHoldingTags(portfolioId)
      ]);
      setTagLibrary(library);
      setHoldingTags(tags);
      setAllHoldingTags(allTags);
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

  const handleCreateTagDefinition = async (tagDefinition: TagDefinition) => {
    try {
      await TagAPI.createTagDefinition(tagDefinition);
      // Reload the tag library to include the new definition
      await loadData();
      setDefinitionManager({ isOpen: false });
    } catch (error) {
      console.error('Error creating tag definition:', error);
      throw error;
    }
  };

  const handleTemplateSelectedForImmediate = async (tagName: string) => {
    try {
      // Find the template in the current tag library (no need to reload since we're using built-in templates)
      if (!tagLibrary) return;
      
      const tagDefinition = tagLibrary.template_tags[tagName] || tagLibrary.tag_definitions[tagName];
      
      if (tagDefinition) {
        setEditingTag({ definition: tagDefinition });
      }
    } catch (error) {
      console.error('Error preparing tag for immediate use:', error);
    }
  };

  const handleCustomTagCreatedForImmediate = async (tagName: string) => {
    try {
      // Reload the tag library to include the new custom definition
      await loadData();
      
      // Find the newly created custom tag definition
      const updatedLibrary = await TagAPI.getUserTagLibrary();
      const tagDefinition = updatedLibrary.tag_definitions[tagName];
      
      if (tagDefinition) {
        setEditingTag({ definition: tagDefinition });
      }
    } catch (error) {
      console.error('Error preparing custom tag for immediate use:', error);
    }
  };

  const handleEditTagDefinition = (definition: TagDefinition) => {
    setDefinitionManager({ isOpen: true, definition });
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

  const getUserDefinedTags = (): TagDefinition[] => {
    if (!tagLibrary) return [];
    return Object.values(tagLibrary.tag_definitions);
  };

  const getTagsInUseByOthers = (): { tagName: string; symbols: string[]; definition?: TagDefinition; isTemplate: boolean }[] => {
    if (!tagLibrary || !allHoldingTags) return [];
    
    const allDefinitions = { ...tagLibrary.template_tags, ...tagLibrary.tag_definitions };
    const tagsInUse: Record<string, Set<string>> = {};
    
    // Collect all tags used by other holdings
    allHoldingTags.forEach(holdingTag => {
      if (holdingTag.symbol !== symbol) { // Exclude current symbol
        Object.keys(holdingTag.tags).forEach(tagName => {
          if (!tagsInUse[tagName]) {
            tagsInUse[tagName] = new Set();
          }
          tagsInUse[tagName].add(holdingTag.symbol);
        });
      }
    });

    return Object.entries(tagsInUse).map(([tagName, symbolSet]) => {
      // Prioritize templates over custom definitions to avoid duplicates
      const isTemplate = Boolean(tagLibrary.template_tags[tagName]);
      
      return {
        tagName,
        symbols: Array.from(symbolSet),
        definition: allDefinitions[tagName],
        isTemplate: isTemplate
      };
    });
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

  const getTagTypeColor = (tagType: TagType) => {
    switch (tagType) {
      case TagType.ENUM: return 'bg-blue-600/20 text-blue-300 border-blue-400/30';
      case TagType.MAP: return 'bg-green-600/20 text-green-300 border-green-400/30';
      case TagType.SCALAR: return 'bg-orange-600/20 text-orange-300 border-orange-400/30';
      case TagType.HIERARCHICAL: return 'bg-purple-600/20 text-purple-300 border-purple-400/30';
      case TagType.BOOLEAN: return 'bg-cyan-600/20 text-cyan-300 border-cyan-400/30';
      case TagType.TIME_BASED: return 'bg-pink-600/20 text-pink-300 border-pink-400/30';
      case TagType.RELATIONSHIP: return 'bg-yellow-600/20 text-yellow-300 border-yellow-400/30';
      default: return 'bg-gray-600/20 text-gray-300 border-gray-400/30';
    }
  };

  const getAllTagUsageCounts = (): Record<string, number> => {
    if (!allHoldingTags) return {};
    
    const usageCounts: Record<string, number> = {};
    
    allHoldingTags.forEach(holdingTag => {
      Object.keys(holdingTag.tags).forEach(tagName => {
        usageCounts[tagName] = (usageCounts[tagName] || 0) + 1;
      });
    });

    return usageCounts;
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
                                 <div className="space-y-2">
                   {getCurrentTags().map(({ definition, value }) => (
                     <Card key={definition.name} className="bg-gray-700/20 border-gray-600/30">
                       <CardContent className="p-3">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3 flex-1 min-w-0">
                             <span className="text-lg">{getTagTypeIcon(definition.tag_type)}</span>
                             <div className="flex-1 min-w-0">
                               <h4 className="text-sm font-medium text-gray-200 truncate">{definition.display_name}</h4>
                               <div className="mt-1">
                                 <TagDisplay
                                   tags={{ [definition.name]: value }}
                                   maxTags={1}
                                   compact={false}
                                 />
                               </div>
                             </div>
                           </div>
                           <div className="flex flex-col items-center gap-1 ml-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleEditTag(definition.name)}
                               className="text-blue-400 hover:text-blue-300 w-8 h-8 p-0"
                             >
                               <Edit size={12} />
                             </Button>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleRemoveTag(definition.name)}
                               className="text-red-400 hover:text-red-300 w-8 h-8 p-0"
                             >
                               <Trash2 size={12} />
                             </Button>
                           </div>
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
              )}
            </div>

            {/* Other Tags */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag size={20} className="text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-200">Other Tags</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Create Tag Card */}
                <Card 
                  className="bg-gray-700/20 border-gray-600/30 cursor-pointer hover:bg-gray-700/40 transition-colors border-dashed"
                  onClick={() => setDefinitionManager({ isOpen: true })}
                >
                  <CardContent className="p-4 flex items-center">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Plus size={16} className="text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-400">Create Custom Tag</h4>
                        <p className="text-xs text-gray-400">Define a new tag type</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User-Defined Tags */}
                {getUserDefinedTags().filter((definition) => {
                  const usageCounts = getAllTagUsageCounts();
                  const usageCount = usageCounts[definition.name] || 0;
                  return usageCount > 0; // Only show tags that are actually used
                }).map((definition) => {
                  const usageCounts = getAllTagUsageCounts();
                  const usageCount = usageCounts[definition.name] || 0;
                  
                  return (
                    <Card 
                      key={definition.name} 
                      className="bg-gray-700/20 border-gray-600/30 group"
                    >
                      <CardContent className="p-4 flex items-center">
                        <div className="flex items-center gap-3 w-full">
                          <span className="text-2xl flex-shrink-0">{getTagTypeIcon(definition.tag_type)}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-200 truncate">{definition.display_name}</h4>
                            <p className="text-xs text-gray-400 truncate mb-2">{definition.description}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className={`text-xs ${getTagTypeColor(definition.tag_type)}`}>
                                {definition.tag_type}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-blue-600/20 text-blue-300 border-blue-400/30">
                                Custom
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-gray-600/20 text-gray-300 border-gray-400/30">
                                {usageCount} {usageCount === 1 ? 'holding' : 'holdings'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTagDefinition(definition)}
                              className="text-gray-400 hover:text-gray-200"
                            >
                              <Edit size={12} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddTag(definition.name)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Tags Used by Other Holdings (Built-in only) */}
                {getTagsInUseByOthers().filter(({ isTemplate }) => isTemplate).map(({ tagName, symbols, definition }) => (
                  <Card 
                    key={tagName} 
                    className="bg-gray-700/20 border-gray-600/30 cursor-pointer hover:bg-gray-700/30 transition-colors"
                    onClick={() => definition && handleAddTag(tagName)}
                  >
                    <CardContent className="p-4 flex items-center">
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-2xl flex-shrink-0">{definition ? getTagTypeIcon(definition.tag_type) : '🏷️'}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-200 truncate">
                            {definition?.display_name || tagName}
                          </h4>
                          <p className="text-xs text-gray-400 truncate mb-2">
                            Used by: {symbols.slice(0, 3).join(', ')}
                            {symbols.length > 3 && ` +${symbols.length - 3} more`}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {definition && (
                              <Badge variant="outline" className={`text-xs ${getTagTypeColor(definition.tag_type)}`}>
                                {definition.tag_type}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs bg-yellow-600/20 text-yellow-300 border-yellow-400/30">
                              Built-in
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-gray-600/20 text-gray-300 border-gray-400/30">
                              {symbols.length} {symbols.length === 1 ? 'holding' : 'holdings'}
                            </Badge>
                          </div>
                        </div>
                        {definition && <Plus size={16} className="text-gray-400 flex-shrink-0" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Empty state when no other tags available */}
              {(() => {
                const usageCounts = getAllTagUsageCounts();
                const usedUserDefinedTags = getUserDefinedTags().filter(def => (usageCounts[def.name] || 0) > 0);
                const usedBuiltInTags = getTagsInUseByOthers().filter(({ isTemplate }) => isTemplate);
                
                return usedUserDefinedTags.length === 0 && usedBuiltInTags.length === 0;
              })() && (
                <div className="text-center p-6 text-gray-500 bg-gray-700/20 rounded-lg">
                  <Tag size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No other tags available</p>
                  <p className="text-sm">Create custom tags or add built-in tags to other holdings to see them here</p>
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

      {/* Tag Definition Manager Dialog */}
      <TagDefinitionManager
        isOpen={definitionManager.isOpen}
        onClose={() => setDefinitionManager({ isOpen: false })}
        onSave={handleCreateTagDefinition}
        onTemplateSelectedForImmediate={handleTemplateSelectedForImmediate}
        onCustomTagCreatedForImmediate={handleCustomTagCreatedForImmediate}
        existingDefinition={definitionManager.definition}
      />
    </>
  );
};

export default HoldingTagManager; 