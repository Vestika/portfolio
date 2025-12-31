import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/xrange';
import { useMediaQuery } from './hooks/useMediaQuery';

export interface TimelineChartDataItem {
  symbol: string;
  name: string;
  value: number;
  start_date?: string;
  end_date?: string;
  single_date?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'annually';
}

interface TimelineChartProps {
  title: string;
  data: TimelineChartDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const TimelineChart: React.FC<TimelineChartProps> = ({
  title,
  data,
  baseCurrency,
  hideValues = false,
  getSymbolName
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Format number with comma separators and no decimal
  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(value);

  // Helper to get display name for a symbol
  const getDisplayName = (symbol: string): string => {
    if (getSymbolName) {
      return getSymbolName(symbol);
    }
    return symbol;
  };

  // Group data by base symbol (strip _N suffix for frequency occurrences)
  const groupedData: Record<string, typeof data> = {};
  data.forEach(item => {
    const baseSymbol = item.symbol.split('_')[0]; // Remove occurrence index
    if (!groupedData[baseSymbol]) {
      groupedData[baseSymbol] = [];
    }
    groupedData[baseSymbol].push(item);
  });

  // Transform data for x-range chart format
  const xRangeData: any[] = [];
  let yIndex = 0;

  Object.entries(groupedData).forEach(([baseSymbol, items]) => {
    items.forEach((item, itemIndex) => {
      const displayName = getDisplayName(baseSymbol);
      
      // Handle single date vs date range
      let x, x2;
      if (item.single_date) {
        const date = new Date(item.single_date).getTime();
        x = date;
        // For frequency events, make bars narrower (8 hours instead of 24)
        x2 = date + (item.frequency ? 8 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
      } else if (item.start_date && item.end_date) {
        x = new Date(item.start_date).getTime();
        x2 = new Date(item.end_date).getTime();
      } else {
        return;
      }

      xRangeData.push({
        x,
        x2,
        y: yIndex, // All occurrences of same symbol share same Y position
        name: itemIndex === 0 ? displayName : '', // Only show name on first occurrence
        symbol: baseSymbol,
        value: item.value,
        isSingleDate: !!item.single_date,
        isFrequency: !!item.frequency,
        frequency: item.frequency,
        startDate: item.start_date || item.single_date,
        endDate: item.end_date || item.single_date,
        // Use different color for frequency-based events
        color: item.frequency ? '#eab308' : '#4E6BA6',
        dataLabels: {
          enabled: itemIndex === 0 && !isMobile // Only show label on first occurrence
        }
      });
    });
    yIndex++; // Increment Y position for next symbol
  });

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'xrange',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      height: Math.max(300, Object.keys(groupedData).length * 50 + 100),
    },
    credits: {
      enabled: false
    },
    title: {
      text: title,
      align: 'left',
      verticalAlign: 'top',
      x: 0,
      y: 20,
      style: {
        fontWeight: 'normal',
        fontSize: '18px',
        color: 'white'
      }
    },
    xAxis: {
      type: 'datetime',
      labels: {
        style: {
          color: 'white',
          fontSize: isMobile ? '10px' : '12px'
        }
      },
      gridLineColor: '#374151',
      lineColor: '#374151',
      tickColor: '#374151'
    },
    yAxis: {
      title: {
        text: ''
      },
      categories: Object.keys(groupedData).map(symbol => getDisplayName(symbol)),
      labels: {
        style: {
          color: 'white',
          fontSize: isMobile ? '10px' : '12px'
        }
      },
      gridLineColor: '#374151',
      lineColor: '#374151',
      tickColor: '#374151',
      reversed: true
    },
    tooltip: {
      useHTML: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderColor: '#374151',
      borderRadius: 8,
      borderWidth: 1,
      shadow: {
        color: 'rgba(0, 0, 0, 0.3)',
        offsetX: 0,
        offsetY: 4,
        opacity: 0.3,
        width: 8
      },
      style: {
        color: 'white',
        fontSize: '13px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      formatter: function() {
        const point = (this as any).point;
        const startDate = new Date(point.x).toLocaleDateString();
        const endDate = new Date(point.x2).toLocaleDateString();
        
        if (hideValues) {
          return `
            <div class="p-2 space-y-1">
              <div class="font-semibold text-white">${point.name}</div>
              <div class="text-gray-300 text-xs">
                ${point.isSingleDate ? startDate : `${startDate} - ${endDate}`}
              </div>
              ${point.isFrequency ? `<div class="text-yellow-400 text-xs">⟳ Recurring: ${point.frequency}</div>` : ''}
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.name}</div>
            <div class="text-blue-400 font-medium">${formatNumber(point.value)} ${baseCurrency}</div>
            <div class="text-gray-300 text-xs">
              ${point.isSingleDate ? startDate : `${startDate} - ${endDate}`}
            </div>
            ${point.isFrequency ? `<div class="text-yellow-400 text-xs">⟳ Recurring: ${point.frequency}</div>` : ''}
          </div>
        `;
      }
    },
    plotOptions: {
      xrange: {
        borderRadius: 3,
        borderColor: '#111827',
        pointWidth: 10, // Set a fixed width for single-date events
        dataLabels: {
          enabled: true,
          style: {
            color: 'white',
            textOutline: '1px contrast',
            fontSize: isMobile ? '9px' : '11px'
          }
        }
      }
    },
    legend: {
      enabled: false
    },
    series: [{
      type: 'xrange',
      name: 'Timeline',
      data: xRangeData as any
    }]
  };

  return (
    <div className="p-4">
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
      />
    </div>
  );
};

export default TimelineChart;

