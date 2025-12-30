import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/highcharts-more';
import 'highcharts/modules/solid-gauge';
import { useMediaQuery } from './hooks/useMediaQuery';

export interface GaugeChartDataItem {
  label: string;
  value: number;
  percentage: number;
}

interface GaugeChartProps {
  title: string;
  data: GaugeChartDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
}

const GaugeChart: React.FC<GaugeChartProps> = ({
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

  // For boolean tags, we expect "Yes" and "No" values
  // Show the "Yes" percentage on the gauge
  const yesData = data.find(item => item.label === 'Yes');
  const noData = data.find(item => item.label === 'No');
  
  const yesPercentage = yesData?.percentage || 0;
  const yesValue = yesData?.value || 0;
  const noValue = noData?.value || 0;

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'solidgauge',
      backgroundColor: 'transparent',
      height: isMobile ? 250 : 300,
    },
    credits: {
      enabled: false
    },
    title: {
      text: title,
      align: 'center',
      verticalAlign: 'top',
      y: 20,
      style: {
        fontWeight: 'normal',
        fontSize: '18px',
        color: 'white'
      }
    },
    pane: {
      center: ['50%', '65%'],
      size: '100%',
      startAngle: -90,
      endAngle: 90,
      background: [{
        backgroundColor: '#374151',
        innerRadius: '60%',
        outerRadius: '100%',
        shape: 'arc'
      }]
    },
    tooltip: {
      enabled: false
    },
    yAxis: {
      min: 0,
      max: 100,
      stops: [
        [0.1, '#ef4444'], // red
        [0.5, '#eab308'], // yellow
        [0.9, '#22c55e']  // green
      ],
      lineWidth: 0,
      tickWidth: 0,
      tickAmount: 2,
      title: {
        text: '',
        y: -70
      },
      labels: {
        y: 16,
        style: {
          color: 'white',
          fontSize: '14px'
        }
      }
    },
    plotOptions: {
      solidgauge: {
        dataLabels: {
          y: -25,
          borderWidth: 0,
          useHTML: true
        }
      }
    },
    series: [{
      type: 'solidgauge',
      name: 'Yes',
      data: [{
        y: yesPercentage,
        radius: '100%',
        innerRadius: '60%'
      }],
      dataLabels: {
        format: `
          <div style="text-align:center">
            <span style="font-size:${isMobile ? '28px' : '36px'};color:white;font-weight:bold">{y:.1f}%</span><br/>
            <span style="font-size:${isMobile ? '12px' : '14px'};color:#9ca3af">Yes</span>
          </div>
        `
      }
    }]
  };

  return (
    <div className="p-4">
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
      />
      
      {/* Summary below gauge */}
      <div className="mt-4 flex justify-center gap-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{yesPercentage.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mb-1">Yes</div>
          {!hideValues && (
            <div className="text-sm text-gray-300">{formatNumber(yesValue)} {baseCurrency}</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">{(100 - yesPercentage).toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mb-1">No</div>
          {!hideValues && (
            <div className="text-sm text-gray-300">{formatNumber(noValue)} {baseCurrency}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GaugeChart;

