import React, { useState, useEffect, useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { SecurityHolding, HoldingsTableData, TagDefinition, TagLibrary, TagType, TagValue } from './types';
import HoldingsHeatmap from './HoldingsHeatmap';
import { usePortfolioData } from './contexts/PortfolioDataContext';
import { useMediaQuery } from './hooks/useMediaQuery';
import TagDisplay from './components/TagDisplay';
import TagEditor from './components/TagEditor';
import EarningsCalendar from './components/EarningsCalendar';
import { Select, SelectContent, SelectItem, SelectTrigger } from './components/ui/select';
import TagAPI from './utils/tag-api';
import { HoldingsTableSkeleton, HoldingsHeatmapSkeleton } from './components/PortfolioSkeleton';

import {
  Search,
  ArrowUpDown,
  Wallet,
  Building2,
  Bitcoin,
  CircleDollarSign,
  Banknote,
  ChartNoAxesCombined,
  Table,
  Flame,
  ChevronDown,
  ChevronRight,
  Users,
  Plus,
  Calendar,
} from 'lucide-react';

import israelFlag from './assets/israel-flag.svg';
import usFlag from './assets/us-flag.svg';
import bitcoinLogo from './assets/bitcoin.svg';
import smhLogo from './assets/smh.svg';
import vanguardLogo from './assets/vanguard.svg';
import appLogo from './assets/logo.png';

const TAG_TYPE_INFO = {
  [TagType.ENUM]: { icon: "🏷️" },
  [TagType.MAP]: { icon: "🗺️" },
  [TagType.SCALAR]: { icon: "📊" },
  [TagType.HIERARCHICAL]: { icon: "🌳" },
  [TagType.BOOLEAN]: { icon: "✅" },
  [TagType.TIME_BASED]: { icon: "⏰" },
  [TagType.RELATIONSHIP]: { icon: "🔗" }
};


interface HoldingsTableProps {
  data: HoldingsTableData;
  isValueVisible: boolean;
  isLoading?: boolean;
}

const getSecurityTypeIcon = (type: string) => {
  const iconProps = { size: 16, className: "text-gray-400" };
  switch (type.toLowerCase()) {
    case 'stock':
      return <ChartNoAxesCombined {...iconProps} />;
    case 'etf':
      return <Wallet {...iconProps} />;
    case 'crypto':
      return <Bitcoin {...iconProps} />;
    case 'real-estate':
      return <Building2 {...iconProps} />;
    case 'cash':
      return <CircleDollarSign {...iconProps} />;
    case 'bond':
      return <Banknote {...iconProps} />;
    default:
      return <Wallet {...iconProps} />;
  }
};

// Helper to get logo URL
const getLogoUrl = (holding: SecurityHolding) => {
    const symbol = holding.symbol;
    if (symbol.toUpperCase() === 'SMH') {
        return smhLogo;
    }

    if (holding.logo) {
        return holding.logo;
    }

  if (symbol.toUpperCase() === 'IBIT') {
    return bitcoinLogo;
  }

    if (symbol.toUpperCase() === 'VTI' || symbol.toUpperCase() === 'VXUS') {
    return vanguardLogo;
  }

  if (symbol.toUpperCase() === 'ILS' || /^\d+$/.test(symbol)) {
    return israelFlag;
  }
  if (symbol.toUpperCase() === 'USD') {
    return usFlag;
  }


  // Default to app logo for other types
  return appLogo;
};


const MiniChart: React.FC<{ 
  data: SecurityHolding['historical_prices'], 
  symbol: string, 
  currency: string, 
  baseCurrency: string,
  onTooltipShow: (tooltipData: { x: number; y: number; content: string; visible: boolean }) => void,
  onTooltipHide: () => void
}> = ({ data, symbol, currency, baseCurrency, onTooltipShow, onTooltipHide }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Determine colors based on trend
  let lineColor = '#10b981'; // green by default
  let gradientStart = 'rgba(16, 185, 129, 0.3)';
  let gradientEnd = 'rgba(16, 185, 129, 0.0)';

  if (data && data.length > 1) {
    const first = data[0].price;
    const last = data[data.length - 1].price;
    if (last < first) {
      lineColor = '#ef4444'; // red
      gradientStart = 'rgba(239, 68, 68, 0.3)';
      gradientEnd = 'rgba(239, 68, 68, 0.0)';
    }
  }

  // Calculate min and max for better scaling
  const prices = data.map(point => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  // Add padding to make variations more visible
  const padding = priceRange * 0.1; // 10% padding
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;

  const options: Highcharts.Options = {
    chart: {
      type: 'area',
      height: 40,
      width: 120,
      backgroundColor: 'transparent',
      margin: [4, 4, 4, 4],
      style: { overflow: 'visible' },
      spacing: [0, 0, 0, 0]
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      type: 'datetime',
      visible: false,
      minPadding: 0,
      maxPadding: 0,
      lineWidth: 0,
      tickLength: 0
    },
    yAxis: {
      visible: false,
      minPadding: 0,
      maxPadding: 0,
      lineWidth: 0,
      tickLength: 0,
      gridLineWidth: 0,
      min: yMin,
      max: yMax
    },
    legend: { enabled: false },
    tooltip: {
      enabled: false, // Disable built-in tooltip since we're using custom one
      useHTML: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderWidth: 0,
      shadow: false,
      style: {
        color: '#e5e7eb',
        fontWeight: 'normal',
        fontSize: '12px',
        borderRadius: 8,
      },
      borderRadius: 8,
      outside: true,
      hideDelay: 0,
      followPointer: true,
      formatter: function(this: unknown) {
        const point = (this as { point: { index: number; y: number } }).point;
        const date = new Date(data[point.index].date);
        // For forex symbols (FX:) and legacy USD, show base currency
        const displayCurrency = symbol === 'USD' || symbol.startsWith('FX:') ? baseCurrency : currency;
        const priceChange = point.index > 0 ? point.y - data[point.index - 1].price : 0;
        const priceChangePercent = point.index > 0 ? ((priceChange / data[point.index - 1].price) * 100) : 0;

        return `
          <div style="padding: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${date.toLocaleDateString()}</div>
            <div style="font-size: 14px; font-weight: 700; color: ${lineColor}; margin-bottom: 2px;">
              ${point.y?.toFixed(2)} ${displayCurrency}
            </div>
            ${priceChange !== 0 ? `
              <div style="font-size: 11px; color: ${priceChange > 0 ? '#10b981' : '#ef4444'};">
                ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)
              </div>
            ` : ''}
          </div>
        `;
      }
    },
    plotOptions: {
      area: {
        fillOpacity: 0.3,
        lineWidth: 2,
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true,
              fillColor: lineColor,
              lineColor: '#ffffff',
              lineWidth: 2,
              radius: 4
            }
          }
        },
        states: {
          hover: {
            lineWidth: 3,
            halo: {
              size: 8,
              opacity: 0.2
            }
          }
        }
      }
    },
    series: [{
      type: 'area',
      data: data.map((point, index) => ({
        x: new Date(point.date).getTime(),
        y: point.price,
        marker: {
          enabled: hoveredIndex === index,
          fillColor: lineColor,
          lineColor: '#ffffff',
          lineWidth: 2,
          radius: 4,
          symbol: 'circle'
        }
      })),
      color: lineColor,
      fillColor: {
        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
        stops: [
          [0, gradientStart],
          [1, gradientEnd]
        ]
      },
      lineWidth: 2,
      states: {
        hover: {
          lineWidth: 3,
          halo: {
            size: 8,
            opacity: 0.2
          }
        }
      },
      animation: {
        duration: 300
      }
    }]
  };

  return (
    <div 
      data-chart-area
      onMouseMove={(e) => {
        if (!data || data.length === 0) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const chartWidth = rect.width;
        
        // Calculate which data point is closest to the mouse position
        const dataIndex = Math.round((mouseX / chartWidth) * (data.length - 1));
        const clampedIndex = Math.max(0, Math.min(dataIndex, data.length - 1));
        const point = data[clampedIndex];
        
        // Only update hovered index if it actually changed
        if (hoveredIndex !== clampedIndex) {
          setHoveredIndex(clampedIndex);
        }
        
        if (point) {
          const date = new Date(point.date);
          // For forex symbols (FX:) and legacy USD, show base currency
          const displayCurrency = symbol === 'USD' || symbol.startsWith('FX:') ? baseCurrency : currency;
          
          // Calculate daily change if not the first point
          let dailyChange = 0;
          let dailyChangePercent = 0;
          if (clampedIndex > 0) {
            const prevPrice = data[clampedIndex - 1].price;
            dailyChange = point.price - prevPrice;
            dailyChangePercent = ((dailyChange / prevPrice) * 100);
          }
          
          const tooltipContent = `
            <div style="padding: 6px;">
              <div style="font-weight: 600; margin-bottom: 4px; color: #e5e7eb;">
                ${date.toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric'
                })}
              </div>
              <div style="font-size: 14px; font-weight: 700; color: ${lineColor}; margin-bottom: 2px;">
                ${point.price.toFixed(2)} ${displayCurrency}
              </div>
              ${clampedIndex > 0 ? `
                <div style="font-size: 11px; color: ${dailyChange >= 0 ? '#10b981' : '#ef4444'};">
                  ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)} (${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%) vs prev day
                </div>
              ` : `
                <div style="font-size: 11px; color: #93c5fd;">
                  First day
                </div>
              `}
            </div>
          `;
          
          onTooltipShow({
            x: e.clientX,
            y: rect.top - 10,
            content: tooltipContent,
            visible: true
          });
        }
      }}
      onMouseLeave={() => {
        setHoveredIndex(null);
        onTooltipHide();
      }}
    >
      <HighchartsReact 
        highcharts={Highcharts} 
        options={options} 
        allowChartUpdate={true}
        updateArgs={[true, true, true]}
      />
    </div>
  );
};

const AccountBreakdownRow: React.FC<{
  accountBreakdown: SecurityHolding['account_breakdown'],
  baseCurrency: string,
  isValueVisible: boolean
}> = ({ accountBreakdown, baseCurrency, isValueVisible }) => {
  if (!accountBreakdown || accountBreakdown.length === 0) {
    return null;
  }

  const totalValue = accountBreakdown.reduce((sum, account) => sum + account.value, 0);

  return (
    <div className="bg-gray-800/40 border-t border-blue-400/20 p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Users size={16} className="text-blue-400" />
          Account Distribution
          <span className="text-xs text-gray-400 font-normal ml-2">
            ({accountBreakdown.length} account{accountBreakdown.length > 1 ? 's' : ''})
          </span>
        </h4>
      </div>
      <div className="space-y-3">
        {accountBreakdown.map((account) => {
          const percentage = totalValue > 0 ? ((account.value / totalValue) * 100).toFixed(1) : '0.0';
          return (
            <div key={account.account_name} className="p-3 bg-gray-700/40 rounded-lg border border-gray-600/30 hover:border-blue-400/30 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-blue-300 truncate">{account.account_name}</span>
                  <span className="text-xs text-gray-400 bg-gray-600/60 px-2 py-0.5 rounded-md border border-gray-500/30">
                    {account.account_type}
                  </span>
                </div>
                {account.owners.length > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-600/40 px-2 py-0.5 rounded-md border border-gray-500/20">
                    {account.owners.join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                {isValueVisible && (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="text-gray-400">Units:</span>
                      <span className="font-medium">{Math.round(account.units).toLocaleString()}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-gray-400">Value:</span>
                      <span className="font-medium text-blue-200">
                        {Math.round(account.value).toLocaleString()} {baseCurrency}
                      </span>
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">Share:</span>
                  <span className="font-medium text-green-300">{percentage}%</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: keyof SecurityHolding | 'percent_change';
  sortConfig: { key: keyof SecurityHolding | 'percent_change'; direction: 'asc' | 'desc' };
  onSort: (key: keyof SecurityHolding | 'percent_change') => void;
}> = ({ label, sortKey, sortConfig, onSort }) => (
  <div
    className="flex items-center gap-1 cursor-pointer group"
    onClick={() => onSort(sortKey)}
  >
    <span>{label}</span>
    <ArrowUpDown size={14} className={`
      ${sortConfig.key === sortKey ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}
      ${sortConfig.direction === 'asc' && sortConfig.key === sortKey ? 'rotate-180' : ''}
      transition-opacity
    `} />
  </div>
);

const HoldingsTable: React.FC<HoldingsTableProps> = ({ data, isValueVisible, isLoading = false }) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof SecurityHolding | 'percent_change';
    direction: 'asc' | 'desc';
  }>({ key: 'total_value', direction: 'desc' });

  // Clean symbol display function (same logic as AccountSelector)
  const getDisplaySymbol = (symbol: string) => {
    let displaySymbol = symbol;
    
    // Remove exchange prefixes for clean display
    if (displaySymbol.toUpperCase().startsWith('NYSE:')) {
      return displaySymbol.substring(5); // Remove "NYSE:"
    }
    if (displaySymbol.toUpperCase().startsWith('NASDAQ:')) {
      return displaySymbol.substring(7); // Remove "NASDAQ:"
    }
    if (displaySymbol.toUpperCase().startsWith('TASE:')) {
      return displaySymbol.substring(5); // Remove "TASE:"
    }
    if (displaySymbol.toUpperCase().startsWith('FX:')) {
      return displaySymbol.substring(3); // Remove "FX:" for clean currency display
    }
    
    // For crypto symbols, remove -USD suffix for cleaner display
    if (displaySymbol.endsWith('-USD')) {
      return displaySymbol.replace('-USD', '');
    }
    
    return displaySymbol;
  };

  // Get real earnings data from context
  const { getEarningsBySymbol, getPercentChange } = usePortfolioData();
  
  // Add real earnings data to holdings - memoized to prevent infinite loops
  const dataWithRealEarnings = useMemo(() => {
    return {
      ...data,
      holdings: data.holdings.map(holding => {
        const earningsData = getEarningsBySymbol(holding.symbol);
        if (earningsData && earningsData.length > 0) {
          return {
            ...holding,
            earnings_calendar: earningsData
          };
        }
        return holding;
      })
    };
  }, [data, getEarningsBySymbol]);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedEarnings, setExpandedEarnings] = useState<string | null>(null);
  const [chartTooltipData, setChartTooltipData] = useState<{ x: number; y: number; content: string; visible: boolean } | null>(null);
  const [earningsTooltipData, setEarningsTooltipData] = useState<{ x: number; y: number; content: string; visible: boolean } | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Auto-hide chart tooltip when mouse moves outside chart areas
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!chartTooltipData?.visible) return;

      // Check if mouse is over any chart element
      const target = e.target as HTMLElement;
      const isOverChart = target?.closest('[data-chart-area]') || 
                         target?.closest('.highcharts-container') ||
                         target?.tagName?.toLowerCase() === 'svg';
      
      // If mouse is not over any chart area, hide the tooltip
      if (!isOverChart) {
        setChartTooltipData(null);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => document.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [chartTooltipData?.visible]);

  // Auto-hide tooltip after 3 seconds as a safety net
  useEffect(() => {
    if (!chartTooltipData?.visible) return;

    const hideTimer = setTimeout(() => {
      setChartTooltipData(null);
    }, 3000); // Hide after 3 seconds

    return () => clearTimeout(hideTimer);
  }, [chartTooltipData?.visible]);

  const [filters, setFilters] = useState<{
    symbol: string;
    type: string;
  }>({
    symbol: '',
    type: ''
  });

  const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('table');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Tag management state
  const [tagLibrary, setTagLibrary] = useState<TagLibrary | null>(null);
  const [editingTag, setEditingTag] = useState<{ symbol: string; definition: TagDefinition; value?: any } | null>(null);

  // Get tags and quotes from context (no more API calls needed!)
  const { getUserTagLibrary, refreshTagsOnly, allPortfoliosData } = usePortfolioData();

  // Load tag library from context (tags are already in holding.tags from computedData)
  useEffect(() => {
    try {
      const library = getUserTagLibrary();
      
      if (library && typeof library === 'object') {
        setTagLibrary(library);
      } else {
        setTagLibrary({ user_id: '', tag_definitions: {}, template_tags: {} });
      }
    } catch (error) {
      console.error('Error loading tag library:', error);
      setTagLibrary({ user_id: '', tag_definitions: {}, template_tags: {} });
    }
  }, [getUserTagLibrary, allPortfoliosData?.user_tag_library]);

  // Handle tag updates (refresh only tags - lightweight and fast!)
  const handleTagsUpdated = async () => {
    try {
      await refreshTagsOnly();
    } catch (error) {
      console.error('Error refreshing tags after update:', error);
    }
  };

  // Handle tag click for filtering
  const handleTagClick = (tagName: string) => {
    if (tagFilter === tagName) {
      // Clicking the same tag clears the filter
      setTagFilter(null);
    } else {
      // Set new tag filter
      setTagFilter(tagName);
    }
  };

  const filteredAndSortedHoldings = [...dataWithRealEarnings.holdings]
    .filter(holding => {
      // Apply symbol and type filters
      const matchesSymbol = holding.symbol.toLowerCase().includes(filters.symbol.toLowerCase());
      const matchesType = holding.security_type.toLowerCase().includes(filters.type.toLowerCase());

      // Apply tag filter if active
      let matchesTag = true;
      if (tagFilter) {
        // Use holding.tags (fresh from context) instead of structuredTags (stale local state)
        matchesTag = holding.tags && Object.keys(holding.tags).includes(tagFilter);
      }

      return matchesSymbol && matchesType && matchesTag;
    })
    .sort((a, b) => {
      // Stocks first, then by total_value desc (default)
      const aIsStock = a.security_type.toLowerCase() === 'stock';
      const bIsStock = b.security_type.toLowerCase() === 'stock';
      if (aIsStock !== bIsStock) {
        return aIsStock ? -1 : 1;
      }
      // Then sort by the selected key
      const key = sortConfig.key;
      let aValue, bValue;
      
      if (key === 'percent_change') {
        // Special handling for percent_change which comes from getPercentChange function
        aValue = getPercentChange(a.symbol);
        bValue = getPercentChange(b.symbol);
      } else {
        // Regular property access for SecurityHolding properties
        aValue = a[key as keyof SecurityHolding];
        bValue = b[key as keyof SecurityHolding];
      }
      
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (key: keyof SecurityHolding | 'percent_change') => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const calculatePercentage = (holding: SecurityHolding) => {
    const total = dataWithRealEarnings.holdings.reduce((sum, h) => sum + h.total_value, 0);
    return ((holding.total_value / total) * 100).toFixed(1);
  };

  const handleRemoveTag = async (symbol: string, tagName: string) => {
    try {
      await TagAPI.removeHoldingTag(symbol, tagName);
      await handleTagsUpdated();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const handleAddTag = async (symbol: string, tagName: string) => {
    if (!tagLibrary) return;

    const tagDefinition = tagLibrary.tag_definitions[tagName];
    if (tagDefinition) {
      setEditingTag({ symbol, definition: tagDefinition });
    }
  };

  const handleSaveTag = async (tagValue: any) => {
    if (!editingTag) return;

    try {
      await TagAPI.setHoldingTag(editingTag.symbol, tagValue.tag_name, tagValue);
      await handleTagsUpdated();
      setEditingTag(null);
    } catch (error) {
      console.error('Error saving tag:', error);
      throw error;
    }
  };

  const renderTags = (holding: SecurityHolding, showManagementControls: boolean = true) => {
    // Get tags from holding data (should contain merged tags from context)
    const tagsToDisplay = holding.tags;
    
    // Get user defined tags
    let userDefinedTags: TagDefinition[] = [];
    try {
      if (tagLibrary?.tag_definitions && typeof tagLibrary.tag_definitions === 'object') {
        userDefinedTags = Object.values(tagLibrary.tag_definitions);
      }
    } catch (e) {
      console.error('Error processing tag library:', e);
      userDefinedTags = [];
    }

    return (
      <div className="flex items-center gap-2 group">
        {(() => {
          // Filter to only include proper TagValue objects
          if (!tagsToDisplay || Object.keys(tagsToDisplay).length === 0) return null;
          
          const properTagValues: Record<string, TagValue> = {};
          Object.entries(tagsToDisplay).forEach(([tagName, tagValue]) => {
            if (typeof tagValue === 'object' && tagValue !== null && 'tag_type' in tagValue) {
              properTagValues[tagName] = tagValue as TagValue;
            }
          });
          
          if (Object.keys(properTagValues).length === 0) return null;
          
          return (
            <TagDisplay
              tags={properTagValues}
              maxTags={0}
              compact={isMobile}
              onTagClick={(tagName) => handleTagClick(tagName)}
              activeFilter={tagFilter}
              onRemoveTag={showManagementControls ? (tagName) => handleRemoveTag(holding.symbol, tagName) : undefined}
              showRemoveButtons={showManagementControls}
            />
          );
        })()}

        {(() => {
          const shouldShowAddButton = showManagementControls && userDefinedTags.length > 0;
          
          if (!shouldShowAddButton) return null;
          
          // Create a stable key based on symbol and current tags to force dropdown re-render when tags change
          const dropdownKey = `${holding.symbol}-${holding.tags ? Object.keys(holding.tags).sort().join(',') : 'notags'}`;
          
          return (
            <Select key={dropdownKey} onValueChange={(tagName) => handleAddTag(holding.symbol, tagName)}>
              <SelectTrigger className="w-8 h-6 border-none bg-transparent p-0 hover:bg-gray-700/30 transition-all focus:ring-1 focus:ring-blue-500/50 opacity-60 group-hover:opacity-100">
                <Plus size={14} className="text-gray-400 hover:text-blue-400" />
              </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600/30 backdrop-blur-sm shadow-lg">
              <div className="p-2">
                <p className="text-xs text-gray-400 mb-2 px-2">Add tag to {holding.symbol}:</p>
                {userDefinedTags.map((tagDef) => {
                  // Don't show tags that are already assigned
                  // Use holding.tags (fresh from context) instead of stale local state
                  const isAlreadyAssigned = holding.tags && holding.tags[tagDef.name];
                  if (isAlreadyAssigned) return null;

                  return (
                    <SelectItem
                      key={tagDef.name}
                      value={tagDef.name}
                      className="text-gray-200 hover:bg-gray-700/50 focus:bg-gray-700/50 cursor-pointer rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{TAG_TYPE_INFO[tagDef.tag_type]?.icon || '🏷️'}</span>
                        <span>{tagDef.display_name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
                {userDefinedTags.filter(tagDef => !(holding.tags && holding.tags[tagDef.name])).length === 0 && (
                  <div className="px-2 py-3 text-xs text-gray-500 text-center">
                    All your tags are already assigned
                  </div>
                )}
              </div>
            </SelectContent>
            </Select>
          );
        })()}
      </div>
    );
  };

  // Show skeleton if loading
  if (isLoading) {
    return <HoldingsTableSkeleton />;
  }

  return (
    <div className="w-full">
      {/* Title and Toggle Header */}
      <div className="flex items-center justify-between px-0 py-3 mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-white">Holdings Overview</h3>

          {/* Tag Filter Indicator */}
          {tagFilter && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-md">
              <span className="text-sm text-blue-200">
                Filtered by: <span className="font-medium">{tagFilter.replace(/_/g, ' ')}</span>
                <span className="text-xs ml-1 opacity-75">
                  ({filteredAndSortedHoldings.length} of {dataWithRealEarnings.holdings.length})
                </span>
              </span>
              <button
                onClick={() => setTagFilter(null)}
                className="text-blue-300 hover:text-blue-100 transition-colors"
                title="Clear filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div
          onClick={() => setViewMode(viewMode === 'table' ? 'heatmap' : 'table')}
          className="flex items-center bg-gray-700/20 backdrop-blur-sm rounded-md border border-blue-400/30 p-1 cursor-pointer select-none"
        >
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 ${
            viewMode === 'table'
              ? 'bg-blue-500/20 text-blue-200 shadow-sm'
              : 'text-gray-400'
          }`}>
            <Table size={16} />
            Table
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 ${
            viewMode === 'heatmap'
              ? 'bg-blue-500/20 text-blue-200 shadow-sm'
              : 'text-gray-400'
          }`}>
            <Flame size={16} />
            Heatmap
          </div>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="border border-blue-400/30 rounded-md overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="h-14 bg-blue-500/10 backdrop-blur-sm border-b border-blue-400/30">
                <th className="px-2 md:px-4 text-left text-sm font-medium text-gray-200 first:rounded-tl-md w-8"></th>
                <th className="px-2 md:px-4 text-left text-sm font-medium text-gray-200">Type</th>
                <th className="px-2 md:px-4 text-left text-sm font-medium text-gray-200">
                  <div className="flex items-center gap-2">
                    <SortableHeader
                      label="Symbol"
                      sortKey="symbol"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <div className="relative hidden md:block">
                      <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filter..."
                        className="pl-7 pr-2 py-1 bg-gray-700/30 backdrop-blur-sm rounded-md text-xs w-24 border border-gray-600/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-400/50"
                        value={filters.symbol}
                        onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                      />
                    </div>
                  </div>
                </th>
                <th className="px-2 md:px-4 text-left text-sm font-medium text-gray-200 hidden md:table-cell">Name</th>
                <th className="px-2 md:px-4 text-left text-sm font-medium text-gray-200 hidden md:table-cell">Tags</th>
                <th className="px-2 md:px-4 text-right text-sm font-medium text-gray-200">
                  <SortableHeader
                    label={isMobile ? "Price" : "Price (Original)"}
                    sortKey="original_price"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-2 md:px-4 text-right text-sm font-medium text-gray-200 hidden md:table-cell">
                  <SortableHeader
                    label="1d Change"
                    sortKey="percent_change" 
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                {isValueVisible && (
                  <>
                    <th className="px-2 md:px-4 text-right text-sm font-medium text-gray-200 hidden md:table-cell">
                      <SortableHeader
                        label="Units"
                        sortKey="total_units"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-2 md:px-4 text-right text-sm font-medium text-gray-200">
                    <SortableHeader
                        label={isMobile ? `Value (${dataWithRealEarnings.base_currency})` : `Total Value (${dataWithRealEarnings.base_currency})`}
                        sortKey="total_value"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </th>
                  </>
                )}
                <th className="px-4 text-center text-sm font-medium text-gray-200 hidden md:table-cell">Earnings</th>
                <th className="px-4 text-center text-sm font-medium text-gray-200 last:rounded-tr-md hidden md:table-cell">7d Trend</th>

              </tr>
            </thead>
            <tbody>
              {filteredAndSortedHoldings.map((holding) => (
                <React.Fragment key={holding.symbol}>
                  <tr
                    className="h-16 border-b border-blue-400/30 hover:bg-blue-500/5 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === holding.symbol ? null : holding.symbol)}
                  >
                    <td className="px-2 md:px-4">
                      {holding.account_breakdown && holding.account_breakdown.length > 1 && (
                        <div className="flex items-center justify-center">
                          {expandedRow === holding.symbol ? (
                            <ChevronDown size={18} className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" />
                          ) : (
                            <ChevronRight size={18} className="text-gray-400 hover:text-blue-400 transition-colors cursor-pointer" />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 md:px-4">{getSecurityTypeIcon(holding.security_type)}</td>
                    <td className="px-2 md:px-4 font-medium text-blue-400">
                      <div className="flex items-center gap-2">
                        {/* Logo image */}
                        {(() => {
                          const logoUrl = getLogoUrl(holding);
                          const isUsFlag = logoUrl === usFlag;
                          const isFlag = logoUrl === israelFlag || isUsFlag;
                          if (logoUrl) {
                            return (
                              <img
                                src={logoUrl}
                                alt={holding.symbol + ' logo'}
                                className={
                                  isFlag
                                    ? 'w-5 h-5 rounded-full object-cover mr-1 transition-transform duration-200 hover:scale-150'
                                    : 'w-5 h-5 rounded-full bg-white object-contain border border-gray-300/40 mr-1 transition-transform duration-200 hover:scale-150'
                                }
                                onError={e => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            );
                          }
                          return null;
                        })()}
                        <span>{getDisplaySymbol(holding.symbol)}</span>
                        {holding.account_breakdown && holding.account_breakdown.length > 1 && (
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-md border border-blue-400/30">
                            {holding.account_breakdown.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 md:px-4 text-sm text-gray-300 hidden md:table-cell">{holding.name}</td>
                    <td className="px-2 md:px-4 text-sm hidden md:table-cell">
                      {renderTags(holding, true)} {/* Show all functionality: filter on click, remove buttons, add dropdown */}
                    </td>
                    <td className="px-2 md:px-4 text-right text-sm text-gray-200">
                      {(Math.round(holding.original_price * 100) / 100).toLocaleString()}
                      <span className="text-xs text-gray-400 ml-1">
                        {holding.symbol.startsWith('FX:') ? dataWithRealEarnings.base_currency : holding.original_currency}
                      </span>
                    </td>
                    <td className="px-2 md:px-4 text-right text-sm text-gray-200 hidden md:table-cell">
                      {(() => {
                        const percentChange = getPercentChange(holding.symbol);
                        const isPositive = percentChange > 0;
                        const isNeutral = percentChange === 0;
                        
                        return (
                          <span className={`font-medium ${
                            isNeutral ? 'text-gray-400' : 
                            isPositive ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </td>
                    {isValueVisible && (
                      <>
                        <td className="px-2 md:px-4 text-right text-sm text-gray-200 hidden md:table-cell">
                          {Math.round(holding.total_units).toLocaleString()}
                        </td>
                        <td className="px-2 md:px-4 text-right text-sm whitespace-nowrap text-gray-200">
                          {Math.round(holding.total_value).toLocaleString()}
                          <span className="text-xs text-gray-400 ml-1 hidden md:inline">
                            ({calculatePercentage(holding)}%)
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-2 md:px-4 hidden md:table-cell">
                      {holding.earnings_calendar && holding.earnings_calendar.length > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedEarnings(expandedEarnings === holding.symbol ? null : holding.symbol);
                          }}
                          onMouseEnter={(e) => {
                            if (holding.earnings_calendar && holding.earnings_calendar.length > 0) {
                              const upcomingEarnings = holding.earnings_calendar
                                .filter(earning => new Date(earning.date) > new Date())
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                              
                              if (upcomingEarnings.length > 0) {
                                const nextEarnings = upcomingEarnings[0];
                                const date = new Date(nextEarnings.date);
                                const today = new Date();
                                const diffTime = date.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                const tooltipContent = `
                                  <div style="padding: 4px;">
                                    <div style="font-weight: 600; margin-bottom: 4px;">${date.toLocaleDateString('en-US', { 
                                      weekday: 'long',
                                      month: 'long', 
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}</div>
                                    <div style="font-size: 14px; font-weight: 700; color: #60a5fa; margin-bottom: 2px;">
                                      Q${nextEarnings.quarter} Earnings
                                    </div>
                                    <div style="font-size: 11px; color: #93c5fd;">
                                      ${diffDays === 1 ? 'Tomorrow' : 
                                        diffDays === 0 ? 'Today' : 
                                        `in ${diffDays} days`}
                                    </div>
                                  </div>
                                `;
                                
                                const rect = e.currentTarget.getBoundingClientRect();
                                setEarningsTooltipData({
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 10,
                                  content: tooltipContent,
                                  visible: true
                                });
                              }
                            }
                          }}
                          onMouseLeave={() => {
                            setEarningsTooltipData(null);
                          }}
                          className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 transition-colors bg-transparent border-none p-2 rounded hover:bg-blue-500/10 w-full"
                        >
                          <Calendar size={16} />
                          <div className="text-xs text-gray-300">
                            {(() => {
                              // Find the next upcoming earnings date
                              const upcomingEarnings = holding.earnings_calendar
                                .filter(earning => new Date(earning.date) > new Date())
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                              
                              if (upcomingEarnings.length > 0) {
                                const nextEarnings = upcomingEarnings[0];
                                const date = new Date(nextEarnings.date);
                                const today = new Date();
                                const diffTime = date.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                return (
                                  <span className="text-xs font-medium text-blue-300">
                                    {diffDays === 1 ? 'Tomorrow' : 
                                     diffDays === 0 ? 'Today' : 
                                     `in ${diffDays} days`}
                                  </span>
                                );
                              } else {
                                // No upcoming earnings - show "No upcoming"
                                return (
                                  <span className="text-xs text-gray-500">
                                    No upcoming
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="text-xs text-gray-600">-</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 md:px-4 hidden md:table-cell">
                      {/* Show 7-day trend for currencies, crypto, and non-base currency holdings */}
                      {(() => {
                        const isBaseCurrency = holding.symbol === dataWithRealEarnings.base_currency;
                        const isCurrency = holding.symbol.startsWith('FX:');
                        const isCrypto = holding.symbol.endsWith('-USD');
                        const isLegacyUsd = holding.symbol === 'USD' && dataWithRealEarnings.base_currency === 'ILS';
                        
                        // Show chart for: currencies, crypto, non-base currencies, or legacy USD
                        const shouldShowChart = isCurrency || isCrypto || isLegacyUsd || !isBaseCurrency;
                        
                        return shouldShowChart ? (
                          <MiniChart 
                            data={holding.historical_prices} 
                            symbol={holding.symbol} 
                            currency={holding.original_currency} 
                            baseCurrency={dataWithRealEarnings.base_currency}
                            onTooltipShow={setChartTooltipData}
                            onTooltipHide={() => setChartTooltipData(null)}
                          />
                        ) : null;
                      })()}
                    </td>
                  </tr>
                  {expandedRow === holding.symbol && holding.account_breakdown && holding.account_breakdown.length > 1 && (
                    <tr>
                      <td colSpan={isValueVisible ? 11 : 9} className="p-0">
                        <AccountBreakdownRow
                          accountBreakdown={holding.account_breakdown}
                          baseCurrency={dataWithRealEarnings.base_currency}
                          isValueVisible={isValueVisible}
                        />
                      </td>
                    </tr>
                  )}
                  {expandedEarnings === holding.symbol && holding.earnings_calendar && holding.earnings_calendar.length > 0 && (
                    <tr>
                      <td colSpan={isValueVisible ? 11 : 9} className="p-0">
                        <EarningsCalendar
                          earningsData={holding.earnings_calendar}
                          symbol={holding.symbol}
                          compact={false}
                        />
                      </td>
                    </tr>
                  )}
                  {expandedRow === holding.symbol && isMobile && (
                    <tr className="bg-gray-800/50 md:hidden">
                      <td colSpan={isValueVisible ? 11 : 9} className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-bold text-gray-400">Name</p>
                            <p>{holding.name}</p>
                          </div>
                          <div>
                            <p className="font-bold text-gray-400">Performance</p>
                            <p>
                              {(() => {
                                const percentChange = getPercentChange(holding.symbol);
                                const isPositive = percentChange > 0;
                                const isNeutral = percentChange === 0;
                                
                                return (
                                  <span className={`font-medium ${
                                    isNeutral ? 'text-gray-400' : 
                                    isPositive ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
                                  </span>
                                );
                              })()}
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-gray-400">Tags</p>
                            <div>{renderTags(holding, true)}</div> {/* Show all functionality: filter on click, remove buttons, add dropdown */}
                          </div>
                          {isValueVisible && (
                            <div>
                              <p className="font-bold text-gray-400">Units</p>
                              <p>{Math.round(holding.total_units).toLocaleString()}</p>
                            </div>
                          )}
                          {holding.earnings_calendar && holding.earnings_calendar.length > 0 && (
                            <div className="col-span-2">
                              <p className="font-bold text-gray-400 mb-2">Earnings</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedEarnings(expandedEarnings === holding.symbol ? null : holding.symbol);
                                }}
                                className="flex items-center gap-2 mb-2 text-blue-400 hover:text-blue-300 transition-colors bg-transparent border-none p-2 rounded hover:bg-blue-500/10 w-full"
                                title={(() => {
                                  // Create tooltip with date information for mobile
                                  if (holding.earnings_calendar && holding.earnings_calendar.length > 0) {
                                    const upcomingEarnings = holding.earnings_calendar
                                      .filter(earning => new Date(earning.date) > new Date())
                                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                    
                                    if (upcomingEarnings.length > 0) {
                                      const nextEarnings = upcomingEarnings[0];
                                      const date = new Date(nextEarnings.date);
                                      return `Next earnings: ${date.toLocaleDateString('en-US', { 
                                        weekday: 'long',
                                        month: 'long', 
                                        day: 'numeric',
                                        year: 'numeric'
                                      })} Q${nextEarnings.quarter}`;
                                    } else {
                                      return "No upcoming earnings";
                                    }
                                  }
                                  return "View earnings calendar";
                                })()}
                              >
                                <Calendar 
                                  size={14} 
                                  className="text-blue-400 bg-transparent"
                                />
                                <span className="text-sm text-gray-300">
                                  {(() => {
                                    const upcomingEarnings = holding.earnings_calendar
                                      .filter(earning => new Date(earning.date) > new Date())
                                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                    
                                    if (upcomingEarnings.length > 0) {
                                      const nextEarnings = upcomingEarnings[0];
                                      const today = new Date();
                                      const date = new Date(nextEarnings.date);
                                      const diffTime = date.getTime() - today.getTime();
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      
                                      return (
                                        <span className="text-gray-300">
                                          Reports {diffDays === 1 ? '(tomorrow)' : 
                                                   diffDays === 0 ? '(today)' : 
                                                   `(in ${diffDays} days)`}
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="text-gray-400">
                                          No upcoming earnings
                                        </span>
                                      );
                                    }
                                  })()}
                                </span>
                              </button>
                              <EarningsCalendar
                                earningsData={holding.earnings_calendar}
                                symbol={holding.symbol}
                                compact={true}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'heatmap' && (
        isLoading ? <HoldingsHeatmapSkeleton /> : <HoldingsHeatmap data={dataWithRealEarnings} isValueVisible={isValueVisible} />
      )}

      {/* Tag Editor Dialog */}
      {editingTag && (
        <TagEditor
          isOpen={true}
          onClose={() => setEditingTag(null)}
          onSave={handleSaveTag}
          tagDefinition={editingTag.definition}
          initialValue={editingTag.value}
          symbol={editingTag.symbol}
        />
      )}

      {/* Chart Tooltip */}
      {chartTooltipData && chartTooltipData.visible && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: chartTooltipData.x,
            top: chartTooltipData.y,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            border: 'none',
            borderRadius: '8px',
            boxShadow: 'none',
            color: '#e5e7eb',
            fontSize: '12px',
            fontWeight: 'normal',
            padding: '4px',
            maxWidth: '200px'
          }}
          dangerouslySetInnerHTML={{ __html: chartTooltipData.content }}
        />
      )}

      {/* Earnings Tooltip */}
      {earningsTooltipData && earningsTooltipData.visible && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: earningsTooltipData.x,
            top: earningsTooltipData.y,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            border: 'none',
            borderRadius: '8px',
            boxShadow: 'none',
            color: '#e5e7eb',
            fontSize: '12px',
            fontWeight: 'normal',
            padding: '4px',
            maxWidth: '200px'
          }}
          dangerouslySetInnerHTML={{ __html: earningsTooltipData.content }}
        />
      )}
    </div>
  );
};

export default HoldingsTable;