import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { HoldingsTableData, SecurityHolding } from './types';

import 'highcharts/modules/treemap';
import 'highcharts/modules/accessibility';

interface HoldingsHeatmapProps {
  data: HoldingsTableData;
  isValueVisible: boolean;
}

const HoldingsHeatmap: React.FC<HoldingsHeatmapProps> = ({ data, isValueVisible }) => {
  const chartOptions = useMemo(() => {
    // Filter to only include stocks and securities with historical data
    const stockHoldings = data.holdings.filter(holding =>
      holding.historical_prices &&
      holding.historical_prices.length >= 2
    );

    const holdingsWithPerformance = stockHoldings.map(holding => {
      const prices = holding.historical_prices;

      // Ensure we have at least 2 price points
      if (prices.length < 2) {
        return {
          ...holding,
          performance: 0
        };
      }

      // Get the most recent and previous prices
      const currentPrice = prices[0].price;
      const previousPrice = prices[1].price;

      // Calculate percentage change
      const performance = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

      // Debug logging
      console.log(`${holding.symbol}: ${previousPrice} -> ${currentPrice} = ${performance.toFixed(2)}%`);

      return {
        ...holding,
        performance
      };
    });

    // Add individual holdings
    const holdingsData = holdingsWithPerformance.map(holding => {
              let color;
      const performance = holding.performance;

      if (performance > 6) {
        color = '#087C42';
      } else if (performance > 4) {
        color = '#16683F';
      } else if (performance > 2) {
        color = '#23543B';
      } else if (performance > 0) {
        color = '#223F3A';
      } else if (performance == 0) {
        color = '#202939';
      } else if (performance > -2) {
        color = '#3C1F2B';
      } else if (performance > -4) {
        color = '#58151D';
      } else if (performance > -6) {
        color = '#740B0F';
      } else {
        color = '#8F0000';
      }

      return {
        id: holding.symbol,
        name: holding.symbol,
        value: isValueVisible ? holding.total_value : holding.total_units,
        colorKey: holding.performance,
        color: color,
        custom: {
          fullName: holding.name,
          performance: (holding.performance < 0 ? '' : '+') + holding.performance.toFixed(2) + '%',
          totalValue: holding.total_value,
          totalUnits: holding.total_units,
          currentPrice: holding.historical_prices[holding.historical_prices.length - 1].price
        }
      };
    });

    console.log('Color values:', holdingsData.map(h => h.colorKey));
    console.log('ColorAxis config:', {
      minColor: '#f73539',
      maxColor: '#2ecc59',
      min: -10,
      max: 10,
      stops: [[0, '#f73539'], [0.5, '#414555'], [1, '#2ecc59']]
    });

    const allData = holdingsData;

    const options: Highcharts.Options = {
      chart: {
        backgroundColor: '#1f2937',
        height: 600
      },
      series: [{
        name: 'Holdings',
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        animationLimit: 1000,
        colorByPoint: true,
                  dataLabels: {
            enabled: true,
            align: 'center',
            format: '{point.name}<br><span style="font-size: 0.7em">' +
              '{point.custom.performance}</span>',
            style: {
              color: '#ffffff',
            }
          },
        levels: [{
          level: 1,

          dataLabels: {
            enabled: true,
            align: 'center',
            format: '{point.name}<br><span style="font-size: 0.7em">' +
              '{point.custom.performance}</span>',
            style: {
              color: '#ffffff',
            }
          }
        }],
        accessibility: {
          exposeAsGroupOnly: true
        },
        breadcrumbs: {
          buttonTheme: {
            style: {
              color: '#9ca3af'
            },
            states: {
              hover: {
                fill: '#374151'
              },
              select: {
                style: {
                  color: '#ffffff'
                }
              }
            }
          }
        },
        data: allData
      }],
      title: {
        text: '',
        align: 'left',
        style: {
          color: '#f3f4f6',
          fontSize: '1.2em'
        }
      },
      subtitle: {
        style: {
          color: '#9ca3af',
          fontSize: '0.9em'
        }
      },
      tooltip: {
        followPointer: true,
        outside: true,
        headerFormat: '<span style="font-size: 0.9em">' +
          '{point.custom.fullName}</span><br/>',
        pointFormat: '<b>Symbol:</b> {point.name}<br/>' +
          '<b>Performance:</b> {point.custom.performance}<br/>' +
          (isValueVisible ?
            '<b>Total Value:</b> ' + data.base_currency + ' {point.value:,.0f}<br/>' :
            '<b>Total Units:</b> {point.value:,.0f}<br/>'
          ) +
          '<b>Current Price:</b> $ {point.custom.currentPrice:.2f}'
      },

      legend: {
        itemStyle: {
          color: '#f3f4f6'
        }
      },
      navigation: {
        buttonOptions: {
          symbolStroke: '#9ca3af'
        }
      }
    };

    return options;
  }, [data, isValueVisible]);

  // Filter to only include stocks with historical data
  const stockHoldings = data.holdings.filter(holding =>
    holding.security_type.toLowerCase() === 'stock' &&
    holding.historical_prices &&
    holding.historical_prices.length >= 2
  );

  if (stockHoldings.length === 0) {
    return (
      <div className="p-8 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700/50 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-200 mb-2">No Stock Data Available</h3>
          <p className="text-sm text-gray-400">
            The heatmap requires stocks with historical price data to display performance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
    </div>
  );
};

export default HoldingsHeatmap;