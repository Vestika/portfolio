// Dialog for splitting a cash flow into multiple flows

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { AlertCircle, Plus, Trash2, Split, GitBranch, Layers } from 'lucide-react'
import type {
  CashFlowItem,
  CashFlowCategory,
  AccountInfo,
  SankeyLinkInfo,
} from '../../types/cashflow'
import {
  splitFlowByAmount,
  splitFlowByDestination,
  calculateRemainingAmount,
  validateSplitAmounts,
  createCustomCategory,
} from '../../utils/cashflow-helpers'

interface SplitFlowDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (
    originalFlowId: string,
    newFlows: CashFlowItem[],
    newCategory?: CashFlowCategory
  ) => void
  linkInfo: SankeyLinkInfo | null
  categories: CashFlowCategory[]
  accounts: AccountInfo[]
}

type SplitTab = 'divide' | 'destinations' | 'intermediate'

interface AmountSplit {
  id: string
  name: string
  amount: string
}

interface DestinationSplit {
  id: string
  name: string
  amount: string
  destinationAccountId: string
  categoryId: string
}

interface IntermediateData {
  categoryName: string
  categoryIcon: string
  useExisting: boolean
  existingCategoryId: string
}

export function SplitFlowDialog({
  isOpen,
  onClose,
  onSave,
  linkInfo,
  categories,
  accounts,
}: SplitFlowDialogProps) {
  const [activeTab, setActiveTab] = useState<SplitTab>('divide')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get the first flow item from the link (for single-flow splits)
  const flow = linkInfo?.flowItems[0] || null

  // Amount split state
  const [amountSplits, setAmountSplits] = useState<AmountSplit[]>([
    { id: '1', name: '', amount: '' },
    { id: '2', name: '', amount: '' },
  ])

  // Destination split state
  const [destSplits, setDestSplits] = useState<DestinationSplit[]>([
    { id: '1', name: '', amount: '', destinationAccountId: '', categoryId: '' },
    { id: '2', name: '', amount: '', destinationAccountId: '', categoryId: '' },
  ])

  // Intermediate category state
  const [intermediateData, setIntermediateData] = useState<IntermediateData>({
    categoryName: '',
    categoryIcon: '',
    useExisting: true,
    existingCategoryId: '',
  })

  // Reset state when dialog opens/flow changes
  useEffect(() => {
    if (isOpen && flow) {
      const halfAmount = Math.floor(flow.amount / 2)
      setAmountSplits([
        { id: '1', name: `${flow.name} - Part 1`, amount: halfAmount.toString() },
        { id: '2', name: `${flow.name} - Part 2`, amount: (flow.amount - halfAmount).toString() },
      ])
      setDestSplits([
        { id: '1', name: `${flow.name} - 1`, amount: halfAmount.toString(), destinationAccountId: '', categoryId: flow.categoryId || '' },
        { id: '2', name: `${flow.name} - 2`, amount: (flow.amount - halfAmount).toString(), destinationAccountId: '', categoryId: flow.categoryId || '' },
      ])
      setIntermediateData({
        categoryName: '',
        categoryIcon: '',
        useExisting: true,
        existingCategoryId: '',
      })
      setError(null)
    }
  }, [isOpen, flow])

  // Filter categories by flow type
  const filteredCategories = useMemo(() => {
    if (!flow) return categories
    return categories.filter((c) => c.type === flow.type)
  }, [flow, categories])

  // ==================== Amount Split Handlers ====================

  const addAmountSplit = () => {
    setAmountSplits([
      ...amountSplits,
      { id: Date.now().toString(), name: '', amount: '' },
    ])
  }

  const removeAmountSplit = (id: string) => {
    if (amountSplits.length <= 2) return
    setAmountSplits(amountSplits.filter((s) => s.id !== id))
  }

  const updateAmountSplit = (id: string, field: keyof AmountSplit, value: string) => {
    setAmountSplits(
      amountSplits.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  const amountRemaining = useMemo(() => {
    if (!flow) return 0
    const splits = amountSplits.map((s) => ({ amount: parseFloat(s.amount) || 0 }))
    return calculateRemainingAmount(flow.amount, splits)
  }, [flow, amountSplits])

  // ==================== Destination Split Handlers ====================

  const addDestSplit = () => {
    setDestSplits([
      ...destSplits,
      { id: Date.now().toString(), name: '', amount: '', destinationAccountId: '', categoryId: flow?.categoryId || '' },
    ])
  }

  const removeDestSplit = (id: string) => {
    if (destSplits.length <= 2) return
    setDestSplits(destSplits.filter((s) => s.id !== id))
  }

  const updateDestSplit = (id: string, field: keyof DestinationSplit, value: string) => {
    setDestSplits(
      destSplits.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  const destRemaining = useMemo(() => {
    if (!flow) return 0
    const splits = destSplits.map((s) => ({ amount: parseFloat(s.amount) || 0 }))
    return calculateRemainingAmount(flow.amount, splits)
  }, [flow, destSplits])

  // ==================== Submit Handlers ====================

  const handleSubmit = () => {
    if (!flow) return

    setError(null)
    setIsSubmitting(true)

    try {
      let newFlows: CashFlowItem[] = []
      let newCategory: CashFlowCategory | undefined

      if (activeTab === 'divide') {
        // Validate amounts
        const splits = amountSplits.map((s) => ({
          name: s.name.trim() || `${flow.name} Split`,
          amount: parseFloat(s.amount) || 0,
        }))
        const validation = validateSplitAmounts(flow.amount, splits)
        if (!validation.valid) {
          setError(validation.error || 'Invalid split amounts')
          setIsSubmitting(false)
          return
        }

        newFlows = splitFlowByAmount(flow, splits)
      } else if (activeTab === 'destinations') {
        // Validate amounts
        const splits = destSplits.map((s) => ({
          name: s.name.trim() || `${flow.name} Split`,
          amount: parseFloat(s.amount) || 0,
          destinationAccountId: s.destinationAccountId || undefined,
          categoryId: s.categoryId || undefined,
        }))
        const validation = validateSplitAmounts(flow.amount, splits)
        if (!validation.valid) {
          setError(validation.error || 'Invalid split amounts')
          setIsSubmitting(false)
          return
        }

        newFlows = splitFlowByDestination(flow, splits)
      } else if (activeTab === 'intermediate') {
        // Create or use existing category
        if (intermediateData.useExisting) {
          if (!intermediateData.existingCategoryId) {
            setError('Please select a category')
            setIsSubmitting(false)
            return
          }
          // Just update the flow's category
          newFlows = [{
            ...flow,
            categoryId: intermediateData.existingCategoryId,
            updatedAt: new Date().toISOString(),
          }]
        } else {
          if (!intermediateData.categoryName.trim()) {
            setError('Please enter a category name')
            setIsSubmitting(false)
            return
          }
          // Create new category
          newCategory = createCustomCategory(
            intermediateData.categoryName.trim(),
            flow.type,
            intermediateData.categoryIcon || undefined
          )
          newFlows = [{
            ...flow,
            categoryId: newCategory.id,
            updatedAt: new Date().toISOString(),
          }]
        }
      }

      onSave(flow.id, newFlows, newCategory)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split flow')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setAmountSplits([
      { id: '1', name: '', amount: '' },
      { id: '2', name: '', amount: '' },
    ])
    setDestSplits([
      { id: '1', name: '', amount: '', destinationAccountId: '', categoryId: '' },
      { id: '2', name: '', amount: '', destinationAccountId: '', categoryId: '' },
    ])
    setError(null)
    onClose()
  }

  if (!flow) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Split className="w-5 h-5" />
            Split Flow
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Split "{flow.name}" (${flow.amount.toLocaleString()}/
            {flow.frequency === 'monthly' ? 'mo' : flow.frequency})
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SplitTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900">
            <TabsTrigger value="divide" className="flex items-center gap-1 data-[state=active]:bg-gray-700">
              <Split className="w-3 h-3" />
              Divide
            </TabsTrigger>
            <TabsTrigger value="destinations" className="flex items-center gap-1 data-[state=active]:bg-gray-700">
              <GitBranch className="w-3 h-3" />
              Destinations
            </TabsTrigger>
            <TabsTrigger value="intermediate" className="flex items-center gap-1 data-[state=active]:bg-gray-700">
              <Layers className="w-3 h-3" />
              Category
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Divide Amount */}
          <TabsContent value="divide" className="space-y-4 mt-4">
            <p className="text-sm text-gray-400">
              Split this flow into multiple parts with different names.
            </p>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {amountSplits.map((split, index) => (
                <div key={split.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder={`Part ${index + 1} name`}
                      value={split.name}
                      onChange={(e) => updateAmountSplit(split.id, 'name', e.target.value)}
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div className="w-32">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={split.amount}
                        onChange={(e) => updateAmountSplit(split.id, 'amount', e.target.value)}
                        className="bg-gray-900 border-gray-700 text-white pl-7"
                      />
                    </div>
                  </div>
                  {amountSplits.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAmountSplit(split.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAmountSplit}
                className="border-gray-600 text-gray-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Split
              </Button>
              <div className={`text-sm ${amountRemaining < 0 ? 'text-red-400' : amountRemaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {amountRemaining === 0
                  ? 'Amounts match!'
                  : amountRemaining > 0
                  ? `$${amountRemaining.toLocaleString()} remaining`
                  : `$${Math.abs(amountRemaining).toLocaleString()} over budget`}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Multiple Destinations */}
          <TabsContent value="destinations" className="space-y-4 mt-4">
            <p className="text-sm text-gray-400">
              Send portions of this flow to different accounts or categories.
            </p>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {destSplits.map((split, index) => (
                <div key={split.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Split {index + 1}</span>
                    {destSplits.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDestSplit(split.id)}
                        className="h-6 w-6 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Name"
                      value={split.name}
                      onChange={(e) => updateDestSplit(split.id, 'name', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={split.amount}
                        onChange={(e) => updateDestSplit(split.id, 'amount', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white pl-7"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={split.categoryId}
                      onValueChange={(value) => updateDestSplit(split.id, 'categoryId', value)}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {filteredCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="text-white">
                            {cat.icon} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={split.destinationAccountId}
                      onValueChange={(value) => updateDestSplit(split.id, 'destinationAccountId', value)}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Destination" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} className="text-white">
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDestSplit}
                className="border-gray-600 text-gray-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Destination
              </Button>
              <div className={`text-sm ${destRemaining < 0 ? 'text-red-400' : destRemaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {destRemaining === 0
                  ? 'Amounts match!'
                  : destRemaining > 0
                  ? `$${destRemaining.toLocaleString()} remaining`
                  : `$${Math.abs(destRemaining).toLocaleString()} over budget`}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Add Intermediate Category */}
          <TabsContent value="intermediate" className="space-y-4 mt-4">
            <p className="text-sm text-gray-400">
              Add or change the category for this flow to better organize your cash flows.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={intermediateData.useExisting}
                    onChange={() => setIntermediateData({ ...intermediateData, useExisting: true })}
                    className="text-blue-600"
                  />
                  <span className="text-gray-200">Use existing category</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!intermediateData.useExisting}
                    onChange={() => setIntermediateData({ ...intermediateData, useExisting: false })}
                    className="text-blue-600"
                  />
                  <span className="text-gray-200">Create new category</span>
                </label>
              </div>

              {intermediateData.useExisting ? (
                <div className="space-y-2">
                  <Label className="text-gray-200">Select Category</Label>
                  <Select
                    value={intermediateData.existingCategoryId}
                    onValueChange={(value) =>
                      setIntermediateData({ ...intermediateData, existingCategoryId: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-white">
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-gray-200">Category Name</Label>
                    <Input
                      placeholder="e.g., Home Office Setup"
                      value={intermediateData.categoryName}
                      onChange={(e) =>
                        setIntermediateData({ ...intermediateData, categoryName: e.target.value })
                      }
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Icon (optional)</Label>
                    <Input
                      placeholder="Enter an emoji..."
                      value={intermediateData.categoryIcon}
                      onChange={(e) =>
                        setIntermediateData({ ...intermediateData, categoryIcon: e.target.value })
                      }
                      className="bg-gray-900 border-gray-700 text-white w-24"
                      maxLength={2}
                    />
                  </div>
                </div>
              )}

              {flow.categoryId && (
                <p className="text-xs text-gray-500">
                  Current category:{' '}
                  {categories.find((c) => c.id === flow.categoryId)?.name || 'Unknown'}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

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
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? 'Splitting...' : 'Split Flow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
