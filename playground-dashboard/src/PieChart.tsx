import React, { useState } from 'react';
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
  console.log(selectedSeries);
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
      }
    },
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
    <div className="p-4 border border-gray-700 rounded-lg shadow-sm bg-gray-800">
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
      />
    </div>
  );
};

export default PieChart;