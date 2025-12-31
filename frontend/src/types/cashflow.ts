// Cash Flow Tool Type Definitions

// import type { Node, Edge } from 'reactflow'

// Temporary types until reactflow is properly installed
type Node<T = any> = { id: string; type?: string; data: T; position: { x: number; y: number } };
type Edge = { id: string; source: string; target: string; type?: string };

// Flow Types
export type FlowFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
export type FlowType = 'inflow' | 'outflow' | 'transfer'
export type NodeType = 'source' | 'category' | 'destination'
export type ViewMode = 'diagram' | 'table'
export type TimePeriod = 'monthly' | 'yearly'

// Currency types
export type FlowCurrency = 'USD' | 'ILS'

// Core Data Models
export interface CashFlowItem {
  id: string // UUID
  name: string // "Salary", "Rent", "401k Contribution"
  type: FlowType
  amount: number // Fixed amount in specified currency (0 if percentage-based)
  currency: FlowCurrency // Currency of the amount (USD or ILS)
  percentage?: number // For percentage-based transfers (e.g., 20% to 401k)
  frequency: FlowFrequency
  sourceAccountId?: string // undefined for inflows from external sources
  categoryId?: string // Optional categorization
  destinationAccountId?: string // undefined for outflows to external
  isActive: boolean // Toggle on/off
  startDate?: string // Optional future start date (ISO string)
  endDate?: string // Optional end date (ISO string)
  notes?: string // Optional user notes
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

export interface CashFlowCategory {
  id: string
  name: string
  type: FlowType // Determines color
  icon?: string // Optional emoji or icon identifier
  isCustom: boolean // True for user-created, false for default categories
}

export interface CashFlowConfiguration {
  portfolioId: string
  baseCurrency: string
  items: CashFlowItem[]
  categories: CashFlowCategory[]
  createdAt: string
  updatedAt: string
}

// React Flow Node Data
export interface FlowNodeData {
  label: string
  accountId?: string
  categoryId?: string
  balance?: number
  flowType?: FlowType
  currency?: string
}

export interface FlowEdgeData {
  flowItemId: string
  amount: number // Monthly equivalent
  percentage?: number
  color: string // Hex color code
  flowType: FlowType
}

// Extended React Flow types
export type CashFlowNode = Node<FlowNodeData>
export type CashFlowEdge = Edge & { data?: FlowEdgeData; style?: any; animated?: boolean; label?: string }

// Account Information (simplified from PortfolioDataContext)
export interface AccountInfo {
  id: string // Account name used as ID
  name: string
  type: string
  balance: number
  currency: string
}

// Monthly Calculation Results
export interface MonthlyTotals {
  inflows: number
  outflows: number
  transfers: number
  net: number // inflows - outflows
}

export interface AccountFlowSummary {
  accountId: string
  accountName: string
  inflows: number
  outflows: number
  netChange: number
  projectedBalance: number
}

export interface CashFlowSummaryData {
  monthly: MonthlyTotals
  yearly: MonthlyTotals
  byAccount: AccountFlowSummary[]
}

// Projection Data
export interface ProjectionPoint {
  month: number // 0-11 for 12 months
  date: Date
  inflows: number
  outflows: number
  net: number
  cumulativeBalance: number
}

// localStorage Storage
export interface StoredCashFlowConfig {
  version: number // For future migrations
  portfolioId: string
  config: CashFlowConfiguration
}

export interface StoredNodeLayout {
  [nodeId: string]: {
    x: number
    y: number
  }
}

// Modal Form State
export interface CashFlowFormData {
  name: string
  type: FlowType
  amount: number
  usePercentage: boolean
  percentage: number
  frequency: FlowFrequency
  sourceAccountId: string
  destinationAccountId: string
  categoryId: string
  startDate: string
  endDate: string
  notes: string
}

export interface CashFlowFormErrors {
  name?: string
  amount?: string
  percentage?: string
  sourceAccountId?: string
  destinationAccountId?: string
  categoryId?: string
  [key: string]: string | undefined
}

// Connection State (for drag-and-drop)
export interface PendingConnection {
  sourceNodeId: string
  targetNodeId: string
  sourceType: NodeType
  targetType: NodeType
}

// Sankey Chart Interactivity Types
export type SankeyNodeType = 'income' | 'account' | 'category' | 'expenses'

export interface SankeyNodeInfo {
  name: string
  nodeType: SankeyNodeType
  accountId?: string
  categoryId?: string
  totalFlow: number
  inflows: CashFlowItem[]
  outflows: CashFlowItem[]
}

export interface SankeyLinkInfo {
  from: string
  to: string
  weight: number
  flowItems: CashFlowItem[]
}

export interface ContextMenuState {
  x: number
  y: number
  linkInfo: SankeyLinkInfo
}

export interface SplitFlowData {
  type: 'divide' | 'multiple-destinations' | 'add-intermediate'
  originalFlow: CashFlowItem
  splits: Array<{
    name: string
    amount: number
    categoryId?: string
    destinationAccountId?: string
  }>
  intermediateCategory?: {
    name: string
    type: FlowType
  }
}

// Default Categories by Type
export const DEFAULT_INFLOW_CATEGORIES: Omit<CashFlowCategory, 'id' | 'isCustom'>[] = [
  { name: 'Salary', type: 'inflow', icon: '💼' },
  { name: 'Freelance Income', type: 'inflow', icon: '💻' },
  { name: 'Investment Income', type: 'inflow', icon: '📈' },
  { name: 'Rental Income', type: 'inflow', icon: '🏠' },
  { name: 'Tax Refund', type: 'inflow', icon: '💵' },
  { name: 'Bonus', type: 'inflow', icon: '🎁' },
  { name: 'Other Income', type: 'inflow', icon: '💰' },
]

export const DEFAULT_OUTFLOW_CATEGORIES: Omit<CashFlowCategory, 'id' | 'isCustom'>[] = [
  { name: 'Rent/Mortgage', type: 'outflow', icon: '🏡' },
  { name: 'Groceries', type: 'outflow', icon: '🛒' },
  { name: 'Utilities', type: 'outflow', icon: '💡' },
  { name: 'Insurance', type: 'outflow', icon: '🛡️' },
  { name: 'Transportation', type: 'outflow', icon: '🚗' },
  { name: 'Entertainment', type: 'outflow', icon: '🎬' },
  { name: 'Healthcare', type: 'outflow', icon: '🏥' },
  { name: 'Education', type: 'outflow', icon: '📚' },
  { name: 'Other Expenses', type: 'outflow', icon: '💸' },
]

export const DEFAULT_TRANSFER_CATEGORIES: Omit<CashFlowCategory, 'id' | 'isCustom'>[] = [
  { name: '401k Contribution', type: 'transfer', icon: '🏦' },
  { name: 'IRA Contribution', type: 'transfer', icon: '🏦' },
  { name: 'Savings Transfer', type: 'transfer', icon: '💎' },
  { name: 'Investment Purchase', type: 'transfer', icon: '📊' },
  { name: 'Credit Card Payment', type: 'transfer', icon: '💳' },
  { name: 'Loan Payment', type: 'transfer', icon: '🏦' },
]

// Color Palette
export const FLOW_COLORS = {
  inflow: '#10B981', // green-500
  outflow: '#EF4444', // red-500
  transfer: '#3B82F6', // blue-500
} as const

// Node Layout Constants
export const NODE_LAYOUT = {
  sourceColumn: 100,
  categoryColumn: 450,
  destinationColumn: 800,
  verticalSpacing: 120,
  nodeWidth: 180,
  nodeHeight: 80,
} as const

// Frequency Multipliers (to convert to monthly)
export const FREQUENCY_MULTIPLIERS: Record<FlowFrequency, number> = {
  weekly: 52 / 12, // ~4.33
  'bi-weekly': 26 / 12, // ~2.17
  monthly: 1,
  quarterly: 1 / 3, // ~0.333
  yearly: 1 / 12, // ~0.083
}

// Frequency Display Labels
export const FREQUENCY_LABELS: Record<FlowFrequency, string> = {
  weekly: 'Weekly',
  'bi-weekly': 'Bi-Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

// Scenario Types (for backend persistence)
export interface CashFlowScenario {
  scenarioId?: string // MongoDB _id (only after save)
  portfolioId: string
  name: string
  items: CashFlowItem[]
  categories: CashFlowCategory[]
  baseCurrency: string
  createdAt?: string
  updatedAt?: string
}

// Draft scenario for local editing before save
export interface DraftCashFlowScenario extends CashFlowScenario {
  localId: string // Local UUID for tracking
  isDirty: boolean // Has unsaved changes
}
