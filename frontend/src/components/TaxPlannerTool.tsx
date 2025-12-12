import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Search, X, Loader2 } from 'lucide-react'
import { usePortfolioData, type AccountData, type HoldingData, type PriceData } from '../contexts/PortfolioDataContext'
import { TaxEntry, TaxScenario, TaxGroupBy, TaxTotals, GroupTotals } from '../types/tax-planner'
import * as taxApi from '../utils/tax-planner-api'
import { useSymbolAutocomplete, SymbolSuggestion } from '../hooks/useSymbolAutocomplete'

// Draft scenario with local ID for tracking unsaved scenarios
interface DraftScenario extends TaxScenario {
  localId: string // Unique ID for unsaved drafts
  isDirty: boolean // Has unsaved changes
}

export function TaxPlannerTool() {
  const { allPortfoliosData, getAvailablePortfolios } = usePortfolioData()

  // Scenario state
  const [savedScenarios, setSavedScenarios] = useState<TaxScenario[]>([])
  const [draftScenarios, setDraftScenarios] = useState<DraftScenario[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null) // localId for drafts, scenarioId for saved
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingTabName, setEditingTabName] = useState(false)
  const tabNameInputRef = useRef<HTMLInputElement>(null)

  // Get current scenario (either saved or draft)
  const currentScenario = useMemo(() => {
    // Check drafts first
    const draft = draftScenarios.find(d => d.localId === activeTabId)
    if (draft) return draft

    // Check saved scenarios (with possible local edits tracked in drafts)
    const savedWithEdits = draftScenarios.find(d => d.scenarioId === activeTabId)
    if (savedWithEdits) return savedWithEdits

    const saved = savedScenarios.find(s => s.scenarioId === activeTabId)
    if (saved) return { ...saved, localId: saved.scenarioId!, isDirty: false } as DraftScenario

    // Return first available or empty
    if (draftScenarios.length > 0) return draftScenarios[0]
    if (savedScenarios.length > 0) {
      const first = savedScenarios[0]
      return { ...first, localId: first.scenarioId!, isDirty: false } as DraftScenario
    }

    return null
  }, [activeTabId, draftScenarios, savedScenarios])

  // View state
  const [groupBy, setGroupBy] = useState<TaxGroupBy>('none')
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [addSearchTerm, setAddSearchTerm] = useState('')
  const addDropdownRef = useRef<HTMLDivElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Symbol autocomplete for searching
  const { suggestions, isLoading: isSearching, fetchSuggestions, clearSuggestions } = useSymbolAutocomplete()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false)
        setAddSearchTerm('')
        clearSuggestions()
      }
    }
    if (showAddDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAddDropdown, clearSuggestions])

  // Fetch suggestions when search term changes
  useEffect(() => {
    if (addSearchTerm.trim().length >= 1) {
      const timer = setTimeout(() => {
        fetchSuggestions(addSearchTerm.trim())
      }, 150)
      return () => clearTimeout(timer)
    } else {
      clearSuggestions()
    }
  }, [addSearchTerm, fetchSuggestions, clearSuggestions])

  // Focus input when dropdown opens
  useEffect(() => {
    if (showAddDropdown && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [showAddDropdown])

  // Focus tab name input when editing
  useEffect(() => {
    if (editingTabName && tabNameInputRef.current) {
      tabNameInputRef.current.focus()
      tabNameInputRef.current.select()
    }
  }, [editingTabName])

  // Get available portfolios and their holdings
  const availablePortfolios = getAvailablePortfolios()
  const defaultPortfolioId = availablePortfolios[0]?.portfolio_id || ''

  // Get base currency from first portfolio
  const baseCurrency = useMemo(() => {
    if (!allPortfoliosData || !defaultPortfolioId) return 'USD'
    return allPortfoliosData.portfolios?.[defaultPortfolioId]?.portfolio_metadata?.base_currency || 'USD'
  }, [allPortfoliosData, defaultPortfolioId])

  // Load saved scenarios on mount
  useEffect(() => {
    loadSavedScenarios()
  }, [])

  // Create initial draft if no scenarios exist
  useEffect(() => {
    if (!isLoading && savedScenarios.length === 0 && draftScenarios.length === 0) {
      const initialDraft: DraftScenario = {
        localId: crypto.randomUUID(),
        name: 'New Scenario',
        year: new Date().getFullYear(),
        entries: [],
        baseCurrency,
        isDirty: false
      }
      setDraftScenarios([initialDraft])
      setActiveTabId(initialDraft.localId)
    }
  }, [isLoading, savedScenarios.length, draftScenarios.length, baseCurrency])

  const loadSavedScenarios = async () => {
    try {
      const scenarios = await taxApi.getScenarios()
      setSavedScenarios(scenarios)
      // Set active tab to first saved scenario if available
      if (scenarios.length > 0) {
        setActiveTabId(scenarios[0].scenarioId || null)
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to update current scenario
  const updateCurrentScenario = useCallback((updates: Partial<TaxScenario>) => {
    if (!currentScenario) return

    const updatedScenario: DraftScenario = {
      ...currentScenario,
      ...updates,
      isDirty: true
    }

    setDraftScenarios(prev => {
      const existingIndex = prev.findIndex(d => d.localId === currentScenario.localId)
      if (existingIndex >= 0) {
        // Update existing draft
        const newDrafts = [...prev]
        newDrafts[existingIndex] = updatedScenario
        return newDrafts
      } else {
        // Create new draft from saved scenario
        return [...prev, updatedScenario]
      }
    })
  }, [currentScenario])

  // Get all holdings across all portfolios for the "Add from Holdings" dropdown
  const allHoldings = useMemo(() => {
    if (!allPortfoliosData?.portfolios) return []

    const holdings: Array<{
      portfolioId: string
      portfolioName: string
      accountName: string
      symbol: string
      securityName: string
      units: number
      currentPrice: number
      originalPrice: number
      currency: string
    }> = []

    const currentPrices = (allPortfoliosData.global_current_prices || {}) as Record<string, PriceData>

    Object.entries(allPortfoliosData.portfolios).forEach(([portfolioId, portfolio]) => {
      const portfolioName = portfolio.portfolio_metadata?.portfolio_name || portfolioId
      ;(portfolio.accounts || []).forEach((account: AccountData) => {
        ;(account.holdings || []).forEach((holding: HoldingData) => {
          const priceData = currentPrices[holding.symbol]
          const originalPrice = priceData?.original_price ?? priceData?.price ?? 0
          const currency = priceData?.currency || holding.original_currency || 'USD'
          holdings.push({
            portfolioId,
            portfolioName,
            accountName: account.account_name,
            symbol: holding.symbol,
            securityName: holding.security_name || holding.symbol,
            units: holding.units,
            currentPrice: priceData?.price || 0,
            originalPrice,
            currency
          })
        })
      })
    })

    return holdings
  }, [allPortfoliosData])

  // Get unique accounts with portfolio info for the account selector dropdown
  // Key is "portfolioId:accountName" to handle same account name in different portfolios
  const availableAccounts = useMemo(() => {
    const accountMap = new Map<string, { accountName: string; portfolioId: string; portfolioName: string }>()
    allHoldings.forEach(h => {
      const key = `${h.portfolioId}:${h.accountName}`
      if (!accountMap.has(key)) {
        accountMap.set(key, { accountName: h.accountName, portfolioId: h.portfolioId, portfolioName: h.portfolioName })
      }
    })
    return Array.from(accountMap.values()).sort((a, b) =>
      a.portfolioName.localeCompare(b.portfolioName) || a.accountName.localeCompare(b.accountName)
    )
  }, [allHoldings])

  // Filter holdings based on search term
  const filteredHoldings = useMemo(() => {
    if (!addSearchTerm.trim()) return allHoldings
    const term = addSearchTerm.toLowerCase()
    return allHoldings.filter(h =>
      h.symbol.toLowerCase().includes(term) ||
      h.securityName.toLowerCase().includes(term) ||
      h.accountName.toLowerCase().includes(term)
    )
  }, [allHoldings, addSearchTerm])

  // Add a new empty entry (manual)
  const addEntry = useCallback(() => {
    if (!currentScenario) return
    const newEntry: TaxEntry = {
      id: crypto.randomUUID(),
      symbol: '',
      units: 0,
      costBasisPerUnit: 0,
      sellPricePerUnit: 0,
      currency: currentScenario.baseCurrency
    }
    updateCurrentScenario({
      entries: [...currentScenario.entries, newEntry]
    })
    setShowAddDropdown(false)
    setAddSearchTerm('')
    clearSuggestions()
  }, [currentScenario, updateCurrentScenario, clearSuggestions])

  // Add entry from searched symbol
  const addFromSearch = useCallback((suggestion: SymbolSuggestion) => {
    if (!currentScenario) return
    const newEntry: TaxEntry = {
      id: crypto.randomUUID(),
      symbol: suggestion.symbol.replace(/^(NYSE:|NASDAQ:|TASE:)/, ''),
      securityName: suggestion.name,
      units: 0,
      costBasisPerUnit: 0,
      sellPricePerUnit: 0,
      currency: currentScenario.baseCurrency
    }
    updateCurrentScenario({
      entries: [...currentScenario.entries, newEntry]
    })
    setShowAddDropdown(false)
    setAddSearchTerm('')
    clearSuggestions()
  }, [currentScenario, updateCurrentScenario, clearSuggestions])

  // Add entry from existing holding
  const addFromHolding = useCallback((holding: typeof allHoldings[0]) => {
    if (!currentScenario) return
    const newEntry: TaxEntry = {
      id: crypto.randomUUID(),
      symbol: holding.symbol,
      securityName: holding.securityName,
      portfolioId: holding.portfolioId,
      accountName: holding.accountName,
      units: holding.units,
      costBasisPerUnit: 0,
      sellPricePerUnit: holding.originalPrice,
      currency: holding.currency
    }
    updateCurrentScenario({
      entries: [...currentScenario.entries, newEntry]
    })
    setShowAddDropdown(false)
    setAddSearchTerm('')
    clearSuggestions()
  }, [currentScenario, updateCurrentScenario, clearSuggestions])

  // Update an entry
  const updateEntry = useCallback((id: string, updates: Partial<TaxEntry>) => {
    if (!currentScenario) return
    updateCurrentScenario({
      entries: currentScenario.entries.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    })
  }, [currentScenario, updateCurrentScenario])

  // Delete an entry
  const deleteEntry = useCallback((id: string) => {
    if (!currentScenario) return
    updateCurrentScenario({
      entries: currentScenario.entries.filter(e => e.id !== id)
    })
  }, [currentScenario, updateCurrentScenario])

  // Save scenario
  const saveScenario = async () => {
    if (!currentScenario) return
    setIsSaving(true)
    try {
      let savedScenario: TaxScenario
      if (currentScenario.scenarioId) {
        // Update existing
        savedScenario = await taxApi.updateScenario(currentScenario.scenarioId, currentScenario)
        // Update in savedScenarios list
        setSavedScenarios(prev => prev.map(s =>
          s.scenarioId === savedScenario.scenarioId ? savedScenario : s
        ))
      } else {
        // Create new
        savedScenario = await taxApi.createScenario(currentScenario)
        // Add to savedScenarios list
        setSavedScenarios(prev => [savedScenario, ...prev])
      }

      // Remove from drafts (it's now saved) and switch to saved tab atomically
      setDraftScenarios(prev => prev.filter(d => d.localId !== currentScenario.localId))
      setActiveTabId(savedScenario.scenarioId || null)
    } catch (error) {
      console.error('Failed to save scenario:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Switch to a saved scenario tab
  const selectSavedScenario = (scenarioId: string) => {
    setActiveTabId(scenarioId)
    setEditingTabName(false)
  }

  // Switch to a draft scenario tab
  const selectDraftScenario = (localId: string) => {
    setActiveTabId(localId)
    setEditingTabName(false)
  }

  // Create new scenario (adds a new draft without overwriting existing)
  const newScenario = () => {
    const newDraft: DraftScenario = {
      localId: crypto.randomUUID(),
      name: 'New Scenario',
      year: new Date().getFullYear(),
      entries: [],
      baseCurrency,
      isDirty: false
    }
    setDraftScenarios(prev => [...prev, newDraft])
    setActiveTabId(newDraft.localId)
    setEditingTabName(false)
  }

  // Delete a saved scenario from backend
  const deleteSavedScenario = async (scenarioId: string) => {
    const scenario = savedScenarios.find(s => s.scenarioId === scenarioId)
    const confirmed = window.confirm(`Are you sure you want to delete "${scenario?.name || 'this scenario'}"? This cannot be undone.`)
    if (!confirmed) return

    try {
      await taxApi.deleteScenario(scenarioId)
      setSavedScenarios(prev => prev.filter(s => s.scenarioId !== scenarioId))

      // If we deleted the currently viewed scenario, switch tabs
      if (activeTabId === scenarioId) {
        // Prefer another saved scenario, then drafts
        const remainingSaved = savedScenarios.filter(s => s.scenarioId !== scenarioId)
        if (remainingSaved.length > 0) {
          setActiveTabId(remainingSaved[0].scenarioId || null)
        } else if (draftScenarios.length > 0) {
          setActiveTabId(draftScenarios[0].localId)
        } else {
          // Create a new draft
          newScenario()
        }
      }
    } catch (error) {
      console.error('Failed to delete scenario:', error)
    }
  }

  // Discard a draft scenario (close tab without saving)
  const discardDraft = (localId: string) => {
    setDraftScenarios(prev => prev.filter(d => d.localId !== localId))

    // If we discarded the currently viewed draft, switch tabs
    if (activeTabId === localId) {
      const remainingDrafts = draftScenarios.filter(d => d.localId !== localId)
      if (savedScenarios.length > 0) {
        setActiveTabId(savedScenarios[0].scenarioId || null)
      } else if (remainingDrafts.length > 0) {
        setActiveTabId(remainingDrafts[0].localId)
      } else {
        // Create a new draft
        newScenario()
      }
    }
  }

  // Get exchange rate from original currency to base currency using price data
  const getExchangeRate = useCallback((fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return 1

    // Try to find a symbol with this currency to derive the rate
    const currentPrices = (allPortfoliosData?.global_current_prices || {}) as Record<string, PriceData>

    // Look for any symbol with this original currency to get the exchange rate
    for (const priceData of Object.values(currentPrices)) {
      if (priceData.currency === fromCurrency && priceData.original_price && priceData.original_price > 0) {
        // rate = base_currency_price / original_currency_price
        return priceData.price / priceData.original_price
      }
    }

    return 1 // Fallback to 1:1 if no rate found
  }, [allPortfoliosData])

  // Calculate totals for entries (converting to base currency)
  const calculateTotals = useCallback((entries: TaxEntry[], targetCurrency: string): TaxTotals => {
    const result = entries.reduce((acc, e) => {
      const costBasis = e.units * e.costBasisPerUnit
      const sellValue = e.units * e.sellPricePerUnit
      const profitLoss = sellValue - costBasis

      // Convert to target currency
      const rate = getExchangeRate(e.currency, targetCurrency)

      return {
        totalCostBasis: acc.totalCostBasis + (costBasis * rate),
        totalSellValue: acc.totalSellValue + (sellValue * rate),
        totalProfitLoss: acc.totalProfitLoss + (profitLoss * rate)
      }
    }, { totalCostBasis: 0, totalSellValue: 0, totalProfitLoss: 0 })

    return {
      ...result,
      profitLossPercent: result.totalCostBasis > 0
        ? (result.totalProfitLoss / result.totalCostBasis) * 100
        : 0
    }
  }, [getExchangeRate])

  // Overall totals (converted to base currency)
  const totals = useMemo(() => {
    if (!currentScenario) return { totalCostBasis: 0, totalSellValue: 0, totalProfitLoss: 0, profitLossPercent: 0 }
    return calculateTotals(currentScenario.entries, currentScenario.baseCurrency)
  }, [currentScenario, calculateTotals])

  // Group entries by selected grouping
  const groupedData = useMemo((): GroupTotals[] => {
    if (!currentScenario) return []
    const entries = currentScenario.entries
    const targetCurrency = currentScenario.baseCurrency
    if (groupBy === 'none' || entries.length === 0) {
      return [{
        groupName: 'All Entries',
        entries,
        totals: calculateTotals(entries, targetCurrency)
      }]
    }

    const groups: Record<string, TaxEntry[]> = {}
    entries.forEach(entry => {
      let key = 'Unassigned'
      if (groupBy === 'account') {
        key = entry.accountName || 'Unassigned'
      } else if (groupBy === 'symbol') {
        key = entry.symbol || 'Unassigned'
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(entry)
    })

    return Object.entries(groups).map(([groupName, groupEntries]) => ({
      groupName,
      entries: groupEntries,
      totals: calculateTotals(groupEntries, targetCurrency)
    }))
  }, [currentScenario, groupBy, calculateTotals])

  const numberFmt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n)

  const numberFmtInt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n)

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6">
      {/* Scenario tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-700">
        {/* Saved scenarios as tabs */}
        {savedScenarios.map(scenario => {
          // Check if we have local edits for this saved scenario
          const localEdits = draftScenarios.find(d => d.scenarioId === scenario.scenarioId)
          const isActive = activeTabId === scenario.scenarioId || (localEdits && activeTabId === localEdits.localId)
          const hasChanges = localEdits?.isDirty ?? false

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
                  selectSavedScenario(scenario.scenarioId!)
                }
              }}
            >
              {isActive && editingTabName && currentScenario ? (
                <input
                  ref={tabNameInputRef}
                  type="text"
                  className="bg-transparent text-white text-sm outline-none border-b border-blue-500 w-24"
                  value={currentScenario.name}
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
                  {localEdits?.name ?? scenario.name}
                </span>
              )}
              {(localEdits?.year ?? scenario.year) && (
                <span className="text-xs text-gray-500">({localEdits?.year ?? scenario.year})</span>
              )}
              {hasChanges && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" title="Unsaved changes" />}
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

        {/* Draft (unsaved) scenario tabs */}
        {draftScenarios
          .filter(draft => !draft.scenarioId) // Only show drafts that aren't linked to a saved scenario
          .map(draft => {
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
                    selectDraftScenario(draft.localId)
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
                {draft.year && <span className="text-xs text-gray-500">({draft.year})</span>}
                {/* Show unsaved indicator for drafts */}
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

        {/* Add new tab button */}
        <button
          className="flex items-center justify-center px-2 py-2 text-gray-500 hover:text-white transition-colors"
          onClick={newScenario}
          title="New scenario"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Save indicator and button */}
        <div className="ml-auto flex items-center gap-2 pb-1">
          {isSaving && (
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {!isSaving && currentScenario && (currentScenario.isDirty || !currentScenario.scenarioId) && currentScenario.entries.length > 0 && (
            <button
              className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
              onClick={saveScenario}
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Options bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Year:</span>
          <input
            type="number"
            className="w-20 bg-gray-900 text-white rounded px-2 py-1 border border-gray-700 text-center text-sm"
            placeholder={new Date().getFullYear().toString()}
            value={currentScenario?.year || ''}
            onChange={(e) => updateCurrentScenario({ year: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500">Group by:</span>
          <select
            className="bg-gray-900 text-white rounded px-2 py-1 border border-gray-700 text-sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as TaxGroupBy)}
          >
            <option value="account">Account</option>
            <option value="symbol">Symbol</option>
            <option value="none">No grouping</option>
          </select>
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-4">
        {groupedData.map((group) => (
          <div key={group.groupName} className="bg-gray-900 border border-gray-700 rounded-md">
            {/* Group header */}
            {groupBy !== 'none' && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
                <span className="font-medium text-white">{group.groupName}</span>
                <span className={`text-sm font-medium ${group.totals.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {group.totals.totalProfitLoss >= 0 ? '+' : ''}{numberFmt(group.totals.totalProfitLoss)} {currentScenario?.baseCurrency}
                </span>
              </div>
            )}

            {/* Entries table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2">Symbol</th>
                    {groupBy !== 'account' && <th className="text-left px-3 py-2">Account</th>}
                    <th className="text-right px-3 py-2">Units</th>
                    <th className="text-right px-3 py-2">Cost Basis</th>
                    <th className="text-right px-3 py-2">Sell Price</th>
                    <th className="text-center px-3 py-2 w-16">Ccy</th>
                    <th className="text-right px-3 py-2">P/L</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {group.entries.map((entry) => {
                    const profitLoss = entry.units * (entry.sellPricePerUnit - entry.costBasisPerUnit)
                    return (
                      <tr key={entry.id} className="text-gray-200">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="w-24 bg-gray-800 text-white rounded px-2 py-1 border border-gray-600 text-sm"
                            placeholder="AAPL"
                            value={entry.symbol}
                            onChange={(e) => updateEntry(entry.id, { symbol: e.target.value.toUpperCase() })}
                          />
                          {entry.securityName && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[120px]" title={entry.securityName}>
                              {entry.securityName}
                            </div>
                          )}
                        </td>
                        {groupBy !== 'account' && (
                          <td className="px-3 py-2">
                            <select
                              className="w-48 bg-gray-800 text-white rounded px-2 py-1 border border-gray-600 text-sm cursor-pointer"
                              value={entry.portfolioId && entry.accountName ? `${entry.portfolioId}:${entry.accountName}` : ''}
                              onChange={(e) => {
                                if (!e.target.value) {
                                  updateEntry(entry.id, { portfolioId: undefined, accountName: undefined })
                                } else {
                                  const [portfolioId, ...accountParts] = e.target.value.split(':')
                                  const accountName = accountParts.join(':') // Handle account names with colons
                                  updateEntry(entry.id, { portfolioId, accountName })
                                }
                              }}
                            >
                              <option value="">Unassigned</option>
                              {availableAccounts.map(acc => (
                                <option key={`${acc.portfolioId}:${acc.accountName}`} value={`${acc.portfolioId}:${acc.accountName}`}>
                                  {acc.accountName} ({acc.portfolioName})
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className="w-20 bg-gray-800 text-white rounded px-2 py-1 border border-gray-600 text-sm text-right"
                            value={entry.units || ''}
                            onChange={(e) => updateEntry(entry.id, { units: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-24 bg-gray-800 text-white rounded px-2 py-1 border border-gray-600 text-sm text-right"
                            placeholder="0.00"
                            value={entry.costBasisPerUnit || ''}
                            onChange={(e) => updateEntry(entry.id, { costBasisPerUnit: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-24 bg-gray-800 text-white rounded px-2 py-1 border border-gray-600 text-sm text-right"
                            placeholder="0.00"
                            value={entry.sellPricePerUnit || ''}
                            onChange={(e) => updateEntry(entry.id, { sellPricePerUnit: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-gray-400 text-xs">
                          {entry.currency}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profitLoss >= 0 ? '+' : ''}{numberFmt(profitLoss)} {entry.currency}
                        </td>
                        <td className="px-1 py-2">
                          <button
                            className="p-1 text-gray-500 hover:text-red-400"
                            onClick={() => deleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Add entry row - outside table to avoid overflow clipping */}
            <div ref={addDropdownRef} className="relative px-3 py-2 border-t border-gray-800">
              {!showAddDropdown ? (
                <div
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-300 cursor-pointer py-1"
                  onClick={() => setShowAddDropdown(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Click to add entry...</span>
                </div>
              ) : (
                <div className="relative">
                  {/* Search input */}
                  <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-md px-3 py-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <input
                      ref={addInputRef}
                      type="text"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
                      placeholder="Search symbol or select from holdings..."
                      value={addSearchTerm}
                      onChange={(e) => setAddSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowAddDropdown(false)
                          setAddSearchTerm('')
                          clearSuggestions()
                        }
                      }}
                    />
                  </div>

                  {/* Dropdown */}
                  <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-50 max-h-80 overflow-auto">
                    {/* Your Holdings section */}
                    {filteredHoldings.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide bg-gray-700/50 sticky top-0">
                          Your Holdings
                        </div>
                        {filteredHoldings.map((holding, idx) => (
                          <div
                            key={`holding-${holding.portfolioId}-${holding.accountName}-${holding.symbol}-${idx}`}
                            className="px-3 py-2 hover:bg-gray-700 cursor-pointer"
                            onClick={() => addFromHolding(holding)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">{holding.symbol}</span>
                              <span className="text-gray-400 text-sm">{holding.units} units</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {holding.portfolioName} • {holding.accountName}
                            </div>
                            <div className="text-xs text-gray-400">
                              Current: {numberFmt(holding.originalPrice)} {holding.currency}
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Search Results section */}
                    {addSearchTerm.trim() && (
                      <>
                        <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide bg-gray-700/50 sticky top-0">
                          Search Results
                        </div>
                        {isSearching ? (
                          <div className="px-3 py-4 text-center text-gray-400 text-sm">
                            Searching...
                          </div>
                        ) : suggestions.length > 0 ? (
                          suggestions.map((suggestion, idx) => (
                            <div
                              key={`search-${suggestion.symbol}-${idx}`}
                              className="px-3 py-2 hover:bg-gray-700 cursor-pointer"
                              onClick={() => addFromSearch(suggestion)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-white font-medium">
                                  {suggestion.symbol.replace(/^(NYSE:|NASDAQ:|TASE:)/, '')}
                                </span>
                                <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-700 rounded">
                                  {suggestion.symbol_type.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {suggestion.name}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-gray-500 text-sm">
                            No results found
                          </div>
                        )}
                      </>
                    )}

                    {/* Manual entry option */}
                    <div className="border-t border-gray-700">
                      <div
                        className="px-3 py-2 hover:bg-gray-700 cursor-pointer"
                        onClick={addEntry}
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-blue-400" />
                          <span className="text-white font-medium">Add Manual Entry</span>
                        </div>
                        <div className="text-xs text-gray-500 ml-6">
                          Enter all details manually
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Group subtotal */}
            {group.entries.length > 0 && groupBy !== 'none' && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 bg-gray-800/30 text-sm">
                <span className="text-gray-400">Subtotal ({group.entries.length} entries)</span>
                <div className="flex gap-6 text-gray-300">
                  <span>Cost: {numberFmt(group.totals.totalCostBasis)}</span>
                  <span>Sell: {numberFmt(group.totals.totalSellValue)}</span>
                  <span className={group.totals.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                    P/L: {group.totals.totalProfitLoss >= 0 ? '+' : ''}{numberFmt(group.totals.totalProfitLoss)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

      </div>

      {/* Summary cards */}
      {currentScenario && currentScenario.entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
            <div className="text-gray-400 text-sm">Total Cost Basis</div>
            <div className="text-2xl font-semibold text-white">{numberFmtInt(totals.totalCostBasis)} {currentScenario.baseCurrency}</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
            <div className="text-gray-400 text-sm">Total Sell Value</div>
            <div className="text-2xl font-semibold text-white">{numberFmtInt(totals.totalSellValue)} {currentScenario.baseCurrency}</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
            <div className="text-gray-400 text-sm">Total Profit/Loss</div>
            <div className={`text-2xl font-semibold ${totals.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totals.totalProfitLoss >= 0 ? '+' : ''}{numberFmtInt(totals.totalProfitLoss)} {currentScenario.baseCurrency}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
            <div className="text-gray-400 text-sm">Return %</div>
            <div className={`text-2xl font-semibold ${totals.profitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totals.profitLossPercent >= 0 ? '+' : ''}{numberFmt(totals.profitLossPercent)}%
            </div>
          </div>
        </div>
      )}

      {/* Info text */}
      <div className="mt-4 text-xs text-gray-500">
        <p>Calculate potential gains/losses from selling stocks. All calculations are performed locally. Save scenarios to track for tax planning.</p>
      </div>
    </div>
  )
}

export default TaxPlannerTool
