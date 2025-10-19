// Type definitions for the extension

export interface ExtensionConfig {
  id?: string;
  name: string;
  url: string; // URL pattern with wildcards
  full_url: boolean;
  selector?: string;
  created_by: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrivateExtensionConfig {
  id?: string;
  user_id: string;
  extension_config_id: string;
  portfolio_id: string;
  account_id: string;
  auto_sync: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExtractedHolding {
  symbol: string;
  units: number;
  cost_basis?: number;
  security_name?: string;
  confidence_score: number;
}

export interface ExtractionMetadata {
  model_used: string;
  timestamp: string;
  html_size_bytes: number;
  extraction_time_ms: number;
  holdings_count: number;
}

export interface ExtractResponse {
  holdings: ExtractedHolding[];
  extraction_metadata: ExtractionMetadata;
}

export interface ImportRequest {
  portfolio_id: string;
  account_id?: string;
  account_name?: string;
  account_type?: string;
  holdings: Array<{ symbol: string; units: number }>;
  replace_holdings?: boolean;
}

export interface ImportResponse {
  success: boolean;
  portfolio_id: string;
  account_id: string;
  account_name: string;
  imported_holdings_count: number;
  message: string;
}

export interface Portfolio {
  id: string;
  portfolio_name: string;
  base_currency: string;
  accounts: Account[];
}

export interface Account {
  id: string;
  name: string;
  type: string;
  url?: string; // URL associated with this account
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: {
    email: string;
    displayName: string;
    photoURL: string;
    uid: string;
  } | null;
  expiresAt?: number | null; // Token expiration timestamp in milliseconds
  lastUpdated?: number; // Last time auth was fetched/refreshed
}

export interface Message {
  type: 'AUTH_STATE' | 'GET_AUTH_TOKEN' | 'EXTRACT_HTML' | 'AUTO_SYNC' | 'REQUEST_AUTH';
  payload?: any;
  forceRefresh?: boolean;
}
