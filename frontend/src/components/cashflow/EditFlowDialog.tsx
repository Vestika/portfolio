// Dialog for editing a cash flow item

import { useState, useEffect } from 'react'
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
import { AlertCircle, Calendar, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import type {
  CashFlowItem,
  CashFlowCategory,
  AccountInfo,
  FlowFrequency,
  FlowCurrency,
} from '../../types/cashflow'
import { FREQUENCY_LABELS } from '../../types/cashflow'

interface EditFlowDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (updatedFlow: CashFlowItem) => void
  onCreateCategory?: (newCategory: CashFlowCategory) => void
  onDeleteCategory?: (categoryId: string) => void
  flow: CashFlowItem | null
  categories: CashFlowCategory[]
  accounts: AccountInfo[]
}

interface FormData {
  name: string
  amount: string
  currency: FlowCurrency
  percentage: string
  usePercentage: boolean
  frequency: FlowFrequency
  categoryId: string
  sourceAccountId: string
  destinationAccountId: string
  isActive: boolean
  startDate: string
  endDate: string
  hasEndDate: boolean
  notes: string
}

const initialFormData: FormData = {
  name: '',
  amount: '',
  currency: 'ILS',
  percentage: '',
  usePercentage: false,
  frequency: 'monthly',
  categoryId: '',
  sourceAccountId: '',
  destinationAccountId: '',
  isActive: true,
  startDate: '',
  endDate: '',
  hasEndDate: false,
  notes: '',
}

export function EditFlowDialog({
  isOpen,
  onClose,
  onSave,
  onCreateCategory,
  onDeleteCategory,
  flow,
  categories,
  accounts,
}: EditFlowDialogProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️')

  // Populate form when flow changes
  useEffect(() => {
    if (flow) {
      const hasSchedule = !!(flow.startDate || flow.endDate)
      setFormData({
        name: flow.name,
        amount: flow.amount.toString(),
        currency: flow.currency || 'ILS',
        percentage: flow.percentage?.toString() || '',
        usePercentage: flow.percentage !== undefined,
        frequency: flow.frequency,
        categoryId: flow.categoryId || '',
        sourceAccountId: flow.sourceAccountId || '',
        destinationAccountId: flow.destinationAccountId || '',
        isActive: flow.isActive,
        startDate: flow.startDate ? flow.startDate.split('T')[0] : '',
        endDate: flow.endDate ? flow.endDate.split('T')[0] : '',
        hasEndDate: !!flow.endDate,
        notes: flow.notes || '',
      })
      setShowAdvanced(hasSchedule)
    } else {
      setFormData(initialFormData)
      setShowAdvanced(false)
    }
    setErrors({})
  }, [flow, isOpen])

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

    if (!validateForm() || !flow) return

    setIsSubmitting(true)

    const updatedFlow: CashFlowItem = {
      ...flow,
      name: formData.name.trim(),
      amount: formData.usePercentage ? 0 : parseFloat(formData.amount),
      currency: formData.currency,
      percentage: formData.usePercentage ? parseFloat(formData.percentage) : undefined,
      frequency: formData.frequency,
      categoryId: formData.categoryId || undefined,
      sourceAccountId: formData.sourceAccountId || undefined,
      destinationAccountId: formData.destinationAccountId || undefined,
      isActive: formData.isActive,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      endDate: formData.hasEndDate && formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      notes: formData.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }

    onSave(updatedFlow)
    setIsSubmitting(false)
    onClose()
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
    if (!newCategoryName.trim() || !onCreateCategory || !flow) return

    const newCategory: CashFlowCategory = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      type: flow.type,
      icon: newCategoryIcon,
      isCustom: true,
    }

    onCreateCategory(newCategory)
    setFormData({ ...formData, categoryId: newCategory.id })
    setShowCreateCategory(false)
    setNewCategoryName('')
    setNewCategoryIcon('🏷️')
  }

  // Filter categories based on flow type
  const filteredCategories = flow
    ? categories.filter((c) => c.type === flow.type)
    : categories

  const flowTypeLabel = flow?.type === 'inflow' ? 'Income' : flow?.type === 'outflow' ? 'Expense' : 'Transfer'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Edit {flowTypeLabel} Flow</DialogTitle>
          <DialogDescription className="text-gray-400">
            Modify the details of this cash flow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-200">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Monthly Salary"
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
              <Label htmlFor="frequency" className="text-gray-200">Frequency</Label>
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
            <Label htmlFor="category" className="text-gray-200">Category</Label>
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
                          setNewCategoryIcon('📁')
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
          {flow?.type !== 'inflow' && (
            <div className="space-y-2">
              <Label htmlFor="sourceAccount" className="text-gray-200">Source Account</Label>
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
            </div>
          )}

          {/* Destination Account (for inflows and transfers) */}
          {flow?.type !== 'outflow' && (
            <div className="space-y-2">
              <Label htmlFor="destAccount" className="text-gray-200">Destination Account</Label>
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
            <Label htmlFor="notes" className="text-gray-200">Notes (optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-700 bg-gray-900"
            />
            <Label htmlFor="isActive" className="text-gray-200 cursor-pointer">
              Active (include in calculations)
            </Label>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
