// Type definitions for the extension

// Shared configuration for popular financial sites
export interface SharedConfig {
  config_id?: string;
  site_name: string;
  url_pattern: string; // Regex pattern
  selector?: string;
  full_page: boolean;

  // Metadata
  creator_id?: string;
  creator_name?: string;
  is_public: boolean;
  verified: boolean;
  status: 'active' | 'under_review' | 'deprecated';

  // Usage stats
  enabled_users_count: number;
  successful_imports_count: number;
  failure_count: number;
  last_used_at?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Private config for auto-sync
export interface PrivateConfig {
  private_config_id?: string;
  user_id: string;
  shared_config_id: string;
  portfolio_id: string;
  account_name?: string;
  account_type?: string;
  enabled: boolean;
  auto_sync_enabled?: boolean;
  notification_preference: 'notification_only' | 'auto_redirect';
  last_sync_at?: string;
  last_sync_status?: 'success' | 'failed' | 'conflict' | 'processing';
  created_at: string;
  updated_at: string;
}

// Config match response
export interface ConfigMatchResponse {
  configs: SharedConfig[];
  matched: boolean;
}

// Aliases for backwards compatibility
export type ExtensionConfig = SharedConfig;
export type PrivateExtensionConfig = PrivateConfig;

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

export interface AutoImportOptions {
  portfolio_id: string;
  account_name?: string;
  account_type?: string;
  replace_holdings?: boolean;
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
  type: 'AUTH_STATE' | 'GET_AUTH_TOKEN' | 'EXTRACT_HTML' | 'AUTO_SYNC' | 'REQUEST_AUTH' | 'EXTRACTION_SUCCESS' | 'EXTRACTION_FAILED' | 'EXTRACTION_CONFLICT' | 'CLEAR_BADGE';
  payload?: any;
  forceRefresh?: boolean;
}
