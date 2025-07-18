export interface PortfolioMetadata {
  base_currency: string;
  user_name: string;
  accounts: AccountInfo[];
}

export interface AccountInfo {
  account_name: string;
  account_total: number;
  account_type: string;
  owners: string[];
  holdings: {
    symbol: string;
    units: number;
  }[];
  account_properties?: {
    [currency: string]: number;
  };
  account_cash?: {
    [currency: string]: number;
  };
  isSelected?: boolean;
}

export interface ChartDataItem {
  label: string;
  value: number;
  percentage: number;
}

export interface PortfolioFile {
  portfolio_id: string;
  portfolio_name: string;
  display_name: string;
}

export interface PortfolioSelectorProps {
  portfolios: PortfolioFile[];
  selectedPortfolioId: string;
  onPortfolioChange: (portfolio_id: string) => void;
  userName: string;
  onPortfolioCreated: (newPortfolioId: string) => Promise<void>;
  onPortfolioDeleted: (deletedPortfolioId: string) => Promise<void>;
  onDefaultPortfolioSet?: (portfolioId: string) => void;
}

export interface ChartBreakdown {
  chart_title: string;
  chart_total: number;
  chart_data: ChartDataItem[];
}

export interface SecurityHolding {
  symbol: string;
  security_type: string;
  name: string;
  tags: Record<string, string>;
  total_units: number;
  original_price: number;
  original_currency: string;
  value_per_unit: number;
  total_value: number;
  currency: string;
  price_source?: string;
  historical_prices: HistoricalPrice[];
}

export interface HistoricalPrice {
  date: string;
  price: number;
}

export interface Quote {
  symbol: string;
  current_price: number;
  percent_change: number;
  last_updated: string;
}

export interface HoldingsTableData {
  base_currency: string;
  holdings: SecurityHolding[];
}

export type PortfolioData = ChartBreakdown[];

export interface DividendBreakdown {
  total_dividends: number;
  breakdown: { period: string; dividends: number }[];
  per_ticker_breakdown: {
    symbol: string;
    total_units: number;
    breakdown: { period: string; dividends: number }[];
  }[];
  period: string;
  accumulate_by: string;
  mock?: boolean;
}