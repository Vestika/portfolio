import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/highcharts-more';
import { useMediaQuery } from './hooks/useMediaQuery';

export interface BubbleChartDataItem {
  symbol: string;
  name: string;
  value: number;
  scalar_value: number;
}

interface BubbleChartProps {
  title: string;
  data: BubbleChartDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const BubbleChart: React.FC<BubbleChartProps> = ({
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

  // Transform data for Highcharts bubble chart format
  // Each bubble: [x, y, z] where x=scalar_value, y=value, z=value (for size)
  const bubbleData = data.map((item) => ({
    x: item.scalar_value,
    y: item.value,
    z: item.value, // Size of bubble proportional to value
    name: getDisplayName(item.symbol),
    symbol: item.symbol,
    originalValue: item.value,
    scalarValue: item.scalar_value
  }));

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bubble',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      height: isMobile ? 400 : 500,
      zooming: {
        type: 'xy'
      }
    },
    colors: [
      '#4E6BA6', // True Blue
      '#938FB8', // Cool gray
      '#D8B5BE', // Fairy Tale
      '#398AA2', // Blue (Munsell)
      '#1E7590', // Cerulean
      '#6B8FB8', // Light blue
      '#B8A8C8', // Lavender
      '#C8B5D8', // Light purple
      '#A8C8D8', // Powder blue
      '#8FB8C8', // Sky blue
      '#D8C8B8', // Warm beige
      '#B8D8C8'  // Mint green
    ],
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
      title: {
        text: 'Scalar Value',
        style: {
          color: 'white',
          fontSize: '12px'
        }
      },
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
        text: `Portfolio Value (${baseCurrency})`,
        style: {
          color: 'white',
          fontSize: '12px'
        }
      },
      labels: {
        style: {
          color: 'white',
          fontSize: isMobile ? '10px' : '12px'
        },
        formatter: function() {
          return hideValues ? '' : formatNumber(this.value as number);
        }
      },
      gridLineColor: '#374151',
      lineColor: '#374151',
      tickColor: '#374151'
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
        
        if (hideValues) {
          return `
            <div class="p-2 space-y-1">
              <div class="font-semibold text-white">${point.name}</div>
              <div class="text-gray-300">Scalar Value: ${point.scalarValue?.toFixed(2) || 'N/A'}</div>
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.name}</div>
            <div class="text-blue-400 font-medium">${formatNumber(point.originalValue)} ${baseCurrency}</div>
            <div class="text-gray-300">Scalar Value: ${point.scalarValue?.toFixed(2) || 'N/A'}</div>
          </div>
        `;
      }
    },
    plotOptions: {
      bubble: {
        minSize: isMobile ? 8 : 10,
        maxSize: isMobile ? 50 : 80,
        dataLabels: {
          enabled: !isMobile,
          format: '{point.name}',
          style: {
            color: 'white',
            textOutline: '2px contrast',
            fontSize: isMobile ? '9px' : '11px'
          }
        }
      }
    },
    legend: {
      enabled: false
    },
    series: [{
      type: 'bubble',
      name: 'Holdings',
      data: bubbleData,
      marker: {
        fillOpacity: 0.7
      }
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

export default BubbleChart;

