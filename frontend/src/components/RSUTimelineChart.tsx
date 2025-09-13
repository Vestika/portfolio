import React, { useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/highcharts-more';
import 'highcharts/modules/solid-gauge';

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
  price_currency?: string;
}

interface RSUTimelineChartProps {
  plans: RSUVestingPlan[];
  symbol: string;
  accountName: string;
  baseCurrency: string;
  globalPrices: Record<string, any>;
}

// Removed unused ChartDataPoint interface

const RSUTimelineChart: React.FC<RSUTimelineChartProps> = ({ plans, symbol, accountName, baseCurrency, globalPrices }) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const [hoveredGauge, setHoveredGauge] = useState<number | null>(null);
  
  // Utility function to format numbers with K/M suffix
  const formatShortNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toString();
  };
  
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
    if (!plans.length) return { grantData: [], totalVested: 0, totalUnvested: 0, overallPercentage: 0, totalVestedShares: 0, totalShares: 0 };

    // Calculate totals for aggregate display
    let totalVested = 0;
    let totalUnvested = 0;
    let totalVestedShares = 0;
    let totalShares = 0;
    
    const grantData = plans.map((plan, index) => {
      // Calculate values dynamically using global price data
      const priceData = globalPrices[plan.symbol];
      const currentPrice = priceData?.price || 0;
      
      const vestedValue = (plan.vested_units || 0) * currentPrice;
      const totalValue = (plan.total_units || 0) * currentPrice;
      const unvestedValue = totalValue - vestedValue;
      const vestedPercentage = totalValue > 0 ? (vestedValue / totalValue) * 100 : 0;
      
      totalVested += vestedValue;
      totalUnvested += unvestedValue;
      totalVestedShares += (plan.vested_units || 0);
      totalShares += (plan.total_units || 0);
      
      return {
        planInfo: plan,
        vestedValue,
        unvestedValue,
        totalValue,
        vestedPercentage,
        color: pieChartColors[index % pieChartColors.length]
      };
    });

    const totalPortfolioValue = totalVested + totalUnvested;
    const overallPercentage = totalPortfolioValue > 0 ? (totalVested / totalPortfolioValue) * 100 : 0;

    return { grantData, totalVested, totalUnvested, overallPercentage, totalVestedShares, totalShares };
  }, [plans, baseCurrency, pieChartColors]);

  // Hover state is now defined above

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'solidgauge',
      backgroundColor: 'transparent',
      height: 600,
      borderWidth: 0,
      plotBorderWidth: 0,
      spacingTop: 20,
      spacingBottom: 20,
      spacingLeft: 20,
      spacingRight: 20
    },
    credits: {
      enabled: false
    },
    title: {
      text: hoveredGauge !== null ? 
        `${symbol} (${accountName || 'Account'}) Grant ${chartData.grantData[hoveredGauge]?.planInfo?.grant_date || ''}` :
        `${symbol} (${accountName || 'Account'})`,
      align: 'left',
      style: { 
        color: '#ffffff',
        fontSize: '20px',
        fontWeight: 'bold'
      }
    },
    subtitle: {
      text: hoveredGauge !== null ? 
        (() => {
          const grant = chartData.grantData[hoveredGauge];
          const grantColor = grant?.color || '#ffffff';
          // Grant-specific information in same format as base subtitle (replaces base when hovering)
          const grantVestedInfo = `Vested: ${grant?.vestedPercentage?.toFixed(1)}%  |  ${(grant?.planInfo?.vested_units || 0).toLocaleString()} of ${(grant?.planInfo?.total_units || 0).toLocaleString()} shares  |  ${Math.round(grant?.vestedValue || 0).toLocaleString()} of ${Math.round(grant?.totalValue || 0).toLocaleString()} ${baseCurrency}`;
          
          // Next vesting information - calculate value using global price
          const grantPriceData = globalPrices[grant?.planInfo?.symbol];
          const grantCurrentPrice = grantPriceData?.price || 0;
          const nextVestInfo = grant?.planInfo?.next_vest_date ? 
            `Next Vest: ${grant.planInfo.next_vest_date}  |  ${(grant.planInfo.next_vest_units || 0).toLocaleString()} shares  |  ${Math.round((grant.planInfo.next_vest_units || 0) * grantCurrentPrice).toLocaleString()} ${baseCurrency}` :
            `No upcoming vesting`;
          
          return `<div style="line-height: 1.2; text-align: left; margin: 0; padding: 0;">
            <div style="color: ${grantColor}; margin: 0; padding: 0;">${grantVestedInfo}</div>
            <div style="color: ${grantColor}; margin: 0; padding: 0;">${nextVestInfo}</div>
          </div>`;
        })() :
        (() => {
          // Find the next vesting event across all plans
          let nextVestDate: string | null = null;
          
          plans.forEach(plan => {
            if (plan.next_vest_date) {
              if (!nextVestDate || new Date(plan.next_vest_date) < new Date(nextVestDate)) {
                nextVestDate = plan.next_vest_date;
              }
            }
          });
          
          const overallInfo = `Vested: ${chartData.overallPercentage.toFixed(1)}%  |  ${chartData.totalVestedShares.toLocaleString()} of ${chartData.totalShares.toLocaleString()} shares  |  ${Math.round(chartData.totalVested).toLocaleString()} of ${Math.round(chartData.totalVested + chartData.totalUnvested).toLocaleString()} ${baseCurrency}`;
          
          let nextVestInfo = '';
          if (nextVestDate) {
            const today = new Date();
            const vestDate = new Date(nextVestDate);
            const daysUntil = Math.ceil((vestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntil > 0) {
              nextVestInfo = `Next Vest: ${daysUntil} days`;
            } else {
              nextVestInfo = `Next Vest: Today`;
            }
          } else {
            nextVestInfo = 'No upcoming vesting events';
          }
          
          return `<div style="line-height: 1.2; text-align: left; margin: 0; padding: 0;">
            <div style="color: #cccccc; margin: 0; padding: 0;">${overallInfo}</div>
            <div style="color: #999999; margin: 0; padding: 0;">${nextVestInfo}</div>
          </div>`;
        })(),
      useHTML: true,
      style: {
        color: '#cccccc',
        fontSize: '16px',
        textAlign: 'left'
      }
    },
    pane: {
      center: ['50%', '50%'],
      size: '80%',
      startAngle: 0,
      endAngle: 360,
      background: chartData.grantData.map((_, index) => ({
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 0,
        borderColor: 'transparent',
        outerRadius: `${100 - index * 15}%`,
        innerRadius: `${85 - index * 15}%`
      }))
    },
    yAxis: {
      min: 0,
      max: 100,
      title: {
        text: ''
      },
      labels: {
        enabled: false
      },
      lineWidth: 0,
      tickWidth: 0,
      tickAmount: 0,
      gridLineWidth: 0,
      minorGridLineWidth: 0,
      tickLength: 0,
      minorTickLength: 0
    },
    plotOptions: {
      solidgauge: {
        dataLabels: {
          enabled: false, // Disabled globally, will be enabled per point
          borderWidth: 0,
          backgroundColor: 'transparent',
          shadow: false
        },
        linecap: 'round',
        stickyTracking: false,
        rounded: true,
        enableMouseTracking: true
      }
    },
    tooltip: {
      enabled: false
    },
    series: chartData.grantData.flatMap((grant, index) => {
      // Pre-compute formatted values
      const grantVestedShort = formatShortNumber(Math.round(grant.vestedValue));
      const grantTotalShort = formatShortNumber(Math.round(grant.totalValue));
      const totalVestedShort = formatShortNumber(Math.round(chartData.totalVested));
      const totalPortfolioShort = formatShortNumber(Math.round(chartData.totalVested + chartData.totalUnvested));
      
      return [
        // Unvested portion (transparent) - full circle background
        {
          name: `Grant ${grant.planInfo.grant_date} Unvested`,
          data: [{
            color: grant.color + '40', // 40 = 25% transparency in hex
            radius: `${100 - index * 15}%`,
            innerRadius: `${85 - index * 15}%`,
            y: 100, // Full circle
            dataLabels: {
              enabled: false
            }
          }],
          enableMouseTracking: false,
          zIndex: 0 // Behind the vested portion
        },
        // Vested portion (colored) - on top
        {
          name: `Grant ${grant.planInfo.grant_date}`,
          data: [{
            color: grant.color,
            radius: `${100 - index * 15}%`,
            innerRadius: `${85 - index * 15}%`,
            y: grant.vestedPercentage,
            dataLabels: {
              enabled: hoveredGauge !== null ? (hoveredGauge === index) : (index === 0),
              borderWidth: 0,
              backgroundColor: 'transparent',
              shadow: false,
              format: hoveredGauge === index ? 
                `<div style="text-align: center; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: none; background: transparent; white-space: nowrap;">
                  <div style="font-size: 32px; font-weight: bold; color: ${grant.color}; line-height: 1.2; white-space: nowrap;">
                    ${grantVestedShort} <span style="font-size: 14px; color: #999999;">${baseCurrency}</span>
                  </div>
                  <div style="font-size: 16px; color: #cccccc; margin-top: 2px; white-space: nowrap;">
                    ${Math.round(grant.vestedPercentage)}% of ${grantTotalShort}
                  </div>
                </div>` : 
                (hoveredGauge === null && index === 0 ? 
                  `<div style="text-align: center; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: none; background: transparent; white-space: nowrap;">
                    <div style="font-size: 32px; font-weight: bold; color: #ffffff; line-height: 1.2; white-space: nowrap;">
                      ${totalVestedShort} <span style="font-size: 14px; color: #999999;">${baseCurrency}</span>
                    </div>
                    <div style="font-size: 16px; color: #cccccc; margin-top: 2px; white-space: nowrap;">
                      ${Math.round(chartData.overallPercentage)}% of ${totalPortfolioShort}
                    </div>
                  </div>` : 
                  ''),
              useHTML: true
            }
          }],
          enableMouseTracking: true,
          events: {
            mouseOver: function() {
              setHoveredGauge(index);
            },
            mouseOut: function() {
              setHoveredGauge(null);
            }
          },
          zIndex: 1 // On top of the unvested portion
        }
      ];
    }).flat() as any
  };

  return (
    <div className="w-full" onMouseLeave={() => setHoveredGauge(null)}>
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        options={chartOptions}
      />
    </div>
  );
};

export default RSUTimelineChart;
