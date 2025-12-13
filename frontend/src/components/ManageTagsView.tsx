import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tags, Plus, Edit, Trash2, HelpCircle, X } from 'lucide-react';
import { TagDefinition, TagLibrary, HoldingTags, TagType, TagValue } from '../types';
import TagDefinitionManager from './TagDefinitionManager';
import TagEditor from './TagEditor';
import TagAPI from '../utils/tag-api';
import { usePortfolioData } from '../contexts/PortfolioDataContext';
import PortfolioSelector from '../PortfolioSelector';

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
  const { 
    refreshTagsOnly, 
    updateCustomCharts, 
    allPortfoliosData, 
    currentPortfolioData,
    selectedPortfolioId,
    setSelectedPortfolioId,
    getAvailablePortfolios,
    refreshAllPortfoliosData,
    getAutocompleteData
  } = usePortfolioData();
  
  const autocompleteData = getAutocompleteData();
  
  const [tagLibrary, setTagLibrary] = useState<TagLibrary | null>(null);
  const [allHoldingTags, setAllHoldingTags] = useState<HoldingTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [definitionManager, setDefinitionManager] = useState<{ 
    isOpen: boolean; 
    definition?: TagDefinition 
  }>({ isOpen: false });
  const [tagEditor, setTagEditor] = useState<{
    isOpen: boolean;
    symbol?: string;
    tagDefinition?: TagDefinition;
  }>({ isOpen: false });
  const [expandedTagged, setExpandedTagged] = useState<Record<string, boolean>>({});
  const [expandedUntagged, setExpandedUntagged] = useState<Record<string, boolean>>({});

  const availablePortfolios = getAvailablePortfolios();
  const portfolioMetadata = currentPortfolioData?.portfolio_metadata;

  useEffect(() => {
    if (selectedPortfolioId) {
      // Reset state when portfolio changes to avoid showing stale data
      setAllHoldingTags([]);
      setExpandedTagged({});
      setExpandedUntagged({});
      loadData();
    }
  }, [selectedPortfolioId]);

  const loadData = async () => {
    if (!selectedPortfolioId) return;
    
    setLoading(true);
    try {
      // Load all tags (global) - tags are stored at user-level with portfolio association
      // We load all tags and filter client-side to show only tags for holdings in current portfolio
      const [library, allTags] = await Promise.all([
        TagAPI.getUserTagLibrary(),
        TagAPI.getAllHoldingTags() // Don't pass portfolio_id - get all tags
      ]);
      setTagLibrary(library);
      setAllHoldingTags(allTags);
    } catch (error) {
      console.error('Error loading tag data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioCreated = async (newPortfolioId: string) => {
    await refreshAllPortfoliosData();
    setSelectedPortfolioId(newPortfolioId);
  };

  const handlePortfolioDeleted = async () => {
    await refreshAllPortfoliosData();
  };

  const handleDefaultPortfolioSet = async () => {
    // Optional: handle default portfolio change
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

  const handleRemoveTag = async (symbol: string, tagName: string) => {
    try {
      await TagAPI.removeHoldingTag(symbol, tagName, selectedPortfolioId || undefined);
      await loadData();
      await refreshTagsOnly();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const handleAddTag = (symbol: string, tagDefinition: TagDefinition) => {
    setTagEditor({ isOpen: true, symbol, tagDefinition });
  };

  const handleTagSaved = async (tagValue: TagValue) => {
    if (!tagEditor.symbol) return;
    try {
      await TagAPI.setHoldingTag(tagEditor.symbol, tagValue.tag_name, tagValue, selectedPortfolioId || undefined);
      await loadData();
      await refreshTagsOnly();
      setTagEditor({ isOpen: false });
    } catch (error) {
      console.error('Error saving tag:', error);
      throw error;
    }
  };

  const getUserDefinedTags = (): TagDefinition[] => {
    if (!tagLibrary) return [];
    return Object.values(tagLibrary.tag_definitions);
  };

  const getAllHoldings = (): string[] => {
    if (!currentPortfolioData?.accounts) return [];
    const symbols = new Set<string>();
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        symbols.add(holding.symbol);
      });
    });
    return Array.from(symbols);
  };

  const getTaggedHoldings = (tagName: string): string[] => {
    const allHoldings = getAllHoldings();
    // Tags are stored globally, but we filter to only show tags for holdings in current portfolio
    const tagged = allHoldingTags
      .filter(ht => tagName in ht.tags && allHoldings.includes(ht.symbol))
      .map(ht => ht.symbol);
    
    return tagged;
  };

  const getUntaggedHoldings = (tagName: string): string[] => {
    const allHoldings = getAllHoldings();
    const taggedHoldings = getTaggedHoldings(tagName);
    return allHoldings.filter(symbol => !taggedHoldings.includes(symbol));
  };

  // Helper to get display name for badges - uses autocomplete data like PortfolioView
  // For numerical symbols (TASE stocks), show the textual name
  // For regular tickers (MSFT, AAPL, etc.), keep the ticker symbol
  const getHoldingName = useMemo(() => {
    const nameCache = new Map<string, string>();
    
    if (!autocompleteData || autocompleteData.length === 0) {
      return (symbol: string) => symbol;
    }
    
    return (symbol: string): string => {
      // Check cache first
      if (nameCache.has(symbol)) return nameCache.get(symbol)!;
      
      // Check if this is a numerical symbol (TASE stock)
      const isNumericSymbol = /^\d+$/.test(symbol);
      
      // If it's not numeric, just return the symbol (regular ticker like MSFT, AAPL)
      if (!isNumericSymbol) {
        nameCache.set(symbol, symbol);
        return symbol;
      }
      
      const symbolUpper = symbol.toUpperCase();
      
      // Find matching TASE symbol in autocomplete data
      const symbolData = autocompleteData.find(s => {
        const sUpper = s.symbol.toUpperCase();
        
        // Direct match
        if (sUpper === symbolUpper) return true;
        
        // TASE symbols are numeric
        if (s.symbol_type === 'tase' && /^\d+$/.test(symbolUpper)) {
          const taseNumPart = sUpper.replace('TASE:', '').split('.')[0];
          if (taseNumPart === symbolUpper) return true;
        }
        
        return false;
      });
      
      // Return the name from autocomplete data, or symbol as fallback
      const name = symbolData ? symbolData.name : symbol;
      nameCache.set(symbol, name);
      return name;
    };
  }, [autocompleteData]);

  if (!portfolioMetadata || !selectedPortfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-2">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-2">
        <div className="text-gray-400">Loading tag management...</div>
      </div>
    );
  }

  const userDefinedTags = getUserDefinedTags();
  const allHoldings = getAllHoldings();
  
  // Tags are stored globally (user-level), but we filter to only include holdings from current portfolio
  // This allows the same symbol (e.g., AAPL) to have different tags in different portfolios
  const currentPortfolioHoldingTags = allHoldingTags.filter(ht => 
    allHoldings.includes(ht.symbol)
  );
  
  const allTaggedSymbols = new Set(currentPortfolioHoldingTags.map(ht => ht.symbol));
  const holdingsWithoutTags = allHoldings.filter(symbol => !allTaggedSymbols.has(symbol));

  return (
    <>
      {/* Header Section */}
      <div className="sticky top-0 z-20 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-start">
          <div className="flex-1">
            <PortfolioSelector
              portfolios={availablePortfolios}
              selectedPortfolioId={selectedPortfolioId}
              onPortfolioChange={setSelectedPortfolioId}
              userName={portfolioMetadata.user_name}
              onPortfolioCreated={handlePortfolioCreated}
              onPortfolioDeleted={handlePortfolioDeleted}
              onDefaultPortfolioSet={handleDefaultPortfolioSet}
              titleSuffix="Tags"
            />
            <p className="text-sm text-gray-400 mt-0">
              Manage custom tags for your holdings
            </p>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <button 
              className="flex items-center space-x-2 pl-3 pr-4 rounded-md bg-emerald-500/20 backdrop-blur-sm text-white hover:bg-emerald-500/30 transition-all duration-300 transform hover:scale-105 shadow-emerald-500/10 hover:shadow-emerald-500/20 border border-emerald-400/30 hover:border-emerald-300/40 group h-[44px]"
              onClick={() => setDefinitionManager({ isOpen: true })}
            >
              <Plus size={16} className="text-emerald-200 group-hover:text-emerald-100" />
              <span className="text-xs font-medium text-emerald-100">Create Tag</span>
            </button>
            <button 
              className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              title="Help"
            >
              <HelpCircle size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="sticky top-[77px] z-10 bg-gray-800 border-t border-b border-gray-700">
        <div className="container mx-auto flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 py-1.5 px-2 sm:px-4 overflow-x-auto">
          <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
            <Tags size={14} className="text-blue-400 mr-1.5" />
            <span className="text-xs font-medium mr-1">Tags:</span>
            <span className="text-xs text-blue-400">{userDefinedTags.length}</span>
          </div>
          <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
            <Tags size={14} className="text-green-400 mr-1.5" />
            <span className="text-xs font-medium mr-1">Tagged:</span>
            <span className="text-xs text-green-400">{allTaggedSymbols.size}</span>
          </div>
          <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
            <Tags size={14} className="text-gray-400 mr-1.5" />
            <span className="text-xs font-medium mr-1">Untagged:</span>
            <span className="text-xs text-gray-400">{holdingsWithoutTags.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-4 px-2 sm:px-4">
        {/* Tags Grid */}
      {userDefinedTags.length === 0 ? (
        <Card className="bg-gray-800/30 border-gray-600/30 border-dashed">
          <CardContent className="p-12 text-center">
            <Tags size={64} className="mx-auto mb-4 text-gray-500" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">No Tags Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Create your first tag to start organizing and categorizing your investments.
            </p>
            <button
              onClick={() => setDefinitionManager({ isOpen: true })}
              className="flex items-center space-x-2 pl-3 pr-4 rounded-md bg-emerald-500/20 backdrop-blur-sm text-white hover:bg-emerald-500/30 transition-all duration-300 transform hover:scale-105 shadow-emerald-500/10 hover:shadow-emerald-500/20 border border-emerald-400/30 hover:border-emerald-300/40 group mx-auto h-[44px]"
            >
              <Plus size={16} className="text-emerald-200 group-hover:text-emerald-100" />
              <span className="text-xs font-medium text-emerald-100">Create Your First Tag</span>
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {userDefinedTags.map((definition) => {
            const taggedHoldings = getTaggedHoldings(definition.name);
            const untaggedHoldings = getUntaggedHoldings(definition.name);
            const typeInfo = TAG_TYPE_INFO[definition.tag_type];
            const showAllTagged = expandedTagged[definition.name] || false;
            const showAllUntagged = expandedUntagged[definition.name] || false;

            const displayedTaggedHoldings = showAllTagged ? taggedHoldings : taggedHoldings.slice(0, 10);
            const displayedUntaggedHoldings = showAllUntagged ? untaggedHoldings : untaggedHoldings.slice(0, 10);

            return (
              <Card key={definition.name} className="bg-gray-800/50 border-gray-600/30">
                <CardContent className="p-6">
                  {/* Tag Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-semibold text-white truncate">{definition.display_name}</h3>
                      <p className="text-sm text-gray-400 truncate">{definition.description}</p>
                    </div>
                    <div className="flex gap-2 ml-4 items-center">
                      <Badge variant="outline" className={`text-xs ${typeInfo.color} flex items-center gap-1`}>
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.name}</span>
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefinitionManager({ isOpen: true, definition })}
                        className="text-blue-400 hover:text-blue-300 border-blue-400/30 hover:border-blue-400/50"
                        title="Edit tag definition"
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTagDefinition(definition.name)}
                        className="text-red-400 hover:text-red-300 border-red-400/30 hover:border-red-400/50"
                        title="Delete tag"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Tagged Holdings */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Tagged Holdings ({taggedHoldings.length})
                    </h4>
                    {taggedHoldings.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No holdings tagged yet</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {displayedTaggedHoldings.map((symbol) => (
                            <Badge
                              key={symbol}
                              className="bg-blue-500/20 text-blue-200 border-blue-400/30 hover:bg-blue-500/30"
                            >
                              <span 
                                onClick={() => setTagEditor({ isOpen: true, symbol, tagDefinition: definition })}
                                className="cursor-pointer"
                              >
                                {getHoldingName(symbol)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTag(symbol, definition.name);
                                }}
                                className="ml-1.5 p-0.5 rounded-full hover:bg-red-500/20 transition-colors opacity-60 hover:opacity-100"
                                title="Remove tag"
                              >
                                <X size={10} className="text-red-400" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        {taggedHoldings.length > 10 && (
                          <button
                            onClick={() => setExpandedTagged(prev => ({ ...prev, [definition.name]: !showAllTagged }))}
                            className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                          >
                            {showAllTagged ? 'Show less' : `Show ${taggedHoldings.length - 10} more`}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Untagged Holdings */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Holdings Without Tag ({untaggedHoldings.length})
                    </h4>
                    {untaggedHoldings.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">All holdings are tagged</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {displayedUntaggedHoldings.map((symbol) => (
                            <Badge
                              key={symbol}
                              className="bg-gray-700/30 text-gray-300 border-gray-500/30 cursor-pointer hover:bg-gray-700/50 group"
                              onClick={() => handleAddTag(symbol, definition)}
                            >
                              <Plus size={12} className="mr-1" />
                              {getHoldingName(symbol)}
                            </Badge>
                          ))}
                        </div>
                        {untaggedHoldings.length > 10 && (
                          <button
                            onClick={() => setExpandedUntagged(prev => ({ ...prev, [definition.name]: !showAllUntagged }))}
                            className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                          >
                            {showAllUntagged ? 'Show less' : `Show ${untaggedHoldings.length - 10} more`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

        {/* Tag Definition Manager Dialog */}
        <TagDefinitionManager
          isOpen={definitionManager.isOpen}
          onClose={() => setDefinitionManager({ isOpen: false })}
          onSave={handleCreateTagDefinition}
          existingDefinition={definitionManager.definition}
        />

        {/* Tag Editor Dialog */}
        {tagEditor.isOpen && tagEditor.symbol && tagEditor.tagDefinition && (
          <TagEditor
            symbol={tagEditor.symbol}
            tagDefinition={tagEditor.tagDefinition}
            isOpen={tagEditor.isOpen}
            onClose={() => setTagEditor({ isOpen: false })}
            onSave={handleTagSaved}
          />
        )}
      </div>
    </>
  );
} 