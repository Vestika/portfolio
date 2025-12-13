import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface StackedBarChartProps {
  title: string;
  data: Array<{
    symbol: string;
    name: string;
    value: number;
    weights: Record<string, number>; // e.g., { "USA": 0.6, "Europe": 0.3, "Asia": 0.1 }
  }>;
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({
  title,
  data,
  baseCurrency,
  hideValues = false,
  getSymbolName
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Get all unique categories across all holdings
  const allCategories = new Set<string>();
  data.forEach(item => {
    Object.keys(item.weights).forEach(category => allCategories.add(category));
  });
  const categories = Array.from(allCategories);

  // Colors for different exposure categories
  const chartColors = [
    '#4E6BA6', '#938FB8', '#D8B5BE', '#398AA2', '#1E7590',
    '#6B8FB8', '#B8A8C8', '#C8B5D8', '#A8C8D8', '#8FB8C8',
    '#D8C8B8', '#B8D8C8'
  ];

  // Transform data into series format (one series per category)
  const series = categories.map((category, idx) => ({
    name: category,
    data: data.map(item => {
      const weight = item.weights[category] || 0;
      const weightedValue = item.value * weight;
      return {
        y: weightedValue,
        percentage: weight * 100,
        totalValue: item.value
      };
    }),
    color: chartColors[idx % chartColors.length]
  }));

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      height: Math.max(300, data.length * 40 + 100)
    },
    credits: {
      enabled: false
    },
    title: {
      text: title,
      align: 'left',
      style: {
        color: 'white',
        fontSize: '18px',
        fontWeight: 'normal'
      }
    },
    xAxis: {
      categories: data.map(item => getSymbolName ? getSymbolName(item.symbol) : item.name),
      labels: {
        style: {
          color: 'white',
          fontSize: isMobile ? '11px' : '13px'
        }
      },
      gridLineColor: '#374151',
      lineColor: '#374151'
    },
    yAxis: {
      min: 0,
      title: {
        text: hideValues ? 'Percentage (%)' : `Value (${baseCurrency})`,
        style: {
          color: 'white'
        }
      },
      labels: {
        style: {
          color: 'white'
        },
        formatter: function() {
          if (hideValues) {
            return this.value + '%';
          }
          return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0
          }).format(this.value as number);
        }
      },
      gridLineColor: '#374151',
      lineColor: '#374151'
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: 'white',
        fontWeight: 'normal'
      },
      itemHoverStyle: {
        color: 'yellow'
      }
    },
    tooltip: {
      shared: true,
      useHTML: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderWidth: 1,
      borderColor: '#374151',
      style: {
        color: '#e5e7eb'
      },
      formatter: function(this: any) {
        const pointIndex = this.point?.index ?? this.x;
        const holding = data[pointIndex];
        
        let tooltipHtml = `<div style="padding: 8px;"><b>${getSymbolName ? getSymbolName(holding.symbol) : holding.name}</b><br/>`;
        
        if (!hideValues) {
          tooltipHtml += `Total Value: <b>${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(holding.value)} ${baseCurrency}</b><br/><br/>`;
        }
        
        tooltipHtml += '<table>';
        categories.forEach((category, idx) => {
          const weight = holding.weights[category] || 0;
          const weightedValue = holding.value * weight;
          const color = chartColors[idx % chartColors.length];
          
          if (weight > 0) {
            tooltipHtml += `<tr>`;
            tooltipHtml += `<td style="padding-right: 8px;"><span style="color: ${color}">●</span> ${category}:</td>`;
            tooltipHtml += `<td style="text-align: right;"><b>${(weight * 100).toFixed(1)}%</b></td>`;
            if (!hideValues) {
              tooltipHtml += `<td style="text-align: right; padding-left: 8px;">(${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(weightedValue)} ${baseCurrency})</td>`;
            }
            tooltipHtml += `</tr>`;
          }
        });
        tooltipHtml += '</table></div>';
        
        return tooltipHtml;
      }
    },
    plotOptions: {
      bar: {
        stacking: 'normal',
        dataLabels: {
          enabled: false
        }
      }
    },
    series: series as any
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

export default StackedBarChart;

