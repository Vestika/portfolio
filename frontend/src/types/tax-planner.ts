// Tax Planner Types

// Individual tax entry (sell transaction)
export interface TaxEntry {
  id: string                    // UUID for local management
  symbol: string                // Stock symbol (e.g., "AAPL")
  securityName?: string         // Display name (e.g., "Apple Inc.")
  portfolioId?: string          // Linked portfolio ID
  accountName?: string          // Linked account (for grouping)
  units: number                 // Number of shares to sell
  costBasisPerUnit: number      // Cost basis per share
  sellPricePerUnit: number      // Expected/actual sell price per share
  sellDate?: string             // Date of sale (ISO string)
  currency: string              // Currency (e.g., "USD")
  notes?: string                // Optional notes
}

// Saved scenario (what gets persisted to backend)
export interface TaxScenario {
  scenarioId?: string           // MongoDB ObjectId (only after save)
  name: string                  // Scenario name (e.g., "2025 Tax Planning")
  description?: string          // Optional description
  year?: number                 // Tax year (e.g., 2025)
  entries: TaxEntry[]           // List of tax entries
  baseCurrency: string          // Base currency for totals
  createdAt?: string            // ISO timestamp
  updatedAt?: string            // ISO timestamp
}

// Grouping options for view
export type TaxGroupBy = 'account' | 'symbol' | 'none'

// Computed totals
export interface TaxTotals {
  totalCostBasis: number
  totalSellValue: number
  totalProfitLoss: number
  profitLossPercent: number
}

// Group totals for grouped views
export interface GroupTotals {
  groupName: string
  entries: TaxEntry[]
  totals: TaxTotals
}
