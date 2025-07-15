import React, { useState, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ChartDataItem } from './types';

interface PieChartProps {
  title: string;
  data: ChartDataItem[];
  total: number;
  baseCurrency: string;
  hideValues?: boolean;
}

const PieChart: React.FC<PieChartProps> = ({
  title,
  data,
  baseCurrency,
  hideValues = false
}) => {
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [is3DLoaded, setIs3DLoaded] = useState(false);
  console.log(selectedSeries);

  // Initialize 3D module
  useEffect(() => {
    const load3D = async () => {
      try {
        const Highcharts3D = (await import('highcharts/highcharts-3d')).default;
        Highcharts3D(Highcharts);
        setIs3DLoaded(true);
      } catch (error) {
        console.error('Failed to load 3D module:', error);
        setIs3DLoaded(true); // Still render the chart, just without 3D
      }
    };
    load3D();
  }, []);

  // Don't render until 3D module is loaded
  if (!is3DLoaded) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading chart...</div>
        </div>
      </div>
    );
  }

  // Format number with comma separators and no decimal
  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(value);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      options3d: {
        enabled: true,
        alpha: 45,
        beta: 0,
        depth: 50,
        viewDistance: 25
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
      style: {
        fontWeight: 'normal',
        fontSize: '18px',
        color: 'white'
      }
    },
    tooltip: {
      pointFormatter: function() {
        const dataPoint = data.find(item => item.label === this.name);

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
        borderColor: '#242424', // Dark gray border to match theme
        borderWidth: 1,
        depth: 35,
        dataLabels: {
          enabled: true,
          format: '{point.percentage:.2f}%',
          color: 'white'
        },
        showInLegend: true,
        events: {
          legendItemClick: function(e) {
            const point = e.target;

            if (point.visible) {
              setSelectedSeries(prev =>
                prev.includes(point.name!)
                  ? prev.filter(name => name !== point.name!)
                  : [...prev, point.name!]
              );
            }
            return false;
          }
        }
      }
    },
    legend: {
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
        name: item.label,
        y: item.value,
        sliced: false,
        selected: false
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