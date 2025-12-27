import { useMemo, useState, useEffect } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { User, Users, Info, Download, Wallet } from 'lucide-react'
import * as cashFlowApi from '../utils/cash-flow-api'
import type { CashFlowScenario } from '../types/cashflow'
import { calculateMonthlyTotals } from '../utils/cashflow-helpers'

type Mode = 'single' | 'couple'

interface CalculationResult {
  years: number | null
  age: number | null
  targetCapital: number
  monthlySavings: number
  found: boolean
  bridgeIssue: boolean
  explanation: string
  chartData: {
    labels: number[]
    liquid: number[]
    locked: number[]
    target: number[]
  }
}

export function FIRECalculator() {
  const [mode, setMode] = useState<Mode>('single')
  const [usePension, setUsePension] = useState(false)
  
  // Personal data
  const [age1, setAge1] = useState(35)
  const [age2, setAge2] = useState(35)
  const [retAge1, setRetAge1] = useState(60)
  const [retAge2, setRetAge2] = useState(60)
  
  // Assets
  const [liquidTaxable, setLiquidTaxable] = useState(100000)
  const [liquidTaxableBasis, setLiquidTaxableBasis] = useState(80000)
  const [liquidTaxFree, setLiquidTaxFree] = useState(80000)
  const [pension1, setPension1] = useState(250000)
  const [pension2, setPension2] = useState(250000)
  const [realYield, setRealYield] = useState(5.0)
  
  // Cash flow
  const [income1, setIncome1] = useState(15000)
  const [income2, setIncome2] = useState(15000)
  const [pensionDeposit1, setPensionDeposit1] = useState(3000)
  const [pensionDeposit2, setPensionDeposit2] = useState(3000)
  const [taxFreeDeposit1, setTaxFreeDeposit1] = useState(1500)
  const [taxFreeDeposit2, setTaxFreeDeposit2] = useState(1500)
  const [monthlyExpenses, setMonthlyExpenses] = useState(12000)
  const [leakage, setLeakage] = useState(1000)
  const [targetSpend, setTargetSpend] = useState(12000)
  const [passiveIncome, setPassiveIncome] = useState(0)
  
  // Parameters
  const [withdrawalRate, setWithdrawalRate] = useState(4.0)
  const [taxRate, setTaxRate] = useState(25)

  const [showExplanation, setShowExplanation] = useState(false)

  // Cash Flow Scenario Integration
  const [cashFlowScenarios, setCashFlowScenarios] = useState<CashFlowScenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [cashFlowInputMode, setCashFlowInputMode] = useState<'manual' | 'scenario'>('scenario')

  const formatNumber = (n: number) => {
    if (n === null || n === undefined || isNaN(n)) return '0'
    return Math.round(n).toLocaleString('en-US')
  }

  const parseInput = (val: string | number): number => {
    if (typeof val === 'number') return val
    const cleaned = val.toString().replace(/,/g, '').trim()
    return parseFloat(cleaned) || 0
  }

  // Load cash flow scenarios on mount
  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const scenarios = await cashFlowApi.getScenarios()
        setCashFlowScenarios(scenarios)
      } catch (error) {
        console.error('Failed to load cash flow scenarios:', error)
      }
    }
    loadScenarios()
  }, [])

  // Populate values from selected cash flow scenario
  useEffect(() => {
    if (cashFlowInputMode !== 'scenario' || !selectedScenarioId) return

    const selectedScenario = cashFlowScenarios.find(s => s.scenarioId === selectedScenarioId)
    if (!selectedScenario) return

    // Calculate monthly totals from scenario
    // Note: We don't have access to actual account balances here, so we pass an empty map
    // This means percentage-based flows won't be calculated accurately
    const accountBalances = new Map<string, number>()
    const conversionRate = 3.7 // Default ILS to USD rate

    const totals = calculateMonthlyTotals(
      selectedScenario.items,
      accountBalances,
      'ILS', // Default to ILS
      conversionRate
    )

    // Map to FIRE calculator inputs
    // For single mode: use total inflows as income1
    // For couple mode: split inflows evenly between income1 and income2
    if (mode === 'single') {
      setIncome1(Math.round(totals.inflows))
    } else {
      const perPerson = Math.round(totals.inflows / 2)
      setIncome1(perPerson)
      setIncome2(perPerson)
    }

    // Set expenses from outflows
    setMonthlyExpenses(Math.round(totals.outflows))

    // Transfers could go to pension/tax-free deposits
    // Split transfers: 60% to pension, 40% to tax-free
    if (totals.transfers > 0) {
      const transferPerPerson = mode === 'couple' ? totals.transfers / 2 : totals.transfers
      const pensionShare = Math.round(transferPerPerson * 0.6)
      const taxFreeShare = Math.round(transferPerPerson * 0.4)

      if (usePension) {
        setPensionDeposit1(pensionShare)
        if (mode === 'couple') {
          setPensionDeposit2(pensionShare)
        }
      }

      setTaxFreeDeposit1(taxFreeShare)
      if (mode === 'couple') {
        setTaxFreeDeposit2(taxFreeShare)
      }
    }
  }, [cashFlowInputMode, selectedScenarioId, cashFlowScenarios, mode, usePension])

  const result: CalculationResult = useMemo(() => {
    const currentAge = age1
    const partnerAge = mode === 'couple' ? age2 : age1
    const partnerRetAge = mode === 'couple' ? retAge2 : retAge1
    
    // Start values
    let sTax = liquidTaxable
    let sBasis = Math.min(liquidTaxableBasis, sTax) // Safety: basis can't exceed current value
    let sFree = liquidTaxFree
    let sPen1 = usePension ? pension1 : 0
    let sPen2 = (usePension && mode === 'couple') ? pension2 : 0

    const netInc = income1 + (mode === 'couple' ? income2 : 0)
    const spend = monthlyExpenses
    const leak = leakage
    
    const dPen1 = usePension ? pensionDeposit1 : 0
    const dPen2 = (usePension && mode === 'couple') ? pensionDeposit2 : 0
    const dFree = taxFreeDeposit1 + (mode === 'couple' ? taxFreeDeposit2 : 0)
    
    const surplus = (netInc + passiveIncome) - spend - leak
    
    const rReal = realYield / 100
    const mReal = Math.pow(1 + rReal, 1/12) - 1
    const swr = withdrawalRate / 100 || 0.04
    const taxRateDecimal = taxRate / 100
    const targetSpendNet = Math.max(0, targetSpend - passiveIncome)

    const totalSavings = surplus + dPen1 + dPen2 + dFree

    let months = 0
    const maxMonths = 12 * 65
    let found = false
    let successMonth = 0
    let bridgeIssue = false
    
    let successCapital = 0
    let successTarget = 0
    
    const labels: number[] = []
    const liquid: number[] = []
    const locked: number[] = []
    const target: number[] = []
    
    // Initial target calculation
    let initLiq = sTax + sFree
    let initGain = Math.max(0, sTax - sBasis)
    let initEffTax = (initLiq > 0) ? ((initGain * taxRateDecimal) / initLiq) : 0
    let initAdjSWR = swr * (1 - initEffTax)
    if (initAdjSWR < 0.001) initAdjSWR = 0.001
    target.push(Math.round(targetSpendNet * 12 / initAdjSWR))
    
    labels.push(currentAge)
    liquid.push(initLiq)
    locked.push(sPen1 + sPen2)

    while (months < maxMonths) {
      let currLiq = sTax + sFree
      let currTotal = currLiq + sPen1 + sPen2
      
      // Basis tracking logic
      let currGain = Math.max(0, sTax - sBasis)
      let effTaxDrag = (currLiq > 0) ? ((currGain * taxRateDecimal) / currLiq) : 0
      
      let adjSWR = swr * (1 - effTaxDrag)
      if (adjSWR < 0.001) adjSWR = 0.001
      
      let dynamicTarget = targetSpendNet * 12 / adjSWR
      
      if (!found && currTotal >= dynamicTarget) {
        if (usePension) {
          let yearsToPen = Math.max(0, retAge1 - (currentAge + months/12))
          if (mode === 'couple') {
            yearsToPen = Math.max(yearsToPen, partnerRetAge - (partnerAge + months/12))
          }
          
          let neededBridgeNet = targetSpendNet * 12 * yearsToPen
          let grossBridgeNeeded = neededBridgeNet / (1 - effTaxDrag)
          
          if (currLiq >= grossBridgeNeeded) {
            found = true
            successMonth = months
            successCapital = currTotal
            successTarget = dynamicTarget
          } else {
            bridgeIssue = true
          }
        } else {
          found = true
          successMonth = months
          successCapital = currTotal
          successTarget = dynamicTarget
        }
      }

      if (found && months > successMonth + 24) break
      
      if (months > 0 && months % 12 === 0) {
        labels.push(Math.round((currentAge + months/12) * 10) / 10)
        liquid.push(Math.round(currLiq))
        locked.push(Math.round(sPen1 + sPen2))
        target.push(Math.round(dynamicTarget))
      }

      // Grow assets
      sTax *= (1 + mReal)
      sFree *= (1 + mReal)
      sPen1 *= (1 + mReal)
      sPen2 *= (1 + mReal)
      
      // Contributions
      sPen1 += dPen1
      sPen2 += dPen2
      sFree += dFree
      
      // Taxable / Deficit
      if (surplus >= 0) {
        sTax += surplus
        sBasis += surplus // New money increases basis
      } else {
        let deficit = Math.abs(surplus)
        if (sTax > 0) {
          let ratio = sBasis / sTax
          let take = Math.min(sTax, deficit)
          sTax -= take
          sBasis -= (take * ratio)
          deficit -= take
        }
        if (deficit > 0) {
          if (sFree >= deficit) {
            sFree -= deficit
            deficit = 0
          } else {
            sFree = 0
          }
        }
      }
      
      months++
    }
    
    let explanation = ''
    if (found) {
      const years = (successMonth / 12).toFixed(1)
      const finishAge = (parseFloat(currentAge.toString()) + parseFloat(years)).toFixed(1)
      explanation = `At age ${finishAge}, your capital will reach ${formatNumber(successCapital)}. This amount is higher than the required target (${formatNumber(successTarget)}), and sufficient to fund your net expenses (${formatNumber(targetSpendNet)}) even after paying taxes.`
    } else {
      if (bridgeIssue) {
        explanation = "You have enough gross capital, but too much of it is locked in pension. You need to increase your liquid savings."
      } else {
        explanation = "At the current rate, capital does not reach the target within the time frame examined."
      }
    }

    return {
      years: found ? parseFloat((successMonth / 12).toFixed(1)) : null,
      age: found ? parseFloat((parseFloat(currentAge.toString()) + successMonth / 12).toFixed(1)) : null,
      targetCapital: found ? successTarget : target[target.length - 1] || 0,
      monthlySavings: totalSavings,
      found,
      bridgeIssue,
      explanation,
      chartData: { labels, liquid, locked, target }
    }
  }, [
    mode, usePension, age1, age2, retAge1, retAge2,
    liquidTaxable, liquidTaxableBasis, liquidTaxFree, pension1, pension2, realYield,
    income1, income2, pensionDeposit1, pensionDeposit2, taxFreeDeposit1, taxFreeDeposit2,
    monthlyExpenses, leakage, targetSpend, passiveIncome, withdrawalRate, taxRate
  ])

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'line',
      backgroundColor: 'transparent',
      height: 400
    },
    title: {
      text: 'Financial Independence Projection',
      style: { color: 'white' }
    },
    credits: { enabled: false },
    xAxis: {
      title: { text: 'Age', style: { color: 'white' } },
      labels: { style: { color: 'white' } },
      lineColor: '#374151',
      tickColor: '#374151'
    },
    yAxis: {
      title: { text: 'Capital (₪)', style: { color: 'white' } },
      labels: {
        style: { color: 'white' },
        formatter: function() {
          const val = this.value as number
          if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M'
          return (val / 1000).toFixed(0) + 'k'
        }
      },
      gridLineColor: '#374151'
    },
    tooltip: {
      shared: true,
      formatter: function() {
        const idx = typeof this.x === 'number' ? this.x : 0
        const age = result.chartData.labels[idx] || 0
        const liq = result.chartData.liquid[idx] || 0
        const lck = result.chartData.locked[idx] || 0
        const trg = result.chartData.target[idx] || 0
        return `<b>Age ${age}</b><br/>` +
          `Liquid: ${formatNumber(liq)} ₪<br/>` +
          `Locked: ${formatNumber(lck)} ₪<br/>` +
          `Target: ${formatNumber(trg)} ₪`
      }
    },
    legend: { itemStyle: { color: 'white' } },
    series: [
      {
        type: 'line',
        name: 'Liquid (Taxable + Tax-Free)',
        data: result.chartData.liquid,
        color: '#1565c0'
      },
      {
        type: 'line',
        name: 'Pension (Locked)',
        data: result.chartData.locked,
        color: '#ff9800'
      },
      {
        type: 'line',
        name: 'Target (Tax-Adjusted)',
        data: result.chartData.target,
        color: '#333',
        dashStyle: 'Dash',
        lineWidth: 2
      }
    ]
  }), [result.chartData])

  const handleExportCSV = () => {
    const csv = '\uFEFFAge,Liquid Capital,Locked Capital,Total Capital,Target\n'
    const rows = result.chartData.labels.map((label, i) => {
      const liq = result.chartData.liquid[i] || 0
      const lck = result.chartData.locked[i] || 0
      return `${label},${liq},${lck},${liq + lck},${result.chartData.target[i] || 0}\n`
    })
    const blob = new Blob([csv + rows.join('')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'fire_projection.csv'
    link.click()
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Financial Independence Calculator
        </h3>
        <p className="text-gray-400 text-sm">Calculate when you can achieve financial independence and retire early</p>
      </div>

      {/* Mode Selector */}
      <div className="flex justify-center gap-3 mb-6">
        <button
          className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 transition-all duration-200 font-semibold ${
            mode === 'single'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
              : 'bg-gray-900/50 border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500'
          }`}
          onClick={() => setMode('single')}
        >
          <User className="h-5 w-5" />
          Single
        </button>
        <button
          className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 transition-all duration-200 font-semibold ${
            mode === 'couple'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
              : 'bg-gray-900/50 border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500'
          }`}
          onClick={() => setMode('couple')}
        >
          <Users className="h-5 w-5" />
          Couple
        </button>
      </div>

      {/* Results Box */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-6 md:p-8 text-center text-white shadow-2xl overflow-hidden border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
        <div className="relative z-10">
          <div className="text-sm font-medium opacity-90 mb-3 tracking-wide uppercase">Estimated Time to Financial Independence</div>
          <div className="text-6xl md:text-7xl font-extrabold mb-3 drop-shadow-lg">
            {result.found
              ? result.years === 0
                ? <span className="bg-gradient-to-r from-yellow-200 to-yellow-400 bg-clip-text text-transparent">Already there!</span>
                : <span className="bg-gradient-to-r from-green-200 to-emerald-300 bg-clip-text text-transparent">{result.years} years</span>
              : <span className="text-gray-300">Not yet...</span>}
          </div>
          <div className="text-xl md:text-2xl font-semibold opacity-90 mb-6">
            {result.found && result.age ? (
              <span className="inline-flex items-center gap-2">
                At age <span className="text-yellow-200 font-bold">{result.age}</span>
              </span>
            ) : (
              <span className="text-gray-300">---</span>
            )}
          </div>
          
          {result.bridgeIssue && (
            <div className="bg-amber-500/20 border border-amber-400/50 rounded-lg p-4 mb-4 text-sm backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-amber-200 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <strong className="text-amber-100">Liquidity Warning:</strong>
                  <p className="text-amber-50/90 mt-1">You have enough total capital, but lack sufficient liquid funds to bridge until pension.</p>
                </div>
              </div>
            </div>
          )}
          
          {showExplanation && result.explanation && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4 text-sm text-left border border-white/20">
              <p className="leading-relaxed">{result.explanation}</p>
            </div>
          )}
          
          <button
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium opacity-90 hover:opacity-100 transition-opacity underline decoration-2 underline-offset-4"
            onClick={() => setShowExplanation(!showExplanation)}
          >
            <Info className="h-4 w-4" />
            {showExplanation ? 'Hide explanation' : 'How did we get here?'}
          </button>
          
          <div className="flex flex-col md:flex-row justify-around gap-4 border-t border-white/20 pt-6 mt-6">
            <div className="flex-1">
              <div className="text-3xl md:text-4xl font-bold mb-1">{formatNumber(result.targetCapital)} ₪</div>
              <div className="text-sm opacity-80 font-medium">Target Capital (Gross)</div>
            </div>
            <div className="flex-1">
              <div className={`text-3xl md:text-4xl font-bold mb-1 ${result.monthlySavings < 0 ? 'text-red-200' : 'text-green-200'}`}>
                {formatNumber(result.monthlySavings)} ₪
              </div>
              <div className="text-sm opacity-80 font-medium">Monthly Savings/Investment</div>
            </div>
          </div>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Personal Data */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              Personal Data
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Age</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1.5 font-medium">Mine</div>
                    <input
                      type="number"
                      className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      value={age1}
                      onChange={(e) => setAge1(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  {mode === 'couple' && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5 font-medium">Partner</div>
                      <input
                        type="number"
                        className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        value={age2}
                        onChange={(e) => setAge2(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  )}
                </div>
              </div>
              {usePension && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Retirement Age (Pension)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5 font-medium">Mine</div>
                      <input
                        type="number"
                        className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        value={retAge1}
                        onChange={(e) => setRetAge1(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    {mode === 'couple' && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1.5 font-medium">Partner</div>
                        <input
                          type="number"
                          className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                          value={retAge2}
                          onChange={(e) => setRetAge2(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assets & Investments */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Wallet className="h-5 w-5 text-green-400" />
              </div>
              Assets & Investments
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-400 mb-2">
                  1. Liquid Investment Portfolio (Taxable)
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  value={formatNumber(liquidTaxable)}
                  onChange={(e) => setLiquidTaxable(parseInput(e.target.value))}
                  placeholder="Current value"
                />
              </div>
              <div className="ml-4 pl-4 border-l-2 border-blue-500 bg-blue-500/5 rounded-r-lg py-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Cost Basis (amount actually invested)
                  <span className="ml-1.5 text-gray-500 cursor-help" title="The amount you actually deposited (excluding gains). The calculator will calculate tax only on the profit, making the target calculation very accurate.">
                    <Info className="h-3.5 w-3.5 inline align-middle" />
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm"
                  value={formatNumber(liquidTaxableBasis)}
                  onChange={(e) => setLiquidTaxableBasis(parseInput(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">
                  2. Tax-Free Funds (e.g., Education Savings)
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                  value={formatNumber(liquidTaxFree)}
                  onChange={(e) => setLiquidTaxFree(parseInput(e.target.value))}
                  placeholder="Current value"
                />
              </div>
              <div className="border-t border-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-orange-400">
                    3. Pension (Locked)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      className="accent-orange-500 w-4 h-4 rounded"
                      checked={usePension}
                      onChange={(e) => setUsePension(e.target.checked)}
                    />
                    <span className="font-medium">Include?</span>
                  </label>
                </div>
                {usePension && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5 font-medium">Mine</div>
                      <input
                        type="text"
                        className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                        value={formatNumber(pension1)}
                        onChange={(e) => setPension1(parseInput(e.target.value))}
                      />
                    </div>
                    {mode === 'couple' && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1.5 font-medium">Partner</div>
                        <input
                          type="text"
                          className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                          value={formatNumber(pension2)}
                          onChange={(e) => setPension2(parseInput(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Real Annual Return (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  value={realYield}
                  onChange={(e) => setRealYield(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Monthly Cash Flow */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Wallet className="h-5 w-5 text-purple-400" />
              </div>
              Monthly Cash Flow
            </h4>

            {/* Input Mode Selector */}
            <div className="mb-4">
              <div className="flex gap-2 mb-4">
                <button
                  className={`flex-1 px-4 py-2.5 rounded-lg border-2 transition-all duration-200 font-medium text-sm ${
                    cashFlowInputMode === 'manual'
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-gray-900/50 border-gray-600 text-gray-400 hover:bg-gray-800 hover:border-gray-500'
                  }`}
                  onClick={() => {
                    setCashFlowInputMode('manual')
                    setSelectedScenarioId(null)
                  }}
                >
                  Enter Manually
                </button>
                <button
                  className={`flex-1 px-4 py-2.5 rounded-lg border-2 transition-all duration-200 font-medium text-sm ${
                    cashFlowInputMode === 'scenario'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-gray-900/50 border-gray-600 text-gray-400 hover:bg-gray-800 hover:border-gray-500'
                  }`}
                  onClick={() => setCashFlowInputMode('scenario')}
                >
                  Use Existing Scenario
                </button>
              </div>

              {/* Scenario Selection */}
              {cashFlowInputMode === 'scenario' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                  <label className="block text-sm font-medium text-blue-300">
                    Select Cash Flow Scenario
                  </label>
                  <select
                    className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    value={selectedScenarioId || ''}
                    onChange={(e) => setSelectedScenarioId(e.target.value || null)}
                  >
                    <option value="">Select a scenario...</option>
                    {cashFlowScenarios.map((scenario) => (
                      <option key={scenario.scenarioId} value={scenario.scenarioId}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                  {selectedScenarioId && (
                    <div className="text-xs text-blue-200/80">
                      ✓ Monthly cash flow values will be calculated from this scenario
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual Input Fields */}
            {cashFlowInputMode === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Net Income (Bank)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1.5 font-medium">Mine</div>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                      value={formatNumber(income1)}
                      onChange={(e) => setIncome1(parseInput(e.target.value))}
                    />
                  </div>
                  {mode === 'couple' && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5 font-medium">Partner</div>
                      <input
                        type="text"
                        className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                        value={formatNumber(income2)}
                        onChange={(e) => setIncome2(parseInput(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </div>
              {usePension && (
                <div>
                  <label className="block text-sm font-medium text-orange-400 mb-2">
                    Pension Deposit (Employee + Employer)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5 font-medium">Mine</div>
                      <input
                        type="text"
                        className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                        value={formatNumber(pensionDeposit1)}
                        onChange={(e) => setPensionDeposit1(parseInput(e.target.value))}
                      />
                    </div>
                    {mode === 'couple' && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1.5 font-medium">Partner</div>
                        <input
                          type="text"
                          className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                          value={formatNumber(pensionDeposit2)}
                          onChange={(e) => setPensionDeposit2(parseInput(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">
                  Tax-Free Deposit (Employee + Employer)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1.5 font-medium">Mine</div>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                      value={formatNumber(taxFreeDeposit1)}
                      onChange={(e) => setTaxFreeDeposit1(parseInput(e.target.value))}
                    />
                  </div>
                  {mode === 'couple' && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5 font-medium">Partner</div>
                      <input
                        type="text"
                        className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                        value={formatNumber(taxFreeDeposit2)}
                        onChange={(e) => setTaxFreeDeposit2(parseInput(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Monthly Recurring Expenses</label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                  value={formatNumber(monthlyExpenses)}
                  onChange={(e) => setMonthlyExpenses(parseInput(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Discretionary Spending (not invested)
                  <span className="ml-1.5 text-gray-500 cursor-help" title="The portion of disposable income that is 'wasted' on non-fixed expenses (vacations, car, gifts) and does not reach the investment portfolio.">
                    <Info className="h-3.5 w-3.5 inline align-middle" />
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                  value={formatNumber(leakage)}
                  onChange={(e) => setLeakage(parseInput(e.target.value))}
                />
              </div>
            </div>
            )}

            {/* Common Fields (always visible) */}
            <div className="space-y-4">
              <hr className="border-gray-700 my-5" />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Desired Spending in Retirement (Net)
                  <span className="ml-1.5 text-gray-500 cursor-help" title="The amount you want 'in hand'. The calculator will automatically calculate the gross required including tax on actual gains accrued.">
                    <Info className="h-3.5 w-3.5 inline align-middle" />
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                  value={formatNumber(targetSpend)}
                  onChange={(e) => setTargetSpend(parseInput(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Passive Net Income (Rental, etc.)</label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                  value={formatNumber(passiveIncome)}
                  onChange={(e) => setPassiveIncome(parseInput(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Calculation Parameters */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Wallet className="h-5 w-5 text-indigo-400" />
              </div>
              Calculation Parameters
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Withdrawal Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  value={withdrawalRate}
                  onChange={(e) => setWithdrawalRate(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Capital Gains Tax Rate (%)</label>
                <input
                  type="number"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>

      {/* Export Button */}
      <div className="text-center">
        <button
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
          onClick={handleExportCSV}
        >
          <Download className="h-5 w-5" />
          Export Data to CSV
        </button>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-400 border-t border-gray-700/50 pt-4 leading-relaxed">
        <p className="max-w-3xl mx-auto">
          Calculation is performed in real terms. The FIRE target (dashed line) changes over the years: it starts lower and rises as the profit component in the taxable portfolio grows (tax liability increases). Monthly deficit is covered first from the liquid portfolio. YMMV.
        </p>
      </div>
    </div>
  )
}

export default FIRECalculator




