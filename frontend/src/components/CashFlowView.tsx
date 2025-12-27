// Cash Flow View - Main navigation tab component with scenario management

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { usePortfolioData, type AccountData, type PriceData } from '../contexts/PortfolioDataContext'
import type {
  CashFlowItem,
  CashFlowCategory,
  CashFlowScenario,
  DraftCashFlowScenario,
  AccountInfo,
  ViewMode,
  TimePeriod,
  SankeyLinkInfo,
  SankeyNodeInfo,
} from '../types/cashflow'
import {
  DEFAULT_INFLOW_CATEGORIES,
  DEFAULT_OUTFLOW_CATEGORIES,
  DEFAULT_TRANSFER_CATEGORIES,
} from '../types/cashflow'
import {
  calculateMonthlyTotals,
} from '../utils/cashflow-helpers'
import * as cashFlowApi from '../utils/cash-flow-api'
import { ChevronDown, Table as TableIcon, Network, Trash2, Plus, X, Loader2, Download, Upload, MoreVertical } from 'lucide-react'
import { CashFlowSankeyChart } from './CashFlowSankeyChart'
import { FlowContextMenu } from './cashflow/FlowContextMenu'
import { EditFlowDialog } from './cashflow/EditFlowDialog'
import { SplitFlowDialog } from './cashflow/SplitFlowDialog'
import { NodeInfoDialog } from './cashflow/NodeInfoDialog'
import { AddFlowDialog } from './cashflow/AddFlowDialog'
import { CashFlowTable } from './cashflow/CashFlowTable'

// Generate default categories with IDs
function generateDefaultCategories(): CashFlowCategory[] {
  const categories: CashFlowCategory[] = []

  DEFAULT_INFLOW_CATEGORIES.forEach((cat, idx) => {
    categories.push({ ...cat, id: `default-inflow-${idx}`, isCustom: false })
  })
  DEFAULT_OUTFLOW_CATEGORIES.forEach((cat, idx) => {
    categories.push({ ...cat, id: `default-outflow-${idx}`, isCustom: false })
  })
  DEFAULT_TRANSFER_CATEGORIES.forEach((cat, idx) => {
    categories.push({ ...cat, id: `default-transfer-${idx}`, isCustom: false })
  })

  return categories
}

export function CashFlowView() {
  const {
    allPortfoliosData,
    getAvailablePortfolios,
  } = usePortfolioData()

  const availablePortfolios = getAvailablePortfolios()
  const defaultPortfolioId = availablePortfolios[0]?.portfolio_id || ''

  // Portfolio state
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(defaultPortfolioId)

  // Scenario state
  const [savedScenarios, setSavedScenarios] = useState<CashFlowScenario[]>([])
  const [draftScenarios, setDraftScenarios] = useState<DraftCashFlowScenario[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingTabName, setEditingTabName] = useState(false)
  const tabNameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('diagram')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly')
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'ILS'>('ILS')
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  // Dialog states
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedLinkInfo, setSelectedLinkInfo] = useState<SankeyLinkInfo | null>(null)
  const [editFlowOpen, setEditFlowOpen] = useState(false)
  const [splitFlowOpen, setSplitFlowOpen] = useState(false)
  const [nodeInfoOpen, setNodeInfoOpen] = useState(false)
  const [addFlowOpen, setAddFlowOpen] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState<CashFlowItem | null>(null)
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<SankeyNodeInfo | null>(null)
  const [addFlowPrefill, setAddFlowPrefill] = useState<{ sourceNodeName?: string; destNodeName?: string } | undefined>(undefined)

  // Get current portfolio data
  const portfolio = useMemo(() => {
    if (!allPortfoliosData || !selectedPortfolioId) return null
    return allPortfoliosData.portfolios?.[selectedPortfolioId] || null
  }, [allPortfoliosData, selectedPortfolioId])

  const baseCurrency = portfolio?.portfolio_metadata?.base_currency || 'USD'

  // Currency conversion rate
  const USD_TO_ILS_RATE = 3.7

  // Format currency helper (amount is already in displayCurrency)
  const formatAmount = useCallback(
    (amount: number): string => {
      const symbol = displayCurrency === 'ILS' ? '₪' : '$'
      return `${symbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    },
    [displayCurrency]
  )

  // Get current scenario
  const currentScenario = useMemo(() => {
    // Check drafts first
    const draft = draftScenarios.find(d => d.localId === activeTabId)
    if (draft) return draft

    // Check saved scenarios (with possible local edits tracked in drafts)
    const savedWithEdits = draftScenarios.find(d => d.scenarioId === activeTabId)
    if (savedWithEdits) return savedWithEdits

    const saved = savedScenarios.find(s => s.scenarioId === activeTabId)
    if (saved) return { ...saved, localId: saved.scenarioId!, isDirty: false } as DraftCashFlowScenario

    // Return first available or null
    if (draftScenarios.length > 0) return draftScenarios[0]
    if (savedScenarios.length > 0) {
      const first = savedScenarios[0]
      return { ...first, localId: first.scenarioId!, isDirty: false } as DraftCashFlowScenario
    }

    return null
  }, [activeTabId, draftScenarios, savedScenarios])

  // Extract accounts from portfolio data
  const accounts: AccountInfo[] = useMemo(() => {
    if (!portfolio || !allPortfoliosData) return []

    const currentPrices = (allPortfoliosData.global_current_prices || {}) as Record<string, PriceData>

    return (portfolio.accounts || []).map((account: AccountData) => {
      const holdings = account.holdings || []
      const holdingsValue = holdings.reduce((acc: number, h) => {
        const price = currentPrices[h.symbol]?.price || 0
        return acc + h.units * price
      }, 0)

      const cashValue = Object.values(account.account_cash || {}).reduce(
        (sum: number, val: number) => sum + val,
        0
      )

      return {
        id: account.account_name,
        name: account.account_name,
        type: account.account_type || 'bank-account',
        balance: holdingsValue + cashValue,
        currency: baseCurrency,
      }
    })
  }, [portfolio, allPortfoliosData, baseCurrency])

  // Account balances map
  const accountBalances = useMemo(() => {
    const map = new Map<string, number>()
    accounts.forEach((account) => {
      map.set(account.id, account.balance)
    })
    return map
  }, [accounts])

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    if (!currentScenario) return { inflows: 0, outflows: 0, transfers: 0, net: 0 }
    return calculateMonthlyTotals(currentScenario.items, accountBalances, displayCurrency, USD_TO_ILS_RATE)
  }, [currentScenario, accountBalances, displayCurrency])

  // Calculate display totals based on period
  const displayTotals = useMemo(() => {
    const multiplier = timePeriod === 'yearly' ? 12 : 1
    return {
      inflows: monthlyTotals.inflows * multiplier,
      outflows: monthlyTotals.outflows * multiplier,
      transfers: monthlyTotals.transfers * multiplier,
      net: monthlyTotals.net * multiplier,
    }
  }, [monthlyTotals, timePeriod])

  // Period suffix for display
  const periodSuffix = timePeriod === 'yearly' ? '/yr' : '/mo'

  // Focus tab name input when editing
  useEffect(() => {
    if (editingTabName && tabNameInputRef.current) {
      tabNameInputRef.current.focus()
      tabNameInputRef.current.select()
    }
  }, [editingTabName])

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false)
      }
    }
    if (actionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [actionsMenuOpen])

  // Load saved scenarios on mount and when portfolio changes
  useEffect(() => {
    loadSavedScenarios()
  }, [selectedPortfolioId])

  // Create initial draft if no scenarios exist
  useEffect(() => {
    if (!isLoading && savedScenarios.length === 0 && draftScenarios.length === 0 && selectedPortfolioId) {
      const initialDraft: DraftCashFlowScenario = {
        localId: crypto.randomUUID(),
        portfolioId: selectedPortfolioId,
        name: 'New Scenario',
        items: [],
        categories: generateDefaultCategories(),
        baseCurrency,
        isDirty: false,
      }
      setDraftScenarios([initialDraft])
      setActiveTabId(initialDraft.localId)
    }
  }, [isLoading, savedScenarios.length, draftScenarios.length, selectedPortfolioId, baseCurrency])

  const loadSavedScenarios = async () => {
    if (!selectedPortfolioId) return
    setIsLoading(true)
    try {
      const scenarios = await cashFlowApi.getScenarios(selectedPortfolioId)
      setSavedScenarios(scenarios)
      setDraftScenarios([]) // Clear drafts when loading new portfolio
      if (scenarios.length > 0) {
        setActiveTabId(scenarios[0].scenarioId || null)
      } else {
        setActiveTabId(null)
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Update current scenario helper
  const updateCurrentScenario = useCallback((updates: Partial<CashFlowScenario>) => {
    if (!currentScenario) return

    const updatedScenario: DraftCashFlowScenario = {
      ...currentScenario,
      ...updates,
      isDirty: true,
    }

    setDraftScenarios(prev => {
      const existingIndex = prev.findIndex(d => d.localId === currentScenario.localId)
      if (existingIndex >= 0) {
        const newDrafts = [...prev]
        newDrafts[existingIndex] = updatedScenario
        return newDrafts
      } else {
        return [...prev, updatedScenario]
      }
    })
  }, [currentScenario])

  // Save scenario
  const saveScenario = async () => {
    if (!currentScenario) return
    setIsSaving(true)
    try {
      let savedScenario: CashFlowScenario
      if (currentScenario.scenarioId) {
        savedScenario = await cashFlowApi.updateScenario(currentScenario.scenarioId, currentScenario)
        setSavedScenarios(prev => prev.map(s =>
          s.scenarioId === savedScenario.scenarioId ? savedScenario : s
        ))
      } else {
        savedScenario = await cashFlowApi.createScenario(currentScenario)
        setSavedScenarios(prev => [savedScenario, ...prev])
      }

      setDraftScenarios(prev => prev.filter(d => d.localId !== currentScenario.localId))
      setActiveTabId(savedScenario.scenarioId || null)
    } catch (error) {
      console.error('Failed to save scenario:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Create new scenario
  const newScenario = () => {
    const newDraft: DraftCashFlowScenario = {
      localId: crypto.randomUUID(),
      portfolioId: selectedPortfolioId,
      name: 'New Scenario',
      items: [],
      categories: generateDefaultCategories(),
      baseCurrency,
      isDirty: false,
    }
    setDraftScenarios(prev => [...prev, newDraft])
    setActiveTabId(newDraft.localId)
    setEditingTabName(false)
  }

  // Delete saved scenario
  const deleteSavedScenario = async (scenarioId: string) => {
    const scenario = savedScenarios.find(s => s.scenarioId === scenarioId)
    const confirmed = window.confirm(`Are you sure you want to delete "${scenario?.name || 'this scenario'}"?`)
    if (!confirmed) return

    try {
      await cashFlowApi.deleteScenario(scenarioId)
      setSavedScenarios(prev => prev.filter(s => s.scenarioId !== scenarioId))

      if (activeTabId === scenarioId) {
        const remainingSaved = savedScenarios.filter(s => s.scenarioId !== scenarioId)
        if (remainingSaved.length > 0) {
          setActiveTabId(remainingSaved[0].scenarioId || null)
        } else if (draftScenarios.length > 0) {
          setActiveTabId(draftScenarios[0].localId)
        } else {
          newScenario()
        }
      }
    } catch (error) {
      console.error('Failed to delete scenario:', error)
    }
  }

  // Discard draft
  const discardDraft = (localId: string) => {
    setDraftScenarios(prev => prev.filter(d => d.localId !== localId))

    if (activeTabId === localId) {
      const remainingDrafts = draftScenarios.filter(d => d.localId !== localId)
      if (savedScenarios.length > 0) {
        setActiveTabId(savedScenarios[0].scenarioId || null)
      } else if (remainingDrafts.length > 0) {
        setActiveTabId(remainingDrafts[0].localId)
      } else {
        newScenario()
      }
    }
  }

  // Portfolio change handler
  const handlePortfolioChange = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId)
  }

  // Flow handlers
  const handleFlowRightClick = useCallback(
    (event: { x: number; y: number }, linkInfo: SankeyLinkInfo) => {
      setContextMenuPosition(event)
      setSelectedLinkInfo(linkInfo)
    },
    []
  )

  const handleNodeClick = useCallback((nodeInfo: SankeyNodeInfo) => {
    setSelectedNodeInfo(nodeInfo)
    setNodeInfoOpen(true)
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuPosition(null)
    setSelectedLinkInfo(null)
  }, [])

  const handleEditFromContextMenu = useCallback((linkInfo: SankeyLinkInfo) => {
    if (linkInfo.flowItems.length > 0) {
      setSelectedFlow(linkInfo.flowItems[0])
      setEditFlowOpen(true)
    }
  }, [])

  const handleSplitFromContextMenu = useCallback((linkInfo: SankeyLinkInfo) => {
    setSelectedLinkInfo(linkInfo)
    setSplitFlowOpen(true)
  }, [])

  const handleDeleteFromContextMenu = useCallback(
    (linkInfo: SankeyLinkInfo) => {
      if (!currentScenario || linkInfo.flowItems.length === 0) return

      const confirmed = window.confirm(
        `Delete ${linkInfo.flowItems.length} flow(s) from "${linkInfo.from}" to "${linkInfo.to}"?`
      )

      if (confirmed) {
        const idsToDelete = new Set(linkInfo.flowItems.map((f) => f.id))
        const newItems = currentScenario.items.filter((item) => !idsToDelete.has(item.id))
        updateCurrentScenario({ items: newItems })
      }
    },
    [currentScenario, updateCurrentScenario]
  )

  const handleSaveFlow = useCallback(
    (updatedFlow: CashFlowItem) => {
      if (!currentScenario) return
      const newItems = currentScenario.items.map((item) =>
        item.id === updatedFlow.id ? updatedFlow : item
      )
      updateCurrentScenario({ items: newItems })
      setSelectedFlow(null)
    },
    [currentScenario, updateCurrentScenario]
  )

  const handleCloseEditDialog = useCallback(() => {
    setEditFlowOpen(false)
    setSelectedFlow(null)
  }, [])

  const handleCloseSplitDialog = useCallback(() => {
    setSplitFlowOpen(false)
    setSelectedLinkInfo(null)
  }, [])

  const handleSaveSplit = useCallback(
    (originalFlowId: string, newFlows: CashFlowItem[], newCategory?: CashFlowCategory) => {
      if (!currentScenario) return
      const filteredItems = currentScenario.items.filter((item) => item.id !== originalFlowId)
      const newItems = [...filteredItems, ...newFlows]
      const newCategories = newCategory
        ? [...currentScenario.categories, newCategory]
        : currentScenario.categories

      updateCurrentScenario({ items: newItems, categories: newCategories })
      setSplitFlowOpen(false)
      setSelectedLinkInfo(null)
    },
    [currentScenario, updateCurrentScenario]
  )

  const handleCloseNodeInfoDialog = useCallback(() => {
    setNodeInfoOpen(false)
    setSelectedNodeInfo(null)
  }, [])

  const handleAddFlowFromNode = useCallback(
    (prefill: { sourceNodeName?: string; destNodeName?: string }) => {
      setAddFlowPrefill(prefill)
      setAddFlowOpen(true)
      setNodeInfoOpen(false)
    },
    []
  )

  const handleEditFlowFromNode = useCallback((flow: CashFlowItem) => {
    setSelectedFlow(flow)
    setEditFlowOpen(true)
    setNodeInfoOpen(false)
  }, [])

  const handleDeleteFlowFromNode = useCallback(
    (flow: CashFlowItem) => {
      if (!currentScenario) return
      const confirmed = window.confirm(`Delete "${flow.name}"?`)
      if (confirmed) {
        const newItems = currentScenario.items.filter((item) => item.id !== flow.id)
        updateCurrentScenario({ items: newItems })
      }
    },
    [currentScenario, updateCurrentScenario]
  )

  const handleCloseAddFlowDialog = useCallback(() => {
    setAddFlowOpen(false)
    setAddFlowPrefill(undefined)
  }, [])

  const handleSaveNewFlow = useCallback(
    (newFlow: CashFlowItem) => {
      if (!currentScenario) return
      const newItems = [...currentScenario.items, newFlow]
      updateCurrentScenario({ items: newItems })
    },
    [currentScenario, updateCurrentScenario]
  )

  const handleCreateCategory = useCallback(
    (newCategory: CashFlowCategory) => {
      if (!currentScenario) return
      const newCategories = [...currentScenario.categories, newCategory]
      updateCurrentScenario({ categories: newCategories })
    },
    [currentScenario, updateCurrentScenario]
  )

  const handleDeleteCategory = useCallback(
    (categoryId: string) => {
      if (!currentScenario) return
      const newCategories = currentScenario.categories.filter(c => c.id !== categoryId)
      // Remove category from any items that reference it
      const newItems = currentScenario.items.map(item =>
        item.categoryId === categoryId ? { ...item, categoryId: undefined } : item
      )
      updateCurrentScenario({ categories: newCategories, items: newItems })
    },
    [currentScenario, updateCurrentScenario]
  )

  // Export scenario to JSON file
  const handleExportScenario = useCallback(() => {
    if (!currentScenario) return

    const exportData = {
      name: currentScenario.name,
      items: currentScenario.items,
      categories: currentScenario.categories,
      baseCurrency: currentScenario.baseCurrency || baseCurrency,
      exportedAt: new Date().toISOString(),
      version: 1,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashflow-${currentScenario.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [currentScenario, baseCurrency])

  // Import scenario from JSON file
  const handleImportScenario = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const importedData = JSON.parse(text)

        // Validate imported data
        if (!importedData.items || !importedData.categories) {
          alert('Invalid cash flow file format')
          return
        }

        // Generate new IDs for all items and categories
        const categoryIdMap = new Map<string, string>()
        const newCategories: CashFlowCategory[] = importedData.categories.map((cat: any) => {
          const newId = crypto.randomUUID()
          categoryIdMap.set(cat.id, newId)
          return {
            ...cat,
            id: newId,
          }
        })

        const newItems: CashFlowItem[] = importedData.items.map((item: any) => ({
          ...item,
          id: crypto.randomUUID(),
          categoryId: item.categoryId ? categoryIdMap.get(item.categoryId) : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))

        // Create new draft scenario
        const newDraft: DraftCashFlowScenario = {
          localId: crypto.randomUUID(),
          portfolioId: selectedPortfolioId,
          name: `${importedData.name} (Imported)`,
          items: newItems,
          categories: newCategories,
          baseCurrency: importedData.baseCurrency || baseCurrency,
          isDirty: true,
        }

        setDraftScenarios(prev => [...prev, newDraft])
        setActiveTabId(newDraft.localId)
      } catch (error) {
        console.error('Failed to import scenario:', error)
        alert('Failed to import cash flow file. Please check the file format.')
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [selectedPortfolioId, baseCurrency]
  )

  const handleClearAll = useCallback(() => {
    if (!currentScenario) return
    const confirmed = window.confirm(
      'Are you sure you want to clear all flows? This will remove all income, expenses, and transfers.'
    )
    if (confirmed) {
      updateCurrentScenario({ items: [] })
    }
  }, [currentScenario, updateCurrentScenario])

  // Table handlers
  const handleUpdateItem = useCallback((id: string, updates: Partial<CashFlowItem>) => {
    if (!currentScenario) return
    const newItems = currentScenario.items.map(item =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    )
    updateCurrentScenario({ items: newItems })
  }, [currentScenario, updateCurrentScenario])

  const handleDeleteItem = useCallback((id: string) => {
    if (!currentScenario) return
    const newItems = currentScenario.items.filter(item => item.id !== id)
    updateCurrentScenario({ items: newItems })
  }, [currentScenario, updateCurrentScenario])

  const handleAddItem = useCallback(() => {
    setAddFlowPrefill(undefined)
    setAddFlowOpen(true)
  }, [])

  // Check if can save
  const canSave = currentScenario && (currentScenario.isDirty || !currentScenario.scenarioId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Scenario Tabs */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          {/* Tabs container */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1">
            {/* Saved scenario tabs */}
            {savedScenarios.map((scenario) => {
              const isActive = activeTabId === scenario.scenarioId
              const hasDraft = draftScenarios.some(d => d.scenarioId === scenario.scenarioId)
              return (
                <div
                  key={scenario.scenarioId}
                  className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'text-white border-blue-500'
                      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'
                  }`}
                  onClick={() => {
                    if (!isActive) {
                      setActiveTabId(scenario.scenarioId!)
                    }
                  }}
                >
                  {isActive && editingTabName ? (
                    <input
                      ref={tabNameInputRef}
                      type="text"
                      className="bg-transparent text-white text-sm outline-none border-b border-blue-500 w-24"
                      value={currentScenario?.name || ''}
                      onChange={(e) => updateCurrentScenario({ name: e.target.value })}
                      onBlur={() => setEditingTabName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingTabName(false)
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="text-sm"
                      onDoubleClick={() => isActive && setEditingTabName(true)}
                      title="Double-click to rename"
                    >
                      {scenario.name}
                    </span>
                  )}
                  {hasDraft && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" title="Unsaved changes" />}
                  <button
                    className="p-0.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSavedScenario(scenario.scenarioId!)
                    }}
                    title="Delete scenario"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}

            {/* Draft scenario tabs */}
            {draftScenarios.filter(d => !d.scenarioId).map((draft) => {
              const isActive = activeTabId === draft.localId
              return (
                <div
                  key={draft.localId}
                  className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'text-white border-blue-500'
                      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'
                  }`}
                  onClick={() => {
                    if (!isActive) {
                      setActiveTabId(draft.localId)
                    }
                  }}
                >
                  {isActive && editingTabName ? (
                    <input
                      ref={tabNameInputRef}
                      type="text"
                      className="bg-transparent text-white text-sm outline-none border-b border-blue-500 w-24"
                      value={draft.name}
                      onChange={(e) => updateCurrentScenario({ name: e.target.value })}
                      onBlur={() => setEditingTabName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingTabName(false)
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="text-sm"
                      onDoubleClick={() => isActive && setEditingTabName(true)}
                      title="Double-click to rename"
                    >
                      {draft.name || 'New Scenario'}
                    </span>
                  )}
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" title="Not saved" />
                  <button
                    className="p-0.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      discardDraft(draft.localId)
                    }}
                    title="Discard draft"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}

            {/* New scenario button */}
            <button
              className="flex items-center justify-center px-2 py-2 text-gray-500 hover:text-white transition-colors"
              onClick={newScenario}
              title="New scenario"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Save indicator and button */}
          <div className="flex items-center gap-2 pb-1 flex-shrink-0">
            {isSaving && (
              <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {!isSaving && canSave && (
              <button
                className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                onClick={saveScenario}
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 p-4">
          {/* Portfolio Selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300">Portfolio:</label>
            <div className="relative">
              <select
                className="appearance-none bg-gray-900 text-white border border-gray-700 rounded-md px-4 py-2 pr-10 cursor-pointer hover:border-gray-600 focus:outline-none focus:border-blue-500"
                value={selectedPortfolioId}
                onChange={(e) => handlePortfolioChange(e.target.value)}
              >
                {availablePortfolios.map((p) => (
                  <option key={p.portfolio_id} value={p.portfolio_id}>
                    {p.portfolio_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'diagram'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setViewMode('diagram')}
            >
              <Network className="h-4 w-4" />
              Diagram
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4" />
              Table
            </button>
          </div>

          {/* Period Toggle */}
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setTimePeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setTimePeriod('yearly')}
            >
              Yearly
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                displayCurrency === 'USD'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setDisplayCurrency('USD')}
            >
              $ USD
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                displayCurrency === 'ILS'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setDisplayCurrency('ILS')}
            >
              ₪ ILS
            </button>
          </div>

          {/* Actions Menu */}
          <div className="relative" ref={actionsMenuRef}>
            <button
              onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="More actions"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {actionsMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleExportScenario()
                      setActionsMenuOpen(false)
                    }}
                    disabled={!currentScenario}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-4 w-4" />
                    Export Scenario
                  </button>
                  <button
                    onClick={() => {
                      handleImportScenario()
                      setActionsMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import Scenario
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      handleClearAll()
                      setActionsMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {currentScenario && (
        <>
          {/* Summary Bar */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-400 mb-1">Inflows</div>
                <div className="text-lg font-semibold text-green-400">
                  {formatAmount(displayTotals.inflows)}{periodSuffix}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Outflows</div>
                <div className="text-lg font-semibold text-red-400">
                  {formatAmount(displayTotals.outflows)}{periodSuffix}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Transfers</div>
                <div className="text-lg font-semibold text-blue-400">
                  {formatAmount(displayTotals.transfers)}{periodSuffix}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Net Cash Flow</div>
                <div className={`text-lg font-semibold ${displayTotals.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(displayTotals.net)}{periodSuffix}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {viewMode === 'diagram' ? (
            <>
              <CashFlowSankeyChart
                items={currentScenario.items}
                categories={currentScenario.categories}
                accounts={accounts}
                accountBalances={accountBalances}
                baseCurrency={displayCurrency}
                timePeriod={timePeriod}
                onFlowRightClick={handleFlowRightClick}
                onNodeClick={handleNodeClick}
                onAddFlow={handleAddItem}
                currencyConversionRate={USD_TO_ILS_RATE}
              />
              <div className="text-center text-xs text-gray-500">
                Click on nodes to view details. Right-click on flows to edit, split, or delete.
              </div>
            </>
          ) : (
            <CashFlowTable
              items={currentScenario.items}
              categories={currentScenario.categories}
              accounts={accounts}
              displayCurrency={displayCurrency}
              timePeriod={timePeriod}
              currencyConversionRate={USD_TO_ILS_RATE}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItem}
            />
          )}
        </>
      )}

      {/* Context Menu */}
      <FlowContextMenu
        position={contextMenuPosition}
        linkInfo={selectedLinkInfo}
        onClose={handleCloseContextMenu}
        onEdit={handleEditFromContextMenu}
        onSplit={handleSplitFromContextMenu}
        onDelete={handleDeleteFromContextMenu}
      />

      {/* Edit Flow Dialog */}
      <EditFlowDialog
        isOpen={editFlowOpen}
        onClose={handleCloseEditDialog}
        onSave={handleSaveFlow}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        flow={selectedFlow}
        categories={currentScenario?.categories || []}
        accounts={accounts}
      />

      {/* Split Flow Dialog */}
      <SplitFlowDialog
        isOpen={splitFlowOpen}
        onClose={handleCloseSplitDialog}
        onSave={handleSaveSplit}
        linkInfo={selectedLinkInfo}
        categories={currentScenario?.categories || []}
        accounts={accounts}
      />

      {/* Node Info Dialog */}
      <NodeInfoDialog
        isOpen={nodeInfoOpen}
        onClose={handleCloseNodeInfoDialog}
        nodeInfo={selectedNodeInfo}
        categories={currentScenario?.categories || []}
        accounts={accounts}
        onAddFlow={handleAddFlowFromNode}
        onEditFlow={handleEditFlowFromNode}
        onDeleteFlow={handleDeleteFlowFromNode}
        displayCurrency={displayCurrency}
        currencyConversionRate={USD_TO_ILS_RATE}
      />

      {/* Add Flow Dialog */}
      <AddFlowDialog
        isOpen={addFlowOpen}
        onClose={handleCloseAddFlowDialog}
        onSave={handleSaveNewFlow}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        categories={currentScenario?.categories || []}
        accounts={accounts}
        prefill={addFlowPrefill}
      />
    </div>
  )
}
