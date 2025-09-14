import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { usePortfolioData } from '../contexts/PortfolioDataContext'

type ScenarioId = string

interface ScenarioInput {
  id: ScenarioId
  name: string
  incomeMonthly: number
  investMonthly: number
  investmentAnnualRatePct: number
  years: number
  debtPrincipal: number
  debtAnnualRatePct: number
  debtYears: number
  portfolioLiquidationNow: number
}

interface Point {
  month: number
  year: number
  investBalance: number
  debtBalance: number
  netWorth: number
}

function computeMonthlyMortgagePayment(principal: number, annualRatePct: number, years: number): number {
  const r = (annualRatePct / 100) / 12
  const n = Math.max(1, Math.round(years * 12))
  if (principal <= 0) return 0
  if (r === 0) return principal / n
  const pmt = (principal * r) / (1 - Math.pow(1 + r, -n))
  return pmt
}

function projectScenario(input: ScenarioInput, initialPortfolioValue: number): Point[] {
  const months = Math.max(1, Math.min(50, input.years)) * 12
  const investRateMonthly = (input.investmentAnnualRatePct / 100) / 12
  const debtRateMonthly = (input.debtAnnualRatePct / 100) / 12

  // If liquidating portfolio now, reduce debt principal immediately up to available amount
  let debtPrincipal = Math.max(0, input.debtPrincipal - Math.max(0, input.portfolioLiquidationNow))
  let investBalance = Math.max(0, initialPortfolioValue - Math.max(0, input.portfolioLiquidationNow))

  const mortgagePayment = computeMonthlyMortgagePayment(debtPrincipal, input.debtAnnualRatePct, input.debtYears)
  const points: Point[] = []

  for (let m = 1; m <= months; m++) {
    // Budget: income covers investMonthly and mortgagePayment; if negative, invest what remains >= 0
    const totalPlannedOutflow = input.investMonthly + mortgagePayment
    const freeCash = input.incomeMonthly - totalPlannedOutflow
    const actualInvestContribution = Math.max(0, input.investMonthly + Math.min(0, freeCash))

    // Investment growth and contribution
    investBalance = investBalance * (1 + investRateMonthly) + actualInvestContribution

    // Debt amortization
    if (debtPrincipal > 0) {
      const interest = debtPrincipal * debtRateMonthly
      let principalPay = Math.max(0, mortgagePayment - interest)
      if (principalPay > debtPrincipal) principalPay = debtPrincipal
      debtPrincipal = Math.max(0, debtPrincipal + interest - mortgagePayment)
      if (debtPrincipal < 0) debtPrincipal = 0
    }

    const year = Math.ceil(m / 12)
    const netWorth = investBalance - debtPrincipal
    points.push({ month: m, year, investBalance, debtBalance: debtPrincipal, netWorth })
  }

  return points
}

export default function ScenarioComparisonTool() {
  const { allPortfoliosData, getAvailablePortfolios } = usePortfolioData()
  const availablePortfolios = getAvailablePortfolios()
  const defaultPortfolioId = availablePortfolios[0]?.portfolio_id || ''

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(defaultPortfolioId)

  const portfolio = useMemo(() => {
    if (!allPortfoliosData || !selectedPortfolioId) return null
    return allPortfoliosData.portfolios?.[selectedPortfolioId] || null
  }, [allPortfoliosData, selectedPortfolioId])

  const baseCurrency = portfolio?.portfolio_metadata?.base_currency || 'USD'

  const initialPortfolioValue = useMemo(() => {
    if (!portfolio || !allPortfoliosData) return 0
    const currentPrices = allPortfoliosData.global_current_prices || {}
    const total = (portfolio.accounts || []).reduce((sum, account) => {
      return sum + (account.holdings || []).reduce((acc, h) => {
        const price = currentPrices[h.symbol]?.price || 0
        return acc + h.units * price
      }, 0)
    }, 0)
    return Math.max(0, Math.round(total * 100) / 100)
  }, [portfolio, allPortfoliosData])

  const [scenarios, setScenarios] = useState<ScenarioInput[]>([{
    id: crypto.randomUUID(),
    name: 'Keep portfolio, larger mortgage',
    incomeMonthly: 8000,
    investMonthly: 500,
    investmentAnnualRatePct: 7,
    years: 20,
    debtPrincipal: 300000,
    debtAnnualRatePct: 5,
    debtYears: 30,
    portfolioLiquidationNow: 0
  }, {
    id: crypto.randomUUID(),
    name: 'Sell portfolio, smaller mortgage',
    incomeMonthly: 8000,
    investMonthly: 500,
    investmentAnnualRatePct: 7,
    years: 20,
    debtPrincipal: 300000,
    debtAnnualRatePct: 5,
    debtYears: 30,
    portfolioLiquidationNow: Math.round(initialPortfolioValue)
  }])

  const updateScenario = (id: ScenarioId, patch: Partial<ScenarioInput>) => {
    setScenarios((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  const addScenario = () => {
    setScenarios((prev) => ([...prev, {
      id: crypto.randomUUID(),
      name: `Scenario ${prev.length + 1}`,
      incomeMonthly: prev[0]?.incomeMonthly ?? 8000,
      investMonthly: prev[0]?.investMonthly ?? 500,
      investmentAnnualRatePct: prev[0]?.investmentAnnualRatePct ?? 7,
      years: prev[0]?.years ?? 20,
      debtPrincipal: prev[0]?.debtPrincipal ?? 300000,
      debtAnnualRatePct: prev[0]?.debtAnnualRatePct ?? 5,
      debtYears: prev[0]?.debtYears ?? 30,
      portfolioLiquidationNow: 0
    }]))
  }

  const removeScenario = (id: ScenarioId) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id))
  }

  const projections = useMemo(() => {
    return scenarios.map((s) => ({
      scenario: s,
      points: projectScenario(s, initialPortfolioValue)
    }))
  }, [scenarios, initialPortfolioValue])

  const maxYears = Math.max(1, ...scenarios.map((s) => s.years))
  const categories = Array.from({ length: maxYears }, (_, i) => `Year ${i + 1}`)

  const yearlySeriesPerScenario = projections.map(({ scenario, points }) => {
    const byYear = new Map<number, Point>()
    points.forEach((p) => {
      const prev = byYear.get(p.year)
      if (!prev || p.month > prev.month) byYear.set(p.year, p)
    })
    const arr = Array.from(byYear.values()).sort((a, b) => a.year - b.year)
    return { id: scenario.id, name: scenario.name, data: arr }
  })

  const numberFmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)

  const chartOptionsNetWorth: Highcharts.Options = useMemo(() => ({
    chart: { type: 'line', backgroundColor: 'transparent', height: 360 },
    title: { text: 'Net Worth by Scenario', style: { color: 'white' } },
    credits: { enabled: false },
    xAxis: {
      categories,
      labels: { style: { color: 'white' } },
      lineColor: '#374151', tickColor: '#374151'
    },
    yAxis: {
      title: { text: `Amount (${baseCurrency})`, style: { color: 'white' } },
      labels: { style: { color: 'white' } },
      gridLineColor: '#374151'
    },
    legend: { itemStyle: { color: 'white' } },
    tooltip: { shared: false, valueDecimals: 0 },
    series: yearlySeriesPerScenario.map(({ name, data }) => ({
      type: 'line',
      name,
      data: data.map((p) => Math.round(p.netWorth))
    }))
  }), [yearlySeriesPerScenario, categories, baseCurrency])

  const chartOptionsInvestment: Highcharts.Options = useMemo(() => ({
    chart: { type: 'line', backgroundColor: 'transparent', height: 300 },
    title: { text: 'Investment Balance', style: { color: 'white' } },
    credits: { enabled: false },
    xAxis: { categories, labels: { style: { color: 'white' } }, lineColor: '#374151', tickColor: '#374151' },
    yAxis: { title: { text: `Value (${baseCurrency})`, style: { color: 'white' } }, labels: { style: { color: 'white' } }, gridLineColor: '#374151' },
    legend: { itemStyle: { color: 'white' } },
    series: yearlySeriesPerScenario.map(({ name, data }) => ({ type: 'line', name, data: data.map((p) => Math.round(p.investBalance)) }))
  }), [yearlySeriesPerScenario, categories, baseCurrency])

  const chartOptionsDebt: Highcharts.Options = useMemo(() => ({
    chart: { type: 'line', backgroundColor: 'transparent', height: 300 },
    title: { text: 'Debt Balance', style: { color: 'white' } },
    credits: { enabled: false },
    xAxis: { categories, labels: { style: { color: 'white' } }, lineColor: '#374151', tickColor: '#374151' },
    yAxis: { title: { text: `Outstanding (${baseCurrency})`, style: { color: 'white' } }, labels: { style: { color: 'white' } }, gridLineColor: '#374151' },
    legend: { itemStyle: { color: 'white' } },
    series: yearlySeriesPerScenario.map(({ name, data }) => ({ type: 'line', name, data: data.map((p) => Math.round(p.debtBalance)) }))
  }), [yearlySeriesPerScenario, categories, baseCurrency])

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6">
      <h3 className="text-xl font-semibold text-white mb-4">Scenario Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <label className="block text-sm text-gray-300">Portfolio</label>
          <select
            className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700"
            value={selectedPortfolioId}
            onChange={(e) => setSelectedPortfolioId(e.target.value)}
          >
            {availablePortfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id}>{p.display_name}</option>
            ))}
          </select>

          <div className="text-sm text-gray-400">Initial portfolio value: <span className="text-gray-200">{numberFmt(initialPortfolioValue)} {baseCurrency}</span></div>

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2"
            onClick={addScenario}
          >Add scenario</button>

          <div className="space-y-4 max-h-[60vh] overflow-auto pr-2">
            {scenarios.map((s) => (
              <div key={s.id} className="bg-gray-900 border border-gray-700 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700"
                    value={s.name}
                    onChange={(e) => updateScenario(s.id, { name: e.target.value })}
                  />
                  <button
                    className="bg-transparent border border-transparent text-[#fca5a5] hover:text-[#fecaca] p-1 rounded"
                    onClick={() => removeScenario(s.id)}
                    aria-label="Remove scenario"
                    title="Remove scenario"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-300">Monthly income
                    <input type="number" className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.incomeMonthly} onChange={(e) => updateScenario(s.id, { incomeMonthly: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="text-xs text-gray-300">Invest monthly
                    <input type="number" className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.investMonthly} onChange={(e) => updateScenario(s.id, { investMonthly: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="text-xs text-gray-300">Investment return %/yr
                    <input type="number" step="0.1" className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.investmentAnnualRatePct} onChange={(e) => updateScenario(s.id, { investmentAnnualRatePct: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="text-xs text-gray-300">Years to compare
                    <input type="number" min={1} max={50} className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.years} onChange={(e) => updateScenario(s.id, { years: Math.max(1, Math.min(50, Number(e.target.value) || 0)) })} />
                  </label>

                  <label className="text-xs text-gray-300">Debt principal
                    <input type="number" className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.debtPrincipal} onChange={(e) => updateScenario(s.id, { debtPrincipal: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="text-xs text-gray-300">Debt rate %/yr
                    <input type="number" step="0.1" className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.debtAnnualRatePct} onChange={(e) => updateScenario(s.id, { debtAnnualRatePct: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="text-xs text-gray-300">Debt term (years)
                    <input type="number" min={1} max={50} className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.debtYears} onChange={(e) => updateScenario(s.id, { debtYears: Math.max(1, Math.min(50, Number(e.target.value) || 0)) })} />
                  </label>
                  <label className="text-xs text-gray-300">Liquidate portfolio now
                    <input type="number" className="w-full bg-gray-800 text-white rounded-md px-2 py-1 border border-gray-700" value={s.portfolioLiquidationNow} onChange={(e) => updateScenario(s.id, { portfolioLiquidationNow: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="bg-gray-900 rounded-md p-2 md:p-4 border border-gray-700">
            <HighchartsReact highcharts={Highcharts} options={chartOptionsNetWorth} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-md p-2 md:p-4 border border-gray-700">
              <HighchartsReact highcharts={Highcharts} options={chartOptionsInvestment} />
            </div>
            <div className="bg-gray-900 rounded-md p-2 md:p-4 border border-gray-700">
              <HighchartsReact highcharts={Highcharts} options={chartOptionsDebt} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


