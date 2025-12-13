import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMediaQuery } from '../hooks/useMediaQuery';

// Initialize sunburst module
import 'highcharts/modules/sunburst';

interface SunburstChartProps {
  title: string;
  data: Array<{
    symbol: string;
    name: string;
    value: number;
    path: string[]; // e.g., ["Technology", "Software", "Cloud Services"]
  }>;
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const SunburstChart: React.FC<SunburstChartProps> = ({
  title,
  data,
  baseCurrency,
  hideValues = false,
  getSymbolName
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Transform hierarchical data into sunburst format
  const buildSunburstData = () => {
    const root: any = {
      id: 'root',
      name: 'Portfolio',
      color: 'transparent'
    };
    
    const nodes: any[] = [root];
    const nodeMap = new Map<string, any>();
    nodeMap.set('root', root);
    
    data.forEach((item) => {
      let parentId = 'root';
      
      // Build hierarchy nodes using actual path names for unique IDs
      item.path.forEach((level, levelIdx) => {
        // Create unique node ID based on the actual path (not positional index)
        // e.g., "x" -> "root>x", "x>y" -> "root>x>y"
        const nodeId = `${parentId}>${level}`;
        
        if (!nodeMap.has(nodeId)) {
          const node: any = {
            id: nodeId,
            parent: parentId,
            name: level
          };
          
          nodes.push(node);
          nodeMap.set(nodeId, node);
        }
        
        // If this is the leaf level, add the value to this node
        // Multiple holdings can share the same leaf - aggregate their values
        if (levelIdx === item.path.length - 1) {
          const existingNode = nodeMap.get(nodeId);
          if (existingNode.value) {
            // Aggregate value if multiple holdings share this path
            existingNode.value += item.value;
          } else {
            existingNode.value = item.value;
            existingNode.symbol = item.symbol;
            existingNode.displayName = getSymbolName ? getSymbolName(item.symbol) : item.name;
          }
        }
        
        parentId = nodeId;
      });
    });
    
    return nodes;
  };

  const sunburstData = buildSunburstData();

  const chartOptions: Highcharts.Options = {
    chart: {
      backgroundColor: 'transparent',
      height: 500
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
    tooltip: {
      useHTML: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderWidth: 1,
      borderColor: '#374151',
      style: {
        color: '#e5e7eb'
      },
      pointFormatter: function(this: any) {
        if (!this.value) {
          return `<b>${this.name}</b>`;
        }
        
        const percentage = ((this.value / (this.series.tree.val || 1)) * 100).toFixed(2);
        
        if (hideValues) {
          return `<b>${this.displayName || this.name}</b><br/>
                  ${percentage}% of total`;
        }
        
        return `<b>${this.displayName || this.name}</b><br/>
                ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(this.value)} ${baseCurrency}<br/>
                ${percentage}% of total`;
      }
    },
    series: [{
      type: 'sunburst',
      data: sunburstData,
      allowDrillToNode: true,
      cursor: 'pointer',
      dataLabels: {
        format: '{point.name}',
        filter: {
          property: 'innerArcLength',
          operator: '>',
          value: 16
        },
        style: {
          textOutline: 'none',
          color: 'white',
          fontSize: isMobile ? '10px' : '12px'
        }
      },
      levels: [{
        level: 1,
        dataLabels: {
          filter: {
            property: 'outerArcLength',
            operator: '>',
            value: 64
          }
        }
      }, {
        level: 2,
        colorByPoint: true
      }, {
        level: 3,
        colorVariation: {
          key: 'brightness',
          to: -0.5
        }
      }],
      colors: [
        '#4E6BA6', '#938FB8', '#D8B5BE', '#398AA2', '#1E7590',
        '#6B8FB8', '#B8A8C8', '#C8B5D8', '#A8C8D8', '#8FB8C8'
      ]
    }] as any
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

export default SunburstChart;

