// Cash Flow Table - Editable spreadsheet-style table for cash flow items

import { useState, useCallback, useMemo } from 'react'
import type {
  CashFlowItem,
  CashFlowCategory,
  AccountInfo,
  FlowType,
  FlowFrequency,
  FlowCurrency,
  TimePeriod,
} from '../../types/cashflow'
import { FREQUENCY_LABELS, FREQUENCY_MULTIPLIERS } from '../../types/cashflow'
import { Trash2, Plus, ChevronUp, ChevronDown, Check, X } from 'lucide-react'

interface CashFlowTableProps {
  items: CashFlowItem[]
  categories: CashFlowCategory[]
  accounts: AccountInfo[]
  displayCurrency: 'USD' | 'ILS'
  timePeriod?: TimePeriod
  currencyConversionRate: number
  onUpdateItem: (id: string, updates: Partial<CashFlowItem>) => void
  onDeleteItem: (id: string) => void
  onAddItem: () => void
}

type SortColumn = 'name' | 'type' | 'amount' | 'frequency' | 'category' | 'source' | 'destination'
type SortDirection = 'asc' | 'desc'

// Editable cell component
interface EditableCellProps {
  value: string | number
  type: 'text' | 'number'
  onSave: (value: string | number) => void
  className?: string
  min?: number
  step?: number
}

function EditableCell({ value, type, onSave, className = '', min, step }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value))

  const handleSave = useCallback(() => {
    const newValue = type === 'number' ? parseFloat(editValue) || 0 : editValue
    if (newValue !== value) {
      onSave(newValue)
    }
    setIsEditing(false)
  }, [editValue, onSave, type, value])

  const handleCancel = useCallback(() => {
    setEditValue(String(value))
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          min={min}
          step={step}
          className="w-full bg-gray-700 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-gray-700 px-2 py-1 rounded transition-colors ${className}`}
      title="Click to edit"
    >
      {value}
    </div>
  )
}

// Dropdown cell component
interface DropdownCellProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onSave: (value: T) => void
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
}

function DropdownCell<T extends string>({
  value,
  options,
  onSave,
  className = '',
  allowEmpty = false,
  emptyLabel = 'None',
}: DropdownCellProps<T>) {
  const [isEditing, setIsEditing] = useState(false)

  const handleChange = useCallback((newValue: string) => {
    onSave(newValue as T)
    setIsEditing(false)
  }, [onSave])

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || (allowEmpty ? emptyLabel : value)

  if (isEditing) {
    return (
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        autoFocus
        className="w-full bg-gray-700 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-gray-700 px-2 py-1 rounded transition-colors ${className}`}
      title="Click to edit"
    >
      {displayValue}
    </div>
  )
}

// Toggle cell component
interface ToggleCellProps {
  value: boolean
  onToggle: (value: boolean) => void
}

function ToggleCell({ value, onToggle }: ToggleCellProps) {
  return (
    <button
      onClick={() => onToggle(!value)}
      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
        value
          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
      }`}
      title={value ? 'Active - click to deactivate' : 'Inactive - click to activate'}
    >
      {value ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
    </button>
  )
}

export function CashFlowTable({
  items,
  categories,
  accounts,
  displayCurrency,
  timePeriod = 'monthly',
  currencyConversionRate,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
}: CashFlowTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Calculate period multiplier and label
  const periodMultiplier = timePeriod === 'yearly' ? 12 : 1
  const periodLabel = timePeriod === 'yearly' ? 'Yearly' : 'Monthly'

  // Build options for dropdowns
  const typeOptions: { value: FlowType; label: string }[] = [
    { value: 'inflow', label: 'Inflow' },
    { value: 'outflow', label: 'Outflow' },
    { value: 'transfer', label: 'Transfer' },
  ]

  const frequencyOptions: { value: FlowFrequency; label: string }[] = [
    { value: 'weekly', label: FREQUENCY_LABELS.weekly },
    { value: 'bi-weekly', label: FREQUENCY_LABELS['bi-weekly'] },
    { value: 'monthly', label: FREQUENCY_LABELS.monthly },
    { value: 'yearly', label: FREQUENCY_LABELS.yearly },
  ]

  const currencyOptions: { value: FlowCurrency; label: string }[] = [
    { value: 'USD', label: '$ USD' },
    { value: 'ILS', label: '₪ ILS' },
  ]

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({
      value: cat.id,
      label: `${cat.icon || ''} ${cat.name}`.trim(),
    }))
  }, [categories])

  const accountOptions = useMemo(() => {
    return accounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
    }))
  }, [accounts])

  // Get category name by id
  const getCategoryName = useCallback((categoryId?: string) => {
    if (!categoryId) return '-'
    const category = categories.find((c) => c.id === categoryId)
    return category ? `${category.icon || ''} ${category.name}`.trim() : '-'
  }, [categories])

  // Get account name by id
  const getAccountName = useCallback((accountId?: string) => {
    if (!accountId) return '-'
    const account = accounts.find((a) => a.id === accountId)
    return account?.name || '-'
  }, [accounts])

  // Calculate display amount based on period
  const getDisplayAmount = useCallback((item: CashFlowItem): number => {
    const monthlyAmount = item.amount * FREQUENCY_MULTIPLIERS[item.frequency]
    return monthlyAmount * periodMultiplier
  }, [periodMultiplier])

  // Format amount for display
  const formatAmount = useCallback((amount: number, itemCurrency: FlowCurrency): string => {
    // Convert if needed
    let displayAmount = amount
    if (displayCurrency === 'ILS' && itemCurrency === 'USD') {
      displayAmount = amount * currencyConversionRate
    } else if (displayCurrency === 'USD' && itemCurrency === 'ILS') {
      displayAmount = amount / currencyConversionRate
    }
    const symbol = displayCurrency === 'ILS' ? '₪' : '$'
    return `${symbol}${displayAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }, [displayCurrency, currencyConversionRate])

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'amount':
          aVal = getDisplayAmount(a)
          bVal = getDisplayAmount(b)
          break
        case 'frequency':
          aVal = a.frequency
          bVal = b.frequency
          break
        case 'category':
          aVal = getCategoryName(a.categoryId).toLowerCase()
          bVal = getCategoryName(b.categoryId).toLowerCase()
          break
        case 'source':
          aVal = getAccountName(a.sourceAccountId).toLowerCase()
          bVal = getAccountName(b.sourceAccountId).toLowerCase()
          break
        case 'destination':
          aVal = getAccountName(a.destinationAccountId).toLowerCase()
          bVal = getAccountName(b.destinationAccountId).toLowerCase()
          break
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [items, sortColumn, sortDirection, getDisplayAmount, getCategoryName, getAccountName])

  // Handle column header click for sorting
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn])

  // Render sort indicator
  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline-block ml-1" />
    )
  }

  // Handle delete with confirmation
  const handleDelete = useCallback((item: CashFlowItem) => {
    const confirmed = window.confirm(`Delete "${item.name}"?`)
    if (confirmed) {
      onDeleteItem(item.id)
    }
  }, [onDeleteItem])

  // Get type color
  const getTypeColor = (type: FlowType): string => {
    switch (type) {
      case 'inflow':
        return 'text-green-400'
      case 'outflow':
        return 'text-red-400'
      case 'transfer':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/50 border-b border-gray-700">
              <th
                className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('name')}
              >
                Name {renderSortIndicator('name')}
              </th>
              <th
                className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('type')}
              >
                Type {renderSortIndicator('type')}
              </th>
              <th
                className="px-3 py-2 text-right text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('amount')}
              >
                Amount {renderSortIndicator('amount')}
              </th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Currency</th>
              <th
                className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('frequency')}
              >
                Frequency {renderSortIndicator('frequency')}
              </th>
              <th
                className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('category')}
              >
                Category {renderSortIndicator('category')}
              </th>
              <th
                className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('source')}
              >
                Source {renderSortIndicator('source')}
              </th>
              <th
                className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('destination')}
              >
                Destination {renderSortIndicator('destination')}
              </th>
              <th className="px-3 py-2 text-center text-gray-400 font-medium">Active</th>
              <th className="px-3 py-2 text-right text-gray-400 font-medium">{periodLabel}</th>
              <th className="px-3 py-2 text-center text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-400 font-medium">No Cash Flows Yet</p>
                    <p className="text-gray-500 text-sm">Add income, expenses, and transfers to visualize your cash flow.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                    !item.isActive ? 'opacity-50' : ''
                  }`}
                >
                  {/* Name */}
                  <td className="px-3 py-2">
                    <EditableCell
                      value={item.name}
                      type="text"
                      onSave={(value) => onUpdateItem(item.id, { name: String(value) })}
                      className="font-medium text-white"
                    />
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2">
                    <DropdownCell
                      value={item.type}
                      options={typeOptions}
                      onSave={(value) => onUpdateItem(item.id, { type: value })}
                      className={getTypeColor(item.type)}
                    />
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2 text-right">
                    <EditableCell
                      value={item.amount}
                      type="number"
                      min={0}
                      step={100}
                      onSave={(value) => onUpdateItem(item.id, { amount: Number(value) })}
                      className="text-white"
                    />
                  </td>

                  {/* Currency */}
                  <td className="px-3 py-2">
                    <DropdownCell
                      value={item.currency}
                      options={currencyOptions}
                      onSave={(value) => onUpdateItem(item.id, { currency: value })}
                    />
                  </td>

                  {/* Frequency */}
                  <td className="px-3 py-2">
                    <DropdownCell
                      value={item.frequency}
                      options={frequencyOptions}
                      onSave={(value) => onUpdateItem(item.id, { frequency: value })}
                    />
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2">
                    <DropdownCell
                      value={item.categoryId || ''}
                      options={categoryOptions}
                      onSave={(value) => onUpdateItem(item.id, { categoryId: value || undefined })}
                      allowEmpty
                      emptyLabel="No category"
                    />
                  </td>

                  {/* Source Account */}
                  <td className="px-3 py-2">
                    <DropdownCell
                      value={item.sourceAccountId || ''}
                      options={accountOptions}
                      onSave={(value) => onUpdateItem(item.id, { sourceAccountId: value || undefined })}
                      allowEmpty
                      emptyLabel="External"
                    />
                  </td>

                  {/* Destination Account */}
                  <td className="px-3 py-2">
                    <DropdownCell
                      value={item.destinationAccountId || ''}
                      options={accountOptions}
                      onSave={(value) => onUpdateItem(item.id, { destinationAccountId: value || undefined })}
                      allowEmpty
                      emptyLabel="External"
                    />
                  </td>

                  {/* Active Toggle */}
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                      <ToggleCell
                        value={item.isActive}
                        onToggle={(value) => onUpdateItem(item.id, { isActive: value })}
                      />
                    </div>
                  </td>

                  {/* Period Amount (Read-only) */}
                  <td className="px-3 py-2 text-right">
                    <span className={`font-medium ${getTypeColor(item.type)}`}>
                      {formatAmount(getDisplayAmount(item), item.currency)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete flow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <div className="border-t border-gray-700 p-3">
        <button
          onClick={onAddItem}
          className="w-full py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Flow
        </button>
      </div>
    </div>
  )
}
