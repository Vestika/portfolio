import api from './api'
import { TaxScenario, TaxEntry, TaxSettings } from '../types/tax-planner'

// Backend response types
interface TaxEntryResponse {
  id: string
  symbol: string
  security_name?: string
  portfolio_id?: string
  account_name?: string
  units: number
  cost_basis_per_unit: number
  sell_price_per_unit: number
  sell_date?: string
  currency: string
  notes?: string
}

interface TaxSettingsResponse {
  tax_rate_percent: number
}

interface TaxScenarioResponse {
  scenario_id: string
  name: string
  description?: string
  year?: number
  entries: TaxEntryResponse[]
  base_currency: string
  tax_settings?: TaxSettingsResponse
  created_at: string
  updated_at: string
}

// Get all scenarios for the current user
export async function getScenarios(year?: number): Promise<TaxScenario[]> {
  const params = year ? { year } : {}
  const response = await api.get<TaxScenarioResponse[]>('/tax-planner/scenarios', { params })
  return response.data.map(mapResponseToScenario)
}

// Get a single scenario by ID
export async function getScenario(scenarioId: string): Promise<TaxScenario> {
  const response = await api.get<TaxScenarioResponse>(`/tax-planner/scenarios/${scenarioId}`)
  return mapResponseToScenario(response.data)
}

// Create a new scenario
export async function createScenario(scenario: TaxScenario): Promise<TaxScenario> {
  const response = await api.post<TaxScenarioResponse>('/tax-planner/scenarios', {
    name: scenario.name,
    description: scenario.description,
    year: scenario.year,
    entries: scenario.entries.map(mapEntryToRequest),
    base_currency: scenario.baseCurrency,
    tax_settings: scenario.taxSettings ? mapTaxSettingsToRequest(scenario.taxSettings) : undefined
  })
  return mapResponseToScenario(response.data)
}

// Update an existing scenario
export async function updateScenario(
  scenarioId: string,
  scenario: Partial<TaxScenario>
): Promise<TaxScenario> {
  const payload: Record<string, unknown> = {}
  if (scenario.name !== undefined) payload.name = scenario.name
  if (scenario.description !== undefined) payload.description = scenario.description
  if (scenario.year !== undefined) payload.year = scenario.year
  if (scenario.entries !== undefined) {
    payload.entries = scenario.entries.map(mapEntryToRequest)
  }
  if (scenario.baseCurrency !== undefined) payload.base_currency = scenario.baseCurrency
  if (scenario.taxSettings !== undefined) {
    payload.tax_settings = mapTaxSettingsToRequest(scenario.taxSettings)
  }

  const response = await api.put<TaxScenarioResponse>(
    `/tax-planner/scenarios/${scenarioId}`,
    payload
  )
  return mapResponseToScenario(response.data)
}

// Delete a scenario
export async function deleteScenario(scenarioId: string): Promise<void> {
  await api.delete(`/tax-planner/scenarios/${scenarioId}`)
}

// Helper: Map backend response to frontend model
function mapResponseToScenario(response: TaxScenarioResponse): TaxScenario {
  return {
    scenarioId: response.scenario_id,
    name: response.name,
    description: response.description,
    year: response.year,
    entries: response.entries.map(mapResponseToEntry),
    baseCurrency: response.base_currency,
    taxSettings: response.tax_settings ? mapResponseToTaxSettings(response.tax_settings) : undefined,
    createdAt: response.created_at,
    updatedAt: response.updated_at
  }
}

function mapResponseToTaxSettings(settings: TaxSettingsResponse): TaxSettings {
  return {
    taxRatePercent: settings.tax_rate_percent
  }
}

function mapTaxSettingsToRequest(settings: TaxSettings): Record<string, number> {
  return {
    tax_rate_percent: settings.taxRatePercent
  }
}

function mapResponseToEntry(e: TaxEntryResponse): TaxEntry {
  return {
    id: e.id,
    symbol: e.symbol,
    securityName: e.security_name,
    portfolioId: e.portfolio_id,
    accountName: e.account_name,
    units: e.units,
    costBasisPerUnit: e.cost_basis_per_unit,
    sellPricePerUnit: e.sell_price_per_unit,
    sellDate: e.sell_date,
    currency: e.currency,
    notes: e.notes
  }
}

// Helper: Map frontend entry to backend request format
function mapEntryToRequest(entry: TaxEntry): Record<string, unknown> {
  return {
    id: entry.id,
    symbol: entry.symbol,
    security_name: entry.securityName,
    portfolio_id: entry.portfolioId,
    account_name: entry.accountName,
    units: entry.units,
    cost_basis_per_unit: entry.costBasisPerUnit,
    sell_price_per_unit: entry.sellPricePerUnit,
    sell_date: entry.sellDate,
    currency: entry.currency,
    notes: entry.notes
  }
}
