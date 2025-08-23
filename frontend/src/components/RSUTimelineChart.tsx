import React, { useMemo, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Card } from './ui/card';

interface VestingEvent {
  date: string;
  units: number;
}

interface RSUVestingPlan {
  id: string;
  symbol: string;
  total_units: number;
  vested_units: number;
  next_vest_date: string | null;
  next_vest_units: number;
  schedule: VestingEvent[];
  grant_date: string;
  cliff_months: number;
  vesting_period_years: number;
  vesting_frequency: string;
  price?: number;
  price_currency?: string;
  total_value?: number;
  vested_value?: number;
  unvested_value?: number;
}

interface RSUTimelineChartProps {
  plans: RSUVestingPlan[];
  symbol: string;
  baseCurrency: string;
}

// Removed unused ChartDataPoint interface

const RSUTimelineChart: React.FC<RSUTimelineChartProps> = ({ plans, symbol, baseCurrency }) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  
  // Use the same colors as pie charts
  const pieChartColors = [
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

  const chartData = useMemo(() => {
    if (!plans.length) return { series: [], categories: [] };

    const now = new Date();
    const allDates = new Set<string>();

    // Sort plans by grant date (older first, so they appear at bottom of stack)
    const sortedPlans = [...plans].sort((a, b) => 
      new Date(a.grant_date).getTime() - new Date(b.grant_date).getTime()
    );

    // Collect all unique dates and prepare data for each plan
    sortedPlans.forEach((plan) => {
      const price = plan.price || 0;

      if (price > 0 && plan.schedule) {
        // Add grant date as starting point
        allDates.add(plan.grant_date);

        plan.schedule.forEach((event) => {
          allDates.add(event.date);
        });

        // Add a point 2 years into the future for better visualization
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 2);
        allDates.add(futureDate.toISOString().split('T')[0]);
      }
    });

    // Convert to sorted array of dates
    const sortedDates = Array.from(allDates).sort();

    // Create one series per plan with color zones for vested/unvested
    const series = sortedPlans.map((plan, index) => {
      const price = plan.price || 0;
      
      // Create cumulative values for area chart
      const seriesData = sortedDates.map(date => {
        const timestamp = new Date(date).getTime();
        const dateObj = new Date(date);
        
        // Calculate cumulative vested value up to this date
        let cumulativeValue = 0;
        if (price > 0 && plan.schedule) {
          plan.schedule.forEach(event => {
            if (new Date(event.date) <= dateObj) {
              cumulativeValue += event.units * price;
            }
          });
        }

        // Find if there's a vesting event on this exact date
        const vestingEvent = plan.schedule?.find(event => event.date === date);

        return {
          x: timestamp,
          y: cumulativeValue,
          marker: vestingEvent ? {
            enabled: true,
            radius: 3,
            symbol: 'circle',
            lineWidth: 1,
            lineColor: 'rgba(255, 255, 255, 0.2)',
          } : { enabled: false },
          vestingInfo: vestingEvent ? {
            date: vestingEvent.date,
            units: vestingEvent.units,
            valueILS: vestingEvent.units * price,
            percentageOfPlan: plan.total_units > 0 ? (vestingEvent.units / plan.total_units) * 100 : 0
          } : undefined,
          planId: plan.id,
          // Mark points without vesting events as non-interactive
          allowPointSelect: !!vestingEvent
        };
      });

      const baseColor = pieChartColors[index % pieChartColors.length];
      
      // Create grayed out version by converting to a more muted color
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };
      
      const rgb = hexToRgb(baseColor);
      const grayedColor = rgb ? 
        `rgb(${Math.floor(rgb.r * 0.6 + 128 * 0.4)}, ${Math.floor(rgb.g * 0.6 + 128 * 0.4)}, ${Math.floor(rgb.b * 0.6 + 128 * 0.4)})` 
        : '#888888';

      return {
        name: `${plan.symbol} - Grant ${plan.grant_date}`,
        data: seriesData,
        type: 'area',
        stacking: 'normal',
        planInfo: plan,
        color: baseColor, // Use base color for legend
        zones: [{
          value: now.getTime(), // Up to today
          color: baseColor,
          fillColor: baseColor
        }, {
          // After today
          color: grayedColor,
          fillColor: grayedColor
        }],
        fillOpacity: 0.7
      };
    });

    // Calculate the maximum STACKED value across all time points for optimal y-axis scaling
    const stackedValues: { [key: string]: number } = {};
    
    // Sum values for each time point across all series
    series.forEach(s => {
      s.data.forEach((point: any) => {
        const key = String(point.x);
        if (!stackedValues[key]) stackedValues[key] = 0;
        stackedValues[key] += (point.y || 0);
      });
    });
    
    // Find the maximum stacked value
    const maxValue = Math.max(...Object.values(stackedValues), 0);

    return { series, categories: sortedDates, maxValue };
  }, [plans, baseCurrency, pieChartColors]);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'area',
      backgroundColor: 'transparent',
      height: 400,
      borderWidth: 0,
      plotBorderWidth: 0,
    //   margin: [80, 20, 60, 80], // Increase top margin to prevent clipping
      spacingTop: 20 // Add extra spacing at the top
    },
    credits: {
      enabled: false
    },
    title: {
      text: `${symbol} RSU Vesting Timeline`,
      align: 'left',
      style: { 
        color: '#ffffff',
        fontSize: '18px',
        fontWeight: 'bold'
      }
    },
    xAxis: {
      type: 'datetime',
      title: { text: '' },
      labels: {
        format: '{value:%Y-%m}',
        style: { color: '#ffffff' }
      },
      gridLineColor: 'rgba(255, 255, 255, 0.1)',
      lineColor: 'rgba(255, 255, 255, 0.2)',
      tickColor: 'rgba(255, 255, 255, 0.2)',
      plotLines: [{
        color: '#ef4444', // red color for "today" line
        width: 2,
        value: new Date().getTime(),
        label: {
          text: 'Today',
          align: 'center',
          style: {
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: 'bold'
          }
        },
        zIndex: 5
      }]
    },
    yAxis: {
      title: { 
        text: `Value (${baseCurrency})`,
        style: { color: '#ffffff' }
      },
      labels: {
        formatter: function() {
          return `${(this.value as number).toLocaleString()}`;
        },
        style: { color: '#ffffff' }
      },
      gridLineColor: 'rgba(255, 255, 255, 0.1)', // Delicate grid lines
      min: 0,
    },
    plotOptions: {
      area: {
        stacking: 'normal',
        marker: {
          enabled: false, // Disable by default, enable only for specific points with vesting events
          radius: 0,
          lineWidth: 0,
        },
        states: {
          hover: {
            enabled: false // Re-enable hover
          }
        },
        enableMouseTracking: true, // Re-enable mouse tracking
        point: {
          events: {
            mouseOver: function() {
              // Only show marker on hover for vesting events
              const point = this as any;
              if (!point.vestingInfo) {
                // Prevent hover effects for non-vesting points
                point.setState('');
                return false;
              }
            }
          }
        }
      }
    },
    tooltip: {
      shared: false,
      formatter: function() {
        const context = this as any;
        const point = context.point;
        const series = context.series;
        const planInfo = series.userOptions.planInfo;
        
        // Only show tooltips for points with vesting events
        if (!(point as any).vestingInfo) {
          return false; // Hide tooltip for non-vesting points
        }
        
        if ((point as any).vestingInfo) {
          // Vesting event tooltip
          return `
            <b>🎯 Vesting Event</b><br/>
            <b>Date:</b> ${(point as any).vestingInfo.date}<br/>
            <b>Units:</b> ${(point as any).vestingInfo.units.toLocaleString()}<br/>
            <b>Value:</b> ${(point as any).vestingInfo.valueILS.toLocaleString()} ${baseCurrency}<br/>
            <b>% of Plan:</b> ${(point as any).vestingInfo.percentageOfPlan.toFixed(1)}%<br/>
            <i>Grant: ${planInfo?.grant_date}</i>
          `;
        } else {
          // Plan area tooltip - determine if this point is vested based on date
          const pointDate = new Date((point as any).x);
          const now = new Date();
          const isVested = pointDate <= now;
          
          return `
            <b>${planInfo?.symbol} - Grant ${planInfo?.grant_date}</b><br/>
            <b>Status:</b> ${isVested ? '✅ Vested Portion' : '⏳ Future Vesting'}<br/>
            <b>Total Units:</b> ${planInfo?.total_units?.toLocaleString()}<br/>
            <b>Vested Units:</b> ${planInfo?.vested_units?.toLocaleString()}<br/>
            ${planInfo?.next_vest_date ? `<b>Next Vest:</b> ${planInfo.next_vest_date} (${planInfo?.next_vest_units?.toLocaleString()})<br/>` : ''}
            <b>Frequency:</b> ${planInfo?.vesting_frequency}<br/>
            <b>Period:</b> ${planInfo?.vesting_period_years}y<br/>
            <b>Vested Value:</b> ${planInfo?.vested_value?.toLocaleString()} ${baseCurrency}<br/>
            <b>Unvested Value:</b> ${planInfo?.unvested_value?.toLocaleString()} ${baseCurrency}<br/>
            <b>Point Value:</b> ${(point as any).y?.toLocaleString()} ${baseCurrency}
          `;
        }
      }
    },
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'bottom',
      layout: 'horizontal',
      itemStyle: {
        color: '#ffffff',
        fontSize: '12px'
      },
      itemHoverStyle: {
        color: '#cccccc'
      }
    },
    series: chartData.series as any
  };

  return (
    <>
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        options={chartOptions}
      />
      
      {/* Plan Summary Cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((plan, index) => {
          const cardColor = pieChartColors[index % pieChartColors.length];
          
          return (
            <Card key={plan.id} className="p-3 border-l-4" 
                  style={{borderLeftColor: cardColor}}>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Grant: {plan.grant_date}</span>
                  <span className="text-xs text-muted-foreground">{plan.vesting_frequency}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Vested: {plan.vested_units?.toLocaleString()}/{plan.total_units?.toLocaleString()}</span>
                  <span>{((plan.vested_units / plan.total_units) * 100).toFixed(1)}%</span>
                </div>
                {plan.next_vest_date && (
                  <div className="text-xs text-green-600">
                    Next: {plan.next_vest_date} ({plan.next_vest_units})
                  </div>
                )}
                {plan.vested_value && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-green-600">{plan.vested_value.toLocaleString()} {baseCurrency}</span>
                    {plan.unvested_value && plan.unvested_value > 0 && (
                      <span className="text-yellow-600">{plan.unvested_value.toLocaleString()} {baseCurrency}</span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
};

export default RSUTimelineChart;
