// Dialog for viewing and editing node information

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { ArrowDownLeft, ArrowUpRight, Plus, DollarSign, Trash2 } from 'lucide-react'
import type {
  CashFlowItem,
  CashFlowCategory,
  AccountInfo,
  SankeyNodeInfo,
} from '../../types/cashflow'
import { FLOW_COLORS, FREQUENCY_LABELS } from '../../types/cashflow'
import { convertToMonthly } from '../../utils/cashflow-helpers'

interface NodeInfoDialogProps {
  isOpen: boolean
  onClose: () => void
  nodeInfo: SankeyNodeInfo | null
  categories: CashFlowCategory[]
  accounts: AccountInfo[]
  onAddFlow: (prefill: { sourceNodeName?: string; destNodeName?: string }) => void
  onEditFlow: (flow: CashFlowItem) => void
  onDeleteFlow: (flow: CashFlowItem) => void
  displayCurrency?: 'USD' | 'ILS'
  currencyConversionRate?: number
}

function formatCurrency(
  amount: number,
  itemCurrency: 'USD' | 'ILS',
  displayCurrency: 'USD' | 'ILS' = 'ILS',
  conversionRate: number = 3.7
): string {
  let displayAmount = amount

  // Convert if needed
  if (displayCurrency === 'ILS' && itemCurrency === 'USD') {
    displayAmount = amount * conversionRate
  } else if (displayCurrency === 'USD' && itemCurrency === 'ILS') {
    displayAmount = amount / conversionRate
  }

  const symbol = displayCurrency === 'ILS' ? '₪' : '$'
  return `${symbol}${displayAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function FlowItem({
  flow,
  type,
  onEdit,
  onDelete,
  displayCurrency,
  currencyConversionRate,
}: {
  flow: CashFlowItem
  type: 'inflow' | 'outflow'
  onEdit: (flow: CashFlowItem) => void
  onDelete: (flow: CashFlowItem) => void
  displayCurrency: 'USD' | 'ILS'
  currencyConversionRate: number
}) {
  const monthlyAmount = convertToMonthly(flow.amount, flow.frequency)
  const color = type === 'inflow' ? FLOW_COLORS.inflow : FLOW_COLORS.outflow
  const itemCurrency = flow.currency || 'ILS'

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(flow)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onEdit(flow)}
        className="flex-1 text-left p-2 rounded-md bg-gray-900 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {type === 'inflow' ? (
              <ArrowDownLeft className="w-4 h-4" style={{ color }} />
            ) : (
              <ArrowUpRight className="w-4 h-4" style={{ color }} />
            )}
            <span className="text-white text-sm font-medium">{flow.name}</span>
          </div>
          <span className="text-sm font-semibold" style={{ color }}>
            {formatCurrency(monthlyAmount, itemCurrency, displayCurrency, currencyConversionRate)}/mo
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <span>{FREQUENCY_LABELS[flow.frequency]}</span>
          {flow.percentage && <span>({flow.percentage}%)</span>}
        </div>
      </button>
      <button
        onClick={handleDelete}
        className="p-2 rounded-md text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
        title="Delete flow"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export function NodeInfoDialog({
  isOpen,
  onClose,
  nodeInfo,
  categories,
  accounts,
  onAddFlow,
  onEditFlow,
  onDeleteFlow,
  displayCurrency = 'ILS',
  currencyConversionRate = 3.7,
}: NodeInfoDialogProps) {
  // Calculate totals (convert all to display currency)
  const totals = useMemo(() => {
    if (!nodeInfo) return { inflows: 0, outflows: 0, net: 0 }

    const inflowTotal = nodeInfo.inflows.reduce((sum, flow) => {
      let amount = convertToMonthly(flow.amount, flow.frequency)
      const itemCurrency = flow.currency || 'ILS'

      // Convert to display currency
      if (displayCurrency === 'ILS' && itemCurrency === 'USD') {
        amount *= currencyConversionRate
      } else if (displayCurrency === 'USD' && itemCurrency === 'ILS') {
        amount /= currencyConversionRate
      }

      return sum + amount
    }, 0)

    const outflowTotal = nodeInfo.outflows.reduce((sum, flow) => {
      let amount = convertToMonthly(flow.amount, flow.frequency)
      const itemCurrency = flow.currency || 'ILS'

      // Convert to display currency
      if (displayCurrency === 'ILS' && itemCurrency === 'USD') {
        amount *= currencyConversionRate
      } else if (displayCurrency === 'USD' && itemCurrency === 'ILS') {
        amount /= currencyConversionRate
      }

      return sum + amount
    }, 0)

    return {
      inflows: inflowTotal,
      outflows: outflowTotal,
      net: inflowTotal - outflowTotal,
    }
  }, [nodeInfo, displayCurrency, currencyConversionRate])

  // Get node description
  const nodeDescription = useMemo(() => {
    if (!nodeInfo) return ''

    switch (nodeInfo.nodeType) {
      case 'income':
        return 'External income sources'
      case 'expenses':
        return 'External expense destinations'
      case 'account':
        const account = accounts.find((a) => a.name === nodeInfo.name)
        return account ? `Balance: ${formatCurrency(account.balance, displayCurrency, displayCurrency, currencyConversionRate)}` : 'Account'
      case 'category':
        const category = categories.find((c) => c.name === nodeInfo.name)
        return category?.type === 'inflow'
          ? 'Income category'
          : category?.type === 'outflow'
          ? 'Expense category'
          : 'Transfer category'
      default:
        return ''
    }
  }, [nodeInfo, accounts, categories])

  // Get node icon/color
  const nodeIcon = useMemo(() => {
    if (!nodeInfo) return null

    const category = categories.find((c) => c.name === nodeInfo.name)
    if (category?.icon) return category.icon

    switch (nodeInfo.nodeType) {
      case 'income':
        return '$'
      case 'expenses':
        return '$'
      case 'account':
        return '$'
      default:
        return null
    }
  }, [nodeInfo, categories])

  const handleAddFlowFrom = () => {
    if (!nodeInfo) return
    onAddFlow({ sourceNodeName: nodeInfo.name })
    onClose()
  }

  const handleAddFlowTo = () => {
    if (!nodeInfo) return
    onAddFlow({ destNodeName: nodeInfo.name })
    onClose()
  }

  if (!nodeInfo) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {nodeIcon && <span className="text-xl">{nodeIcon}</span>}
            {nodeInfo.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {nodeDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Inflows</div>
              <div className="text-lg font-semibold text-green-400">
                {formatCurrency(totals.inflows, displayCurrency, displayCurrency, currencyConversionRate)}
              </div>
              <div className="text-xs text-gray-500">per month</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Outflows</div>
              <div className="text-lg font-semibold text-red-400">
                {formatCurrency(totals.outflows, displayCurrency, displayCurrency, currencyConversionRate)}
              </div>
              <div className="text-xs text-gray-500">per month</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Net</div>
              <div
                className={`text-lg font-semibold ${
                  totals.net >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(totals.net, displayCurrency, displayCurrency, currencyConversionRate)}
              </div>
              <div className="text-xs text-gray-500">per month</div>
            </div>
          </div>

          {/* Inflows List */}
          {nodeInfo.inflows.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-green-400" />
                Inflows ({nodeInfo.inflows.length})
              </h4>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {nodeInfo.inflows.map((flow) => (
                  <FlowItem
                    key={flow.id}
                    flow={flow}
                    type="inflow"
                    onEdit={onEditFlow}
                    onDelete={onDeleteFlow}
                    displayCurrency={displayCurrency}
                    currencyConversionRate={currencyConversionRate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Outflows List */}
          {nodeInfo.outflows.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-red-400" />
                Outflows ({nodeInfo.outflows.length})
              </h4>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {nodeInfo.outflows.map((flow) => (
                  <FlowItem
                    key={flow.id}
                    flow={flow}
                    type="outflow"
                    onEdit={onEditFlow}
                    onDelete={onDeleteFlow}
                    displayCurrency={displayCurrency}
                    currencyConversionRate={currencyConversionRate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {nodeInfo.inflows.length === 0 && nodeInfo.outflows.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No flows through this node yet</p>
            </div>
          )}

          {/* Add Flow Buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-700">
            {nodeInfo.nodeType !== 'expenses' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddFlowFrom}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Flow From Here
              </Button>
            )}
            {nodeInfo.nodeType !== 'income' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddFlowTo}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Flow To Here
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
