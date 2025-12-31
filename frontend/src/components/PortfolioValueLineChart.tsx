import { useEffect, useRef, useMemo, useState } from 'react'
import Highcharts from 'highcharts'
import { AccountInfo } from '../types'
import { Layers, User } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

// Chart marker interface for reusable event markers
export interface ChartMarker {
  id: string
  date: string  // ISO date string
  label: string
  description?: string
  color?: string
  icon?: string  // Emoji or icon identifier
}

interface PortfolioValueLineChartProps {
  accounts: AccountInfo[]
  selectedAccountNames: string[]
  historicalPrices: Record<string, Array<{ date: string; price: number }>>
  baseCurrency: string
  isValueVisible: boolean
  globalSecurities: Record<string, { symbol: string; name: string; security_type: string; currency: string }>
  globalCurrentPrices: Record<string, { price: number; original_price?: number; currency: string }>
  markers?: ChartMarker[]  // Optional markers for events like user join date
}

export function PortfolioValueLineChart({
  accounts,
  selectedAccountNames,
  historicalPrices,
  baseCurrency,
  isValueVisible,
  globalSecurities,
  globalCurrentPrices,
  markers = []
}: PortfolioValueLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null)
  const [viewMode, setViewMode] = useState<'aggregated' | 'separate'>('aggregated')
  const [selectedZoom, setSelectedZoom] = useState<'all' | 'year' | 'month' | 'week'>('all')

  // Filter to selected accounts only
  const selectedAccounts = useMemo(() => {
    return accounts.filter(account => selectedAccountNames.includes(account.account_name))
  }, [accounts, selectedAccountNames])

  // Calculate portfolio value over time (aggregated or per-account)
  const { seriesData, minValue, maxValue } = useMemo(() => {
    if (!selectedAccounts.length || !historicalPrices) {
      return { seriesData: [], minValue: 0, maxValue: 0 }
    }

    // Collect all unique dates from all symbols
    const allDates = new Set<string>()
    Object.values(historicalPrices).forEach(series => {
      series.forEach(point => allDates.add(point.date))
    })

    const sortedDates = Array.from(allDates).sort()
    
    // Use all dates including weekends - forward-filling will handle closed markets

    // Build historical FX rate cache with forward-filling
    // Backend returns currency rates with "FX:" prefix (e.g., "FX:USD", "FX:ILS")
    const fxRateCache = new Map<string, Map<string, number>>()
    
    Object.entries(historicalPrices).forEach(([symbol, series]) => {
      // Check if this symbol starts with "FX:" prefix
      const isCurrency = symbol.startsWith('FX:')
      
      if (isCurrency) {
        const fxRates = new Map<string, number>()
        let lastKnownRate = 0
        
        // Extract currency code from "FX:USD" -> "USD"
        const currencyCode = symbol.substring(3).toUpperCase()
        
        const sortedSeries = [...series].sort((a, b) => a.date.localeCompare(b.date))
        
        sortedDates.forEach(date => {
          const exactRate = sortedSeries.find(p => p.date === date)
          if (exactRate && exactRate.price > 0) {
            lastKnownRate = exactRate.price
            fxRates.set(date, exactRate.price)
          } else if (lastKnownRate > 0) {
            // Forward-fill: use last known rate (handles weekends)
            fxRates.set(date, lastKnownRate)
          } else {
            const futureRate = sortedSeries.find(p => p.date > date && p.price > 0)
            if (futureRate) {
              fxRates.set(date, futureRate.price)
            }
          }
        })
        
        if (fxRates.size > 0) {
          // Store by currency code without the FX: prefix
          fxRateCache.set(currencyCode, fxRates)
        }
      }
    })

    /**
     * Helper function to get FX rate for a specific date
     * 
     * CALCULATION EXAMPLE:
     * ==================
     * Scenario: 720 units of NVDA, base currency = ILS
     * 
     * 1. NVDA historical price on 2024-11-15: $140.50 (in USD)
     * 2. Symbol currency (from globalSecurities): "USD"
     * 3. Historical FX rate for USD→ILS on 2024-11-15: 3.65
     *    (means 1 USD = 3.65 ILS)
     * 4. Converted price: $140.50 × 3.65 = ₪512.83
     * 5. Holding value: 720 units × ₪512.83 = ₪369,237.60 ✅
     * 
     * This function returns the FX rate (step 3 above)
     */
    const getFXRate = (currency: string, date: string): number => {
      const cur = currency.toUpperCase()
      const base = baseCurrency.toUpperCase()
      
      if (cur === base) return 1.0
      
      const rates = fxRateCache.get(cur)
      if (rates) {
        const rate = rates.get(date)
        if (rate && rate > 0) {
          return rate
        }
      }
      
      // Fallback to current rate if historical rate not available
      const currentRate = globalCurrentPrices[cur]?.price
      return typeof currentRate === 'number' && currentRate > 0 ? currentRate : 1.0
    }

    // Build a price cache with forward-filling for each symbol
    // Convert all prices to base currency using HISTORICAL FX rates
    const priceCache = new Map<string, Map<string, number>>()
    
    Object.entries(historicalPrices).forEach(([symbol, series]) => {
      // Skip FX rate symbols UNLESS they're currency holdings (we need them for cash)
      // FX rates are already processed into fxRateCache above
      if (symbol.startsWith('FX:')) {
        // Check if any account actually holds this currency
        const isCurrencyHolding = selectedAccounts.some(account => 
          account.holdings?.some(h => h.symbol === symbol)
        )
        
        if (!isCurrencyHolding) {
          return  // Skip if it's just an FX rate, not a holding
        }
        // Otherwise, continue to process it as a holding
      }
      
      const symbolPrices = new Map<string, number>()
      let lastKnownConvertedPrice = 0
      
      // Get the currency for this symbol
      // For FX: symbols, extract the currency code (e.g., FX:ILS -> ILS)
      let symbolCurrency = baseCurrency
      if (symbol.startsWith('FX:')) {
        symbolCurrency = symbol.substring(3)  // Remove "FX:" prefix
      } else {
        symbolCurrency = globalSecurities[symbol]?.currency || 
                        globalCurrentPrices[symbol]?.currency || 
                        baseCurrency
      }
      
      // Sort series by date to ensure proper forward-filling
      const sortedSeries = [...series].sort((a, b) => a.date.localeCompare(b.date))
      
      sortedDates.forEach(date => {
        // For currency holdings (FX: symbols), the historical data contains the exchange rate,
        // but we need to treat it as 1 unit of currency, then apply the FX rate once.
        // For regular securities, use the actual price from historical data.
        const isCurrencyHolding = symbol.startsWith('FX:')
        
        // Find exact price for this date
        const exactPrice = sortedSeries.find(p => p.date === date)
        if (exactPrice) {
          // CALCULATION: 
          // - For currency holdings: 1.0 (1 unit) × FX rate = price in base currency
          //   Example: 1.0 USD × 3.65 (USD→ILS) = ₪3.65
          // - For regular securities: originalPrice (in symbol's currency) × FX rate = price in base currency
          //   Example: $140.50 × 3.65 (USD→ILS) = ₪512.83
          const fxRate = getFXRate(symbolCurrency, date)
          const basePrice = isCurrencyHolding ? 1.0 : exactPrice.price
          const convertedPrice = basePrice * fxRate
          lastKnownConvertedPrice = convertedPrice
          symbolPrices.set(date, convertedPrice)
        } else if (lastKnownConvertedPrice > 0) {
          // Forward-fill: use last known converted price (handles weekends & market holidays)
          symbolPrices.set(date, lastKnownConvertedPrice)
        } else {
          // Back-fill: Look for the first available price after this date
          const futurePrice = sortedSeries.find(p => p.date > date)
          if (futurePrice) {
            const fxRate = getFXRate(symbolCurrency, date)
            const basePrice = isCurrencyHolding ? 1.0 : futurePrice.price
            const convertedPrice = basePrice * fxRate
            symbolPrices.set(date, convertedPrice)
          }
        }
      })
      
      priceCache.set(symbol, symbolPrices)
    })

    // DEBUG: Verify forward-filling worked for ALL dates
    const sampleSymbol = Array.from(priceCache.keys()).find(s => !s.startsWith('FX:'))
    if (sampleSymbol) {
      const prices = priceCache.get(sampleSymbol)
      console.log(`🔍 [FORWARD-FILL CHECK] ${sampleSymbol}:`, {
        totalDates: sortedDates.length,
        cachedDates: prices?.size,
        allDatesCovered: sortedDates.every(d => prices?.has(d)),
        sampleDatePrices: sortedDates.slice(0, 10).map(d => ({
          date: d,
          dayOfWeek: new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
          hasPrice: prices?.has(d),
          price: prices?.get(d)
        }))
      })
      
      // Check for missing prices
      const missingDates = sortedDates.filter(d => !prices?.has(d) || !prices.get(d))
      if (missingDates.length > 0) {
        console.error(`❌ [FORWARD-FILL FAILED] ${sampleSymbol} missing prices for ${missingDates.length} dates:`, missingDates.slice(0, 5))
      }
    }

    // Get S&P 500 benchmark data (SPY ETF as proxy)
    const sp500Historical = historicalPrices['SPY'] || []
    console.log('📊 [S&P 500] SPY data:', {
      hasSPY: !!historicalPrices['SPY'],
      dataPoints: sp500Historical.length,
      sample: sp500Historical.slice(0, 3),
      allSymbols: Object.keys(historicalPrices).slice(0, 10)
    })
    
    const sp500Prices = new Map<string, number>()
    let lastSP500Price = 0
    
    // Build S&P 500 price cache with forward-filling and currency conversion
    const sortedSP500 = [...sp500Historical].sort((a, b) => a.date.localeCompare(b.date))
    
    sortedDates.forEach(date => {
      const exactPrice = sortedSP500.find(p => p.date === date)
      if (exactPrice) {
        // Convert SPY price from USD to base currency
        const fxRate = getFXRate('USD', date)
        const priceInBase = exactPrice.price * fxRate
        lastSP500Price = priceInBase
        sp500Prices.set(date, priceInBase)
      } else if (lastSP500Price > 0) {
        // Forward-fill
        sp500Prices.set(date, lastSP500Price)
      }
    })
    
    console.log('📊 [S&P 500] Processed prices:', {
      totalDates: sp500Prices.size,
      samplePrices: Array.from(sp500Prices.entries()).slice(0, 5),
      firstDateInCache: Array.from(sp500Prices.keys())[0],
      firstDateRequested: sortedDates[0],
      priceForFirstDate: sp500Prices.get(sortedDates[0])
    })

    // Calculate portfolio value over time
    if (viewMode === 'aggregated') {
      // Single series: total portfolio value
      const lastDate = sortedDates[sortedDates.length - 1]
      
      const portfolioValues: Array<[number, number]> = sortedDates.map(date => {
        let totalValue = 0
        const isLastDate = date === lastDate

        // Sum value across all selected accounts
        selectedAccounts.forEach(account => {
          if (!account.holdings) return

          account.holdings.forEach(holding => {
            // Handle custom holdings (use their fixed custom price)
            if ((holding as any).is_custom) {
              const customPrice = (holding as any).custom_price || 0
              const customCurrency = (holding as any).custom_currency || baseCurrency
              
              // Convert custom price to base currency
              const fxRate = getFXRate(customCurrency, date)
              const priceInBase = customPrice * fxRate
              totalValue += holding.units * priceInBase
              return
            }
            
            // For the last date (today), use current price to match PortfolioSummary
            if (isLastDate && globalCurrentPrices[holding.symbol]) {
              const currentPriceData = globalCurrentPrices[holding.symbol]
              totalValue += holding.units * currentPriceData.price
              return
            }
            
            // For historical dates, use priceCache
            const symbolPrices = priceCache.get(holding.symbol)
            if (!symbolPrices) return

            const price = symbolPrices.get(date)
            if (!price) return

            totalValue += holding.units * price
          })
        })

        // Convert date string to timestamp for Highcharts
        const timestamp = new Date(date).getTime()
        return [timestamp, totalValue]
      })

      // S&P 500 benchmark scaled to start at same initial value as portfolio
      const initialPortfolioValue = portfolioValues[0]?.[1] || 0
      
      // Find the first available SPY price (might not be on the first date)
      let initialSP500Price = sp500Prices.get(sortedDates[0])
      if (!initialSP500Price) {
        // Back-fill: use first available price from any date
        for (const date of sortedDates) {
          const price = sp500Prices.get(date)
          if (price && price > 0) {
            initialSP500Price = price
            console.log(`📊 [S&P BACKFILL] Using SPY price from ${date} as initial: ${price}`)
            break
          }
        }
      }
      if (!initialSP500Price) initialSP500Price = 1 // Final fallback
      
      console.log('📊 [S&P BENCHMARK - AGGREGATED]', {
        initialPortfolioValue,
        initialSP500Price,
        firstDate: sortedDates[0],
        sp500PricesSample: Array.from(sp500Prices.entries()).slice(0, 3)
      })
      
      const sp500BenchmarkValues: Array<[number, number]> = sortedDates.map(date => {
        const sp500Price = sp500Prices.get(date) || initialSP500Price
        const sp500Return = (sp500Price / initialSP500Price) // Percentage change as multiplier
        const benchmarkValue = initialPortfolioValue * sp500Return
        const timestamp = new Date(date).getTime()
        return [timestamp, benchmarkValue]
      })
      
      console.log('📊 [S&P BENCHMARK VALUES]', {
        sampleValues: sp500BenchmarkValues.slice(0, 3).map(([ts, val]) => ({
          date: new Date(ts).toISOString().split('T')[0],
          value: val.toFixed(0)
        }))
      })

      // Calculate min and max for better Y-axis scaling
      const allValues = [...portfolioValues.map(p => p[1]), ...sp500BenchmarkValues.map(p => p[1])]
      const min = allValues.length > 0 ? Math.min(...allValues) : 0
      const max = allValues.length > 0 ? Math.max(...allValues) : 0

      return { 
        seriesData: [
          { name: 'Total Portfolio', data: portfolioValues },
          { name: 'S&P 500 Benchmark', data: sp500BenchmarkValues }
        ], 
        minValue: min, 
        maxValue: max 
      }
    } else {
      // Multiple series: one per account, normalized to start at 0
      const accountSeries: Array<{ name: string; data: Array<[number, number]> }> = []
      let allNormalizedValues: number[] = []

      const lastDate = sortedDates[sortedDates.length - 1]
      
      selectedAccounts.forEach(account => {
        const accountAbsoluteValues: number[] = sortedDates.map(date => {
          let accountValue = 0
          const isLastDate = date === lastDate

          if (account.holdings) {
            account.holdings.forEach(holding => {
              // Handle custom holdings (use their fixed custom price)
              if ((holding as any).is_custom) {
                const customPrice = (holding as any).custom_price || 0
                const customCurrency = (holding as any).custom_currency || baseCurrency
                
                // Convert custom price to base currency
                const fxRate = getFXRate(customCurrency, date)
                const priceInBase = customPrice * fxRate
                accountValue += holding.units * priceInBase
                return
              }
              
              // For the last date (today), use current price to match PortfolioSummary
              if (isLastDate && globalCurrentPrices[holding.symbol]) {
                const currentPriceData = globalCurrentPrices[holding.symbol]
                accountValue += holding.units * currentPriceData.price
                return
              }
              
              // For historical dates, use priceCache
              const symbolPrices = priceCache.get(holding.symbol)
              if (!symbolPrices) return

              const price = symbolPrices.get(date)
              if (!price) return

              accountValue += holding.units * price
            })
          }

          return accountValue
        })

        // Normalize to start at 0 (show change from initial value)
        const initialValue = accountAbsoluteValues[0] || 0
        const accountNormalizedValues: Array<[number, number]> = sortedDates.map((date, idx) => {
          const normalizedValue = accountAbsoluteValues[idx] - initialValue
          const timestamp = new Date(date).getTime()
          allNormalizedValues.push(normalizedValue)
          return [timestamp, normalizedValue]
        })

        accountSeries.push({
          name: account.account_name,
          data: accountNormalizedValues
        })
      })

      // S&P 500 benchmark normalized to start at 0
      // Find the first available SPY price (might not be on the first date)
      let initialSP500Price = sp500Prices.get(sortedDates[0])
      if (!initialSP500Price) {
        // Back-fill: use first available price from any date
        for (const date of sortedDates) {
          const price = sp500Prices.get(date)
          if (price && price > 0) {
            initialSP500Price = price
            break
          }
        }
      }
      if (!initialSP500Price) initialSP500Price = 1 // Final fallback
      
      // Calculate average initial portfolio value (before normalization) for scaling
      const avgInitialValue = accountSeries.length > 0
        ? selectedAccounts.reduce((sum, acc) => {
            // Calculate first day value for this account
            let firstDayValue = 0
            if (acc.holdings) {
              acc.holdings.forEach(holding => {
                if ((holding as any).is_custom) {
                  const customPrice = (holding as any).custom_price || 0
                  const customCurrency = (holding as any).custom_currency || baseCurrency
                  const fxRate = getFXRate(customCurrency, sortedDates[0])
                  firstDayValue += holding.units * customPrice * fxRate
                } else {
                  const symbolPrices = priceCache.get(holding.symbol)
                  const price = symbolPrices?.get(sortedDates[0])
                  if (price) firstDayValue += holding.units * price
                }
              })
            }
            return sum + firstDayValue
          }, 0) / selectedAccounts.length
        : 1000000
      
      console.log('📊 [S&P BENCHMARK - BY ACCOUNT]', {
        initialSP500Price,
        avgInitialValue,
        accountsCount: selectedAccounts.length
      })
      
      const sp500NormalizedValues: Array<[number, number]> = sortedDates.map(date => {
        const sp500Price = sp500Prices.get(date) || initialSP500Price
        const sp500PercentChange = (sp500Price - initialSP500Price) / initialSP500Price
        const sp500ChangeInILS = sp500PercentChange * avgInitialValue
        const timestamp = new Date(date).getTime()
        
        allNormalizedValues.push(sp500ChangeInILS)
        return [timestamp, sp500ChangeInILS]
      })
      
      accountSeries.push({
        name: 'S&P 500 Benchmark',
        data: sp500NormalizedValues
      })

      const min = allNormalizedValues.length > 0 ? Math.min(...allNormalizedValues) : 0
      const max = allNormalizedValues.length > 0 ? Math.max(...allNormalizedValues) : 0

      return { 
        seriesData: accountSeries, 
        minValue: min, 
        maxValue: max 
      }
    }
  }, [selectedAccounts, historicalPrices, globalSecurities, globalCurrentPrices, baseCurrency, viewMode])

  useEffect(() => {
    if (!chartRef.current) return

    // Destroy existing chart if any
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
      chartInstanceRef.current = null
    }

    // Only create chart if we have data
    if (seriesData.length === 0 || seriesData[0].data.length === 0) {
      return
    }

    // Calculate padding for Y-axis
    const padding = (maxValue - minValue) * 0.1 // 10% padding

    const chartElement = chartRef.current
    if (!chartElement) return

    chartInstanceRef.current = Highcharts.chart({
      chart: {
        renderTo: chartElement,
        backgroundColor: 'transparent',
        height: 400,
        style: {
          fontFamily: 'inherit'
        },
        // Enable zooming on the x-axis (time axis)
        zooming: {
          type: 'x',
          resetButton: {
            theme: {
              fill: '#1f2937',  // Dark background
              stroke: '#60a5fa',  // Blue border
              'stroke-width': 1,
              r: 4,  // Border radius
              padding: 8,  // Internal padding for text
              width: 85,  // Explicit width to contain text
              height: 24,  // Explicit height
              style: {
                color: '#e5e7eb',  // Light gray text
                fontSize: '11px',
                fontWeight: '500',
                textAlign: 'center'
              },
              states: {
                hover: {
                  fill: '#374151',  // Lighter on hover
                  style: {
                    color: '#fff'
                  }
                }
              }
            },
            position: {
              align: 'right',
              verticalAlign: 'top',
              x: -10,
              y: 10
            }
          }
        },
        panning: {
          enabled: true,
          type: 'x'
        },
        panKey: 'shift'  // Hold shift to pan instead of zoom
      },
      title: {
        text: undefined  // Title now in React header
      },
      credits: {
        enabled: false
      },
      xAxis: {
        type: 'datetime',
        labels: {
          enabled: false  // Hide x-axis labels (shown in tooltip instead)
        },
        gridLineColor: 'rgba(55, 65, 81, 0.3)', // Softer grid lines
        lineColor: '#374151',
        tickLength: 0,
        crosshair: {
          width: 1,
          color: '#60a5fa',
          dashStyle: 'Dash',
          zIndex: 5,
          label: {
            backgroundColor: 'rgba(31, 41, 55, 0.9)',
            borderColor: '#60a5fa',
            borderRadius: 4,
            style: {
              color: '#e5e7eb',
              fontSize: '11px'
            }
          }
        },
        // Add vertical plotLines for markers (e.g., user join date)
        plotLines: markers.map(marker => {
          const markerTimestamp = new Date(marker.date).getTime()
          return {
            value: markerTimestamp,
            color: '#6b7280',  // Light gray color
            width: 1,  // Very thin line
            zIndex: 3,
            dashStyle: 'Solid' as const,  // Solid line (not dashed)
            label: {
              text: `${marker.icon || '📍'} ${marker.label}`,
              rotation: 0,
              y: 20,  // Position below the top to avoid header overlap
              verticalAlign: 'top',
              align: 'left',
              x: 5,  // Small offset from the line
              style: {
                color: '#9ca3af',  // Light gray text
                fontSize: '10px',
                fontWeight: 'normal'
              }
            }
          }
        })
      },
      yAxis: {
        title: {
          text: viewMode === 'separate' ? `Change (${baseCurrency})` : `Value (${baseCurrency})`,
          style: {
            color: '#9ca3af'
          }
        },
        labels: {
          enabled: isValueVisible,  // Hide labels when values are hidden
          style: {
            color: '#9ca3af'
          },
          formatter: function() {
            const val = this.value as number
            const sign = viewMode === 'separate' && val > 0 ? '+' : ''
            return sign + new Intl.NumberFormat('en-US', {
              maximumFractionDigits: 0
            }).format(val)
          }
        },
        gridLineColor: 'rgba(55, 65, 81, 0.3)', // Softer, more subtle grid lines
        gridLineWidth: 1,
        min: viewMode === 'separate' ? minValue - padding : Math.max(0, minValue - padding),
        max: maxValue + padding,
        plotLines: viewMode === 'separate' ? [{
          value: 0,
          color: '#6b7280',
          width: 2,
          zIndex: 2,
          dashStyle: 'Dash'
        }] : []
      },
      tooltip: {
        enabled: true,  // Always show tooltip
        useHTML: true, // Enable HTML rendering for proper line breaks
        backgroundColor: 'rgba(31, 41, 55, 0.95)', // Slightly transparent for modern look
        borderColor: '#60a5fa',
        borderWidth: 1,
        borderRadius: 8,
        shadow: {
          color: 'rgba(0, 0, 0, 0.3)',
          offsetX: 0,
          offsetY: 2,
          opacity: 0.5,
          width: 4
        },
        style: {
          color: '#fff',
          fontSize: '13px',
          fontWeight: '400'
        },
        shared: true, // Show all series in one tooltip
        formatter: function() {
          const date = Highcharts.dateFormat('%b %d, %Y', this.x as number)
          let tooltip = `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-weight: 600; color: #e5e7eb; font-size: 14px;">${date}</div>`
          
          const tooltipContext = this as any // TooltipFormatterContextObject when shared=true
          if (tooltipContext.points && tooltipContext.points.length > 0) {
            tooltipContext.points.forEach((point: any) => {
              const seriesName = point.series.name
              const color = point.color
              
              if (!isValueVisible) {
                tooltip += `<div style="margin: 6px 0; line-height: 1.6;">
                  <span style="display: inline-block; width: 14px; height: 3px; background-color: ${color}; margin-right: 12px; vertical-align: middle; border-radius: 1px;"></span>
                  <span style="color: #e5e7eb; vertical-align: middle;">${seriesName}</span>
                </div>`
              } else {
                const yValue = point.y as number
                const value = new Intl.NumberFormat('en-US', {
                  maximumFractionDigits: 0
                }).format(Math.abs(yValue))
                
                if (viewMode === 'separate') {
                  const sign = yValue >= 0 ? '+' : '-'
                  tooltip += `<div style="margin: 6px 0; line-height: 1.6;">
                    <span style="display: inline-block; width: 14px; height: 3px; background-color: ${color}; margin-right: 12px; vertical-align: middle; border-radius: 1px;"></span>
                    <span style="color: #e5e7eb; vertical-align: middle;">${seriesName}</span>
                    <span style="color: #fff; font-weight: 600; margin-left: 12px; vertical-align: middle;">${sign}${value} ${baseCurrency}</span>
                  </div>`
                } else {
                  tooltip += `<div style="margin: 6px 0; line-height: 1.6;">
                    <span style="display: inline-block; width: 14px; height: 3px; background-color: ${color}; margin-right: 12px; vertical-align: middle; border-radius: 1px;"></span>
                    <span style="color: #e5e7eb; vertical-align: middle;">${seriesName}</span>
                    <span style="color: #fff; font-weight: 600; margin-left: 12px; vertical-align: middle;">${value} ${baseCurrency}</span>
                  </div>`
                }
              }
            })
          } else {
            // Fallback for single point
            const seriesName = (this as any).series?.name || 'Portfolio'
            if (!isValueVisible) {
              return `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-weight: 600; color: #e5e7eb; font-size: 14px;">${date}</div>
                <div style="color: #e5e7eb; margin-top: 6px; display: block;">${seriesName}</div>`
            }
            const yValue = this.y as number
            const value = new Intl.NumberFormat('en-US', {
              maximumFractionDigits: 0
            }).format(Math.abs(yValue))
            
            if (viewMode === 'separate') {
              const sign = yValue >= 0 ? '+' : '-'
              return `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-weight: 600; color: #e5e7eb; font-size: 14px;">${date}</div>
                <div style="color: #e5e7eb; margin-top: 6px; display: block;">${seriesName}: <strong style="color: #fff;">${sign}${value} ${baseCurrency}</strong></div>`
            } else {
              return `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-weight: 600; color: #e5e7eb; font-size: 14px;">${date}</div>
                <div style="color: #e5e7eb; margin-top: 6px; display: block;">${seriesName}: <strong style="color: #fff;">${value} ${baseCurrency}</strong></div>`
            }
          }
          
          return tooltip
        }
      },
      legend: {
        enabled: seriesData.length > 1, // Show legend when we have multiple series (accounts or benchmark)
        align: 'right',
        verticalAlign: 'top',
        layout: 'vertical',
        itemStyle: {
          color: '#9ca3af',
          fontSize: '12px'
        },
        itemHoverStyle: {
          color: '#fff'
        }
      },
      plotOptions: {
        series: {
          marker: {
            enabled: false,  // Disable markers by default
            states: {
              hover: {
                enabled: true,  // Show markers on hover for better interactivity
                radius: 5,
                lineWidth: 2,
                lineColor: '#fff',
                fillColor: undefined // Use series color
              }
            }
          },
          states: {
            hover: {
              halo: {
                size: 10,
                opacity: 0.25
              }
            }
          },
          animation: {
            duration: 750,
            easing: 'easeOutQuart'
          }
        },
        spline: {
          lineWidth: 3,  // Thicker line
          states: {
            hover: {
              lineWidth: 4,
              halo: {
                size: 12,
                opacity: 0.3
              }
            }
          }
        },
        area: {
          fillOpacity: 0.1,
          lineWidth: 3,
          states: {
            hover: {
              lineWidth: 4
            }
          }
        }
      },
      series: seriesData.map((series, index) => {
        // Check if this is the S&P 500 benchmark
        const isBenchmark = series.name === 'S&P 500 Benchmark'
        
        // Use the same colors as other charts (PieChart, BarChart, RSUTimelineChart)
        const colors = [
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
        ]
        
        // Use a distinct color for benchmark (amber/orange tone that stands out)
        const seriesColor = isBenchmark ? '#f59e0b' : colors[index % colors.length]
        // Apply gradient to all portfolio lines (not benchmarks)
        const shouldHaveGradient = !isBenchmark
        
        // Convert hex to rgba for gradient (helper function)
        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          return `rgba(${r}, ${g}, ${b}, ${alpha})`
        }
        
        return {
          name: series.name,
          type: shouldHaveGradient ? 'areaspline' : 'spline', // Area chart for all portfolio lines
          data: series.data,  // Always show actual data, even when values are "hidden"
          color: seriesColor,
          dashStyle: isBenchmark ? 'Dash' : 'Solid', // Dashed line for benchmark
          lineWidth: isBenchmark ? 2 : 3, // Thinner line for benchmark
          zIndex: isBenchmark ? 1 : 2, // Portfolio lines on top
          fillColor: shouldHaveGradient ? {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, hexToRgba(seriesColor, 0.15)], // Start with 15% opacity using series color
              [1, hexToRgba(seriesColor, 0.0)]    // Fade to transparent
            ]
          } : undefined,
          marker: {
            enabled: false,  // Disabled by default
            states: {
              hover: {
                enabled: true,
                radius: 5,
                lineWidth: 2,
                lineColor: '#fff',
                fillColor: seriesColor
              }
            }
          },
          // Add constant glow effect using halo
          halo: {
            size: 8, // Base glow size
            opacity: 0.3, // Subtle constant glow
            attributes: {
              fill: seriesColor,
              'fill-opacity': 0.3
            } as any
          },
          states: {
            hover: {
              lineWidth: isBenchmark ? 3 : 4,
              halo: {
                size: 15, // Larger halo for stronger glow on hover
                opacity: 0.6, // More visible glow on hover
                attributes: {
                  fill: seriesColor,
                  'fill-opacity': 0.6
                } as any
              }
            }
          }
        } as any // Type assertion to allow shadow and custom properties
      })
    })

    // Apply zoom after chart is created
    if (chartInstanceRef.current && seriesData.length > 0 && seriesData[0].data.length > 0) {
      // Calculate date range
      const allTimestamps: number[] = []
      seriesData.forEach(series => {
        series.data.forEach(([timestamp]) => {
          allTimestamps.push(timestamp as number)
        })
      })
      
      if (allTimestamps.length > 0) {
        const maxTimestamp = Math.max(...allTimestamps)
        
        // Apply selected zoom
        if (selectedZoom !== 'all') {
          const endDate = new Date(maxTimestamp)
          let startDate = new Date(endDate)
          
          switch (selectedZoom) {
            case 'year':
              startDate.setFullYear(endDate.getFullYear() - 1)
              break
            case 'month':
              startDate.setMonth(endDate.getMonth() - 1)
              break
            case 'week':
              startDate.setDate(endDate.getDate() - 7)
              break
          }
          
          // Small delay to ensure chart is fully rendered
          setTimeout(() => {
            if (chartInstanceRef.current) {
              chartInstanceRef.current.xAxis[0].setExtremes(startDate.getTime(), endDate.getTime(), true)
            }
          }, 100)
        }
      }
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [seriesData, baseCurrency, isValueVisible, minValue, maxValue, viewMode, markers, selectedZoom])

  // Calculate date range from series data
  const dateRange = useMemo(() => {
    if (seriesData.length === 0 || seriesData[0].data.length === 0) {
      return { min: null, max: null }
    }
    
    // Get all timestamps from all series
    const allTimestamps: number[] = []
    seriesData.forEach(series => {
      series.data.forEach(([timestamp]) => {
        allTimestamps.push(timestamp as number)
      })
    })
    
    if (allTimestamps.length === 0) {
      return { min: null, max: null }
    }
    
    return {
      min: Math.min(...allTimestamps),
      max: Math.max(...allTimestamps)
    }
  }, [seriesData])

  // Zoom functions
  const zoomToPeriod = (period: 'all' | 'year' | 'month' | 'week') => {
    if (!chartInstanceRef.current || !dateRange.min || !dateRange.max) return
    
    setSelectedZoom(period)
    
    const chart = chartInstanceRef.current
    const xAxis = chart.xAxis[0]
    
    if (period === 'all') {
      // Reset to full range
      xAxis.setExtremes(dateRange.min, dateRange.max, true)
      return
    }
    
    // Calculate the end date (most recent date)
    const endDate = new Date(dateRange.max)
    let startDate = new Date(endDate)
    
    // Calculate start date based on period
    switch (period) {
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1)
        break
      case 'week':
        startDate.setDate(endDate.getDate() - 7)
        break
    }
    
    // Set the extremes
    xAxis.setExtremes(startDate.getTime(), endDate.getTime(), true)
  }

  // Show empty state if no data
  if (seriesData.length === 0 || seriesData[0].data.length === 0) {
    return (
      <div className="w-full rounded-lg mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white">Portfolio Value - Last Year</h3>
        </div>
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          <p className="text-sm">No historical data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg mb-6">
      {/* Header with title, zoom buttons, and toggle */}
      <div className="flex items-center justify-between mb-2 gap-4">
        <h3 className="text-lg font-bold text-white">
          {viewMode === 'separate' 
            ? 'Estimated Portfolio Performance (Normalized)' 
            : 'Estimated Portfolio Value'}
        </h3>
        
        <div className="flex items-center gap-3">
          {/* Zoom Dropdown */}
          <Select value={selectedZoom} onValueChange={(value) => zoomToPeriod(value as 'all' | 'year' | 'month' | 'week')}>
            <SelectTrigger className="w-[120px] h-9 bg-gray-700/20 backdrop-blur-sm border-blue-400/30 text-gray-300 hover:text-white focus:ring-blue-500/50">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="week" className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700">
                Week
              </SelectItem>
              <SelectItem value="month" className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700">
                Month
              </SelectItem>
              <SelectItem value="year" className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700">
                Year
              </SelectItem>
              <SelectItem value="all" className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700">
                All
              </SelectItem>
            </SelectContent>
          </Select>
          
          {/* View Mode Toggle */}
          <div
            className="flex items-center bg-gray-700/20 backdrop-blur-sm rounded-md border border-blue-400/30 p-1 cursor-pointer select-none"
          >
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                viewMode === 'aggregated'
                  ? 'bg-blue-500/20 text-blue-200 shadow-sm'
                  : 'text-gray-400'
              }`}
              onClick={() => setViewMode('aggregated')}
            >
              <Layers size={16} />
              Aggregated
            </div>
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                viewMode === 'separate'
                  ? 'bg-blue-500/20 text-blue-200 shadow-sm'
                  : selectedAccounts.length <= 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400'
              }`}
              onClick={() => {
                if (selectedAccounts.length > 1) {
                  setViewMode('separate')
                }
              }}
            >
              <User size={16} />
              By Account
            </div>
          </div>
        </div>
      </div>
      
      <div ref={chartRef} />
    </div>
  )
}

