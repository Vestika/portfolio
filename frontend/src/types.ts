export interface PortfolioMetadata {
  base_currency: string;
  user_name: string;
  accounts: AccountInfo[];
}

export interface RSUPlan {
  id: string;
  symbol: string;
  units: number;
  grant_date: string;
  has_cliff: boolean;
  cliff_duration_months?: number;
  vesting_period_years: 3 | 4;
  vesting_frequency: 'monthly' | 'quarterly' | 'annually';
  left_company?: boolean;
  left_company_date?: string | null;
}

export interface ESPPPlan {
  id: string;
  symbol: string;
  units: number;
  income_percentage: number;
  buying_periods: {
    start_date: string;
    end_date: string;
  }[];
  stock_discount_percentage: number;
  base_stock_price: number;
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
  rsu_plans?: RSUPlan[];
  espp_plans?: ESPPPlan[];
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

export interface HistoricalPrice {
  date: string;
  price: number;
}

export interface AccountBreakdown {
  account_name: string;
  account_type: string;
  units: number;
  value: number;
  owners: string[];
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
  account_breakdown?: AccountBreakdown[];
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