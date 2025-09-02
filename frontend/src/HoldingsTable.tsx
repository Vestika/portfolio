import React, { useState, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { SecurityHolding, HoldingsTableData, Quote, HoldingTags, TagDefinition, TagLibrary, TagType } from './types';
import HoldingsHeatmap from './HoldingsHeatmap';
import api from './utils/api';
import { useMediaQuery } from './hooks/useMediaQuery';
import TagDisplay from './components/TagDisplay';
import TagEditor from './components/TagEditor';
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
} from 'lucide-react';

import israelFlag from './assets/israel-flag.svg';
import usFlag from './assets/us-flag.svg';
import bitcoinLogo from './assets/bitcoin.svg';
import smhLogo from './assets/smh.svg';

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
    const type = holding.security_type;
    if (symbol.toUpperCase() === 'SMH') {
        return smhLogo;
    }

    if (holding.logo) {
        return holding.logo;
    }

  if (symbol.toUpperCase() === 'IBIT') {
    return bitcoinLogo;
  }

  if (symbol.toUpperCase() === 'ILS' || /^\d+$/.test(symbol)) {
    return israelFlag;
  }
  if (symbol.toUpperCase() === 'USD') {
    return usFlag;
  }
  if (type.toLowerCase() === 'crypto') {
    return `https://cryptoicons.org/api/icon/${symbol.toLowerCase()}/32`;
  }
  if (type.toLowerCase() === 'stock' || type.toLowerCase() === 'etf') {
    return `https://storage.googleapis.com/iex/api/logos/${symbol.toUpperCase()}.png`;
  }
  // Default icon for other types
  return null;
};


const MiniChart: React.FC<{ data: SecurityHolding['historical_prices'], symbol: string, currency: string, baseCurrency: string }> = ({ data, symbol, currency, baseCurrency }) => {
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
      enabled: true,
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
        const displayCurrency = symbol === 'USD' ? baseCurrency : currency;
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
      data: data.map(point => ({
        x: new Date(point.date).getTime(),
        y: point.price
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

  return <HighchartsReact highcharts={Highcharts} options={options} />;
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
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">Units:</span>
                  <span className="font-medium">{Math.round(account.units).toLocaleString()}</span>
                </span>
                {isValueVisible && (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="text-gray-400">Value:</span>
                      <span className="font-medium text-blue-200">
                        {Math.round(account.value).toLocaleString()} {baseCurrency}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-gray-400">Share:</span>
                      <span className="font-medium text-green-300">{percentage}%</span>
                    </span>
                  </>
                )}
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
  sortKey: keyof SecurityHolding;
  sortConfig: { key: keyof SecurityHolding; direction: 'asc' | 'desc' };
  onSort: (key: keyof SecurityHolding) => void;
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
    key: keyof SecurityHolding;
    direction: 'asc' | 'desc';
  }>({ key: 'total_value', direction: 'desc' });

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

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
  const [structuredTags, setStructuredTags] = useState<Record<string, HoldingTags>>({});
  const [tagLibrary, setTagLibrary] = useState<TagLibrary | null>(null);
  const [editingTag, setEditingTag] = useState<{ symbol: string; definition: TagDefinition; value?: any } | null>(null);

  // Fetch live quotes for holdings
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  React.useEffect(() => {
    const symbols = data.holdings.map(h => h.symbol).join(',');
    if (!symbols) return;
    api.get(`/quotes?symbols=${symbols}`)
      .then(res => setQuotes(res.data))
      .catch(() => setQuotes({}));
  }, [data.holdings]);

  // Load structured tags and tag library for all holdings
  useEffect(() => {
    const loadTagData = async () => {
      try {
        const [allTags, library] = await Promise.all([
          TagAPI.getAllHoldingTags(),
          TagAPI.getUserTagLibrary()
        ]);
        
        const tagsMap = allTags.reduce((acc, holdingTags) => {
          acc[holdingTags.symbol] = holdingTags;
          return acc;
        }, {} as Record<string, HoldingTags>);
        
        setStructuredTags(tagsMap);
        setTagLibrary(library);
      } catch (error) {
        console.error('Error loading tag data:', error);
      }
    };

    if (data.holdings.length > 0) {
      loadTagData();
    }
  }, [data.holdings]);

  // Handle tag updates
  const handleTagsUpdated = async () => {
    try {
      const allTags = await TagAPI.getAllHoldingTags();
      const tagsMap = allTags.reduce((acc, holdingTags) => {
        acc[holdingTags.symbol] = holdingTags;
        return acc;
      }, {} as Record<string, HoldingTags>);
      setStructuredTags(tagsMap);
    } catch (error) {
      console.error('Error reloading tags:', error);
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

  const filteredAndSortedHoldings = [...data.holdings]
    .filter(holding => {
      // Apply symbol and type filters
      const matchesSymbol = holding.symbol.toLowerCase().includes(filters.symbol.toLowerCase());
      const matchesType = holding.security_type.toLowerCase().includes(filters.type.toLowerCase());

      // Apply tag filter if active
      let matchesTag = true;
      if (tagFilter) {
        const holdingTags = structuredTags[holding.symbol];
        matchesTag = holdingTags && Object.keys(holdingTags.tags).includes(tagFilter);
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
      const aValue = a[key];
      const bValue = b[key];
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (key: keyof SecurityHolding) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const calculatePercentage = (holding: SecurityHolding) => {
    const total = data.holdings.reduce((sum, h) => sum + h.total_value, 0);
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
    const structuredTag = structuredTags[holding.symbol];
    const userDefinedTags = tagLibrary ? Object.values(tagLibrary.tag_definitions) : [];

    return (
      <div className="flex items-center gap-2 group">
        {structuredTag && Object.keys(structuredTag.tags).length > 0 && (
          <TagDisplay
            tags={structuredTag.tags}
            maxTags={0}
            compact={isMobile}
            onTagClick={(tagName) => handleTagClick(tagName)}
            activeFilter={tagFilter}
            onRemoveTag={showManagementControls ? (tagName) => handleRemoveTag(holding.symbol, tagName) : undefined}
            showRemoveButtons={showManagementControls}
          />
        )}
        
        {showManagementControls && userDefinedTags.length > 0 && (
          <Select onValueChange={(tagName) => handleAddTag(holding.symbol, tagName)}>
            <SelectTrigger className="w-8 h-6 border-none bg-transparent p-0 hover:bg-gray-700/30 transition-all focus:ring-1 focus:ring-blue-500/50 opacity-60 group-hover:opacity-100">
              <Plus size={14} className="text-gray-400 hover:text-blue-400" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600/30 backdrop-blur-sm shadow-lg">
              <div className="p-2">
                <p className="text-xs text-gray-400 mb-2 px-2">Add tag to {holding.symbol}:</p>
                {userDefinedTags.map((tagDef) => {
                  // Don't show tags that are already assigned
                  const isAlreadyAssigned = structuredTag && structuredTag.tags[tagDef.name];
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
                {userDefinedTags.filter(tagDef => !(structuredTag && structuredTag.tags[tagDef.name])).length === 0 && (
                  <div className="px-2 py-3 text-xs text-gray-500 text-center">
                    All your tags are already assigned
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        )}
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
                  ({filteredAndSortedHoldings.length} of {data.holdings.length})
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
                        label={isMobile ? `Value (${data.base_currency})` : `Total Value (${data.base_currency})`}
                        sortKey="total_value"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </th>
                  </>
                )}
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
                        <span>{holding.symbol}</span>
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
                      <span className="text-xs text-gray-400 ml-1">{holding.original_currency}</span>
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
                      {( holding.symbol !== data.base_currency) ? (
                        <MiniChart data={holding.historical_prices} symbol={holding.symbol} currency={holding.original_currency} baseCurrency={data.base_currency} />
                      ) : null}
                    </td>
                  </tr>
                  {expandedRow === holding.symbol && holding.account_breakdown && holding.account_breakdown.length > 1 && (
                    <tr>
                      <td colSpan={isValueVisible ? 9 : 7} className="p-0">
                        <AccountBreakdownRow
                          accountBreakdown={holding.account_breakdown}
                          baseCurrency={data.base_currency}
                          isValueVisible={isValueVisible}
                        />
                      </td>
                    </tr>
                  )}
                  {expandedRow === holding.symbol && isMobile && (
                    <tr className="bg-gray-800/50 md:hidden">
                      <td colSpan={isValueVisible ? 9 : 7} className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-bold text-gray-400">Name</p>
                            <p>{holding.name}</p>
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
        isLoading ? <HoldingsHeatmapSkeleton /> : <HoldingsHeatmap data={data} isValueVisible={isValueVisible} quotes={quotes} />
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
    </div>
  );
};

export default HoldingsTable;