import api from './api'
import type {
  CashFlowItem,
  CashFlowCategory,
  FlowType,
  FlowFrequency,
  FlowCurrency,
} from '../types/cashflow'

// Backend response types (snake_case)
interface CashFlowItemResponse {
  id: string
  name: string
  type: string
  amount: number
  currency: string
  percentage?: number
  frequency: string
  source_account_id?: string
  category_id?: string
  destination_account_id?: string
  is_active: boolean
  start_date?: string
  end_date?: string
  notes?: string
}

interface CashFlowCategoryResponse {
  id: string
  name: string
  type: string
  icon?: string
  is_custom: boolean
}

interface CashFlowScenarioResponse {
  scenario_id: string
  portfolio_id: string
  name: string
  items: CashFlowItemResponse[]
  categories: CashFlowCategoryResponse[]
  base_currency: string
  created_at: string
  updated_at: string
}

// Frontend types
export interface CashFlowScenario {
  scenarioId?: string
  portfolioId: string
  name: string
  items: CashFlowItem[]
  categories: CashFlowCategory[]
  baseCurrency: string
  createdAt?: string
  updatedAt?: string
}

// Get all scenarios for the current user, optionally filtered by portfolio
export async function getScenarios(portfolioId?: string): Promise<CashFlowScenario[]> {
  const params = portfolioId ? { portfolio_id: portfolioId } : {}
  const response = await api.get<CashFlowScenarioResponse[]>('/cash-flow/scenarios', { params })
  return response.data.map(mapResponseToScenario)
}

// Get a single scenario by ID
export async function getScenario(scenarioId: string): Promise<CashFlowScenario> {
  const response = await api.get<CashFlowScenarioResponse>(`/cash-flow/scenarios/${scenarioId}`)
  return mapResponseToScenario(response.data)
}

// Create a new scenario
export async function createScenario(scenario: CashFlowScenario): Promise<CashFlowScenario> {
  const response = await api.post<CashFlowScenarioResponse>('/cash-flow/scenarios', {
    portfolio_id: scenario.portfolioId,
    name: scenario.name,
    items: scenario.items.map(mapItemToRequest),
    categories: scenario.categories.map(mapCategoryToRequest),
    base_currency: scenario.baseCurrency,
  })
  return mapResponseToScenario(response.data)
}

// Update an existing scenario
export async function updateScenario(
  scenarioId: string,
  scenario: Partial<CashFlowScenario>
): Promise<CashFlowScenario> {
  const payload: Record<string, unknown> = {}
  if (scenario.name !== undefined) payload.name = scenario.name
  if (scenario.items !== undefined) {
    payload.items = scenario.items.map(mapItemToRequest)
  }
  if (scenario.categories !== undefined) {
    payload.categories = scenario.categories.map(mapCategoryToRequest)
  }
  if (scenario.baseCurrency !== undefined) payload.base_currency = scenario.baseCurrency

  const response = await api.put<CashFlowScenarioResponse>(
    `/cash-flow/scenarios/${scenarioId}`,
    payload
  )
  return mapResponseToScenario(response.data)
}

// Delete a scenario
export async function deleteScenario(scenarioId: string): Promise<void> {
  await api.delete(`/cash-flow/scenarios/${scenarioId}`)
}

// Helper: Map backend response to frontend model
function mapResponseToScenario(response: CashFlowScenarioResponse): CashFlowScenario {
  return {
    scenarioId: response.scenario_id,
    portfolioId: response.portfolio_id,
    name: response.name,
    items: response.items.map(mapResponseToItem),
    categories: response.categories.map(mapResponseToCategory),
    baseCurrency: response.base_currency,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  }
}

function mapResponseToItem(item: CashFlowItemResponse): CashFlowItem {
  return {
    id: item.id,
    name: item.name,
    type: item.type as FlowType,
    amount: item.amount,
    currency: item.currency as FlowCurrency,
    percentage: item.percentage,
    frequency: item.frequency as FlowFrequency,
    sourceAccountId: item.source_account_id,
    categoryId: item.category_id,
    destinationAccountId: item.destination_account_id,
    isActive: item.is_active,
    startDate: item.start_date,
    endDate: item.end_date,
    notes: item.notes,
    createdAt: '', // Not stored per-item in backend
    updatedAt: '',
  }
}

function mapResponseToCategory(cat: CashFlowCategoryResponse): CashFlowCategory {
  return {
    id: cat.id,
    name: cat.name,
    type: cat.type as FlowType,
    icon: cat.icon,
    isCustom: cat.is_custom,
  }
}

// Helper: Map frontend item to backend request format
function mapItemToRequest(item: CashFlowItem): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    amount: item.amount,
    currency: item.currency,
    percentage: item.percentage,
    frequency: item.frequency,
    source_account_id: item.sourceAccountId,
    category_id: item.categoryId,
    destination_account_id: item.destinationAccountId,
    is_active: item.isActive,
    start_date: item.startDate,
    end_date: item.endDate,
    notes: item.notes,
  }
}

function mapCategoryToRequest(cat: CashFlowCategory): Record<string, unknown> {
  return {
    id: cat.id,
    name: cat.name,
    type: cat.type,
    icon: cat.icon,
    is_custom: cat.isCustom,
  }
}
