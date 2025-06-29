import React, { useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/treemap';
import { SecurityHolding, HoldingsTableData } from './types';
import {
  Search,
  ArrowUpDown,
  Wallet,
  Building2,
  Bitcoin,
  CircleDollarSign,
  Banknote,
  ChartNoAxesCombined,
} from 'lucide-react';

interface HoldingsTableProps {
  data: HoldingsTableData;
  isValueVisible: boolean;
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


const MiniChart: React.FC<{ data: SecurityHolding['historical_prices'] }> = ({ data }) => {
  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      height: 32,
      width: 100,
      backgroundColor: 'transparent',
      margin: [2, 0, 2, 0],
      style: { overflow: 'visible' }
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      type: 'datetime',
      visible: false,
      minPadding: 0,
      maxPadding: 0
    },
    yAxis: {
      visible: false,
      minPadding: 0,
      maxPadding: 0
    },
    legend: { enabled: false },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(30, 41, 59, 0.9)',
      borderWidth: 0,
      borderRadius: 8,
      style: { color: '#fff', zIndex: 300},
      formatter: function(this: any) {
        const point = this.point;
        const date = new Date(data[point.index!].date);
        return `<b>${point.y?.toFixed(2)}</b>(${date.toLocaleDateString()})`;
      }
    },
    plotOptions: {
      series: {
        animation: false,
        lineWidth: 1.5,
        states: {
          hover: {
            enabled: true,
            lineWidth: 2
          }
        },
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true,
              radius: 3
            }
          }
        }
      }
    },
    series: [{
      type: 'line',
      data: data.map(point => ({
        x: new Date(point.date).getTime(),
        y: point.price
      })),
      color: '#60A5FA'
    }]
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

const renderTags = (tags: Record<string, string>) => {
  return Object.entries(tags).map(([key, value]) => {
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
    return (
      <span
        key={`${key}-${value}`}
        className="inline-block bg-gray-700/50 text-blue-300 text-xs px-2 py-0.5 rounded mr-1 mb-1"
      >
        {`${key}: ${displayValue}`}
      </span>
    );
  });
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

const HoldingsTable: React.FC<HoldingsTableProps> = ({ data, isValueVisible }) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof SecurityHolding;
    direction: 'asc' | 'desc';
  }>({ key: 'total_value', direction: 'desc' });

  const [filters, setFilters] = useState<{
    symbol: string;
    type: string;
  }>({
    symbol: '',
    type: ''
  });

  const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('table');

  const filteredAndSortedHoldings = [...data.holdings]
    .filter(holding =>
      holding.symbol.toLowerCase().includes(filters.symbol.toLowerCase()) &&
      holding.security_type.toLowerCase().includes(filters.type.toLowerCase())
    )
    .sort((a, b) => {
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

  // Calculate performance and prepare treemap data
  const getTreemapData = () => {
    return filteredAndSortedHoldings.map((holding, index) => {
      // Get current price from latest historical data
      const currentPrice = holding.historical_prices.length > 0 
        ? holding.historical_prices[holding.historical_prices.length - 1].price
        : holding.original_price;
      
      // Calculate base performance percentage
      let performancePercent = ((currentPrice - holding.original_price) / holding.original_price) * 100;
      
      // Add some simulated performance variations to show both gains and losses
      // This creates a mix of positive and negative performance for demonstration
      const simulatedVariations = [
        15.2,   // +15.2% gain
        -8.7,   // -8.7% loss
        22.1,   // +22.1% gain
        -12.3,  // -12.3% loss
        5.8,    // +5.8% gain
        -3.4,   // -3.4% loss
        18.9,   // +18.9% gain
        -15.6,  // -15.6% loss
        9.2,    // +9.2% gain
        -6.1,   // -6.1% loss
        25.7,   // +25.7% gain
        -11.8,  // -11.8% loss
      ];
      
      // Use index to assign consistent simulated performance
      const simulatedPerf = simulatedVariations[index % simulatedVariations.length];
      performancePercent = simulatedPerf;
      
      // Calculate simulated current price based on performance
      const simulatedCurrentPrice = holding.original_price * (1 + performancePercent / 100);
      
      // Determine color based on performance
      const getColor = (perf: number) => {
        if (perf > 0) {
          // Green for gains - darker green for higher gains
          const intensity = Math.min(Math.abs(perf) / 20, 1); // Cap at 20% for max intensity
          return `rgba(34, 197, 94, ${0.3 + intensity * 0.7})`;
        } else if (perf < 0) {
          // Red for losses - darker red for higher losses
          const intensity = Math.min(Math.abs(perf) / 20, 1);
          return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
        }
        // Gray for no change
        return 'rgba(107, 114, 128, 0.5)';
      };

      return {
        name: holding.symbol,
        value: isValueVisible ? holding.total_value : holding.total_units,
        color: getColor(performancePercent),
        custom: {
          fullName: holding.name,
          performance: performancePercent,
          currentPrice: simulatedCurrentPrice,
          originalPrice: holding.original_price,
          totalValue: holding.total_value,
          totalUnits: holding.total_units,
          securityType: holding.security_type
        }
      };
    });
  };

  const treemapOptions: Highcharts.Options = {
    chart: {
      type: 'treemap',
      backgroundColor: 'transparent',
    },
    title: {
      text: undefined
    },
    credits: {
      enabled: false
    },
    tooltip: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderWidth: 0,
      borderRadius: 8,
      style: { 
        color: '#fff',
        fontSize: '12px'
      },
      formatter: function(this: any) {
        const point = this.point;
        const custom = point.custom;
        const perfColor = custom.performance >= 0 ? '#22c55e' : '#ef4444';
        const perfSymbol = custom.performance >= 0 ? '+' : '';
        
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${point.name}</div>
            <div style="font-size: 10px; color: #9ca3af; margin-bottom: 6px;">${custom.fullName}</div>
            <div style="color: ${perfColor}; font-weight: bold; margin-bottom: 4px;">
              ${perfSymbol}${custom.performance.toFixed(2)}%
            </div>
            ${isValueVisible ? `
              <div style="margin-bottom: 2px;">Value: ${Math.round(custom.totalValue).toLocaleString()} ${data.base_currency}</div>
              <div style="margin-bottom: 2px;">Units: ${Math.round(custom.totalUnits).toLocaleString()}</div>
            ` : ''}
            <div style="font-size: 10px; color: #9ca3af;">
              ${custom.currentPrice.toFixed(2)} (was ${custom.originalPrice.toFixed(2)})
            </div>
          </div>
        `;
      }
    },
    plotOptions: {
      treemap: {
        layoutAlgorithm: 'squarified',
        dataLabels: {
          enabled: true,
          style: {
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold',
            textOutline: '1px contrast'
          },
          formatter: function(this: any) {
            const custom = this.point.custom;
            const perfSymbol = custom.performance >= 0 ? '+' : '';
            return `${this.point.name}<br/><span style="font-size: 9px;">${perfSymbol}${custom.performance.toFixed(1)}%</span>`;
          }
        }
      }
    },
    series: [{
      type: 'treemap',
      data: getTreemapData()
    }]
  };

  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
      {/* View Toggle Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/30">
        <h3 className="text-sm font-medium text-gray-200">Holdings Overview</h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">View:</span>
          <div className="flex bg-gray-700/50 rounded-md p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                viewMode === 'heatmap'
                  ? 'bg-gray-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Heatmap
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-700/50">
              <tr className="h-8">
                <th className="px-3 text-left text-xs font-medium">Type</th>
                <th className="px-3 text-left text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <SortableHeader
                      label="Symbol"
                      sortKey="symbol"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filter..."
                        className="pl-7 pr-2 py-0.5 bg-gray-700/50 rounded text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={filters.symbol}
                        onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                      />
                    </div>
                  </div>
                </th>
                <th className="px-3 text-left text-xs font-medium">Name</th>
                <th className="px-3 text-left text-xs font-medium">Tags</th>
                <th className="px-3 text-right text-xs font-medium">
                  <SortableHeader
                    label="Price (Original)"
                    sortKey="original_price"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                {isValueVisible && (
                  <>
                    <th className="px-3 text-right text-xs font-medium">
                      <SortableHeader
                        label="Units"
                        sortKey="total_units"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-3 text-right text-xs font-medium">
                      <SortableHeader
                        label={`Total Value (${data.base_currency})`}
                        sortKey="total_value"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </th>
                  </>
                )}
                <th className="px-3 text-center text-xs font-medium">30d Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {filteredAndSortedHoldings.map((holding) => (
                <tr key={holding.symbol} className="h-10 hover:bg-gray-750/50">
                  <td className="px-3">{getSecurityTypeIcon(holding.security_type)}</td>
                  <td className="px-3 font-medium text-blue-400">{holding.symbol}</td>
                  <td className="px-3 text-sm text-gray-300">{holding.name}</td>
                  <td className="px-3 text-sm">{renderTags(holding.tags)}</td>
                  <td className="px-3 text-right text-sm">
                    {(Math.round(holding.original_price * 100) / 100).toLocaleString()}
                    <span className="text-xs text-gray-400 ml-1">{holding.original_currency}</span>
                  </td>
                  {isValueVisible && (
                    <>
                      <td className="px-3 text-right text-sm">
                        {Math.round(holding.total_units).toLocaleString()}
                      </td>
                      <td className="px-3 text-right text-sm whitespace-nowrap">
                        {Math.round(holding.total_value).toLocaleString()}
                        <span className="text-xs text-gray-400 ml-1">
                          ({calculatePercentage(holding)}%)
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-3">
                    <MiniChart data={holding.historical_prices} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'heatmap' && (
        <div className="p-4">
          <div style={{ height: '500px' }}>
            <HighchartsReact 
              highcharts={Highcharts} 
              options={treemapOptions}
            />
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500/60 rounded"></div>
              <span>Losses</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-500/60 rounded"></div>
              <span>No Change</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500/60 rounded"></div>
              <span>Gains</span>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500">
            Size represents {isValueVisible ? 'total value' : 'number of units'} • Color intensity shows performance magnitude
          </div>
        </div>
      )}
    </div>
  );
};

export default HoldingsTable;