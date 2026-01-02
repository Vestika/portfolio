import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tags, Plus, Edit, Trash2, HelpCircle, X, PieChart as PieChartIcon, BarChart3, Grid3x3, Layers, CircleDot, Calendar as CalendarIcon, GanttChart } from 'lucide-react';
import { TagDefinition, TagLibrary, HoldingTags, TagType, TagValue, ChartDataItem } from '../types';
import TagDefinitionManager from './TagDefinitionManager';
import TagEditor from './TagEditor';
import TagAPI from '../utils/tag-api';
import PortfolioAPI from '../utils/portfolio-api';
import { usePortfolioData } from '../contexts/PortfolioDataContext';
import { useMixpanel } from '../contexts/MixpanelContext';
import PortfolioSelector from '../PortfolioSelector';
import PieChart from '../PieChart';
import BarChart from '../BarChart';
import StackedBarChart from './StackedBarChart';
import SunburstChart from './SunburstChart';
import SankeyChart from '../SankeyChart';
import TreeMapChart, { TreeMapDataItem } from '../TreeMapChart';
import BubbleChart, { BubbleChartDataItem } from '../BubbleChart';
import DependencyWheelChart, { DependencyWheelDataItem } from '../DependencyWheelChart';
import TimelineChart, { TimelineChartDataItem } from '../TimelineChart';
import CalendarView, { CalendarViewDataItem } from '../CalendarView';
import GaugeChart from '../GaugeChart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

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
  const { track } = useMixpanel();

  const autocompleteData = getAutocompleteData();
  
  const [tagLibrary, setTagLibrary] = useState<TagLibrary | null>(null);
  const [allHoldingTags, setAllHoldingTags] = useState<HoldingTags[]>([]);
  
  // Helper to find a holding's tag for the CURRENT portfolio
  // IMPORTANT: A symbol can have MULTIPLE tag records with different portfolio_ids
  // Priority: 1) Exact portfolio_id match, 2) Global tags (portfolio_id=null)
  // We also need to MERGE tags from both if they exist
  const getHoldingTagForCurrentPortfolio = (symbol: string): HoldingTags | undefined => {
    // Get ALL tag records for this symbol
    const allMatchesForSymbol = allHoldingTags.filter(ht => ht.symbol === symbol);
    
    if (allMatchesForSymbol.length === 0) {
      return undefined;
    }
    
    // Find exact portfolio match and global (null) match
    const exactMatch = allMatchesForSymbol.find(ht => ht.portfolio_id === selectedPortfolioId);
    const globalMatch = allMatchesForSymbol.find(ht => !ht.portfolio_id);
    
    // If we have both, MERGE their tags (portfolio-specific tags take precedence)
    if (exactMatch && globalMatch) {
      return {
        ...globalMatch,
        tags: { ...globalMatch.tags, ...exactMatch.tags },
        portfolio_id: selectedPortfolioId || undefined // Mark as portfolio-specific
      };
    }
    
    // Return whichever one exists
    return exactMatch || globalMatch;
  };
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
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [chartTypePreference, setChartTypePreference] = useState<Record<string, 'pie' | 'bar' | 'treemap' | 'stacked-bar' | 'sunburst' | 'sankey' | 'dependency-wheel' | 'timeline' | 'calendar' | 'gauge'>>({});

  const availablePortfolios = getAvailablePortfolios();
  const portfolioMetadata = currentPortfolioData?.portfolio_metadata;

  // Initialize chart type preferences from existing charts
  useEffect(() => {
    if (allPortfoliosData?.custom_charts) {
      const preferences: Record<string, 'pie' | 'bar' | 'treemap' | 'stacked-bar' | 'sunburst' | 'sankey' | 'dependency-wheel' | 'timeline' | 'calendar' | 'gauge'> = {};
      allPortfoliosData.custom_charts.forEach(chart => {
        if (chart.chart_type === 'pie' || chart.chart_type === 'bar' || chart.chart_type === 'treemap' || chart.chart_type === 'stacked-bar' || chart.chart_type === 'sunburst' || chart.chart_type === 'sankey' || chart.chart_type === 'dependency-wheel' || chart.chart_type === 'timeline' || chart.chart_type === 'calendar' || chart.chart_type === 'gauge') {
          preferences[chart.tag_name] = chart.chart_type as 'pie' | 'bar' | 'treemap' | 'stacked-bar' | 'sunburst' | 'sankey' | 'dependency-wheel' | 'timeline' | 'calendar' | 'gauge';
        }
      });
      setChartTypePreference(preferences);
    }
  }, [allPortfoliosData?.custom_charts]);

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

      // Mixpanel: Track tag definition created
      track('feature_tags_definition_created', {
        tag_type: tagDefinition.tag_type,
        is_custom: true,
      });

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
      // Mixpanel: Track tag definition deleted
      track('feature_tags_definition_deleted', {
        tag_name_provided: false, // Privacy: don't send actual tag name
      });

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

      // Mixpanel: Track tags applied to holding
      const tagDef = tagLibrary?.tag_definitions[tagValue.tag_name];
      track('feature_tags_applied_to_holding', {
        tag_type: tagDef?.tag_type || 'unknown',
        holdings_tagged_count: 1,
      });

      await loadData();
      await refreshTagsOnly();
      setTagEditor({ isOpen: false });
    } catch (error) {
      console.error('Error saving tag:', error);
      throw error;
    }
  };

  const generateChartData = (tagName: string, tagDefinition: TagDefinition): ChartDataItem[] | null => {
    // Only ENUM and BOOLEAN tags support this simple chart data format
    if (tagDefinition.tag_type !== TagType.ENUM && tagDefinition.tag_type !== TagType.BOOLEAN) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; security_type: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, security_type: holding.security_type };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with tags
    const allHoldings: any[] = [];
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      if (holdingTag && tagName in holdingTag.tags) {
        allHoldings.push({
          symbol: symbol,
          units: holdingData.units,
          security_type: holdingData.security_type,
          tags: holdingTag.tags
        });
      }
    }

    // Group holdings by tag value
    const groups: Record<string, any[]> = {};
    
    allHoldings.forEach(holding => {
      const tagValue = holding.tags?.[tagName] as any;
      let groupKey = 'Uncategorized';
      
      if (tagValue && typeof tagValue === 'object') {
        if ('enum_value' in tagValue && tagValue.enum_value) {
          groupKey = tagValue.enum_value as string;
        } else if ('boolean_value' in tagValue) {
          groupKey = tagValue.boolean_value ? 'Yes' : 'No';
        }
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(holding);
    });

    // Calculate values using global prices
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    const chartTotal = Object.values(groups).reduce((sum, holdings) => {
      return sum + holdings.reduce((groupSum, h) => {
        const priceData = globalPrices[h.symbol];
        const value = priceData ? h.units * priceData.price : 0;
        return groupSum + value;
      }, 0);
    }, 0);
    
    const chartData = Object.entries(groups).map(([groupName, holdings]) => {
      const groupValue = holdings.reduce((sum, h) => {
        const priceData = globalPrices[h.symbol];
        const value = priceData ? h.units * priceData.price : 0;
        return sum + value;
      }, 0);
      const percentage = chartTotal > 0 ? (groupValue / chartTotal) * 100 : 0;
      
      return {
        label: groupName,
        value: Math.round(groupValue * 100) / 100,
        percentage: Math.round(percentage * 100) / 100
      };
    }).sort((a, b) => b.value - a.value);

    return chartData.length > 0 ? chartData : null;
  };

  const generateMapChartData = (tagName: string): any[] | null => {
    if (!currentPortfolioData?.accounts) return null;

    const globalPrices = allPortfoliosData?.global_current_prices || {};
    const holdings: any[] = [];
    
    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });
    
    // Now process unique symbols
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        if (tagValue?.map_value && typeof tagValue.map_value === 'object') {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          holdings.push({
            symbol: symbol,
            name: holdingData.name,
            value,
            weights: tagValue.map_value
          });
        }
      }
    }

    return holdings.length > 0 ? holdings : null;
  };

  const generateMapSunburstData = (tagName: string): any[] | null => {
    if (!currentPortfolioData?.accounts) return null;

    const globalPrices = allPortfoliosData?.global_current_prices || {};
    const hierarchicalData: any[] = [];
    
    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });
    
    // Now process unique symbols with MAP tags
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        if (tagValue?.map_value && typeof tagValue.map_value === 'object') {
          const priceData = globalPrices[symbol];
          const totalValue = priceData ? holdingData.units * priceData.price : 0;
          
          // Create hierarchical entries for each category in the map
          // Each weight creates a path: [category, symbol]
          Object.entries(tagValue.map_value).forEach(([category, weight]) => {
            const weightDecimal = (weight as number) / 100; // Convert percentage to decimal
            const weightedValue = totalValue * weightDecimal;
            
            if (weightedValue > 0) {
              hierarchicalData.push({
                symbol: symbol,
                name: holdingData.name,
                value: weightedValue,
                path: [category, symbol] // 2-level hierarchy: category -> holding
              });
            }
          });
        }
      }
    }

    return hierarchicalData.length > 0 ? hierarchicalData : null;
  };

  const generateHierarchicalChartData = (tagName: string): any[] | null => {
    if (!currentPortfolioData?.accounts) return null;

    const globalPrices = allPortfoliosData?.global_current_prices || {};
    const holdings: any[] = [];
    
    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });
    
    // Now process unique symbols
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        if (tagValue?.hierarchical_value && Array.isArray(tagValue.hierarchical_value)) {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          holdings.push({
            symbol: symbol,
            name: holdingData.name,
            value,
            path: tagValue.hierarchical_value
          });
        }
      }
    }

    return holdings.length > 0 ? holdings : null;
  };

  const generateTreeMapData = (tagName: string, tagDefinition: TagDefinition): TreeMapDataItem[] | null => {
    // Only ENUM and BOOLEAN tags support treemap
    if (tagDefinition.tag_type !== TagType.ENUM && tagDefinition.tag_type !== TagType.BOOLEAN) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with tags
    const allHoldings: any[] = [];
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      if (holdingTag && tagName in holdingTag.tags) {
        allHoldings.push({
          symbol: symbol,
          name: holdingData.name,
          units: holdingData.units,
          tags: holdingTag.tags
        });
      }
    }

    // Group holdings by tag value (category)
    const groups: Record<string, any[]> = {};
    
    allHoldings.forEach(holding => {
      const tagValue = holding.tags?.[tagName] as any;
      let groupKey = 'Uncategorized';
      
      if (tagValue && typeof tagValue === 'object') {
        if ('enum_value' in tagValue && tagValue.enum_value) {
          groupKey = tagValue.enum_value as string;
        } else if ('boolean_value' in tagValue) {
          groupKey = tagValue.boolean_value ? 'Yes' : 'No';
        }
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(holding);
    });

    // Calculate values using global prices
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    
    const treeMapData: TreeMapDataItem[] = Object.entries(groups).map(([groupName, holdings]) => {
      const categoryHoldings = holdings.map(h => {
        const priceData = globalPrices[h.symbol];
        const value = priceData ? h.units * priceData.price : 0;
        
        return {
          symbol: h.symbol,
          name: h.name,
          value
        };
      }).filter(h => h.value > 0); // Only include holdings with value

      return {
        label: groupName,
        holdings: categoryHoldings
      };
    }).filter(category => category.holdings.length > 0); // Only include categories with holdings

    return treeMapData.length > 0 ? treeMapData : null;
  };

  const generateBubbleChartData = (tagName: string, tagDefinition: TagDefinition): BubbleChartDataItem[] | null => {
    // Only SCALAR tags support bubble chart
    if (tagDefinition.tag_type !== TagType.SCALAR) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with scalar tag values
    const bubbleData: BubbleChartDataItem[] = [];
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        if (tagValue?.scalar_value !== undefined && tagValue.scalar_value !== null) {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          if (value > 0) {
            bubbleData.push({
              symbol: symbol,
              name: holdingData.name,
              value,
              scalar_value: tagValue.scalar_value
            });
          }
        }
      }
    }

    return bubbleData.length > 0 ? bubbleData : null;
  };

  const generateDependencyWheelData = (tagName: string, tagDefinition: TagDefinition): DependencyWheelDataItem[] | null => {
    // Only RELATIONSHIP tags support dependency wheel
    if (tagDefinition.tag_type !== TagType.RELATIONSHIP) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with relationship tag values
    const wheelData: DependencyWheelDataItem[] = [];
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        // Use relationship_value (correct field name from TagValue interface)
        if (tagValue?.relationship_value && Array.isArray(tagValue.relationship_value)) {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          if (value > 0) {
            wheelData.push({
              symbol: symbol,
              name: holdingData.name,
              value,
              related_symbols: tagValue.relationship_value
            });
          }
        }
      }
    }

    return wheelData.length > 0 ? wheelData : null;
  };

  const generateRelationshipSankeyData = (tagName: string, tagDefinition: TagDefinition): any[] | null => {
    // Only RELATIONSHIP tags support sankey
    if (tagDefinition.tag_type !== TagType.RELATIONSHIP) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with relationship tag values
    const sankeyData: any[] = [];
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        // Use relationship_value (correct field name from TagValue interface)
        if (tagValue?.relationship_value && Array.isArray(tagValue.relationship_value)) {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          if (value > 0) {
            // For Sankey, we need the same structure as hierarchical data
            // Create a simple 2-level hierarchy: [symbol, related_symbol]
            tagValue.relationship_value.forEach((relatedSymbol: string) => {
              sankeyData.push({
                symbol: symbol,
                name: holdingData.name,
                value,
                path: [symbol, relatedSymbol] // Simple 2-level path for relationships
              });
            });
          }
        }
      }
    }

    return sankeyData.length > 0 ? sankeyData : null;
  };

  const generateTimelineData = (tagName: string, tagDefinition: TagDefinition): TimelineChartDataItem[] | null => {
    // Only TIME_BASED tags support timeline
    if (tagDefinition.tag_type !== TagType.TIME_BASED) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with time-based tag values
    const timelineData: TimelineChartDataItem[] = [];
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        if (tagValue?.time_value) {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          if (value > 0) {
            // For frequency-based tags, generate individual occurrences
            if (tagValue.time_value.frequency) {
              const startDate = tagValue.time_value.frequency_start || tagValue.time_value.date || new Date().toISOString().split('T')[0];
              const start = new Date(startDate);
              const threeMonthsLater = new Date(start);
              threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
              
              const current = new Date(start);
              let occurrenceIndex = 0;
              
              // Generate individual occurrences
              while (current <= threeMonthsLater && occurrenceIndex < 50) { // Safety limit
                timelineData.push({
                  symbol: `${symbol}_${occurrenceIndex}`, // Unique key for each occurrence
                  name: `${holdingData.name} (${tagValue.time_value.frequency})`,
                  value,
                  single_date: current.toISOString().split('T')[0],
                  frequency: tagValue.time_value.frequency
                });
                
                // Increment based on frequency
                switch (tagValue.time_value.frequency) {
                  case 'daily':
                    current.setDate(current.getDate() + 1);
                    break;
                  case 'weekly':
                    current.setDate(current.getDate() + 7);
                    break;
                  case 'monthly':
                    current.setMonth(current.getMonth() + 1);
                    break;
                  case 'quarterly':
                    current.setMonth(current.getMonth() + 3);
                    break;
                  case 'yearly':
                  case 'annually':
                    current.setFullYear(current.getFullYear() + 1);
                    break;
                  default:
                    current.setDate(current.getDate() + 1);
                }
                occurrenceIndex++;
              }
            } else {
              // Regular single date or date range
              timelineData.push({
                symbol: symbol,
                name: holdingData.name,
                value,
                start_date: tagValue.time_value.start_date,
                end_date: tagValue.time_value.end_date,
                single_date: tagValue.time_value.date // Use 'date' not 'single_date'
              });
            }
          }
        }
      }
    }

    return timelineData.length > 0 ? timelineData : null;
  };

  const generateCalendarData = (tagName: string, tagDefinition: TagDefinition): CalendarViewDataItem[] | null => {
    // Only TIME_BASED tags support calendar
    if (tagDefinition.tag_type !== TagType.TIME_BASED) {
      return null;
    }

    if (!currentPortfolioData?.accounts) return null;

    // First, aggregate holdings by symbol across all accounts
    const aggregatedHoldings: Record<string, { units: number; name: string }> = {};
    
    currentPortfolioData.accounts.forEach(account => {
      account.holdings.forEach(holding => {
        if (!aggregatedHoldings[holding.symbol]) {
          aggregatedHoldings[holding.symbol] = { units: 0, name: holding.security_name };
        }
        aggregatedHoldings[holding.symbol].units += holding.units;
      });
    });

    // Get all unique holdings with time-based tag values
    const calendarData: CalendarViewDataItem[] = [];
    const globalPrices = allPortfoliosData?.global_current_prices || {};
    
    for (const [symbol, holdingData] of Object.entries(aggregatedHoldings)) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      
      if (holdingTag && tagName in holdingTag.tags) {
        const tagValue = holdingTag.tags[tagName] as any;
        
        if (tagValue?.time_value) {
          const priceData = globalPrices[symbol];
          const value = priceData ? holdingData.units * priceData.price : 0;
          
          if (value > 0) {
            // For calendar view, pass all the time data as-is
            calendarData.push({
              symbol: symbol,
              name: holdingData.name,
              value,
              start_date: tagValue.time_value.start_date,
              end_date: tagValue.time_value.end_date,
              single_date: tagValue.time_value.date, // Use 'date' not 'single_date'
              frequency: tagValue.time_value.frequency,
              frequency_start: tagValue.time_value.frequency_start || tagValue.time_value.date // Use date as start if no frequency_start
            });
          }
        }
      }
    }

    return calendarData.length > 0 ? calendarData : null;
  };

  const getExistingChart = (tagName: string) => {
    if (!allPortfoliosData?.custom_charts) return null;
    return allPortfoliosData.custom_charts.find(chart => 
      chart.tag_name === tagName &&
      (!chart.portfolio_id || chart.portfolio_id === selectedPortfolioId)
    );
  };

  const getChartType = (tagDefinition: TagDefinition): string => {
    switch (tagDefinition.tag_type) {
      case TagType.ENUM:
        // Use user preference, default to pie
        return chartTypePreference[tagDefinition.name] || 'pie';
      case TagType.BOOLEAN:
        // Boolean tags always use gauge
        return 'gauge';
      case TagType.MAP:
        // Use user preference, default to stacked-bar
        return chartTypePreference[tagDefinition.name] || 'stacked-bar';
      case TagType.HIERARCHICAL:
        // Use user preference, default to sunburst
        return chartTypePreference[tagDefinition.name] || 'sunburst';
      case TagType.SCALAR:
        return 'bubble';
      case TagType.RELATIONSHIP:
        // Use user preference, default to dependency-wheel
        return chartTypePreference[tagDefinition.name] || 'dependency-wheel';
      case TagType.TIME_BASED:
        // Use user preference, default to timeline
        return chartTypePreference[tagDefinition.name] || 'timeline';
      default:
        return 'pie';
    }
  };

  const handleAddChart = async (tagName: string, tagDefinition: TagDefinition) => {
    try {
      const chartTitle = `${tagDefinition.display_name} Distribution`;
      const chartType = getChartType(tagDefinition);
      
      const requestData = {
        chart_title: chartTitle,
        tag_name: tagName,
        chart_type: chartType,
        portfolio_id: selectedPortfolioId || undefined
      };
      
      const response = await PortfolioAPI.createCustomChart(requestData);
      
      // Update context immediately
      const newChart = {
        chart_id: response.chart_id,
        chart_title: response.chart_title,
        tag_name: response.tag_name,
        chart_type: response.chart_type,
        portfolio_id: response.portfolio_id
      };
      const updatedCharts = [
        ...(allPortfoliosData?.custom_charts || []),
        newChart
      ];
      updateCustomCharts(updatedCharts);
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  };

  const handleRemoveChart = async (chartId: string) => {
    try {
      await PortfolioAPI.deleteCustomChart(chartId);
      
      const updatedCharts = (allPortfoliosData?.custom_charts || []).filter(
        chart => chart.chart_id !== chartId
      );
      updateCustomCharts(updatedCharts);
    } catch (error) {
      console.error('Error removing chart:', error);
    }
  };

  const handleChartTypeToggle = async (tagName: string, chartType: 'pie' | 'bar' | 'treemap' | 'stacked-bar' | 'sunburst' | 'sankey' | 'dependency-wheel' | 'timeline' | 'calendar' | 'gauge') => {
    // Update local state immediately for responsive UI
    setChartTypePreference(prev => ({ ...prev, [tagName]: chartType }));
    
    // Find existing chart for this tag
    const existingChart = getExistingChart(tagName);
    if (existingChart) {
      try {
        // Update the chart type in the backend
        const response = await PortfolioAPI.updateChartType(existingChart.chart_id, chartType);
        
        // Update context to reflect the change immediately
        const updatedCharts = (allPortfoliosData?.custom_charts || []).map(chart =>
          chart.chart_id === existingChart.chart_id
            ? { ...chart, chart_type: response.chart_type }
            : chart
        );
        updateCustomCharts(updatedCharts);
      } catch (error) {
        console.error('Error updating chart type:', error);
        // Revert on error
        const originalType = existingChart.chart_type as 'pie' | 'bar' | 'treemap' | 'stacked-bar' | 'sunburst' | 'sankey' | 'dependency-wheel' | 'timeline' | 'calendar' | 'gauge' | undefined;
        setChartTypePreference(prev => ({ ...prev, [tagName]: originalType || 'pie' }));
      }
    }
    // If no chart exists yet, just update the preview preference
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
    
    // Use the portfolio-aware lookup to properly check each holding
    // This handles the case where tags are split across multiple records
    const tagged: string[] = [];
    
    for (const symbol of allHoldings) {
      const holdingTag = getHoldingTagForCurrentPortfolio(symbol);
      if (holdingTag && tagName in holdingTag.tags) {
        tagged.push(symbol);
      }
    }
    
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
  
  // Tags are portfolio-scoped - filter to include only tags that:
  // 1. Belong to holdings in the current portfolio
  // 2. Match the current portfolio's ID (or are global tags with no portfolio_id)
  const currentPortfolioHoldingTags = allHoldingTags.filter(ht => 
    allHoldings.includes(ht.symbol) &&
    (ht.portfolio_id === selectedPortfolioId || !ht.portfolio_id)
  );
  
  const allTaggedSymbols = new Set(currentPortfolioHoldingTags.map(ht => ht.symbol));
  const holdingsWithoutTags = allHoldings.filter(symbol => !allTaggedSymbols.has(symbol));

  return (
    <>
      {/* Header Section */}
      <div className="sticky z-30 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700" style={{ top: '37px' }}>
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
              onClick={() => setShowHelpDialog(true)}
            >
              <HelpCircle size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="sticky z-20 bg-gray-800 border-t border-b border-gray-700" style={{ top: '114px' }}>
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
            const existingChart = getExistingChart(definition.name);
            const currentChartType = existingChart?.chart_type || chartTypePreference[definition.name] || getChartType(definition);

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

                  {/* Chart Preview Section */}
                  <div className="mt-6 pt-4 border-t border-gray-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-300">Chart Preview</h4>
                      <div className="flex items-center gap-2">
                        {/* Chart Type Toggle for ENUM tags only (BOOLEAN uses gauge exclusively) */}
                        {definition.tag_type === TagType.ENUM && (
                          <div className="flex items-center bg-gray-700/20 rounded-md border border-gray-600/30 p-0.5">
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'pie')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'pie'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <PieChartIcon size={12} />
                              Pie
                            </button>
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'bar')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'bar'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <BarChart3 size={12} />
                              Bar
                            </button>
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'treemap')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'treemap'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <Grid3x3 size={12} />
                              Tree
                            </button>
                          </div>
                        )}
                        
                        {/* Chart Type Toggle for MAP tags */}
                        {definition.tag_type === TagType.MAP && (
                          <div className="flex items-center bg-gray-700/20 rounded-md border border-gray-600/30 p-0.5">
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'stacked-bar')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'stacked-bar'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <BarChart3 size={12} />
                              Stacked
                            </button>
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'sunburst')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'sunburst'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <CircleDot size={12} />
                              Sunburst
                            </button>
                          </div>
                        )}
                        
                        {/* Chart Type Toggle for HIERARCHICAL tags */}
                        {definition.tag_type === TagType.HIERARCHICAL && (
                          <div className="flex items-center bg-gray-700/20 rounded-md border border-gray-600/30 p-0.5">
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'sunburst')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'sunburst'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <CircleDot size={12} />
                              Sunburst
                            </button>
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'sankey')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'sankey'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <Layers size={12} />
                              Sankey
                            </button>
                          </div>
                        )}
                        
                        {/* Chart Type Toggle for RELATIONSHIP tags */}
                        {definition.tag_type === TagType.RELATIONSHIP && (
                          <div className="flex items-center bg-gray-700/20 rounded-md border border-gray-600/30 p-0.5">
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'dependency-wheel')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'dependency-wheel'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <CircleDot size={12} />
                              Wheel
                            </button>
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'sankey')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'sankey'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <Layers size={12} />
                              Sankey
                            </button>
                          </div>
                        )}
                        
                        {/* Chart Type Toggle for TIME_BASED tags */}
                        {definition.tag_type === TagType.TIME_BASED && (
                          <div className="flex items-center bg-gray-700/20 rounded-md border border-gray-600/30 p-0.5">
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'timeline')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'timeline'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <GanttChart size={12} />
                              Timeline
                            </button>
                            <button
                              onClick={() => handleChartTypeToggle(definition.name, 'calendar')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-all ${
                                currentChartType === 'calendar'
                                  ? 'bg-blue-500/20 text-blue-200'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <CalendarIcon size={12} />
                              Calendar
                            </button>
                          </div>
                        )}
                        
                        {/* Add/Remove Chart Button */}
                        {(() => {
                          const existingChart = getExistingChart(definition.name);
                          const isChartable = [TagType.ENUM, TagType.BOOLEAN, TagType.MAP, TagType.HIERARCHICAL, TagType.SCALAR, TagType.RELATIONSHIP, TagType.TIME_BASED].includes(definition.tag_type);
                          
                          if (!isChartable) {
                            return null;
                          }
                          
                          return existingChart ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveChart(existingChart.chart_id)}
                              className="text-red-400 hover:text-red-300 border-red-400/30 hover:border-red-400/50 h-7 text-xs"
                            >
                              <X size={12} className="mr-1" />
                              Remove from Portfolio
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddChart(definition.name, definition)}
                              className="text-green-400 hover:text-green-300 border-green-400/30 hover:border-green-400/50 h-7 text-xs"
                              disabled={taggedHoldings.length === 0}
                            >
                              <Plus size={12} className="mr-1" />
                              Add to Portfolio
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {(() => {
                      // Use the currentChartType calculated above
                      // Handle different tag types
                      
                      // Handle SCALAR tags (bubble chart)
                      if (definition.tag_type === TagType.SCALAR) {
                        const bubbleData = generateBubbleChartData(definition.name, definition);
                        if (!bubbleData) {
                          return (
                            <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                              <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                              <p className="text-sm text-gray-400">No scalar data available</p>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                            <BubbleChart
                              title=""
                              data={bubbleData}
                              baseCurrency={portfolioMetadata.base_currency}
                              hideValues={false}
                              getSymbolName={getHoldingName}
                            />
                          </div>
                        );
                      }
                      
                      // Handle RELATIONSHIP tags (dependency wheel or sankey)
                      if (definition.tag_type === TagType.RELATIONSHIP) {
                        if (currentChartType === 'sankey') {
                          const sankeyData = generateRelationshipSankeyData(definition.name, definition);
                          if (!sankeyData) {
                            return (
                              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                                <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                                <p className="text-sm text-gray-400">No relationship data available</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                              <SankeyChart
                                title=""
                                data={sankeyData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            </div>
                          );
                        } else {
                          const wheelData = generateDependencyWheelData(definition.name, definition);
                          if (!wheelData) {
                            return (
                              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                                <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                                <p className="text-sm text-gray-400">No relationship data available</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                              <DependencyWheelChart
                                title=""
                                data={wheelData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            </div>
                          );
                        }
                      }
                      
                      if (definition.tag_type === TagType.MAP) {
                        // Support both stacked-bar and sunburst for MAP tags
                        if (currentChartType === 'sunburst') {
                          const sunburstData = generateMapSunburstData(definition.name);
                          if (!sunburstData) {
                            return (
                              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                                <CircleDot size={48} className="mx-auto mb-3 text-gray-500" />
                                <p className="text-sm text-gray-400">No weighted exposure data</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                              <SunburstChart
                                title=""
                                data={sunburstData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            </div>
                          );
                        } else {
                          const mapData = generateMapChartData(definition.name);
                          if (!mapData) {
                            return (
                              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                                <BarChart3 size={48} className="mx-auto mb-3 text-gray-500" />
                                <p className="text-sm text-gray-400">No weighted exposure data</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                              <StackedBarChart
                                title=""
                                data={mapData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            </div>
                          );
                        }
                      }
                      
                      if (definition.tag_type === TagType.HIERARCHICAL) {
                        const hierarchicalData = generateHierarchicalChartData(definition.name);
                        if (!hierarchicalData) {
                          return (
                            <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                              <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                              <p className="text-sm text-gray-400">No hierarchical data</p>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                            {currentChartType === 'sankey' ? (
                              <SankeyChart
                                title=""
                                data={hierarchicalData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            ) : (
                              <SunburstChart
                                title=""
                                data={hierarchicalData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            )}
                          </div>
                        );
                      }
                      
                      // Handle TIME_BASED tags (timeline or calendar)
                      if (definition.tag_type === TagType.TIME_BASED) {
                        if (currentChartType === 'calendar') {
                          const calendarData = generateCalendarData(definition.name, definition);
                          if (!calendarData) {
                            return (
                              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                                <CalendarIcon size={48} className="mx-auto mb-3 text-gray-500" />
                                <p className="text-sm text-gray-400">No time-based data available</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                              <CalendarView
                                title=""
                                data={calendarData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            </div>
                          );
                        } else {
                          const timelineData = generateTimelineData(definition.name, definition);
                          if (!timelineData) {
                            return (
                              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                                <GanttChart size={48} className="mx-auto mb-3 text-gray-500" />
                                <p className="text-sm text-gray-400">No timeline data available</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                              <TimelineChart
                                title=""
                                data={timelineData}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            </div>
                          );
                        }
                      }
                      
                      // Handle BOOLEAN tags - always use gauge
                      if (definition.tag_type === TagType.BOOLEAN) {
                        const chartData = generateChartData(definition.name, definition);
                        if (!chartData) {
                          return (
                            <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                              <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                              <p className="text-sm text-gray-400">No tagged holdings to display</p>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                            <GaugeChart
                              title=""
                              data={chartData}
                              baseCurrency={portfolioMetadata.base_currency}
                              hideValues={false}
                            />
                          </div>
                        );
                      }
                      
                      // Handle ENUM tags
                      // For treemap, use different data structure
                      if (currentChartType === 'treemap' && definition.tag_type === TagType.ENUM) {
                        const treeMapData = generateTreeMapData(definition.name, definition);
                        if (!treeMapData) {
                          return (
                            <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                              <Grid3x3 size={48} className="mx-auto mb-3 text-gray-500" />
                              <p className="text-sm text-gray-400">No tagged holdings to display</p>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                            <TreeMapChart
                              title=""
                              data={treeMapData}
                              baseCurrency={portfolioMetadata.base_currency}
                              hideValues={false}
                              getSymbolName={getHoldingName}
                            />
                          </div>
                        );
                      }
                      
                      // For ENUM tags - pie and bar charts
                      if (definition.tag_type === TagType.ENUM) {
                        const chartData = generateChartData(definition.name, definition);
                        if (!chartData) {
                          return (
                            <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                              <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                              <p className="text-sm text-gray-400">No tagged holdings to display</p>
                            </div>
                          );
                        }
                        
                        const chartTotal = chartData.reduce((sum, item) => sum + item.value, 0);
                        
                        return (
                          <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg overflow-hidden">
                            {currentChartType === 'pie' ? (
                              <PieChart
                                title=""
                                data={chartData}
                                total={chartTotal}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                                getSymbolName={getHoldingName}
                              />
                            ) : (
                              <BarChart
                                title=""
                                data={chartData}
                                total={chartTotal}
                                baseCurrency={portfolioMetadata.base_currency}
                                hideValues={false}
                              />
                            )}
                          </div>
                        );
                      }
                      
                      // Fallback for unsupported tag types
                      return (
                        <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-8 text-center">
                          <PieChartIcon size={48} className="mx-auto mb-3 text-gray-500" />
                          <p className="text-sm text-gray-400">Chart type not supported for this tag</p>
                        </div>
                      );
                    })()}
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

        {/* Help Dialog */}
        <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Tags className="h-6 w-6 text-blue-400" />
                About Tags
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed">
                Organize and categorize your investments with custom tags
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">What are Tags?</h4>
                <p className="text-sm leading-relaxed">
                  Tags allow you to create custom categories and classifications for your holdings. 
                  Use them to organize investments by sector, strategy, risk level, or any custom criteria that matters to you.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Key Features</h4>
                <ul className="text-sm space-y-2 list-disc list-inside">
                  <li>Create and manage custom tags for your holdings</li>
                  <li>Generate customized infographics and pie charts from tagged holdings</li>
                  <li>Filter and group holdings by tag values in the Portfolio page</li>
                  <li>Multiple tag types supported (Categorical, Boolean, Weighted Exposure, and more)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Managing Tags</h4>
                <p className="text-sm leading-relaxed mb-2">
                  You can manage tags in two ways:
                </p>
                <ul className="text-sm space-y-2 list-disc list-inside">
                  <li><strong>This page:</strong> Create tag definitions and manage tags across all holdings</li>
                  <li><strong>Portfolio page:</strong> Add or edit tags for individual holdings in the Holdings table</li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
                <h4 className="font-semibold text-blue-200 mb-2 flex items-center gap-2">
                  <PieChartIcon size={16} />
                  Chart Generation
                </h4>
                <p className="text-sm leading-relaxed">
                  For <strong>Categorical</strong> and <strong>Boolean</strong> tags, you can create pie charts 
                  that show the distribution of your portfolio across different tag values. 
                  Charts appear on your Portfolio page and update automatically as you modify tags.
                </p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-200 mb-2 flex items-center gap-2">
                  <Plus size={16} />
                  Get Started
                </h4>
                <p className="text-sm leading-relaxed">
                  Click the <strong>"Create Tag"</strong> button to create your first tag and explore 
                  the different tag types available. Each type offers unique ways to organize your investments.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowHelpDialog(false)}>
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
} 