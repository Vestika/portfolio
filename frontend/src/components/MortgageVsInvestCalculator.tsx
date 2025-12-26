import { useMemo, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Home, TrendingUp, Plus, Trash2, Info, AlertCircle } from 'lucide-react'

type MortgageTrackType = 'prime' | 'fixed-non-linked' | 'fixed-linked' | 'variable-non-linked' | 'variable-linked' | 'foreign' | 'other'

interface MortgageTrack {
  id: number
  type: MortgageTrackType
  balance: number
  rate: number
  years: number
  linked: boolean
}

const trackTypeLabels: Record<MortgageTrackType, string> = {
  'prime': 'Prime (P)',
  'fixed-non-linked': 'Fixed Non-Linked',
  'fixed-linked': 'Fixed Linked',
  'variable-non-linked': 'Variable Non-Linked',
  'variable-linked': 'Variable Linked',
  'foreign': 'Foreign Currency',
  'other': 'Other'
}

export function MortgageVsInvestCalculator() {
  const [tracks, setTracks] = useState<MortgageTrack[]>([
    { id: 1, type: 'prime', balance: 150000, rate: 6.0, years: 20, linked: false },
    { id: 2, type: 'fixed-non-linked', balance: 100000, rate: 4.5, years: 15, linked: false }
  ])
  const [nextId, setNextId] = useState(3)
  const [lumpSum, setLumpSum] = useState(100000)
  const [marketYield, setMarketYield] = useState(7.0)
  const [horizon, setHorizon] = useState<number | ''>('')
  const [userEditedHorizon, setUserEditedHorizon] = useState(false)
  const [inflation, setInflation] = useState(3.0)
  const [capitalGainsTax, setCapitalGainsTax] = useState(25)

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num)
  }

  const parseInput = (value: string): number => {
    const cleaned = value.replace(/,/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : Math.max(0, parsed)
  }

  const calculations = useMemo(() => {
    if (tracks.length === 0) {
      return {
        totalDebt: 0,
        weightedRate: 0,
        weightedYears: 0,
        mortgageSavings: 0,
        avgSavedRate: 0,
        investNetProfit: 0,
        investNetCAGR: 0,
        diff: 0,
        verdict: 'No mortgage',
        verdictDesc: 'Please add mortgage tracks.',
        verdictColor: '#666',
        warning: ''
      }
    }

    // Calculate total debt and weighted averages
    let totalDebt = 0
    let weightedRateSum = 0
    let weightedYearsSum = 0
    const tracksData: Array<{
      balance: number
      effectiveRate: number
      years: number
    }> = []

    tracks.forEach(track => {
      if (track.balance > 0) {
        totalDebt += track.balance
        let effectiveRate = track.rate
        if (track.linked) {
          effectiveRate = ((1 + track.rate / 100) * (1 + inflation / 100) - 1) * 100
        }
        tracksData.push({
          balance: track.balance,
          effectiveRate,
          years: track.years
        })
        weightedRateSum += (effectiveRate * track.balance)
        weightedYearsSum += (track.years * track.balance)
      }
    })

    const weightedRate = totalDebt > 0 ? weightedRateSum / totalDebt : 0
    const weightedYears = totalDebt > 0 ? weightedYearsSum / totalDebt : 0

    // Calculate time horizon
    const calcHorizon = (horizon !== '' && horizon > 0) ? horizon : weightedYears
    const finalHorizon = calcHorizon > 0 ? calcHorizon : 5

    // Calculate investment amount (cap at total debt if lump sum is larger)
    let investAmount = lumpSum
    let warning = ''
    if (lumpSum > totalDebt && totalDebt > 0) {
      investAmount = totalDebt
      warning = `Note: Available amount exceeds total debt. Calculation is based on debt ceiling (${formatNumber(totalDebt)} ₪).`
    }

    // Sort tracks by effective rate (highest first) for smart payoff
    tracksData.sort((a, b) => b.effectiveRate - a.effectiveRate)

    // Calculate mortgage savings (pay off highest rate tracks first)
    let remainingToPay = investAmount
    let totalMortgageSavings = 0
    let totalEffectiveRatePaid = 0

    tracksData.forEach(track => {
      if (remainingToPay <= 0) return
      const pay = Math.min(remainingToPay, track.balance)
      const yearsToCalc = Math.min(finalHorizon, track.years)
      const futureVal = pay * Math.pow(1 + track.effectiveRate / 100, yearsToCalc)
      const profit = futureVal - pay
      totalMortgageSavings += profit
      totalEffectiveRatePaid += (track.effectiveRate * pay)
      remainingToPay -= pay
    })

    const avgSavedRate = investAmount > 0 ? totalEffectiveRatePaid / investAmount : 0

    // Calculate investment net profit
    const marketYieldVal = marketYield / 100
    const inflationVal = inflation / 100
    const investGrossFV = investAmount * Math.pow(1 + marketYieldVal, finalHorizon)
    const principalIndexed = investAmount * Math.pow(1 + inflationVal, finalHorizon)
    const realGain = investGrossFV - principalIndexed
    const tax = (realGain > 0) ? realGain * (capitalGainsTax / 100) : 0
    const investNetProfit = (investGrossFV - tax) - investAmount

    // Calculate net CAGR
    let investNetCAGR = 0
    if (investAmount > 0) {
      investNetCAGR = (Math.pow((investAmount + investNetProfit) / investAmount, 1 / finalHorizon) - 1) * 100
    }

    // Determine verdict
    const diff = Math.abs(investNetProfit - totalMortgageSavings)
    let verdict = ''
    let verdictDesc = ''
    let verdictColor = ''

    if (totalDebt === 0) {
      verdict = 'No mortgage'
      verdictDesc = 'Please add mortgage tracks.'
      verdictColor = '#666'
    } else if (lumpSum <= 0) {
      verdict = 'No available amount'
      verdictDesc = 'Please enter an available amount for decision.'
      verdictColor = '#666'
    } else if (investNetProfit > totalMortgageSavings) {
      verdict = 'Better to invest in the market'
      verdictDesc = `Market return (net) over ${finalHorizon} years is expected to be higher than mortgage cost.`
      verdictColor = '#2e7d32'
    } else {
      verdict = 'Better to pay off the mortgage'
      verdictDesc = "The interest and indexation you'll save is higher than the expected net profit from market investment."
      verdictColor = '#c62828'
    }

    return {
      totalDebt,
      weightedRate,
      weightedYears,
      mortgageSavings: totalMortgageSavings,
      avgSavedRate,
      investNetProfit,
      investNetCAGR,
      diff,
      verdict,
      verdictDesc,
      verdictColor,
      warning
    }
  }, [tracks, lumpSum, marketYield, horizon, inflation, capitalGainsTax])

  // Auto-update horizon if user hasn't edited it
  useMemo(() => {
    if (!userEditedHorizon && calculations.weightedYears > 0) {
      setHorizon(Math.round(calculations.weightedYears))
    }
  }, [calculations.weightedYears, userEditedHorizon])

  const addTrack = () => {
    const newTrack: MortgageTrack = {
      id: nextId,
      type: 'prime',
      balance: 0,
      rate: 0,
      years: 0,
      linked: false
    }
    setTracks([...tracks, newTrack])
    setNextId(nextId + 1)
  }

  const removeTrack = (id: number) => {
    setTracks(tracks.filter(t => t.id !== id))
  }

  const updateTrack = (id: number, updates: Partial<MortgageTrack>) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const autoSetLinkage = (type: MortgageTrackType) => {
    const linkedTypes: MortgageTrackType[] = ['fixed-linked', 'variable-linked']
    return linkedTypes.includes(type)
  }

  const handleTrackTypeChange = (id: number, type: MortgageTrackType) => {
    const shouldBeLinked = autoSetLinkage(type)
    updateTrack(id, { type, linked: shouldBeLinked })
  }

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      height: 350
    },
    colors: ['#5c6bc0', '#26a69a'],
    credits: {
      enabled: false
    },
    title: {
      text: ''
    },
    xAxis: {
      categories: ['Savings from Payoff', 'Profit from Investment'],
      labels: {
        style: {
          color: '#ffffff'
        }
      }
    },
    yAxis: {
      title: {
        text: 'Amount (₪)',
        style: {
          color: '#ffffff'
        }
      },
      labels: {
        style: {
          color: '#ffffff'
        },
        formatter: function() {
          return formatNumber(this.value as number)
        }
      }
    },
    tooltip: {
      pointFormatter: function() {
        return `<b>${this.series.name}</b>: ${formatNumber(this.y as number)} ₪`
      }
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        dataLabels: {
          enabled: true,
          color: '#ffffff',
          formatter: function() {
            return formatNumber(this.y as number) + ' ₪'
          }
        }
      }
    },
    legend: {
      enabled: false
    },
    series: [{
      type: 'bar',
      name: 'Amount',
      data: [
        Math.max(0, calculations.mortgageSavings),
        Math.max(0, calculations.investNetProfit)
      ]
    }]
  }), [calculations])

  return (
    <div className="bg-gray-800 rounded-xl p-4 md:p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Pay Off Mortgage or Invest?</h3>
        <p className="text-gray-300">Financial decision calculator</p>
      </div>

      {/* Intro Box */}
      <div className="bg-pink-50 dark:bg-pink-900/20 border-l-4 border-pink-500 rounded-lg p-4">
        <p className="text-gray-800 dark:text-gray-200 text-sm">
          Have available funds? This calculator checks what's better: paying off your highest-rate mortgage tracks (guaranteed savings) or investing the money in the market (expected return). The calculation accounts for inflation, capital gains tax, and smart payoff from highest to lowest rate.
        </p>
      </div>

      {/* Mortgage Section */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-700">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Home className="h-5 w-5 text-blue-400" />
            </div>
            1. Current Mortgage Mix
          </h4>
        </div>

        <div className="space-y-4">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-gray-400 pb-2 border-b border-gray-700">
            <div className="col-span-3">Track</div>
            <div className="col-span-2">Balance (₪)</div>
            <div className="col-span-1">Rate %</div>
            <div className="col-span-1">Years</div>
            <div className="col-span-1">Linked?</div>
            <div className="col-span-4"></div>
          </div>

          {/* Track Rows */}
          {tracks.map(track => (
            <div key={track.id} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-3">
                <select
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                  value={track.type}
                  onChange={(e) => handleTrackTypeChange(track.id, e.target.value as MortgageTrackType)}
                >
                  {Object.entries(trackTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-right"
                  value={formatNumber(track.balance)}
                  onChange={(e) => updateTrack(track.id, { balance: parseInput(e.target.value) })}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-right"
                  value={track.rate || ''}
                  onChange={(e) => updateTrack(track.id, { rate: parseFloat(e.target.value) || 0 })}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-right"
                  value={track.years || ''}
                  onChange={(e) => updateTrack(track.id, { years: parseFloat(e.target.value) || 0 })}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="col-span-1">
                <select
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                  value={track.linked ? 'yes' : 'no'}
                  onChange={(e) => updateTrack(track.id, { linked: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <button
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  onClick={() => removeTrack(track.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold"
            onClick={addTrack}
          >
            <Plus className="h-4 w-4" />
            Add Track
          </button>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-gray-700 flex justify-around flex-wrap gap-4 bg-gray-900/50 rounded-lg p-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Total Debt</div>
              <div className="text-lg font-bold text-white" style={{ direction: 'ltr' }}>
                {formatNumber(calculations.totalDebt)} ₪
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Weighted Rate (Effective)</div>
              <div className="text-lg font-bold text-pink-500" style={{ direction: 'ltr' }}>
                {calculations.weightedRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Investment Section */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-700">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            2. Investment Alternative
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              Available Amount for Decision (₪)
              <div className="group relative">
                <Info className="h-4 w-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
                  The amount you currently have available. The calculator will check whether it's better to "buy" debt reduction (guaranteed return) or invest it.
                </div>
              </div>
            </label>
            <input
              type="text"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border-2 border-pink-500 focus:ring-2 focus:ring-pink-500/20 text-lg font-bold text-right"
              value={formatNumber(lumpSum)}
              onChange={(e) => setLumpSum(parseInput(e.target.value))}
              style={{ direction: 'ltr' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Expected Annual Market Yield (%)
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-right"
              value={marketYield}
              onChange={(e) => setMarketYield(parseFloat(e.target.value) || 0)}
              style={{ direction: 'ltr' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              Time Horizon for Comparison (years)
              <div className="group relative">
                <Info className="h-4 w-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
                  How many years do you plan to invest, or when will you sell the house? (Default is average of mortgage years).
                </div>
              </div>
            </label>
            <input
              type="number"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-right"
              value={horizon}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setHorizon('')
                  setUserEditedHorizon(false)
                } else {
                  setHorizon(parseFloat(val) || 0)
                  setUserEditedHorizon(true)
                }
              }}
              placeholder="Auto-calculated"
              style={{ direction: 'ltr' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              Expected Annual Inflation (%)
              <div className="group relative">
                <Info className="h-4 w-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
                  Affects the cost increase of linked tracks and the calculation of real tax on investment.
                </div>
              </div>
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-right"
              value={inflation}
              onChange={(e) => setInflation(parseFloat(e.target.value) || 0)}
              style={{ direction: 'ltr' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Capital Gains Tax (%)
            </label>
            <input
              type="number"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-right"
              value={capitalGainsTax}
              onChange={(e) => setCapitalGainsTax(parseFloat(e.target.value) || 0)}
              style={{ direction: 'ltr' }}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border-2 border-pink-500 shadow-lg text-center">
        <div className="text-2xl font-bold mb-2" style={{ color: calculations.verdictColor }}>
          {calculations.verdict}
        </div>
        {calculations.totalDebt > 0 && lumpSum > 0 && (
          <div className="text-4xl font-bold text-white mb-2" style={{ direction: 'ltr' }}>
            Difference: {formatNumber(calculations.diff)} ₪
          </div>
        )}
        <div className="text-lg text-gray-300 mb-4">{calculations.verdictDesc}</div>

        {calculations.warning && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">{calculations.warning}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-700">
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Interest Savings (Payoff)</h4>
            <div className="text-2xl font-bold text-white mb-1" style={{ direction: 'ltr' }}>
              {formatNumber(calculations.mortgageSavings)} ₪
            </div>
            <div className="text-sm text-gray-400">
              Guaranteed return (payoff): {calculations.avgSavedRate.toFixed(2)}%
            </div>
          </div>
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Net Profit (Investment)</h4>
            <div className="text-2xl font-bold text-white mb-1" style={{ direction: 'ltr' }}>
              {formatNumber(calculations.investNetProfit)} ₪
            </div>
            <div className="text-sm text-gray-400">
              Estimated net return (market): {calculations.investNetCAGR.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
        <div className="h-[350px]">
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-400 border-t border-gray-700 pt-4">
        Note: The calculator assumes payoff of the highest-rate track (effective rate) first. The calculation is an estimate only.
      </div>
    </div>
  )
}

