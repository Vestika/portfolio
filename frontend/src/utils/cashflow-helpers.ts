// Cash Flow Helper Functions

import type {
  CashFlowItem,
  CashFlowCategory,
  CashFlowConfiguration,
  CashFlowNode,
  CashFlowEdge,
  AccountInfo,
  MonthlyTotals,
  AccountFlowSummary,
  StoredCashFlowConfig,
  StoredNodeLayout,
  FlowFrequency,
  NodeType,
} from '../types/cashflow'
import {
  FREQUENCY_MULTIPLIERS,
  FLOW_COLORS,
  NODE_LAYOUT,
  DEFAULT_INFLOW_CATEGORIES,
  DEFAULT_OUTFLOW_CATEGORIES,
  DEFAULT_TRANSFER_CATEGORIES,
} from '../types/cashflow'
// ==================== UUID Generation ====================

/**
 * Generate a UUID using native crypto API
 */
function generateUUID(): string {
  return crypto.randomUUID()
}

// ==================== Frequency Conversion ====================

/**
 * Convert any frequency to monthly equivalent
 */
export function convertToMonthly(amount: number, frequency: FlowFrequency): number {
  return amount * FREQUENCY_MULTIPLIERS[frequency]
}

/**
 * Convert monthly amount to any frequency
 */
export function convertFromMonthly(monthlyAmount: number, frequency: FlowFrequency): number {
  return monthlyAmount / FREQUENCY_MULTIPLIERS[frequency]
}

// ==================== Amount Calculations ====================

/**
 * Calculate the monthly amount for a flow item
 * Handles both fixed amounts and percentages
 */
export function calculateMonthlyAmount(
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

/**
 * Calculate total monthly flows by type
 * All amounts are returned in the target currency after conversion
 */
export function calculateMonthlyTotals(
  items: CashFlowItem[],
  accountBalances: Map<string, number>,
  targetCurrency: 'USD' | 'ILS' = 'ILS',
  conversionRate: number = 3.7
): MonthlyTotals {
  const totals = {
    inflows: 0,
    outflows: 0,
    transfers: 0,
    net: 0,
  }

  items.forEach((item) => {
    if (!item.isActive) return

    const sourceBalance = item.sourceAccountId
      ? accountBalances.get(item.sourceAccountId)
      : undefined
    let monthlyAmount = calculateMonthlyAmount(item, sourceBalance)

    // Convert to target currency if needed
    const itemCurrency = item.currency || 'ILS'
    if (targetCurrency === 'ILS' && itemCurrency === 'USD') {
      monthlyAmount *= conversionRate
    } else if (targetCurrency === 'USD' && itemCurrency === 'ILS') {
      monthlyAmount /= conversionRate
    }

    switch (item.type) {
      case 'inflow':
        totals.inflows += monthlyAmount
        break
      case 'outflow':
        totals.outflows += monthlyAmount
        break
      case 'transfer':
        totals.transfers += monthlyAmount
        break
    }
  })

  totals.net = totals.inflows - totals.outflows

  return totals
}

/**
 * Calculate flows per account
 */
export function calculateAccountFlows(
  items: CashFlowItem[],
  accounts: AccountInfo[],
  accountBalances: Map<string, number>
): AccountFlowSummary[] {
  const accountFlows = new Map<string, { inflows: number; outflows: number }>()

  // Initialize all accounts
  accounts.forEach((account) => {
    accountFlows.set(account.id, { inflows: 0, outflows: 0 })
  })

  // Calculate flows for each account
  items.forEach((item) => {
    if (!item.isActive) return

    const sourceBalance = item.sourceAccountId
      ? accountBalances.get(item.sourceAccountId)
      : undefined
    const monthlyAmount = calculateMonthlyAmount(item, sourceBalance)

    // Source account (money leaving)
    if (item.sourceAccountId) {
      const current = accountFlows.get(item.sourceAccountId)
      if (current) {
        current.outflows += monthlyAmount
      }
    }

    // Destination account (money arriving)
    if (item.destinationAccountId) {
      const current = accountFlows.get(item.destinationAccountId)
      if (current) {
        current.inflows += monthlyAmount
      }
    }
  })

  // Build summary
  return accounts.map((account) => {
    const flows = accountFlows.get(account.id) || { inflows: 0, outflows: 0 }
    const netChange = flows.inflows - flows.outflows
    const currentBalance = accountBalances.get(account.id) || 0

    return {
      accountId: account.id,
      accountName: account.name,
      inflows: flows.inflows,
      outflows: flows.outflows,
      netChange,
      projectedBalance: currentBalance + netChange,
    }
  })
}

// ==================== Node/Edge Generation ====================

/**
 * Generate React Flow nodes from accounts and categories
 */
export function generateNodes(
  accounts: AccountInfo[],
  categories: CashFlowCategory[],
  savedLayout?: StoredNodeLayout
): CashFlowNode[] {
  const nodes: CashFlowNode[] = []

  // Source nodes (left column) - Accounts + "External Income"
  const sourceAccounts = accounts.filter((a) => a.balance > 0 || a.type === 'bank-account')
  sourceAccounts.forEach((account, index) => {
    const nodeId = `source-${account.id}`
    const saved = savedLayout?.[nodeId]

    nodes.push({
      id: nodeId,
      type: 'source',
      position: saved || { x: NODE_LAYOUT.sourceColumn, y: index * NODE_LAYOUT.verticalSpacing },
      data: {
        label: account.name,
        accountId: account.id,
        balance: account.balance,
        currency: account.currency,
      },
    })
  })

  // Add "External Income" source node
  const externalIncomeId = 'source-external-income'
  const savedExternal = savedLayout?.[externalIncomeId]
  nodes.push({
    id: externalIncomeId,
    type: 'source',
    position: savedExternal || {
      x: NODE_LAYOUT.sourceColumn,
      y: sourceAccounts.length * NODE_LAYOUT.verticalSpacing
    },
    data: {
      label: 'External Income',
      flowType: 'inflow',
    },
  })

  // Category nodes (middle column)
  categories.forEach((category, index) => {
    const nodeId = `category-${category.id}`
    const saved = savedLayout?.[nodeId]

    nodes.push({
      id: nodeId,
      type: 'category',
      position: saved || { x: NODE_LAYOUT.categoryColumn, y: index * NODE_LAYOUT.verticalSpacing },
      data: {
        label: category.name,
        categoryId: category.id,
        flowType: category.type,
      },
    })
  })

  // Destination nodes (right column) - Accounts + "External Expenses"
  accounts.forEach((account, index) => {
    const nodeId = `destination-${account.id}`
    const saved = savedLayout?.[nodeId]

    nodes.push({
      id: nodeId,
      type: 'destination',
      position: saved || { x: NODE_LAYOUT.destinationColumn, y: index * NODE_LAYOUT.verticalSpacing },
      data: {
        label: account.name,
        accountId: account.id,
        balance: account.balance,
        currency: account.currency,
      },
    })
  })

  // Add "External Expenses" destination node
  const externalExpensesId = 'destination-external-expenses'
  const savedExpenses = savedLayout?.[externalExpensesId]
  nodes.push({
    id: externalExpensesId,
    type: 'destination',
    position: savedExpenses || {
      x: NODE_LAYOUT.destinationColumn,
      y: accounts.length * NODE_LAYOUT.verticalSpacing
    },
    data: {
      label: 'External Expenses',
      flowType: 'outflow',
    },
  })

  return nodes
}

/**
 * Generate React Flow edges from cash flow items
 */
export function generateEdges(
  items: CashFlowItem[],
  accountBalances: Map<string, number>
): CashFlowEdge[] {
  const edges: CashFlowEdge[] = []

  items.forEach((item) => {
    // Determine source node
    let sourceNodeId: string
    if (item.sourceAccountId) {
      sourceNodeId = `source-${item.sourceAccountId}`
    } else {
      sourceNodeId = 'source-external-income'
    }

    // Category node (if specified)
    const categoryNodeId = item.categoryId ? `category-${item.categoryId}` : undefined

    // Determine target node
    let targetNodeId: string
    if (item.destinationAccountId) {
      targetNodeId = `destination-${item.destinationAccountId}`
    } else {
      targetNodeId = 'destination-external-expenses'
    }

    const sourceBalance = item.sourceAccountId
      ? accountBalances.get(item.sourceAccountId)
      : undefined
    const monthlyAmount = calculateMonthlyAmount(item, sourceBalance)

    // Edge from source to category
    if (categoryNodeId) {
      edges.push({
        id: `${item.id}-to-category`,
        source: sourceNodeId,
        target: categoryNodeId,
        data: {
          flowItemId: item.id,
          amount: monthlyAmount,
          percentage: item.percentage,
          color: FLOW_COLORS[item.type],
          flowType: item.type,
        },
        style: {
          stroke: FLOW_COLORS[item.type],
          strokeWidth: 2,
          opacity: item.isActive ? 1 : 0.3,
        },
        animated: item.isActive,
        label: formatEdgeLabel(monthlyAmount, item.percentage),
      })

      // Edge from category to destination
      edges.push({
        id: `${item.id}-from-category`,
        source: categoryNodeId,
        target: targetNodeId,
        data: {
          flowItemId: item.id,
          amount: monthlyAmount,
          percentage: item.percentage,
          color: FLOW_COLORS[item.type],
          flowType: item.type,
        },
        style: {
          stroke: FLOW_COLORS[item.type],
          strokeWidth: 2,
          opacity: item.isActive ? 1 : 0.3,
        },
        animated: item.isActive,
      })
    } else {
      // Direct edge without category
      edges.push({
        id: `${item.id}-direct`,
        source: sourceNodeId,
        target: targetNodeId,
        data: {
          flowItemId: item.id,
          amount: monthlyAmount,
          percentage: item.percentage,
          color: FLOW_COLORS[item.type],
          flowType: item.type,
        },
        style: {
          stroke: FLOW_COLORS[item.type],
          strokeWidth: 2,
          opacity: item.isActive ? 1 : 0.3,
        },
        animated: item.isActive,
        label: formatEdgeLabel(monthlyAmount, item.percentage),
      })
    }
  })

  return edges
}

/**
 * Format edge label (amount or percentage)
 */
function formatEdgeLabel(amount: number, percentage?: number): string {
  if (percentage !== undefined) {
    return `${percentage}%`
  }
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
}

// ==================== Default Configuration ====================

/**
 * Create default categories with UUIDs
 */
export function createDefaultCategories(): CashFlowCategory[] {
  const categories: CashFlowCategory[] = []

  DEFAULT_INFLOW_CATEGORIES.forEach((cat) => {
    categories.push({
      id: generateUUID(),
      ...cat,
      isCustom: false,
    })
  })

  DEFAULT_OUTFLOW_CATEGORIES.forEach((cat) => {
    categories.push({
      id: generateUUID(),
      ...cat,
      isCustom: false,
    })
  })

  DEFAULT_TRANSFER_CATEGORIES.forEach((cat) => {
    categories.push({
      id: generateUUID(),
      ...cat,
      isCustom: false,
    })
  })

  return categories
}

/**
 * Create sample cash flow items for demo
 */
export function createSampleItems(categories: CashFlowCategory[]): CashFlowItem[] {
  const now = new Date().toISOString()

  // Find category IDs
  const salaryCategory = categories.find(c => c.name === 'Salary')
  const rentCategory = categories.find(c => c.name === 'Rent/Mortgage')
  const groceriesCategory = categories.find(c => c.name === 'Groceries')
  const utilitiesCategory = categories.find(c => c.name === 'Utilities')
  const savingsCategory = categories.find(c => c.name === 'Savings Transfer')
  const entertainmentCategory = categories.find(c => c.name === 'Entertainment')

  const items: CashFlowItem[] = []

  if (salaryCategory) {
    items.push({
      id: generateUUID(),
      name: 'Monthly Salary',
      type: 'inflow',
      amount: 8000,
      currency: 'USD',
      frequency: 'monthly',
      categoryId: salaryCategory.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (rentCategory) {
    items.push({
      id: generateUUID(),
      name: 'Rent Payment',
      type: 'outflow',
      amount: 2500,
      currency: 'USD',
      frequency: 'monthly',
      categoryId: rentCategory.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (groceriesCategory) {
    items.push({
      id: generateUUID(),
      name: 'Groceries',
      type: 'outflow',
      amount: 600,
      currency: 'USD',
      frequency: 'monthly',
      categoryId: groceriesCategory.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (utilitiesCategory) {
    items.push({
      id: generateUUID(),
      name: 'Utilities',
      type: 'outflow',
      amount: 200,
      currency: 'USD',
      frequency: 'monthly',
      categoryId: utilitiesCategory.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (entertainmentCategory) {
    items.push({
      id: generateUUID(),
      name: 'Entertainment',
      type: 'outflow',
      amount: 300,
      currency: 'USD',
      frequency: 'monthly',
      categoryId: entertainmentCategory.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (savingsCategory) {
    items.push({
      id: generateUUID(),
      name: 'Monthly Savings',
      type: 'outflow',
      amount: 1500,
      currency: 'USD',
      frequency: 'monthly',
      categoryId: savingsCategory.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  return items
}

/**
 * Create initial cash flow configuration
 */
export function createInitialConfig(
  portfolioId: string,
  baseCurrency: string
): CashFlowConfiguration {
  const categories = createDefaultCategories()
  const items = createSampleItems(categories)

  return {
    portfolioId,
    baseCurrency,
    items,
    categories,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ==================== localStorage Operations ====================

/**
 * Load cash flow configuration from localStorage
 */
export function loadConfig(portfolioId: string): CashFlowConfiguration | null {
  try {
    const key = `cashflow_config_${portfolioId}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const parsed: StoredCashFlowConfig = JSON.parse(stored)
    if (parsed.version !== 1) return null

    return parsed.config
  } catch (error) {
    console.error('Failed to load cash flow config:', error)
    return null
  }
}

/**
 * Save cash flow configuration to localStorage
 */
export function saveConfig(config: CashFlowConfiguration): void {
  try {
    const key = `cashflow_config_${config.portfolioId}`
    const stored: StoredCashFlowConfig = {
      version: 1,
      portfolioId: config.portfolioId,
      config: {
        ...config,
        updatedAt: new Date().toISOString(),
      },
    }
    localStorage.setItem(key, JSON.stringify(stored))
  } catch (error) {
    console.error('Failed to save cash flow config:', error)
  }
}

/**
 * Load node layout from localStorage
 */
export function loadNodeLayout(portfolioId: string): StoredNodeLayout | null {
  try {
    const key = `cashflow_layout_${portfolioId}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to load node layout:', error)
    return null
  }
}

/**
 * Save node layout to localStorage
 */
export function saveNodeLayout(portfolioId: string, nodes: CashFlowNode[]): void {
  try {
    const key = `cashflow_layout_${portfolioId}`
    const layout: StoredNodeLayout = {}

    nodes.forEach((node) => {
      layout[node.id] = {
        x: node.position.x,
        y: node.position.y,
      }
    })

    localStorage.setItem(key, JSON.stringify(layout))
  } catch (error) {
    console.error('Failed to save node layout:', error)
  }
}

// ==================== Validation ====================

/**
 * Validate a cash flow item
 */
export function validateFlowItem(item: Partial<CashFlowItem>): string[] {
  const errors: string[] = []

  if (!item.name || item.name.trim().length === 0) {
    errors.push('Name is required')
  }

  if (!item.type) {
    errors.push('Type is required')
  }

  if (item.amount === undefined || item.amount === null) {
    if (item.percentage === undefined || item.percentage === null) {
      errors.push('Either amount or percentage is required')
    }
  }

  if (item.percentage !== undefined && (item.percentage < 0 || item.percentage > 100)) {
    errors.push('Percentage must be between 0 and 100')
  }

  if (item.type === 'transfer') {
    if (!item.sourceAccountId) {
      errors.push('Transfer requires a source account')
    }
    if (!item.destinationAccountId) {
      errors.push('Transfer requires a destination account')
    }
    if (item.sourceAccountId === item.destinationAccountId) {
      errors.push('Source and destination accounts must be different')
    }
  }

  if (item.type === 'inflow' && item.sourceAccountId) {
    errors.push('Inflows should not have a source account')
  }

  if (item.type === 'outflow' && item.destinationAccountId) {
    errors.push('Outflows should not have a destination account')
  }

  return errors
}

/**
 * Validate a connection between nodes
 */
export function isValidConnection(
  sourceNodeId: string,
  targetNodeId: string,
  sourceType: NodeType,
  targetType: NodeType
): boolean {
  // No self-connections
  if (sourceNodeId === targetNodeId) return false

  // Valid patterns: source→category, category→destination
  if (sourceType === 'source' && targetType === 'category') return true
  if (sourceType === 'category' && targetType === 'destination') return true

  return false
}

// ==================== Currency Conversion ====================

/**
 * Convert amount from one currency to another
 * @param amount - The amount to convert
 * @param fromCurrency - The source currency ('USD' | 'ILS')
 * @param toCurrency - The target currency ('USD' | 'ILS')
 * @param conversionRate - USD to ILS conversion rate (default 3.7)
 * @returns The converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: 'USD' | 'ILS',
  toCurrency: 'USD' | 'ILS',
  conversionRate: number = 3.7
): number {
  // No conversion needed if same currency
  if (fromCurrency === toCurrency) return amount

  // Convert USD to ILS
  if (fromCurrency === 'USD' && toCurrency === 'ILS') {
    return amount * conversionRate
  }

  // Convert ILS to USD
  if (fromCurrency === 'ILS' && toCurrency === 'USD') {
    return amount / conversionRate
  }

  return amount
}

/**
 * Format currency amount with proper symbol
 * @param amount - The amount (should already be in display currency)
 * @param displayCurrency - The currency to display ('USD' | 'ILS')
 * @returns Formatted currency string
 */
export function formatCurrencyAmount(
  amount: number,
  displayCurrency: 'USD' | 'ILS' = 'ILS'
): string {
  const symbol = displayCurrency === 'ILS' ? '₪' : '$'
  return `${symbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/**
 * Convert and format currency in one step
 * @param amount - The amount in source currency
 * @param fromCurrency - The source currency
 * @param toCurrency - The target display currency
 * @param conversionRate - USD to ILS conversion rate
 * @returns Formatted currency string in target currency
 */
export function convertAndFormatCurrency(
  amount: number,
  fromCurrency: 'USD' | 'ILS',
  toCurrency: 'USD' | 'ILS',
  conversionRate: number = 3.7
): string {
  const converted = convertCurrency(amount, fromCurrency, toCurrency, conversionRate)
  return formatCurrencyAmount(converted, toCurrency)
}

// ==================== Formatting ====================

/**
 * Format currency amount
 * @deprecated Use formatCurrencyAmount or convertAndFormatCurrency instead
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

// ==================== Flow Splitting Operations ====================

/**
 * Split a flow by dividing its amount into multiple flows
 * Creates new flows with the same source/destination but different amounts
 */
export function splitFlowByAmount(
  originalFlow: CashFlowItem,
  splits: Array<{ name: string; amount: number }>
): CashFlowItem[] {
  const now = new Date().toISOString()

  return splits.map((split) => ({
    id: generateUUID(),
    name: split.name,
    type: originalFlow.type,
    amount: split.amount,
    currency: originalFlow.currency || 'USD',
    frequency: originalFlow.frequency,
    sourceAccountId: originalFlow.sourceAccountId,
    categoryId: originalFlow.categoryId,
    destinationAccountId: originalFlow.destinationAccountId,
    isActive: originalFlow.isActive,
    startDate: originalFlow.startDate,
    endDate: originalFlow.endDate,
    notes: `Split from "${originalFlow.name}"`,
    createdAt: now,
    updatedAt: now,
  }))
}

/**
 * Split a flow to multiple destinations
 * Creates new flows with same source but different destinations
 */
export function splitFlowByDestination(
  originalFlow: CashFlowItem,
  splits: Array<{ name: string; amount: number; destinationAccountId?: string; categoryId?: string }>
): CashFlowItem[] {
  const now = new Date().toISOString()

  return splits.map((split) => ({
    id: generateUUID(),
    name: split.name,
    type: originalFlow.type,
    amount: split.amount,
    currency: originalFlow.currency || 'USD',
    frequency: originalFlow.frequency,
    sourceAccountId: originalFlow.sourceAccountId,
    categoryId: split.categoryId || originalFlow.categoryId,
    destinationAccountId: split.destinationAccountId || originalFlow.destinationAccountId,
    isActive: originalFlow.isActive,
    startDate: originalFlow.startDate,
    endDate: originalFlow.endDate,
    notes: `Split from "${originalFlow.name}"`,
    createdAt: now,
    updatedAt: now,
  }))
}

/**
 * Add an intermediate category to a flow
 * This doesn't create new flows, but updates the existing flow's category
 */
export function addIntermediateCategory(
  flow: CashFlowItem,
  newCategoryId: string
): CashFlowItem {
  return {
    ...flow,
    categoryId: newCategoryId,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Create a new custom category
 */
export function createCustomCategory(
  name: string,
  type: CashFlowItem['type'],
  icon?: string
): CashFlowCategory {
  return {
    id: generateUUID(),
    name,
    type,
    icon: icon || '📁',
    isCustom: true,
  }
}

/**
 * Calculate remaining amount after splits
 */
export function calculateRemainingAmount(
  originalAmount: number,
  splits: Array<{ amount: number }>
): number {
  const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0)
  return Math.max(0, originalAmount - totalSplit)
}

/**
 * Validate split amounts don't exceed original
 */
export function validateSplitAmounts(
  originalAmount: number,
  splits: Array<{ amount: number }>
): { valid: boolean; error?: string } {
  const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0)

  if (totalSplit > originalAmount) {
    return {
      valid: false,
      error: `Split amounts ($${totalSplit.toLocaleString()}) exceed original amount ($${originalAmount.toLocaleString()})`,
    }
  }

  if (splits.some((s) => s.amount <= 0)) {
    return {
      valid: false,
      error: 'All split amounts must be greater than 0',
    }
  }

  return { valid: true }
}
