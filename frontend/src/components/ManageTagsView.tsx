import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tags, Plus, Edit, Trash2, Users, BarChart3 } from 'lucide-react';
import { TagDefinition, TagLibrary, HoldingTags, TagType } from '../types';
import TagDefinitionManager from './TagDefinitionManager';
import TagAPI from '../utils/tag-api';
import { usePortfolioData } from '../contexts/PortfolioDataContext';

const TAG_TYPE_INFO = {
  [TagType.ENUM]: {
    name: "Categorical",
    icon: "🏷️",
    color: "bg-blue-500/20 text-blue-200 border-blue-400/30"
  },
  [TagType.MAP]: {
    name: "Weighted Exposure",
    icon: "🗺️",
    color: "bg-green-500/20 text-green-200 border-green-400/30"
  },
  [TagType.SCALAR]: {
    name: "Single Value",
    icon: "📊",
    color: "bg-yellow-500/20 text-yellow-200 border-yellow-400/30"
  },
  [TagType.HIERARCHICAL]: {
    name: "Hierarchical Path",
    icon: "🌳",
    color: "bg-purple-500/20 text-purple-200 border-purple-400/30"
  },
  [TagType.BOOLEAN]: {
    name: "Yes/No Flag",
    icon: "✅",
    color: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30"
  },
  [TagType.TIME_BASED]: {
    name: "Time/Date",
    icon: "⏰",
    color: "bg-orange-500/20 text-orange-200 border-orange-400/30"
  },
  [TagType.RELATIONSHIP]: {
    name: "Related Holdings",
    icon: "🔗",
    color: "bg-pink-500/20 text-pink-200 border-pink-400/30"
  }
};

export function ManageTagsView() {
  const { refreshTagsOnly, updateCustomCharts, allPortfoliosData } = usePortfolioData();
  const [tagLibrary, setTagLibrary] = useState<TagLibrary | null>(null);
  const [allHoldingTags, setAllHoldingTags] = useState<HoldingTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [definitionManager, setDefinitionManager] = useState<{ 
    isOpen: boolean; 
    definition?: TagDefinition 
  }>({ isOpen: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [library, allTags] = await Promise.all([
        TagAPI.getUserTagLibrary(),
        TagAPI.getAllHoldingTags()
      ]);
      setTagLibrary(library);
      setAllHoldingTags(allTags);
    } catch (error) {
      console.error('Error loading tag data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTagDefinition = async (tagDefinition: TagDefinition) => {
    try {
      await TagAPI.createTagDefinition(tagDefinition);
      await loadData();
      // Update global context so tags are immediately available everywhere
      await refreshTagsOnly();
      setDefinitionManager({ isOpen: false });
    } catch (error) {
      console.error('Error creating tag definition:', error);
      throw error;
    }
  };

  const handleDeleteTagDefinition = async (tagName: string) => {
    if (!confirm(`Are you sure you want to delete the tag definition "${tagName}"? This will remove the tag from all holdings and any associated charts.`)) {
      return;
    }

    try {
      await TagAPI.deleteTagDefinition(tagName);
      await loadData();
      // Update global context so deleted tags are removed everywhere
      await refreshTagsOnly();
      
      // Remove any charts associated with this tag
      const updatedCharts = (allPortfoliosData?.custom_charts || []).filter(
        chart => chart.tag_name !== tagName
      );
      updateCustomCharts(updatedCharts);
    } catch (error) {
      console.error('Error deleting tag definition:', error);
    }
  };

  const getTagUsageStats = (): Record<string, { count: number; symbols: string[] }> => {
    const usageStats: Record<string, { count: number; symbols: string[] }> = {};
    
    allHoldingTags.forEach(holdingTag => {
      Object.keys(holdingTag.tags).forEach(tagName => {
        if (!usageStats[tagName]) {
          usageStats[tagName] = { count: 0, symbols: [] };
        }
        usageStats[tagName].count++;
        usageStats[tagName].symbols.push(holdingTag.symbol);
      });
    });

    return usageStats;
  };

  const getUserDefinedTags = (): TagDefinition[] => {
    if (!tagLibrary) return [];
    return Object.values(tagLibrary.tag_definitions);
  };

  const getBuiltInTags = (): TagDefinition[] => {
    if (!tagLibrary) return [];
    return Object.values(tagLibrary.template_tags);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-2">
        <div className="text-gray-400">Loading tag management...</div>
      </div>
    );
  }

  const userDefinedTags = getUserDefinedTags();
  const builtInTags = getBuiltInTags();
  const usageStats = getTagUsageStats();

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Tags className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Manage Tags</h1>
          </div>
          <Button
            onClick={() => setDefinitionManager({ isOpen: true })}
            variant="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus size={16} className="mr-2" />
            Create Tag
          </Button>
        </div>
        <p className="text-gray-300">
          Create and manage custom tags to organize and categorize your investments.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gray-800/50 border-gray-600/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Tags size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{userDefinedTags.length}</p>
                <p className="text-sm text-gray-400">Custom Tags</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-600/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Users size={24} className="text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{allHoldingTags.length}</p>
                <p className="text-sm text-gray-400">Tagged Holdings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-600/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <BarChart3 size={24} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{Object.keys(usageStats).length}</p>
                <p className="text-sm text-gray-400">Tags in Use</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Tags Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🏷️</span>
          Your Custom Tags
        </h2>
        
        {userDefinedTags.length === 0 ? (
          <Card className="bg-gray-800/30 border-gray-600/30 border-dashed">
            <CardContent className="p-8 text-center">
              <Tags size={48} className="mx-auto mb-4 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No Custom Tags Yet</h3>
              <p className="text-gray-400 mb-4">Create your first custom tag to start organizing your investments.</p>
                             <Button
                 onClick={() => setDefinitionManager({ isOpen: true })}
                 variant="default"
                 className="bg-blue-600 hover:bg-blue-700 text-white"
               >
                <Plus size={16} className="mr-2" />
                Create Your First Tag
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userDefinedTags.map((definition) => {
              const usage = usageStats[definition.name] || { count: 0, symbols: [] };
              const typeInfo = TAG_TYPE_INFO[definition.tag_type];

              return (
                <Card key={definition.name} className="bg-gray-800/50 border-gray-600/30 group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typeInfo.icon}</span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white truncate">{definition.display_name}</h3>
                          <p className="text-xs text-gray-400 truncate">{definition.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefinitionManager({ isOpen: true, definition })}
                          className="text-gray-400 hover:text-gray-200 w-8 h-8 p-0"
                        >
                          <Edit size={12} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTagDefinition(definition.name)}
                          className="text-red-400 hover:text-red-300 w-8 h-8 p-0"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                          {typeInfo.name}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-600/20 text-blue-300 border-blue-400/30">
                          Custom
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-300">
                        <span className="font-medium">{usage.count}</span>{' '}
                        {usage.count === 1 ? 'holding' : 'holdings'}
                        {usage.count > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {usage.symbols.slice(0, 3).join(', ')}
                            {usage.symbols.length > 3 && ` +${usage.symbols.length - 3} more`}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Built-in Tags Section */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">✨</span>
          Built-in Template Tags
        </h2>
        <p className="text-gray-400 mb-4">
          These are pre-defined tags that you can use in your holdings. They appear in dropdowns when adding tags.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtInTags.map((template) => {
            const usage = usageStats[template.name] || { count: 0, symbols: [] };
            const typeInfo = TAG_TYPE_INFO[template.tag_type];

            return (
              <Card key={template.name} className="bg-gray-700/30 border-gray-600/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xl">{typeInfo.icon}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-200 truncate">{template.display_name}</h3>
                      <p className="text-xs text-gray-400 truncate">{template.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                        {typeInfo.name}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-yellow-600/20 text-yellow-300 border-yellow-400/30">
                        Built-in
                      </Badge>
                    </div>

                    <div className="text-sm text-gray-300">
                      <span className="font-medium">{usage.count}</span>{' '}
                      {usage.count === 1 ? 'holding' : 'holdings'}
                      {usage.count > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {usage.symbols.slice(0, 3).join(', ')}
                          {usage.symbols.length > 3 && ` +${usage.symbols.length - 3} more`}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tag Definition Manager Dialog */}
      <TagDefinitionManager
        isOpen={definitionManager.isOpen}
        onClose={() => setDefinitionManager({ isOpen: false })}
        onSave={handleCreateTagDefinition}
        existingDefinition={definitionManager.definition}
      />
    </div>
  );
} 