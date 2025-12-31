import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/treemap';
import { useMediaQuery } from './hooks/useMediaQuery';

export interface TreeMapDataItem {
  label: string; // Category name
  holdings: {
    symbol: string;
    name: string;
    value: number;
  }[];
}

interface TreeMapChartProps {
  title: string;
  data: TreeMapDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const TreeMapChart: React.FC<TreeMapChartProps> = ({
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

  // Define colors for categories
  const categoryColors = [
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

  // Transform data for Highcharts treemap format
  const transformedData: any[] = [];
  let categoryIndex = 0;

  data.forEach((category) => {
    const categoryColor = categoryColors[categoryIndex % categoryColors.length];
    const categoryTotal = category.holdings.reduce((sum, h) => sum + h.value, 0);
    
    // Add parent category node
    transformedData.push({
      id: `cat_${category.label}`,
      name: category.label,
      value: categoryTotal,
      color: categoryColor,
      dataLabels: {
        enabled: true,
        style: {
          fontSize: isMobile ? '11px' : '14px',
          fontWeight: 'bold',
          textOutline: '2px contrast'
        }
      }
    });

    // Add child holding nodes
    category.holdings.forEach((holding) => {
      const displayName = getDisplayName(holding.symbol);
      const percentage = categoryTotal > 0 ? (holding.value / categoryTotal) * 100 : 0;
      
      transformedData.push({
        name: displayName,
        parent: `cat_${category.label}`,
        value: holding.value,
        color: Highcharts.color(categoryColor).brighten(0.15).get(),
        originalSymbol: holding.symbol,
        categoryName: category.label,
        percentage: percentage,
        dataLabels: {
          enabled: true,
          style: {
            fontSize: isMobile ? '9px' : '11px',
            textOutline: '1px contrast'
          }
        }
      });
    });

    categoryIndex++;
  });

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'treemap',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      height: isMobile ? 400 : 500,
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
        
        // For category nodes (parent)
        if (point.id && point.id.startsWith('cat_')) {
          if (hideValues) {
            return `
              <div class="p-2">
                <div class="font-semibold text-white">${point.name}</div>
              </div>
            `;
          }
          return `
            <div class="p-2 space-y-1">
              <div class="font-semibold text-white">${point.name}</div>
              <div class="text-blue-400 font-medium">${formatNumber(point.value)} ${baseCurrency}</div>
            </div>
          `;
        }
        
        // For holding nodes (children)
        if (hideValues) {
          return `
            <div class="p-2">
              <div class="font-semibold text-white">${point.name}</div>
              <div class="text-gray-400 text-xs">${point.categoryName}</div>
              <div class="text-gray-300">${point.percentage?.toFixed(2)}% of category</div>
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.name}</div>
            <div class="text-gray-400 text-xs">${point.categoryName}</div>
            <div class="text-blue-400 font-medium">${formatNumber(point.value)} ${baseCurrency}</div>
            <div class="text-gray-300">${point.percentage?.toFixed(2)}% of category</div>
          </div>
        `;
      }
    },
    plotOptions: {
      treemap: {
        layoutAlgorithm: 'squarified',
        allowTraversingTree: false,
        animationLimit: 1000,
        dataLabels: {
          enabled: true,
          style: {
            color: 'white',
            textOutline: '2px contrast'
          }
        },
        levels: [{
          level: 1,
          dataLabels: {
            enabled: true,
            align: 'left',
            verticalAlign: 'top',
            style: {
              fontSize: isMobile ? '11px' : '14px',
              fontWeight: 'bold'
            }
          }
        }]
      }
    },
    series: [{
      type: 'treemap',
      layoutAlgorithm: 'squarified',
      alternateStartingDirection: true,
      data: transformedData
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

export default TreeMapChart;

