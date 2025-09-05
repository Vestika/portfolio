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

export interface OptionsPlan {
  id: string;
  symbol: string;
  units: number;
  grant_date: string;
  exercise_price: number;
  strike_price: number;
  expiration_date: string;
  has_cliff: boolean;
  cliff_duration_months?: number;
  vesting_period_years: 3 | 4;
  vesting_frequency: 'monthly' | 'quarterly' | 'annually';
  option_type: 'iso' | 'nso' | 'eso';
  left_company?: boolean;
  left_company_date?: string | null;
  company_valuation?: number;
  company_valuation_date?: string;
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
  options_plans?: OptionsPlan[];
  rsu_vesting_data?: any[];
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
  structured_tags?: Record<string, TagValue>;
  total_units: number;
  original_price: number;
  original_currency: string;
  value_per_unit: number;
  total_value: number;
  currency: string;
  price_source?: string;
  historical_prices: HistoricalPrice[];
  logo?: string;
  account_breakdown?: AccountBreakdown[];
}

export enum TagType {
  ENUM = "enum",
  MAP = "map",
  SCALAR = "scalar",
  HIERARCHICAL = "hierarchical",
  BOOLEAN = "boolean",
  TIME_BASED = "time_based",
  RELATIONSHIP = "relationship"
}

export enum ScalarDataType {
  FLOAT = "float",
  INTEGER = "integer",
  PERCENTAGE = "percentage",
  CURRENCY = "currency",
  DATE = "date",
  STRING = "string"
}

export interface TagDefinition {
  id?: string;
  user_id: string;
  name: string;
  display_name: string;
  description?: string;
  tag_type: TagType;

  // For ENUM tags
  enum_values?: string[];

  // For SCALAR tags
  scalar_data_type?: ScalarDataType;
  min_value?: number;
  max_value?: number;

  // For MAP tags
  map_key_type?: string;
  allowed_keys?: string[];

  // For HIERARCHICAL tags
  max_depth?: number;
  path_separator?: string;

  // For TIME_BASED tags
  time_format?: string;

  // For RELATIONSHIP tags
  relationship_type?: string;

  // Metadata
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface TagValue {
  tag_name: string;
  tag_type: TagType;

  // Different value types
  enum_value?: string;
  map_value?: Record<string, number>;
  scalar_value?: number | string;
  hierarchical_value?: string[];
  boolean_value?: boolean;
  time_value?: Record<string, any>;
  relationship_value?: string[];

  // Metadata
  created_at?: string;
  updated_at?: string;
}

export interface HoldingTags {
  symbol: string;
  user_id: string;
  portfolio_id?: string;
  tags: Record<string, TagValue>;
  created_at?: string;
  updated_at?: string;
}

export interface TagLibrary {
  id?: string;
  user_id: string;
  tag_definitions: Record<string, TagDefinition>;
  template_tags: Record<string, TagDefinition>;
  created_at?: string;
  updated_at?: string;
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