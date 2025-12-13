import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ChartDataItem } from './types';
import { useMediaQuery } from './hooks/useMediaQuery';

interface BarChartProps {
  title: string;
  data: ChartDataItem[];
  total: number;
  baseCurrency: string;
  hideValues?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({
  title,
  data,
  baseCurrency,
  hideValues = false
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Format number with comma separators and no decimal
  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(value);

  // Sort data by percentage descending for better visualization
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);

  // Initial visible range - show more items for better density
  const initialVisibleItems = 10;
  
  // Calculate the maximum percentage for initial view
  const getMaxPercentageForRange = (startIndex: number, endIndex: number) => {
    const visibleData = sortedData.slice(startIndex, endIndex + 1);
    if (visibleData.length === 0) return 100;
    return Math.max(...visibleData.map(item => item.percentage));
  };

  const initialMaxPercentage = getMaxPercentageForRange(0, Math.min(initialVisibleItems - 1, sortedData.length - 1));
  const initialYAxisMax = Math.ceil(initialMaxPercentage * 1.15); // Add 15% padding and round up

// This function was moved to xAxis.events.afterSetExtremes

  // Define colors array separately to avoid circular reference
  const chartColors = [
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
  ];

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      height: isMobile ? 400 : 500,
    },
    colors: chartColors,
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
      type: 'category',
      labels: {
        style: {
          color: 'white',
          fontSize: isMobile ? '11px' : '13px'
        },
        rotation: -30
      },
      gridLineColor: '#374151',
      lineColor: '#374151',
      tickColor: '#374151',
      // Show only a portion of data initially, rest accessible via scrolling
      min: 0,
      max: Math.min(initialVisibleItems - 1, sortedData.length - 1),
      scrollbar: {
        enabled: true,
        height: 20,
        buttonArrowColor: 'white',
        buttonBackgroundColor: '#374151',
        buttonBorderColor: '#4B5563',
        rifleColor: 'white',
        trackBackgroundColor: '#1F2937',
        trackBorderColor: '#374151',
        trackBorderRadius: 4,
        barBackgroundColor: '#4B5563',
        barBorderColor: '#6B7280'
      },
      events: {
        afterSetExtremes: function(e) {
          console.log('🔄 X-axis extremes changed:', e.min, 'to', e.max);
          
          if (e.trigger === 'scrollbar' || e.trigger === 'navigator' || !e.trigger) {
            const chart = this.chart;
            const min = Math.floor(e.min || 0);
            const max = Math.ceil(e.max || Math.min(initialVisibleItems - 1, sortedData.length - 1));
            
            console.log(`Visible range: ${min} to ${max}`);
            
            // Calculate new y-axis max based on visible data
            const visibleMaxPercentage = getMaxPercentageForRange(min, max);
            const newYAxisMax = Math.ceil(visibleMaxPercentage * 1.15);
            const newTickInterval = newYAxisMax <= 10 ? 2 : newYAxisMax <= 50 ? 5 : 10;
            
            console.log(`🎯 Updating y-axis: max ${visibleMaxPercentage.toFixed(1)}% → ${newYAxisMax}%`);
            
            // Update y-axis
            chart.yAxis[0].update({
              max: newYAxisMax,
              tickInterval: newTickInterval
            }, true);
          }
        }
      }
    },
    yAxis: {
      title: {
        text: 'Percentage (%)',
        style: {
          color: 'white',
          fontSize: '12px'
        }
      },
      labels: {
        style: {
          color: 'white',
          fontSize: '12px'
        },
        formatter: function() {
          return this.value + '%';
        }
      },
      gridLineColor: '#374151',
      lineColor: '#374151',
      tickColor: '#374151',
      min: 0,
      max: initialYAxisMax,
      tickInterval: initialYAxisMax <= 10 ? 2 : initialYAxisMax <= 50 ? 5 : 10
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
        const dataPoint = sortedData.find(item => item.label === this.key);
        const symbol = this.key as string;
        const percentage = dataPoint?.percentage.toFixed(2) || '0.00';
        
        if (hideValues) {
          return `
            <div class="p-2">
              <div class="font-semibold text-white mb-1">${symbol}</div>
              <div class="text-gray-300">${percentage}%</div>
            </div>
          `;
        }

        const numericValue = formatNumber(dataPoint?.value || 0);
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${symbol}</div>
            <div class="text-blue-400 font-medium">${numericValue} ${baseCurrency}</div>
            <div class="text-gray-300">${percentage}%</div>
          </div>
        `;
      }
    },
    plotOptions: {
      column: {
        colorByPoint: true,
        borderColor: '#111827',
        borderWidth: 0,
        borderRadius: 2,
        pointWidth: isMobile ? 25 : 35, // Narrower bars to fit more
        groupPadding: 0.05, // Less space between groups
        pointPadding: 0.02, // Less space between bars
        dataLabels: {
          enabled: false // Remove percentage labels on top of bars
        }
      }
    },
    navigator: {
      enabled: false // Disable the navigator (preview scrollbar)
    },
    legend: {
      enabled: false // Disable legend for bar charts as X-axis labels serve this purpose
    },
    series: [{
      type: 'column',
      name: 'Percentage',
      data: sortedData.map((item, index) => ({
        name: item.label,
        y: item.percentage,
        color: chartColors[index % chartColors.length]
      }))
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

export default BarChart;
