// Dialog for adding a new cash flow item

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { AlertCircle, Plus, Calendar, ChevronDown, ChevronRight, X } from 'lucide-react'
import type {
  CashFlowItem,
  CashFlowCategory,
  AccountInfo,
  FlowFrequency,
  FlowType,
  FlowCurrency,
} from '../../types/cashflow'
import { FREQUENCY_LABELS } from '../../types/cashflow'

interface AddFlowDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (newFlow: CashFlowItem) => void
  onCreateCategory?: (newCategory: CashFlowCategory) => void
  onDeleteCategory?: (categoryId: string) => void
  categories: CashFlowCategory[]
  accounts: AccountInfo[]
  prefill?: {
    sourceNodeName?: string
    destNodeName?: string
  }
}

interface FormData {
  name: string
  type: FlowType
  amount: string
  currency: FlowCurrency
  percentage: string
  usePercentage: boolean
  frequency: FlowFrequency
  categoryId: string
  sourceAccountId: string
  destinationAccountId: string
  startDate: string
  endDate: string
  hasEndDate: boolean
  notes: string
}

const initialFormData: FormData = {
  name: '',
  type: 'outflow',
  amount: '',
  currency: 'ILS',
  percentage: '',
  usePercentage: false,
  frequency: 'monthly',
  categoryId: '',
  sourceAccountId: '',
  destinationAccountId: '',
  startDate: '',
  endDate: '',
  hasEndDate: false,
  notes: '',
}

export function AddFlowDialog({
  isOpen,
  onClose,
  onSave,
  onCreateCategory,
  onDeleteCategory,
  categories,
  accounts,
  prefill,
}: AddFlowDialogProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️')

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      let initialType: FlowType = 'outflow'
      let sourceAccountId = ''
      let destinationAccountId = ''

      // Handle prefill from node click
      if (prefill?.sourceNodeName) {
        const sourceAccount = accounts.find((a) => a.name === prefill.sourceNodeName)
        if (sourceAccount) {
          sourceAccountId = sourceAccount.id
          initialType = 'outflow' // Default to outflow when source is set
        } else if (prefill.sourceNodeName === 'Income') {
          initialType = 'inflow'
        }
      }

      if (prefill?.destNodeName) {
        const destAccount = accounts.find((a) => a.name === prefill.destNodeName)
        if (destAccount) {
          destinationAccountId = destAccount.id
          initialType = 'inflow' // Default to inflow when destination is set
        } else if (prefill.destNodeName === 'Expenses') {
          initialType = 'outflow'
        }
      }

      // Check for transfer (both source and dest are accounts)
      if (sourceAccountId && destinationAccountId) {
        initialType = 'transfer'
      }

      setFormData({
        ...initialFormData,
        type: initialType,
        sourceAccountId,
        destinationAccountId,
      })
      setErrors({})
    }
  }, [isOpen, prefill, accounts])

  // Filter categories by flow type
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === formData.type)
  }, [categories, formData.type])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (formData.usePercentage) {
      const pct = parseFloat(formData.percentage)
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        newErrors.percentage = 'Percentage must be between 0 and 100'
      }
    } else {
      const amt = parseFloat(formData.amount)
      if (isNaN(amt) || amt <= 0) {
        newErrors.amount = 'Amount must be a positive number'
      }
    }

    // Validate source/destination based on flow type
    if (formData.type === 'transfer') {
      if (!formData.sourceAccountId) {
        newErrors.sourceAccountId = 'Source account is required for transfers'
      }
      if (!formData.destinationAccountId) {
        newErrors.destinationAccountId = 'Destination account is required for transfers'
      }
      if (formData.sourceAccountId === formData.destinationAccountId) {
        newErrors.destinationAccountId = 'Source and destination must be different'
      }
    }

    // Validate dates
    if (formData.startDate && formData.hasEndDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        newErrors.endDate = 'End date must be after start date'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    const newFlow: CashFlowItem = {
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      type: formData.type,
      amount: formData.usePercentage ? 0 : parseFloat(formData.amount),
      currency: formData.currency,
      percentage: formData.usePercentage ? parseFloat(formData.percentage) : undefined,
      frequency: formData.frequency,
      categoryId: formData.categoryId || undefined,
      sourceAccountId: formData.type !== 'inflow' ? (formData.sourceAccountId || undefined) : undefined,
      destinationAccountId: formData.type !== 'outflow' ? (formData.destinationAccountId || undefined) : undefined,
      isActive: true,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      endDate: formData.hasEndDate && formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      notes: formData.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onSave(newFlow)
    setIsSubmitting(false)
    handleClose()
  }

  const handleClose = () => {
    setFormData(initialFormData)
    setErrors({})
    setShowCreateCategory(false)
    setNewCategoryName('')
    setNewCategoryIcon('🏷️')
    onClose()
  }

  const handleCreateCategory = () => {
    if (!newCategoryName.trim() || !onCreateCategory) return

    const newCategory: CashFlowCategory = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      type: formData.type,
      icon: newCategoryIcon,
      isCustom: true,
    }

    onCreateCategory(newCategory)
    setFormData({ ...formData, categoryId: newCategory.id })
    setShowCreateCategory(false)
    setNewCategoryName('')
    setNewCategoryIcon('🏷️')
  }

  const flowTypeLabel =
    formData.type === 'inflow' ? 'Income' : formData.type === 'outflow' ? 'Expense' : 'Transfer'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Flow
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new cash flow to track your income, expenses, or transfers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Flow Type */}
          <div className="space-y-2">
            <Label className="text-gray-200">Flow Type</Label>
            <div className="flex gap-2">
              {(['inflow', 'outflow', 'transfer'] as FlowType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, type, categoryId: '' })}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    formData.type === type
                      ? type === 'inflow'
                        ? 'bg-green-600 text-white'
                        : type === 'outflow'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                >
                  {type === 'inflow' ? 'Income' : type === 'outflow' ? 'Expense' : 'Transfer'}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-200">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={`e.g., ${
                formData.type === 'inflow'
                  ? 'Monthly Salary'
                  : formData.type === 'outflow'
                  ? 'Rent Payment'
                  : '401k Contribution'
              }`}
              className="bg-gray-900 border-gray-700 text-white"
            />
            {errors.name && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Amount / Percentage with Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-200">
                {formData.usePercentage ? 'Percentage' : 'Amount'}
              </Label>
              <div className="flex gap-2">
                {!formData.usePercentage && (
                  <div className="flex bg-gray-900 rounded-md border border-gray-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, currency: 'USD' })}
                      className={`px-2 py-2 text-sm font-medium transition-colors ${
                        formData.currency === 'USD'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, currency: 'ILS' })}
                      className={`px-2 py-2 text-sm font-medium transition-colors ${
                        formData.currency === 'ILS'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      ₪
                    </button>
                  </div>
                )}
                <div className="relative flex-1">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.usePercentage ? formData.percentage : formData.amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [formData.usePercentage ? 'percentage' : 'amount']: e.target.value,
                      })
                    }
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                  {formData.usePercentage && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  )}
                </div>
              </div>
              {(errors.amount || errors.percentage) && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.amount || errors.percentage}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency" className="text-gray-200">
                Frequency
              </Label>
              <Select
                value={formData.frequency}
                onValueChange={(value: FlowFrequency) =>
                  setFormData({ ...formData, frequency: value })
                }
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-white">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-gray-200">
              Category
            </Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id} className="text-white group">
                    <div className="flex items-center justify-between w-full">
                      <span>{category.icon} {category.name}</span>
                      {category.isCustom && onDeleteCategory && (
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (confirm(`Delete category "${category.name}"?`)) {
                              onDeleteCategory(category.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 ml-2 p-1 rounded hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {onCreateCategory && !showCreateCategory && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowCreateCategory(true)
                    }}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-700 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Category
                  </button>
                )}
                {showCreateCategory && (
                  <div className="p-2 border-t border-gray-700">
                    <Input
                      placeholder="Category name (Enter to create, Esc to cancel)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white text-sm h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateCategory()
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          setShowCreateCategory(false)
                          setNewCategoryName('')
                          setNewCategoryIcon('🏷️')
                        }
                      }}
                      autoFocus
                    />
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Source Account (for outflows and transfers) */}
          {formData.type !== 'inflow' && (
            <div className="space-y-2">
              <Label htmlFor="sourceAccount" className="text-gray-200">
                Source Account
              </Label>
              <Select
                value={formData.sourceAccountId}
                onValueChange={(value) => setFormData({ ...formData, sourceAccountId: value })}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select source account..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id} className="text-white">
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sourceAccountId && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.sourceAccountId}
                </p>
              )}
            </div>
          )}

          {/* Destination Account (for inflows and transfers) */}
          {formData.type !== 'outflow' && (
            <div className="space-y-2">
              <Label htmlFor="destAccount" className="text-gray-200">
                Destination Account
              </Label>
              <Select
                value={formData.destinationAccountId}
                onValueChange={(value) => setFormData({ ...formData, destinationAccountId: value })}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select destination account..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id} className="text-white">
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.destinationAccountId && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.destinationAccountId}
                </p>
              )}
            </div>
          )}

          {/* Advanced Options (collapsible) */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
            >
              <div className="flex items-center gap-2 text-gray-300">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Schedule</span>
                <span className="text-xs text-gray-500">(optional)</span>
                {(formData.startDate || formData.hasEndDate) && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Set</span>
                )}
              </div>
              {showAdvanced ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-3 bg-gray-900/50 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-gray-200 text-sm">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="endDate" className="text-gray-200 text-sm">End Date</Label>
                      <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.hasEndDate}
                          onChange={(e) => setFormData({ ...formData, hasEndDate: e.target.checked, endDate: e.target.checked ? formData.endDate : '' })}
                          className="rounded border-gray-700 bg-gray-800 w-3 h-3"
                        />
                        Has end
                      </label>
                    </div>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      disabled={!formData.hasEndDate}
                      className="bg-gray-800 border-gray-700 text-white disabled:opacity-50"
                    />
                    {errors.endDate && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.endDate}
                      </p>
                    )}
                  </div>
                </div>
                {!formData.startDate && !formData.hasEndDate && (
                  <p className="text-xs text-gray-500">No schedule set - flow runs indefinitely</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-200">
              Notes (optional)
            </Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Adding...' : `Add ${flowTypeLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
