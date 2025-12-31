import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/sankey';
import 'highcharts/modules/dependency-wheel';
import { useMediaQuery } from './hooks/useMediaQuery';

export interface DependencyWheelDataItem {
  symbol: string;
  name: string;
  value: number;
  related_symbols: string[];
}

interface DependencyWheelChartProps {
  title: string;
  data: DependencyWheelDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const DependencyWheelChart: React.FC<DependencyWheelChartProps> = ({
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

  // Build a map of symbol to value
  const symbolValueMap: Record<string, number> = {};
  data.forEach(item => {
    symbolValueMap[item.symbol] = item.value;
  });

  // Transform data for dependency wheel format
  // Each link: [from, to, weight]
  const links: Array<[string, string, number]> = [];
  const processedPairs = new Set<string>();

  data.forEach(item => {
    const fromSymbol = getDisplayName(item.symbol);
    const fromValue = item.value;
    
    item.related_symbols.forEach(relatedSymbol => {
      const toSymbol = getDisplayName(relatedSymbol);
      const toValue = symbolValueMap[relatedSymbol] || 0;
      
      // Create a unique key for this relationship (bidirectional)
      const pairKey1 = `${item.symbol}-${relatedSymbol}`;
      const pairKey2 = `${relatedSymbol}-${item.symbol}`;
      
      // Only add if we haven't processed this relationship yet
      if (!processedPairs.has(pairKey1) && !processedPairs.has(pairKey2)) {
        // Weight is the average of both values (or just one if the other doesn't exist)
        const weight = toValue > 0 ? (fromValue + toValue) / 2 : fromValue;
        links.push([fromSymbol, toSymbol, weight]);
        processedPairs.add(pairKey1);
        processedPairs.add(pairKey2);
      }
    });
  });

  const chartOptions: any = {
    chart: {
      type: 'dependencywheel',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      height: isMobile ? 400 : 600,
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
      nodeFormatter: function(this: any) {
        const point = this as any;
        const holding = data.find(d => getDisplayName(d.symbol) === point.id);
        
        if (!holding) {
          return `<div class="p-2"><div class="font-semibold text-white">${point.id}</div></div>`;
        }
        
        if (hideValues) {
          return `
            <div class="p-2 space-y-1">
              <div class="font-semibold text-white">${point.id}</div>
              <div class="text-gray-300 text-xs">${holding.related_symbols.length} relationship(s)</div>
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.id}</div>
            <div class="text-blue-400 font-medium">${formatNumber(holding.value)} ${baseCurrency}</div>
            <div class="text-gray-300 text-xs">${holding.related_symbols.length} relationship(s)</div>
          </div>
        `;
      },
      pointFormatter: function() {
        const point = this as any;
        
        if (hideValues) {
          return `
            <div class="p-2">
              <div class="font-semibold text-white">${point.fromNode.id} ↔ ${point.toNode.id}</div>
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.fromNode.id} ↔ ${point.toNode.id}</div>
            <div class="text-gray-300 text-xs">Related Holdings</div>
          </div>
        `;
      }
    },
    plotOptions: {
      dependencywheel: {
        dataLabels: {
          enabled: !isMobile,
          style: {
            color: 'white',
            textOutline: '2px contrast',
            fontSize: isMobile ? '9px' : '11px'
          }
        },
        size: isMobile ? '80%' : '90%',
        center: ['50%', '50%']
      }
    },
    series: [{
      type: 'dependencywheel',
      name: 'Relationships',
      keys: ['from', 'to', 'weight'],
      data: links,
      dataLabels: {
        color: 'white',
        textPath: {
          enabled: true
        },
        distance: 10
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

export default DependencyWheelChart;

