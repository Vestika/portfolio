import { useMemo, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Maximize2, X } from 'lucide-react'
import { usePortfolioData } from '../contexts/PortfolioDataContext'

type Scope = 'portfolio' | 'accounts'

interface ProjectionPoint {
  month: number
  year: number
  total: number
  contributions: number
  interest: number
}

export function CompoundInterestTool() {
  const {
    allPortfoliosData,
    getAvailablePortfolios
  } = usePortfolioData()

  const availablePortfolios = getAvailablePortfolios()
  const defaultPortfolioId = availablePortfolios[0]?.portfolio_id || ''

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(defaultPortfolioId)
  const [scope, setScope] = useState<Scope>('portfolio')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [years, setYears] = useState<number>(10)
  const [monthlyDeposit, setMonthlyDeposit] = useState<number>(500)
  const [annualRatePercent, setAnnualRatePercent] = useState<number>(7)

  const portfolio = useMemo(() => {
    if (!allPortfoliosData || !selectedPortfolioId) return null
    return allPortfoliosData.portfolios?.[selectedPortfolioId] || null
  }, [allPortfoliosData, selectedPortfolioId])

  const baseCurrency = portfolio?.portfolio_metadata?.base_currency || 'USD'

  const accountNames = useMemo(() => {
    if (!portfolio) return []
    return (portfolio.accounts || []).map((a) => a.account_name)
  }, [portfolio])

  const { initialPrincipal } = useMemo(() => {
    if (!portfolio || !allPortfoliosData) return { initialPrincipal: 0 }

    const accountsToUse = scope === 'portfolio' || selectedAccounts.length === 0
      ? (portfolio.accounts || []).map((a) => a.account_name)
      : selectedAccounts

    const currentPrices = allPortfoliosData.global_current_prices || {}

    // Sum holdings value across selected accounts
    const total = (portfolio.accounts || [])
      .filter((a) => accountsToUse.includes(a.account_name))
      .reduce((sum, account) => {
        const holdings = account.holdings || []
        const accountTotal = holdings.reduce((acc, h) => {
          const price = currentPrices[h.symbol]?.price || 0
          return acc + h.units * price
        }, 0)
        return sum + accountTotal
      }, 0)

    return { initialPrincipal: Math.max(0, Math.round(total * 100) / 100) }
  }, [portfolio, allPortfoliosData, scope, selectedAccounts])

  const seriesData = useMemo<ProjectionPoint[]>(() => {
    const months = Math.max(1, Math.min(50, years)) * 12
    const monthlyRate = (annualRatePercent / 100) / 12
    let total = initialPrincipal
    let contributions = 0
    const points: ProjectionPoint[] = []
    for (let m = 1; m <= months; m++) {
      total = total * (1 + monthlyRate) + monthlyDeposit
      contributions += monthlyDeposit
      const year = Math.ceil(m / 12)
      const interest = total - initialPrincipal - contributions
      points.push({ month: m, year, total, contributions, interest })
    }
    return points
  }, [initialPrincipal, monthlyDeposit, annualRatePercent, years])

  const yearlyPoints = useMemo(() => {
    // Take last month of each year for chart readability
    const byYear = new Map<number, ProjectionPoint>()
    seriesData.forEach((p) => {
      const prev = byYear.get(p.year)
      if (!prev || p.month > prev.month) byYear.set(p.year, p)
    })
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year)
  }, [seriesData])

  const final = seriesData[seriesData.length - 1] || { total: 0, contributions: 0, interest: 0 }

  const numberFmt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n)

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: { type: 'line', backgroundColor: 'transparent', height: 400 },
    title: { text: 'Compound Interest Projection', style: { color: 'white' } },
    credits: { enabled: false },
    xAxis: {
      categories: yearlyPoints.map((p) => `Year ${p.year}`),
      labels: { style: { color: 'white' } },
      lineColor: '#374151', tickColor: '#374151'
    },
    yAxis: {
      title: { text: `Value (${baseCurrency})`, style: { color: 'white' } },
      labels: { style: { color: 'white' } },
      gridLineColor: '#374151'
    },
    tooltip: {
      shared: true,
      valueDecimals: 0,
      formatter: function() {
        const idx = typeof this.x === 'number' ? this.x : 0
        const p = yearlyPoints[idx]
        return `<b>Year ${p.year}</b><br/>` +
          `Total: ${numberFmt(p.total)} ${baseCurrency}<br/>` +
          `Contributions: ${numberFmt(p.contributions)} ${baseCurrency}<br/>` +
          `Interest: ${numberFmt(p.interest)} ${baseCurrency}`
      }
    },
    legend: { itemStyle: { color: 'white' } },
    series: [
      { type: 'line', name: 'Total', data: yearlyPoints.map((p) => Math.round(p.total)) },
      { type: 'line', name: 'Contributions', data: yearlyPoints.map((p) => Math.round(p.contributions)) },
      { type: 'line', name: 'Interest', data: yearlyPoints.map((p) => Math.round(p.interest)) }
    ]
  }), [yearlyPoints, baseCurrency])

  const [expanded, setExpanded] = useState<boolean>(false)
  const openExpanded = () => setExpanded(true)
  const closeExpanded = () => setExpanded(false)

  const handleAccountToggle = (name: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  return (
    <>
    <div className="bg-gray-800 rounded-lg p-4 md:p-6">
      <h3 className="text-xl font-semibold text-white mb-4">Compound Interest Calculator</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3">
          <label className="block text-sm text-gray-300">Portfolio</label>
          <select
            className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700"
            value={selectedPortfolioId}
            onChange={(e) => {
              setSelectedPortfolioId(e.target.value)
              setSelectedAccounts([])
            }}
          >
            {availablePortfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id}>{p.display_name}</option>
            ))}
          </select>

          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="radio"
                className="accent-blue-600"
                checked={scope === 'portfolio'}
                onChange={() => setScope('portfolio')}
              />
              Whole portfolio
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="radio"
                className="accent-blue-600"
                checked={scope === 'accounts'}
                onChange={() => setScope('accounts')}
              />
              Specific accounts
            </label>
          </div>

          {scope === 'accounts' && (
            <div className="max-h-40 overflow-auto border border-gray-700 rounded-md p-2 mt-2">
              {accountNames.length === 0 && (
                <div className="text-gray-400 text-sm">No accounts available</div>
              )}
              {accountNames.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm text-gray-200 py-1">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={selectedAccounts.includes(name)}
                    onChange={() => handleAccountToggle(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="block text-sm text-gray-300">Years</label>
              <input
                type="number"
                min={1}
                max={50}
                className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700"
                value={years}
                onChange={(e) => setYears(Math.max(1, Math.min(50, Number(e.target.value) || 0)))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300">Monthly deposit ({baseCurrency})</label>
              <input
                type="number"
                min={0}
                step={50}
                className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300">Expected yearly interest (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700"
                value={annualRatePercent}
                onChange={(e) => setAnnualRatePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-400">
            <div>Base currency: <span className="text-gray-200">{baseCurrency}</span></div>
            <div>Initial principal: <span className="text-gray-200">{numberFmt(initialPrincipal)} {baseCurrency}</span></div>
          </div>
        </div>

        <div className="md:col-span-2 bg-gray-900 rounded-md p-2 md:p-4 border border-gray-700 relative">
          <button
            className="absolute right-2 top-2 z-10 pointer-events-auto bg-transparent border border-transparent text-[#d1d5db] hover:text-[#ffffff] p-1 rounded"
            onClick={openExpanded}
            aria-label="Expand chart"
            title="Expand"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
          <div className="text-gray-400 text-sm">Final total</div>
          <div className="text-2xl font-semibold">{numberFmt(final.total)} {baseCurrency}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
          <div className="text-gray-400 text-sm">Total contributions</div>
          <div className="text-2xl font-semibold">{numberFmt(final.contributions)} {baseCurrency}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
          <div className="text-gray-400 text-sm">Total interest</div>
          <div className="text-2xl font-semibold">{numberFmt(final.interest)} {baseCurrency}</div>
        </div>
      </div>

      <div className="mt-6 overflow-auto border border-gray-700 rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Year</th>
              <th className="text-right px-3 py-2">Ending balance</th>
              <th className="text-right px-3 py-2">Contributions</th>
              <th className="text-right px-3 py-2">Interest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {yearlyPoints.map((p) => (
              <tr key={p.year} className="text-gray-200">
                <td className="px-3 py-2">Year {p.year}</td>
                <td className="px-3 py-2 text-right">{numberFmt(p.total)} {baseCurrency}</td>
                <td className="px-3 py-2 text-right">{numberFmt(p.contributions)} {baseCurrency}</td>
                <td className="px-3 py-2 text-right">{numberFmt(p.interest)} {baseCurrency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {expanded && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70" onClick={closeExpanded} />
        <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-3 md:p-4 w-[95vw] max-w-6xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold text-sm md:text-base">Compound Interest Projection</div>
            <button
              className="bg-transparent border border-transparent text-[#d1d5db] hover:text-[#ffffff] p-1 rounded"
              onClick={closeExpanded}
              aria-label="Close expanded chart"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-md p-2">
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                ...chartOptions,
                chart: { ...(chartOptions.chart || {}), height: 650, backgroundColor: 'transparent' },
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default CompoundInterestTool


