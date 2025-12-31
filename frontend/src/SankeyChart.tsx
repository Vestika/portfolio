import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/sankey';
import { useMediaQuery } from './hooks/useMediaQuery';

export interface SankeyChartDataItem {
  symbol: string;
  name: string;
  value: number;
  path: string[];
}

interface SankeyChartProps {
  title: string;
  data: SankeyChartDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const SankeyChart: React.FC<SankeyChartProps> = ({
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

  // Transform hierarchical data to Sankey format
  // Sankey needs [from, to, weight] links
  const links: Array<[string, string, number]> = [];
  const nodeValues: Record<string, number> = {};

  data.forEach(item => {
    const displayName = getDisplayName(item.symbol);
    const path = item.path;
    
    if (!path || path.length === 0) return;

    // Build the hierarchy: Root -> Level1 -> Level2 -> ... -> Holding
    for (let i = 0; i < path.length; i++) {
      const currentNode = path[i];
      const nextNode = i < path.length - 1 ? path[i + 1] : displayName;
      
      // Track values for each node
      nodeValues[currentNode] = (nodeValues[currentNode] || 0) + item.value;
      
      // Create link from current to next
      links.push([currentNode, nextNode, item.value]);
    }
    
    // Add final holding value
    nodeValues[displayName] = (nodeValues[displayName] || 0) + item.value;
  });

  // Create a map to store original symbols for tooltips
  const symbolMap: Record<string, string> = {};
  data.forEach(item => {
    symbolMap[getDisplayName(item.symbol)] = item.symbol;
  });

  const chartOptions: any = {
    chart: {
      type: 'sankey',
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
        const nodeValue = nodeValues[point.id] || 0;
        
        if (hideValues) {
          return `
            <div class="p-2">
              <div class="font-semibold text-white">${point.id}</div>
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.id}</div>
            <div class="text-blue-400 font-medium">${formatNumber(nodeValue)} ${baseCurrency}</div>
          </div>
        `;
      },
      pointFormatter: function() {
        const point = this as any;
        
        if (hideValues) {
          return `
            <div class="p-2">
              <div class="font-semibold text-white">${point.fromNode.id} → ${point.toNode.id}</div>
            </div>
          `;
        }
        
        return `
          <div class="p-2 space-y-1">
            <div class="font-semibold text-white">${point.fromNode.id} → ${point.toNode.id}</div>
            <div class="text-blue-400 font-medium">${formatNumber(point.weight)} ${baseCurrency}</div>
          </div>
        `;
      }
    },
    plotOptions: {
      sankey: {
        dataLabels: {
          enabled: !isMobile,
          style: {
            color: 'white',
            textOutline: '2px contrast',
            fontSize: isMobile ? '9px' : '11px',
            fontWeight: 'normal'
          }
        },
        nodeWidth: isMobile ? 15 : 20,
        nodePadding: isMobile ? 8 : 10
      }
    },
    series: [{
      type: 'sankey',
      name: 'Hierarchical Flow',
      keys: ['from', 'to', 'weight'],
      data: links,
      nodes: Object.keys(nodeValues).map(nodeId => ({
        id: nodeId,
        color: undefined // Use default colors
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

export default SankeyChart;

