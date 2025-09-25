import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { HoldingsTableData, Quote } from './types';
import { usePortfolioData } from './contexts/PortfolioDataContext';
import { useMediaQuery } from './hooks/useMediaQuery';

import 'highcharts/modules/treemap';
import 'highcharts/modules/accessibility';

interface HoldingsHeatmapProps {
  data: HoldingsTableData;
  isValueVisible: boolean;
}

const HoldingsHeatmap: React.FC<HoldingsHeatmapProps> = ({ data, isValueVisible }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { getPriceBySymbol, getPercentChange } = usePortfolioData();

  // Calculate quotes from current prices and historical data
  const quotes = useMemo((): Record<string, Quote> => {
    const quotesFromContext: Record<string, Quote> = {};

    data.holdings.forEach(holding => {
      const priceData = getPriceBySymbol(holding.symbol);
      const percentChange = getPercentChange(holding.symbol);
      
      if (priceData) {
        quotesFromContext[holding.symbol] = {
          symbol: holding.symbol,
          current_price: priceData.original_price || priceData.price,
          percent_change: percentChange,
          last_updated: priceData.last_updated
        };
      }
    });

    return quotesFromContext;
  }, [data.holdings, getPriceBySymbol, getPercentChange]);

  const chartOptions = useMemo(() => {
    console.log('🌡️ [HEATMAP] Processing data:', {
      totalHoldings: data.holdings.length,
      quotesAvailable: Object.keys(quotes).length,
      sampleQuotes: Object.keys(quotes).slice(0, 3),
      holdingTypes: [...new Set(data.holdings.map(h => h.security_type.toLowerCase()))]
    });

    // Filter to include all holdings that can have performance data (exclude pure cash positions and currency holdings)
    const performanceHoldings = data.holdings.filter(holding => {
      // Exclude ILS and USD currency holdings
      const isCurrencyHolding = holding.symbol === 'ILS' || holding.symbol === 'USD';
      if (isCurrencyHolding) {
        return false;
      }
      
      // Include all holdings except pure cash positions that don't have quotes
      const quote = quotes && quotes[holding.symbol];
      const hasPerformanceData = quote && typeof quote.percent_change === 'number';
      const isCash = holding.security_type.toLowerCase() === 'cash';
      
      // Include if it has performance data, or if it's not cash (even with 0% performance)
      return hasPerformanceData || !isCash;
    });

    console.log('🎯 [HEATMAP] Performance holdings filtered:', {
      originalCount: data.holdings.length,
      performanceCount: performanceHoldings.length,
      filtered: performanceHoldings.map(h => `${h.symbol} (${h.security_type})`),
      excludedCashPositions: data.holdings.filter(h => 
        h.security_type.toLowerCase() === 'cash' && 
        !(quotes && quotes[h.symbol] && typeof quotes[h.symbol].percent_change === 'number')
      ).length
    });

    const holdingsWithPerformance = performanceHoldings.map(holding => {
      // Use percent_change from quotes if available
      const quote = quotes && quotes[holding.symbol];
      const percentChange = quote && typeof quote.percent_change === 'number' ? quote.percent_change : 0;
      console.log(`📈 [HEATMAP] Performance for ${holding.symbol}: ${percentChange}% (quote available: ${!!quote})`);
      return {
        ...holding,
        performance: percentChange
      };
    });

    // Add individual holdings
    const holdingsData = holdingsWithPerformance.map(holding => {
      let color;
      const performance = holding.performance;

      if (performance > 3) {
        color = '#087C42';
      } else if (performance > 2) {
        color = '#16683F';
      } else if (performance > 1) {
        color = '#23543B';
      } else if (performance > 0) {
        color = '#223F3A';
      } else if (performance == 0) {
        color = '#202939';
      } else if (performance > -1) {
        color = '#3C1F2B';
      } else if (performance > -2) {
        color = '#58151D';
      } else if (performance > -3) {
        color = '#740B0F';
      } else {
        color = '#8F0000';
      }

      // Safely access quotes and format values
      const quote = quotes && quotes[holding.symbol];
      const percentChange = quote && typeof quote.percent_change === 'number'
        ? quote.percent_change.toFixed(2)
        : 'N/A';
      const currentPrice = quote && typeof quote.current_price === 'number'
        ? quote.current_price.toFixed(2)
        : 'N/A';

      return {
        id: holding.symbol,
        name: holding.symbol,
        value: holding.total_value, // Always use total_value for consistent block sizes
        colorKey: holding.performance,
        color: color,
        custom: {
          fullName: holding.name,
          performance: percentChange + '%',
          totalValue: holding.total_value,
          totalUnits: holding.total_units,
          currentPrice: currentPrice
        }
      };
    });

    const colorAxis = {
      minColor: '#f73539',
      maxColor: '#2ecc59',
      min: -10,
      max: 10,
      stops: [[0, '#f73539'], [0.5, '#414555'], [1, '#2ecc59']] as [number, string][]
    };

    const allData = holdingsData;

    const options: Highcharts.Options = {
      chart: {
        backgroundColor: 'transparent',
        height: isMobile ? 400 : 600,
        margin: [2, 2, 2, 2],
        spacing: [0,0,0,0]
      },
      credits: {
        enabled: false
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
            fontSize: isMobile ? '10px' : '12px',
          }
        },
        levels: [{
          level: 1,
          borderColor: '#111827',
          borderWidth: 2,
          dataLabels: {
            enabled: true,
            align: 'center',
            format: '{point.name}<br><span style="font-size: 0.7em">' +
              '{point.custom.performance}</span>',
            style: {
              color: '#ffffff',
              fontSize: isMobile ? '10px' : '12px',
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
            ''
          ) +
          '<b>Current Price:</b> $ {point.custom.currentPrice}'
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
      },
      colorAxis: colorAxis
    };

    return options;
  }, [data, isValueVisible, quotes, isMobile]);

  // Filter to include all holdings that can be displayed meaningfully (same logic as chartOptions)
  const displayableHoldings = data.holdings.filter(holding => {
    // Exclude ILS and USD currency holdings
    const isCurrencyHolding = holding.symbol === 'ILS' || holding.symbol === 'USD';
    if (isCurrencyHolding) {
      return false;
    }
    
    const quote = quotes && quotes[holding.symbol];
    const hasPerformanceData = quote && typeof quote.percent_change === 'number';
    const isCash = holding.security_type.toLowerCase() === 'cash';
    
    return hasPerformanceData || !isCash;
  });

  console.log('🔍 [HEATMAP] Final displayable holdings check:', {
    totalHoldings: data.holdings.length,
    displayableHoldings: displayableHoldings.length,
    quotesCount: quotes ? Object.keys(quotes).length : 0,
    willShowHeatmap: displayableHoldings.length > 0
  });

  if (displayableHoldings.length === 0) {
    return (
      <div className="p-8 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700/50 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-200 mb-2">No Performance Data Available</h3>
          <p className="text-sm text-gray-400">
            The heatmap displays holdings with live performance data from market quotes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border border-blue-400/30 rounded-md overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
    </div>
  );
};

export default HoldingsHeatmap;