import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ChartDataItem } from './types';
import { useMediaQuery } from './hooks/useMediaQuery';

interface PieChartProps {
  title: string;
  data: ChartDataItem[];
  total: number;
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string; // Function to resolve symbol names (e.g., TASE numeric to text)
}

const PieChart: React.FC<PieChartProps> = ({
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

  // Helper to get display name for a label (symbol)
  const getDisplayName = (label: string): string => {
    if (getSymbolName) {
      return getSymbolName(label);
    }
    return label;
  };

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
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
    tooltip: {
      pointFormatter: function() {
        // Use custom property to get original label for lookup
        const originalLabel = (this as any).originalLabel || this.name;
        const dataPoint = data.find(item => item.label === originalLabel);

        if (hideValues) {
          return `<b>${this.name}</b> (${dataPoint?.percentage.toFixed(2)}%)`;
        }

        return `<b>${formatNumber(this.y!)} ${baseCurrency}</b> (${dataPoint?.percentage.toFixed(2)}%)`;
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        borderColor: '#111827', // border color to match page background
        borderWidth: 0,
        borderRadius: 0,
        dataLabels: {
          enabled: !isMobile,
          format: '{point.percentage:.2f}%',
          color: 'white'
        },
        showInLegend: true
      }
    },
    legend: {
      enabled: !isMobile,
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'middle',
      itemStyle: {
        fontWeight: 'normal',
        color: 'white'
      },
      itemHoverStyle: {
        fontWeight: 'bold',
        color: 'yellow'
      }
    },
    series: [{
      type: 'pie',
      name: title,
      data: data.map(item => ({
        name: getDisplayName(item.label), // Use display name (resolves TASE numeric to text)
        y: item.value,
        sliced: false,
        selected: false,
        originalLabel: item.label // Store original label for data lookup
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

export default PieChart;