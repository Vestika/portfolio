import { useMemo, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Home, TrendingUp, Info } from 'lucide-react'

export function BuyOrRentCalculator() {
  // Buying scenario
  const [apartmentPrice, setApartmentPrice] = useState(2000000)
  const [otherFees, setOtherFees] = useState(80000)
  const [equity, setEquity] = useState(500000)
  const [mortgageRate, setMortgageRate] = useState(4.5)
  const [mortgageYears, setMortgageYears] = useState(25)
  const [appreciationRate, setAppreciationRate] = useState(3.0)
  const [maintenanceRate, setMaintenanceRate] = useState(0.5)

  // Renting + Investing scenario
  const [monthlyRent, setMonthlyRent] = useState(5500)
  const [rentInflation, setRentInflation] = useState(2.5)
  const [stockYield, setStockYield] = useState(7.0)
  const [investmentFees, setInvestmentFees] = useState(0.1)
  const [capitalGainsTax, setCapitalGainsTax] = useState(25)

  // Common parameters
  const [inflation, setInflation] = useState(2.5)
  const [horizon, setHorizon] = useState(20)

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

  // Calculate purchase tax based on Israeli brackets (2024)
  const calculatePurchaseTax = (price: number): number => {
    const brackets = [
      { limit: 1978745, rate: 0 },
      { limit: 2347040, rate: 0.035 },
      { limit: 6055070, rate: 0.05 },
      { limit: 20183530, rate: 0.08 },
      { limit: Infinity, rate: 0.10 }
    ]

    let tax = 0
    let prevLimit = 0

    for (const bracket of brackets) {
      if (price > prevLimit) {
        const taxable = Math.min(price, bracket.limit) - prevLimit
        tax += taxable * bracket.rate
        prevLimit = bracket.limit
      } else {
        break
      }
    }

    return Math.round(tax)
  }

  // Calculate mortgage payment (PMT function)
  const calculateMortgagePayment = (principal: number, annualRate: number, years: number): number => {
    const monthlyRate = annualRate / 100 / 12
    const numberOfPayments = years * 12
    if (monthlyRate === 0) return principal / numberOfPayments
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
  }

  const calculations = useMemo(() => {
    const purchaseTax = calculatePurchaseTax(apartmentPrice)
    const totalPurchaseFees = purchaseTax + otherFees
    const loanAmount = Math.max(0, apartmentPrice - equity)
    const monthlyMortgage = loanAmount > 0 && mortgageYears > 0 
      ? calculateMortgagePayment(loanAmount, mortgageRate, mortgageYears)
      : 0

    const monthlyMortgageRate = mortgageRate / 100 / 12
    const netStockReturnMonth = Math.pow(1 + stockYield / 100 - investmentFees / 100, 1/12) - 1
    const inflationMonth = Math.pow(1 + inflation / 100, 1/12) - 1
    const totalMonths = horizon * 12

    // Initial values
    let buyerAsset = apartmentPrice
    let buyerDebt = loanAmount
    let renterPortfolio = equity + totalPurchaseFees // Equity + fees that would be saved
    let renterIndexedPrincipal = renterPortfolio
    let currentRent = monthlyRent

    const labels: string[] = ['Start']
    const dataBuy: number[] = [apartmentPrice - loanAmount]
    const dataRent: number[] = [renterPortfolio]

    // Monthly simulation
    for (let month = 1; month <= totalMonths; month++) {
      // Buying scenario: property appreciation
      buyerAsset *= Math.pow(1 + appreciationRate / 100, 1/12)

      // Mortgage payments
      let interestPayment = 0
      let principalPayment = 0
      let actualMortgagePayment = 0

      if (buyerDebt > 0) {
        interestPayment = buyerDebt * monthlyMortgageRate
        principalPayment = monthlyMortgage - interestPayment
        if (principalPayment > buyerDebt) {
          principalPayment = buyerDebt
          actualMortgagePayment = principalPayment + interestPayment
        } else {
          actualMortgagePayment = monthlyMortgage
        }
        buyerDebt -= principalPayment
      }

      // Maintenance costs
      const monthlyMaintenance = (buyerAsset * maintenanceRate / 100) / 12
      const buyerMonthlyCost = actualMortgagePayment + monthlyMaintenance

      // Renting scenario
      const renterMonthlyCost = currentRent

      // Calculate surplus (difference between costs)
      const surplus = buyerMonthlyCost - renterMonthlyCost

      // Investment growth
      renterPortfolio *= (1 + netStockReturnMonth)
      renterPortfolio += surplus

      // Track indexed principal for tax calculation
      renterIndexedPrincipal *= (1 + inflationMonth)
      renterIndexedPrincipal += surplus

      // Annual rent increase
      if (month % 12 === 0) {
        currentRent *= (1 + rentInflation / 100)
      }

      // Record yearly data
      if (month % 12 === 0 || month === totalMonths) {
        const netBuy = buyerAsset - buyerDebt
        
        // Calculate tax on real gains
        const realGain = renterPortfolio - renterIndexedPrincipal
        const tax = realGain > 0 ? realGain * (capitalGainsTax / 100) : 0
        const netRent = renterPortfolio - tax

        labels.push(`Year ${Math.floor(month / 12)}`)
        dataBuy.push(Math.round(netBuy))
        dataRent.push(Math.round(netRent))
      }
    }

    const finalNetBuy = dataBuy[dataBuy.length - 1]
    const finalNetRent = dataRent[dataRent.length - 1]
    const diff = Math.abs(finalNetBuy - finalNetRent)

    let verdict = ''
    let verdictDesc = ''
    let verdictColor = '#666'

    if (finalNetBuy > finalNetRent) {
      verdict = 'Better to Buy Apartment'
      verdictDesc = 'Property appreciation (combined with leverage) outperformed the stock market.'
      verdictColor = '#a71e39'
    } else {
      verdict = 'Better to Rent and Invest'
      verdictDesc = 'The investment portfolio accumulated compound interest stronger than property appreciation.'
      verdictColor = '#2e7d32'
    }

    return {
      purchaseTax,
      totalPurchaseFees,
      finalNetBuy,
      finalNetRent,
      diff,
      verdict,
      verdictDesc,
      verdictColor,
      chartData: {
        labels,
        dataBuy,
        dataRent
      }
    }
  }, [
    apartmentPrice, otherFees, equity, mortgageRate, mortgageYears,
    appreciationRate, maintenanceRate, monthlyRent, rentInflation,
    stockYield, investmentFees, capitalGainsTax, inflation, horizon
  ])

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'line',
      backgroundColor: 'transparent',
      height: 400
    },
    title: {
      text: 'Net Worth Comparison Over Time',
      style: { color: '#ffffff' }
    },
    xAxis: {
      categories: calculations.chartData.labels,
      labels: { style: { color: '#ffffff' } },
      lineColor: '#374151',
      tickColor: '#374151'
    },
    yAxis: {
      title: { text: 'Net Worth (₪)', style: { color: '#ffffff' } },
      labels: {
        style: { color: '#ffffff' },
        formatter: function() {
          const val = this.value as number
          if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M'
          return (val / 1000).toFixed(0) + 'k'
        }
      },
      gridLineColor: '#374151'
    },
    legend: {
      itemStyle: { color: '#ffffff' }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      style: { color: '#ffffff' },
      formatter: function() {
        const point = (this as any).points?.[0]
        if (!point) return ''
        return `<b>${point.series.name}</b>: ${formatNumber(point.y as number)} ₪`
      },
      shared: true
    },
    series: [
      {
        name: 'Buying (Net Property Value)',
        data: calculations.chartData.dataBuy,
        type: 'line',
        color: '#a71e39',
        lineWidth: 3
      },
      {
        name: 'Renting (Net Investment Portfolio)',
        data: calculations.chartData.dataRent,
        type: 'line',
        color: '#2e7d32',
        lineWidth: 3
      }
    ],
    plotOptions: {
      line: {
        marker: { enabled: false },
        animation: false
      }
    }
  }), [calculations.chartData])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Home className="h-7 w-7 text-indigo-400" />
          Buy Apartment or Rent and Invest?
        </h2>
        <p className="text-gray-400 text-sm">
          Compare buying an apartment with a mortgage versus renting and investing your equity in the stock market.
          The calculator accounts for purchase tax, maintenance costs, rent increases, investment returns, and taxes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Buying Scenario */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
            <Home className="h-5 w-5 text-indigo-400" />
            Scenario A: Buying Apartment
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Apartment Price (₪)</label>
              <input
                type="text"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formatNumber(apartmentPrice)}
                onChange={(e) => setApartmentPrice(parseInput(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Purchase Tax (₪)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    Calculated automatically based on Israeli purchase tax brackets (2024).
                  </div>
                </div>
              </label>
              <input
                type="text"
                readOnly
                className="w-full bg-gray-700/50 text-gray-400 rounded-lg px-3 py-2.5 border border-gray-600 cursor-not-allowed"
                value={formatNumber(calculations.purchaseTax)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Additional Expenses (₪)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    Lawyer, brokerage, renovation, etc. In the renting scenario, this money is invested.
                  </div>
                </div>
              </label>
              <input
                type="text"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formatNumber(otherFees)}
                onChange={(e) => setOtherFees(parseInput(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Equity (₪)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    Cash available for purchase. In the renting scenario, this is invested in the stock market.
                  </div>
                </div>
              </label>
              <input
                type="text"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formatNumber(equity)}
                onChange={(e) => setEquity(parseInput(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mortgage Interest Rate (Annual %)</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={mortgageRate}
                onChange={(e) => setMortgageRate(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mortgage Term (Years)</label>
              <input
                type="number"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={mortgageYears}
                onChange={(e) => setMortgageYears(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Property Appreciation Rate (Annual %)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    How much the property appreciates each year. Long-term average is around inflation + 1-2%.
                  </div>
                </div>
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={appreciationRate}
                onChange={(e) => setAppreciationRate(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Maintenance & Insurance (% of Property Value)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    Depreciation, repairs, building and life insurance. Recommended: at least 0.5% of property value per year.
                  </div>
                </div>
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={maintenanceRate}
                onChange={(e) => setMaintenanceRate(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>
        </div>

        {/* Renting + Investing Scenario */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Scenario B: Renting + Investing
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Monthly Rent (₪)</label>
              <input
                type="text"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formatNumber(monthlyRent)}
                onChange={(e) => setMonthlyRent(parseInput(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Annual Rent Increase (%)</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={rentInflation}
                onChange={(e) => setRentInflation(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stock Market Yield (Annual %)</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={stockYield}
                onChange={(e) => setStockYield(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Investment Management Fees (%)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    Total trading commissions and management fees for the investment portfolio.
                  </div>
                </div>
              </label>
              <input
                type="number"
                step="0.05"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={investmentFees}
                onChange={(e) => setInvestmentFees(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                Capital Gains Tax (%)
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                    In Israel: 25% on real gains. For apartments (single unit) there is usually exemption from capital gains tax.
                  </div>
                </div>
              </label>
              <input
                type="number"
                className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={capitalGainsTax}
                onChange={(e) => setCapitalGainsTax(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="border-t border-gray-700 pt-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  Expected Annual Inflation (%)
                  <div className="group relative">
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
                      Affects real taxation in the stock market, and also the value of money in the future.
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  value={inflation}
                  onChange={(e) => setInflation(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Comparison Period (Years)</label>
                <input
                  type="number"
                  className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  value={horizon}
                  onChange={(e) => setHorizon(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-6 md:p-8 text-center text-white shadow-2xl overflow-hidden border border-gray-700/50">
        <div className="text-sm font-medium opacity-90 mb-3 tracking-wide uppercase">Verdict</div>
        <div className="text-4xl md:text-5xl font-extrabold mb-3" style={{ color: calculations.verdictColor }}>
          {calculations.verdict}
        </div>
        <div className="text-xl md:text-2xl font-semibold opacity-90 mb-6">
          Gap of {formatNumber(calculations.diff)} ₪
        </div>
        <div className="text-base opacity-80 mb-6">
          {calculations.verdictDesc}
        </div>

        <div className="flex flex-col md:flex-row justify-around gap-4 border-t border-white/20 pt-6 mt-6">
          <div className="flex-1">
            <h4 className="text-sm text-gray-400 mb-2">Net Worth (Buying)</h4>
            <div className="text-2xl font-bold text-white mb-1" style={{ direction: 'ltr' }}>
              {formatNumber(calculations.finalNetBuy)} ₪
            </div>
            <div className="text-sm text-gray-400">
              (Property value minus mortgage)
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm text-gray-400 mb-2">Net Worth (Renting)</h4>
            <div className="text-2xl font-bold text-white mb-1" style={{ direction: 'ltr' }}>
              {formatNumber(calculations.finalNetRent)} ₪
            </div>
            <div className="text-sm text-gray-400">
              (Investment portfolio net)
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>

      <div className="text-center text-sm text-gray-400">
        Note: The calculator assumes investment of the monthly difference (if any) in the stock market. 
        The calculation is a simulation and does not constitute financial advice.
      </div>
    </div>
  )
}

