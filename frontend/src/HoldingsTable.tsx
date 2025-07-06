import React, { useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { SecurityHolding, HoldingsTableData } from './types';
import HoldingsHeatmap from './HoldingsHeatmap';
import api from './utils/api';
import { Switch, Tooltip } from '@mui/material';

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
      formatter: function(this: unknown) {
        const point = (this as { point: { index: number; y: number } }).point;
        const date = new Date(data[point.index].date);
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

  // Fetch live quotes for holdings
  const [quotes, setQuotes] = useState<Record<string, unknown>>({});
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

  const handleViewModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setViewMode(event.target.checked ? 'heatmap' : 'table');
  };

  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
      {/* View Toggle Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/30">
        <h3 className="text-sm font-medium text-gray-200">Holdings Overview</h3>
        <div className="flex items-center space-x-3">
          <Tooltip title={viewMode === 'table' ? 'Table View' : 'Heatmap View'} placement="top">
            <Switch
              checked={viewMode === 'heatmap'}
              onChange={handleViewModeChange}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#60a5fa',
                  '&:hover': {
                    backgroundColor: 'rgba(96, 165, 250, 0.08)',
                  },
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#60a5fa',
                },
                '& .MuiSwitch-track': {
                  backgroundColor: '#4b5563',
                },
                '& .MuiSwitch-thumb': {
                  backgroundColor: '#9ca3af',
                },
              }}
            />
          </Tooltip>
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
        <HoldingsHeatmap data={data} isValueVisible={isValueVisible} quotes={quotes} />
      )}
    </div>
  );
};

export default HoldingsTable;