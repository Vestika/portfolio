// Cash Flow Sankey Chart using Highcharts

import { useMemo, useRef, useCallback } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import 'highcharts/modules/sankey'
import { Plus } from 'lucide-react'

import type {
  CashFlowItem,
  CashFlowCategory,
  AccountInfo,
  SankeyNodeInfo,
  SankeyLinkInfo,
  SankeyNodeType,
  TimePeriod,
} from '../types/cashflow'
import { FREQUENCY_MULTIPLIERS, FLOW_COLORS } from '../types/cashflow'

interface CashFlowSankeyChartProps {
  items: CashFlowItem[]
  categories: CashFlowCategory[]
  accounts: AccountInfo[]
  accountBalances: Map<string, number>
  baseCurrency: string
  timePeriod?: TimePeriod
  currencyConversionRate?: number
  onFlowRightClick?: (event: { x: number; y: number }, linkInfo: SankeyLinkInfo) => void
  onNodeClick?: (nodeInfo: SankeyNodeInfo) => void
  onAddFlow?: () => void
}

// Convert frequency to monthly
function convertToMonthly(amount: number, frequency: CashFlowItem['frequency']): number {
  return amount * FREQUENCY_MULTIPLIERS[frequency]
}

// Calculate monthly amount for an item
function calculateMonthlyAmount(
  item: CashFlowItem,
  sourceAccountBalance?: number
): number {
  if (!item.isActive) return 0

  // Use percentage mode only if percentage is a valid positive number AND source balance exists
  if (
    item.percentage !== undefined &&
    item.percentage !== null &&
    item.percentage > 0 &&
    sourceAccountBalance !== undefined &&
    sourceAccountBalance > 0
  ) {
    const baseAmount = (sourceAccountBalance * item.percentage) / 100
    return convertToMonthly(baseAmount, item.frequency)
  }

  // Otherwise use fixed amount
  return convertToMonthly(item.amount, item.frequency)
}

// Determine node type from name
function getNodeType(name: string, accounts: AccountInfo[], categories: CashFlowCategory[]): SankeyNodeType {
  if (name === 'Income') return 'income'
  if (name === 'Expenses') return 'expenses'
  if (accounts.some(a => a.name === name)) return 'account'
  if (categories.some(c => c.name === name)) return 'category'
  return 'category' // Default to category for custom names
}

export function CashFlowSankeyChart({
  items,
  categories,
  accounts,
  accountBalances,
  baseCurrency,
  timePeriod = 'monthly',
  currencyConversionRate = 1,
  onFlowRightClick,
  onNodeClick,
  onAddFlow,
}: CashFlowSankeyChartProps) {
  const chartRef = useRef<HighchartsReact.RefObject>(null)

  // Calculate period multiplier and suffix
  const periodMultiplier = timePeriod === 'yearly' ? 12 : 1
  const periodSuffix = timePeriod === 'yearly' ? '/yr' : '/mo'

  // Build mapping from link key to flow items
  const linkToItemsMap = useMemo(() => {
    const map = new Map<string, CashFlowItem[]>()
    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    items.forEach((item) => {
      if (!item.isActive) return

      const sourceBalance = item.sourceAccountId
        ? accountBalances.get(item.sourceAccountId)
        : undefined
      const monthlyAmount = calculateMonthlyAmount(item, sourceBalance)

      if (monthlyAmount <= 0) return

      // Determine source node name
      let sourceName: string
      if (item.type === 'inflow') {
        sourceName = 'Income'
      } else if (item.sourceAccountId) {
        const account = accounts.find((a) => a.id === item.sourceAccountId)
        sourceName = account?.name || item.sourceAccountId
      } else {
        sourceName = 'Income'
      }

      // Determine category node name
      const category = item.categoryId ? categoryMap.get(item.categoryId) : null
      const categoryName = category?.name || item.name

      // Determine destination node name
      let destName: string
      if (item.type === 'outflow') {
        destName = 'Expenses'
      } else if (item.destinationAccountId) {
        const account = accounts.find((a) => a.id === item.destinationAccountId)
        destName = account?.name || item.destinationAccountId
      } else {
        destName = 'Expenses'
      }

      // Track which items contribute to which links
      const addToLink = (from: string, to: string) => {
        const key = `${from}|||${to}`
        const existing = map.get(key) || []
        existing.push(item)
        map.set(key, existing)
      }

      if (item.type === 'inflow') {
        addToLink(sourceName, categoryName)
        if (item.destinationAccountId) {
          addToLink(categoryName, destName)
        }
      } else if (item.type === 'outflow') {
        addToLink(sourceName, categoryName)
        addToLink(categoryName, destName)
      } else if (item.type === 'transfer') {
        addToLink(sourceName, categoryName)
        addToLink(categoryName, destName)
      }
    })

    return map
  }, [items, categories, accounts, accountBalances])

  // Build Sankey data
  const sankeyData = useMemo(() => {
    const data: Array<[string, string, number]> = []
    const nodeColors: Record<string, string> = {}

    // Category lookup
    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    // Process each flow item
    items.forEach((item) => {
      if (!item.isActive) return

      const sourceBalance = item.sourceAccountId
        ? accountBalances.get(item.sourceAccountId)
        : undefined
      let monthlyAmount = calculateMonthlyAmount(item, sourceBalance)

      // Convert to display currency
      const itemCurrency = item.currency || 'ILS'
      if (baseCurrency === 'ILS' && itemCurrency === 'USD') {
        monthlyAmount *= currencyConversionRate
      } else if (baseCurrency === 'USD' && itemCurrency === 'ILS') {
        monthlyAmount /= currencyConversionRate
      }

      if (monthlyAmount <= 0) return

      // Apply period multiplier
      const displayAmount = monthlyAmount * periodMultiplier

      // Determine source node name
      let sourceName: string
      if (item.type === 'inflow') {
        sourceName = 'Income'
        nodeColors['Income'] = FLOW_COLORS.inflow
      } else if (item.sourceAccountId) {
        const account = accounts.find((a) => a.id === item.sourceAccountId)
        sourceName = account?.name || item.sourceAccountId
      } else {
        sourceName = 'Income'
        nodeColors['Income'] = FLOW_COLORS.inflow
      }

      // Determine category node name
      const category = item.categoryId ? categoryMap.get(item.categoryId) : null
      const categoryName = category?.name || item.name

      // Set category color based on flow type
      nodeColors[categoryName] = FLOW_COLORS[item.type]

      // Determine destination node name
      let destName: string
      if (item.type === 'outflow') {
        destName = 'Expenses'
        nodeColors['Expenses'] = FLOW_COLORS.outflow
      } else if (item.destinationAccountId) {
        const account = accounts.find((a) => a.id === item.destinationAccountId)
        destName = account?.name || item.destinationAccountId
      } else {
        destName = 'Expenses'
        nodeColors['Expenses'] = FLOW_COLORS.outflow
      }

      // For inflows: Income -> Category -> Account
      if (item.type === 'inflow') {
        data.push([sourceName, categoryName, displayAmount])
        if (item.destinationAccountId) {
          data.push([categoryName, destName, displayAmount])
        }
      }
      // For outflows: Account -> Category -> Expenses
      else if (item.type === 'outflow') {
        data.push([sourceName, categoryName, displayAmount])
        data.push([categoryName, destName, displayAmount])
      }
      // For transfers: Account -> Category -> Account
      else if (item.type === 'transfer') {
        data.push([sourceName, categoryName, displayAmount])
        data.push([categoryName, destName, displayAmount])
      }
    })

    // Aggregate duplicate flows
    const aggregated = new Map<string, number>()
    data.forEach(([from, to, weight]) => {
      const key = `${from}|||${to}`
      aggregated.set(key, (aggregated.get(key) || 0) + weight)
    })

    const aggregatedData = Array.from(aggregated.entries()).map(([key, weight]) => {
      const [from, to] = key.split('|||')
      return [from, to, weight] as [string, string, number]
    })

    // Build nodes array with colors
    const nodeSet = new Set<string>()
    aggregatedData.forEach(([from, to]) => {
      nodeSet.add(from)
      nodeSet.add(to)
    })

    const nodes = Array.from(nodeSet).map((name) => ({
      id: name,
      color: nodeColors[name] || '#6B7280',
    }))

    return { data: aggregatedData, nodes, nodeColors }
  }, [items, categories, accounts, accountBalances, baseCurrency, currencyConversionRate, periodMultiplier])

  // Handle link right-click
  const handleLinkRightClick = useCallback(
    (point: any, event: MouseEvent) => {
      if (!onFlowRightClick) return

      const from = point.from
      const to = point.to
      const key = `${from}|||${to}`
      const flowItems = linkToItemsMap.get(key) || []

      const linkInfo: SankeyLinkInfo = {
        from,
        to,
        weight: point.weight || 0,
        flowItems,
      }

      onFlowRightClick({ x: event.clientX, y: event.clientY }, linkInfo)
    },
    [onFlowRightClick, linkToItemsMap]
  )

  // Handle node click
  const handleNodeClick = useCallback(
    (point: any) => {
      if (!onNodeClick) return

      const name = point.name
      const nodeType = getNodeType(name, accounts, categories)

      // Find all flows through this node
      const inflows: CashFlowItem[] = []
      const outflows: CashFlowItem[] = []

      linkToItemsMap.forEach((flowItems, key) => {
        const [from, to] = key.split('|||')
        if (to === name) {
          inflows.push(...flowItems)
        }
        if (from === name) {
          outflows.push(...flowItems)
        }
      })

      // Deduplicate
      const uniqueInflows = [...new Map(inflows.map(i => [i.id, i])).values()]
      const uniqueOutflows = [...new Map(outflows.map(i => [i.id, i])).values()]

      const nodeInfo: SankeyNodeInfo = {
        name,
        nodeType,
        accountId: accounts.find(a => a.name === name)?.id,
        categoryId: categories.find(c => c.name === name)?.id,
        totalFlow: point.sum || 0,
        inflows: uniqueInflows,
        outflows: uniqueOutflows,
      }

      onNodeClick(nodeInfo)
    },
    [onNodeClick, accounts, categories, linkToItemsMap]
  )

  // Empty state
  if (sankeyData.data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-gray-400 font-medium">No Cash Flows Yet</p>
            <p className="text-gray-500 text-sm">Add income, expenses, and transfers to visualize your cash flow.</p>
          </div>
        </div>
        {onAddFlow && (
          <div className="border-t border-gray-700 p-3">
            <button
              onClick={onAddFlow}
              className="w-full py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Flow
            </button>
          </div>
        )}
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    // Value is already in baseCurrency and period-adjusted after conversion in sankeyData
    const symbol = baseCurrency === 'ILS' ? '₪' : '$'
    return `${symbol}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  const chartOptions: Highcharts.Options = {
    chart: {
      backgroundColor: 'transparent',
      height: 500,
      events: {
        load: function () {
          // Add context menu event listener after chart loads
          const chart = this
          const container = chart.container

          container.addEventListener('contextmenu', (e: MouseEvent) => {
            const point = (chart as any).hoverPoint
            if (point && !point.isNode) {
              e.preventDefault()
              handleLinkRightClick(point, e)
            }
          })
        },
      },
    },
    credits: {
      enabled: false,
    },
    title: {
      text: '',
    },
    tooltip: {
      useHTML: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderWidth: 1,
      borderColor: '#374151',
      style: {
        color: '#e5e7eb',
      },
      formatter: function (this: any) {
        // Check if it's a node or a link
        if (this.point && this.point.isNode) {
          const sum = this.point.sum || 0
          return `<b>${this.point.name}</b><br/>${formatCurrency(sum)}${periodSuffix}<br/><span style="font-size:10px;color:#9ca3af">Click to view details</span>`
        }
        // It's a link
        const weight = this.point?.weight || 0
        return `${this.point?.from} → ${this.point?.to}<br/><b>${formatCurrency(weight)}${periodSuffix}</b><br/><span style="font-size:10px;color:#9ca3af">Right-click for options</span>`
      },
    },
    plotOptions: {
      sankey: {
        cursor: 'pointer',
        point: {
          events: {
            click: function (this: any) {
              if (this.isNode) {
                handleNodeClick(this)
              }
            },
          },
        },
      },
    },
    series: [
      {
        type: 'sankey',
        name: 'Cash Flow',
        keys: ['from', 'to', 'weight'],
        data: sankeyData.data,
        nodes: sankeyData.nodes as any,
        dataLabels: {
          enabled: true,
          style: {
            color: '#e5e7eb',
            textOutline: 'none',
            fontSize: '12px',
            fontWeight: 'normal',
          },
          formatter: function (this: any) {
            const point = this.point
            if (point && point.isNode) {
              const sum = point.sum || 0
              return `${point.name}<br/>${formatCurrency(sum)}`
            }
            return ''
          },
        },
        nodeWidth: 20,
        nodePadding: 20,
        linkOpacity: 0.5,
        curveFactor: 0.5,
      } as any,
    ],
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-4">
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          options={chartOptions}
        />
      </div>
      {onAddFlow && (
        <div className="border-t border-gray-700 p-3">
          <button
            onClick={onAddFlow}
            className="w-full py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Flow
          </button>
        </div>
      )}
    </div>
  )
}
