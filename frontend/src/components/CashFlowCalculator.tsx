import { useMemo, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { TrendingDown, TrendingUp, Download, Home, ShoppingCart, Car, GraduationCap, Zap, Heart, CreditCard, PartyPopper, MoreHorizontal } from 'lucide-react'

export function CashFlowCalculator() {
  // Expenses
  const [housing, setHousing] = useState(4500)
  const [food, setFood] = useState(2500)
  const [transportation, setTransportation] = useState(1200)
  const [education, setEducation] = useState(0)
  const [bills, setBills] = useState(800)
  const [health, setHealth] = useState(400)
  const [loans, setLoans] = useState(0)
  const [fun, setFun] = useState(800)
  const [other, setOther] = useState(500)

  // Income
  const [salary1, setSalary1] = useState(10000)
  const [salary2, setSalary2] = useState(0)
  const [allowances, setAllowances] = useState(0)
  const [business, setBusiness] = useState(0)
  const [capital, setCapital] = useState(0)
  const [otherIncome, setOtherIncome] = useState(0)

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
    const totalExpenses = housing + food + transportation + education + bills + health + loans + fun + other
    const totalIncome = salary1 + salary2 + allowances + business + capital + otherIncome
    const balance = totalIncome - totalExpenses
    const burnRate = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : (totalExpenses > 0 ? 100 : 0)

    // Prepare expense data for chart (only non-zero expenses)
    const expenseData = [
      { name: 'Housing', value: housing },
      { name: 'Food', value: food },
      { name: 'Transportation', value: transportation },
      { name: 'Education', value: education },
      { name: 'Bills', value: bills },
      { name: 'Health', value: health },
      { name: 'Loans', value: loans },
      { name: 'Fun', value: fun },
      { name: 'Other', value: other }
    ].filter(item => item.value > 0)

    return {
      totalExpenses,
      totalIncome,
      balance,
      burnRate,
      expenseData
    }
  }, [housing, food, transportation, education, bills, health, loans, fun, other, salary1, salary2, allowances, business, capital, otherIncome])

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: 300
    },
    colors: [
      '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185',
      '#818cf8', '#f472b6', '#a78bfa', '#6b7280'
    ],
    credits: {
      enabled: false
    },
    title: {
      text: ''
    },
    tooltip: {
      pointFormatter: function() {
        return `<b>${this.name}</b>: ${formatNumber(this.y as number)} ₪`
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        borderColor: '#111827',
        borderWidth: 2,
        dataLabels: {
          enabled: true,
          format: '{point.name}: {point.percentage:.1f}%',
          color: '#ffffff',
          style: {
            fontSize: '11px'
          }
        },
        showInLegend: true
      }
    },
    legend: {
      enabled: true,
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'middle',
      itemStyle: {
        color: '#ffffff',
        fontSize: '12px'
      }
    },
    series: [{
      type: 'pie',
      name: 'Expenses',
      data: calculations.expenseData.map(item => ({
        name: item.name,
        y: item.value
      }))
    }]
  }), [calculations.expenseData])

  const getBurnRateColor = (rate: number): string => {
    if (rate > 100) return '#b91c1c' // Muted dark red - overspending
    if (rate > 90) return '#dc2626' // Muted red - dangerous
    if (rate > 75) return '#d97706' // Muted orange/yellow
    return '#059669' // Muted green - excellent
  }

  const getBurnRateText = (rate: number): string => {
    if (rate > 100) {
      return `You're spending ${rate.toFixed(0)}% of your income (overspending)`
    }
    if (rate > 90) {
      return `You're living on the edge (${rate.toFixed(0)}% of income)`
    }
    if (rate > 75) {
      return `Room for improvement (${rate.toFixed(0)}% of income)`
    }
    return `Excellent! You're saving ${(100 - rate).toFixed(0)}% of your income`
  }

  const getStatusText = (balance: number): string => {
    if (balance > 0) return "Great job! You're in the green"
    if (balance < 0) return "Warning: Monthly deficit"
    return "Balanced (zero)"
  }

  const handleExportCSV = () => {
    const date = new Date().toLocaleDateString('en-US')
    const rows = [
      ['Monthly Cash Flow Report', date],
      [''],
      ['Income', 'Amount (₪)'],
      ['Salary 1', formatNumber(salary1)],
      ['Salary 2', formatNumber(salary2)],
      ['Allowances', formatNumber(allowances)],
      ['Business', formatNumber(business)],
      ['Capital/Rental', formatNumber(capital)],
      ['Other', formatNumber(otherIncome)],
      ['Total Income', `${formatNumber(calculations.totalIncome)} ₪`],
      [''],
      ['Expenses', 'Amount (₪)'],
      ['Housing', formatNumber(housing)],
      ['Food & Groceries', formatNumber(food)],
      ['Transportation & Car', formatNumber(transportation)],
      ['Education & Kids', formatNumber(education)],
      ['Bills & Communication', formatNumber(bills)],
      ['Health & Insurance', formatNumber(health)],
      ['Loan Payments', formatNumber(loans)],
      ['Entertainment & Leisure', formatNumber(fun)],
      ['Other', formatNumber(other)],
      ['Total Expenses', `${formatNumber(calculations.totalExpenses)} ₪`],
      [''],
      ['Summary', ''],
      ['Net Cash Flow', `${calculations.balance >= 0 ? '+' : ''}${formatNumber(calculations.balance)} ₪`],
      ['Burn Rate', `${calculations.burnRate.toFixed(0)}%`]
    ]

    const csvContent = '\uFEFF' + rows.map(row => row.join(',')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Cash_Flow_${date.replace(/\//g, '-')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 md:p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Monthly Cash Flow Calculator</h3>
        <p className="text-gray-300">Where does your money go? Family financial snapshot</p>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-green-600/20 border-t-4 border-t-green-600/40 shadow-lg">
          <div className="text-sm font-semibold text-gray-400 mb-2 uppercase">Income</div>
          <div className="text-3xl font-bold text-green-500" style={{ direction: 'ltr' }}>
            {formatNumber(calculations.totalIncome)} ₪
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-red-600/20 border-t-4 border-t-red-600/40 shadow-lg">
          <div className="text-sm font-semibold text-gray-400 mb-2 uppercase">Expenses</div>
          <div className="text-3xl font-bold text-red-500" style={{ direction: 'ltr' }}>
            {formatNumber(calculations.totalExpenses)} ₪
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/50 shadow-lg md:col-span-1">
          <div className="text-sm font-semibold text-white/80 mb-2 uppercase">Net Cash Flow</div>
          <div className="text-4xl font-bold text-white mb-2" style={{ direction: 'ltr' }}>
            {calculations.balance >= 0 ? '+' : ''}{formatNumber(calculations.balance)} ₪
          </div>
          <div className="text-sm text-white/90">{getStatusText(calculations.balance)}</div>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses Column */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
              <div className="p-2 bg-red-600/15 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              Expenses
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <Home className="h-4 w-4 text-gray-500" />
                  Housing
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(housing)}
                  onChange={(e) => setHousing(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <ShoppingCart className="h-4 w-4 text-gray-500" />
                  Food & Groceries
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(food)}
                  onChange={(e) => setFood(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <Car className="h-4 w-4 text-gray-500" />
                  Transportation & Car
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(transportation)}
                  onChange={(e) => setTransportation(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <GraduationCap className="h-4 w-4 text-gray-500" />
                  Education & Kids
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(education)}
                  onChange={(e) => setEducation(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <Zap className="h-4 w-4 text-gray-500" />
                  Bills & Communication
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(bills)}
                  onChange={(e) => setBills(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <Heart className="h-4 w-4 text-gray-500" />
                  Health & Insurance
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(health)}
                  onChange={(e) => setHealth(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  Loan Payments
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(loans)}
                  onChange={(e) => setLoans(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <PartyPopper className="h-4 w-4 text-gray-500" />
                  Entertainment & Leisure
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(fun)}
                  onChange={(e) => setFun(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                  Other
                </label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-red-600/50 focus:ring-2 focus:ring-red-600/10 text-right"
                  value={formatNumber(other)}
                  onChange={(e) => setOther(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Income Column */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-gray-700">
              <div className="p-2 bg-green-600/15 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              Income (Net)
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300">Salary 1</label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-600/50 focus:ring-2 focus:ring-green-600/10 text-right"
                  value={formatNumber(salary1)}
                  onChange={(e) => setSalary1(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300">Salary 2</label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-600/50 focus:ring-2 focus:ring-green-600/10 text-right"
                  value={formatNumber(salary2)}
                  onChange={(e) => setSalary2(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300">Allowances (Kids/Other)</label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-600/50 focus:ring-2 focus:ring-green-600/10 text-right"
                  value={formatNumber(allowances)}
                  onChange={(e) => setAllowances(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300">Business Income</label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-600/50 focus:ring-2 focus:ring-green-600/10 text-right"
                  value={formatNumber(business)}
                  onChange={(e) => setBusiness(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300">Capital/Rental Income</label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-600/50 focus:ring-2 focus:ring-green-600/10 text-right"
                  value={formatNumber(capital)}
                  onChange={(e) => setCapital(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300">Other</label>
                <input
                  type="text"
                  className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-600/50 focus:ring-2 focus:ring-green-600/10 text-right"
                  value={formatNumber(otherIncome)}
                  onChange={(e) => setOtherIncome(parseInput(e.target.value))}
                  style={{ direction: 'ltr' }}
                />
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
            <h4 className="text-lg font-bold text-white mb-4">Expense Breakdown</h4>
            <div className="h-[300px]">
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Burn Rate Bar */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700/50 shadow-lg">
        <h4 className="text-lg font-bold text-white mb-4 text-center">Burn Rate Indicator</h4>
        <div className="bg-gray-700 rounded-full h-8 w-full relative overflow-hidden shadow-inner">
          <div
            className="h-full flex items-center justify-end pr-3 text-white text-xs font-bold transition-all duration-600"
            style={{
              width: `${Math.min(calculations.burnRate, 100)}%`,
              backgroundColor: getBurnRateColor(calculations.burnRate)
            }}
          >
            {calculations.burnRate > 0 && `${calculations.burnRate.toFixed(0)}%`}
          </div>
        </div>
        <div className="text-center mt-3 text-sm font-semibold text-gray-300">
          {getBurnRateText(calculations.burnRate)}
        </div>
      </div>

      {/* Export Button */}
      <div className="text-center">
        <button
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl font-semibold border border-gray-600/50"
          onClick={handleExportCSV}
        >
          <Download className="h-5 w-5" />
          Export Cash Flow Report to CSV
        </button>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-400 border-t border-gray-700 pt-4">
        Note: This calculator is designed to reflect your average monthly financial situation. It's recommended to enter an average of the last 3 months.
      </div>
    </div>
  )
}
