import React, { useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { SecurityHolding, HoldingsTableData, Quote } from './types';
import HoldingsHeatmap from './HoldingsHeatmap';
import api from './utils/api';
import { useMediaQuery } from './hooks/useMediaQuery';

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


const MiniChart: React.FC<{ data: SecurityHolding['historical_prices'], symbol: string, currency: string, baseCurrency: string }> = ({ data, symbol, currency, baseCurrency }) => {
  // Determine solid color: green for positive/neutral, red for negative
  let trendColor = '#4ade80'; // green by default
  if (data && data.length > 1) {
    const first = data[0].price;
    const last = data[data.length - 1].price;
    if (last < first) {
      trendColor = '#f87171'; // red
    }
  }
  const options: Highcharts.Options = {
    chart: {
      type: 'spline',
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
      useHTML: true,
      backgroundColor: 'transparent', // No card background
      borderWidth: 0,
      shadow: false,
      style: {
        color: '#e5e7eb', // Softer light gray
        fontWeight: 'normal', // Softer font weight
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        padding: '0px',
        zIndex: 300,
        pointerEvents: 'none',
        fontSize: '13px',
      },
      borderRadius: 0,
      outside: true, // Always float above the chart
      hideDelay: 0, // Disappear immediately when not hovering
      followPointer: true, // Tooltip follows the mouse
      formatter: function(this: unknown) {
        const point = (this as { point: { index: number; y: number } }).point;
        const date = new Date(data[point.index].date);
        // If symbol is USD, show baseCurrency instead of currency
        const displayCurrency = symbol === 'USD' ? baseCurrency : currency;
        return `<span style="padding:2px 8px;display:inline-block;"><b>${date.toLocaleDateString()}</b><br/><b>${point.y?.toFixed(2)} ${displayCurrency}</b></span>`;
      }
    },
    plotOptions: {
      series: {
        animation: false,
        lineWidth: 3,
        shadow: {
          color: 'rgba(96,165,250,0.5)',
          width: 8,
          offsetX: 0,
          offsetY: 0
        },
        states: {
          hover: {
            enabled: true,
            lineWidth: 4,
            halo: {
              size: 10,
              opacity: 0.25
            }
          }
        },
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true,
              fillColor: 'rgba(96,165,250,0.8)',
              lineColor: '#fff',
              lineWidth: 2,
              radius: 5,
            }
          }
        }
      }
    },
    series: [{
      type: 'spline',
      data: data.map(point => ({
        x: new Date(point.date).getTime(),
        y: point.price
      })),
      color: trendColor,
      linecap: 'round',
      lineWidth: 3,
      shadow: {
        color: 'rgba(56,189,248,0.4)',
        width: 10,
        offsetX: 0,
        offsetY: 0
      },
      states: {
        hover: {
          lineWidth: 4,
          halo: {
            size: 12,
            opacity: 0.35
          }
        }
      }
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

const AccountBreakdownRow: React.FC<{ 
  accountBreakdown: SecurityHolding['account_breakdown'], 
  baseCurrency: string,
  isValueVisible: boolean 
}> = ({ accountBreakdown, baseCurrency, isValueVisible }) => {
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
        {accountBreakdown.map((account, index) => {
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

const HoldingsTable: React.FC<HoldingsTableProps> = ({ data, isValueVisible }) => {
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

  // Fetch live quotes for holdings
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  React.useEffect(() => {
    const symbols = data.holdings.map(h => h.symbol).join(',');
    if (!symbols) return;
    api.get(`/quotes?symbols=${symbols}`)
      .then(res => setQuotes(res.data))
      .catch(() => setQuotes({}));
  }, [data.holdings]);

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

  return (
    <div className="w-full">
      {/* Title and Toggle Header */}
      <div className="flex items-center justify-between px-0 py-3 mb-4">
        <h3 className="text-xl font-bold text-white">Holdings Overview</h3>
        
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
                        <span>{holding.symbol}</span>
                        {holding.account_breakdown && holding.account_breakdown.length > 1 && (
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-md border border-blue-400/30">
                            {holding.account_breakdown.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 md:px-4 text-sm text-gray-300 hidden md:table-cell">{holding.name}</td>
                    <td className="px-2 md:px-4 text-sm hidden md:table-cell">{renderTags(holding.tags)}</td>
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
                            <div>{renderTags(holding.tags)}</div>
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
        <HoldingsHeatmap data={data} isValueVisible={isValueVisible} quotes={quotes} />
      )}
    </div>
  );
};

export default HoldingsTable;