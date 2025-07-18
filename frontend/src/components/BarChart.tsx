import React, { useEffect, useRef } from 'react';
import Highcharts from 'highcharts';

interface BarChartProps {
  title: string;
  data: { period: string; dividends: number }[];
  perTickerData?: {
    symbol: string;
    total_units: number;
    breakdown: { period: string; dividends: number }[];
  }[];
  baseCurrency: string;
}

const BarChart: React.FC<BarChartProps> = ({ title, data, perTickerData, baseCurrency }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Prepare series data for stacked bars
    let series: Highcharts.SeriesColumnOptions[] = [];
    
    if (perTickerData && perTickerData.length > 0) {
      // Create stacked series for each ticker
      series = perTickerData.map((ticker, index) => {
        const tickerData = data.map(periodData => {
          const tickerPeriod = ticker.breakdown.find(t => t.period === periodData.period);
          return tickerPeriod ? tickerPeriod.dividends : 0;
        });
        
        return {
          name: ticker.symbol,
          type: 'column',
          data: tickerData,
          stack: 'dividends',
          color: Highcharts.getOptions().colors?.[index % 10] || '#4E6BA6'
        };
      });
    } else {
      // Single series for total
      series = [{
        name: 'Dividends',
        type: 'column',
        data: data.map(d => d.dividends),
        color: '#4E6BA6',
      }];
    }

    const chart = Highcharts.chart(chartRef.current, {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        style: { fontFamily: 'Arial, sans-serif' },
      },
      title: {
        text: title,
        style: { color: 'white', fontWeight: 'normal', fontSize: '18px' },
      },
      xAxis: {
        categories: data.map(d => d.period),
        labels: { style: { color: '#e5e7eb' } },
        title: { text: 'Period', style: { color: '#e5e7eb' } },
      },
      yAxis: {
        min: 0,
        title: {
          text: `Dividends (${baseCurrency})`,
          style: { color: '#e5e7eb' },
        },
        labels: { style: { color: '#e5e7eb' } },
        gridLineColor: '#374151',
      },
      legend: { 
        enabled: perTickerData && perTickerData.length > 0,
        itemStyle: { color: '#e5e7eb' }
      },
      credits: { enabled: false },
      tooltip: {
        pointFormat: `<b>{point.y:.2f} ${baseCurrency}</b>`,
        backgroundColor: '#1f2937',
        style: { color: '#f3f4f6' },
      },
      plotOptions: {
        column: {
          borderRadius: 3,
          pointPadding: 0.2,
          groupPadding: 0.1,
          stacking: perTickerData && perTickerData.length > 0 ? 'normal' : undefined,
        },
      },
      series: series,
      responsive: {
        rules: [
          {
            condition: { maxWidth: 600 },
            chartOptions: {
              xAxis: { labels: { style: { fontSize: '10px' } } },
              yAxis: { labels: { style: { fontSize: '10px' } } },
              title: { style: { fontSize: '14px' } },
            },
          },
        ],
      },
    });
    return () => {
      chart.destroy();
    };
  }, [title, data, perTickerData, baseCurrency]);

  return <div ref={chartRef} style={{ width: '100%', height: '350px' }} />;
};

export default BarChart; 