import api from './api';

// Types for IBKR API requests and responses
export interface IBKRTestConnectionRequest {
  flex_query_token: string;
  flex_query_id: string;
}

export interface IBKRTestConnectionResponse {
  success: boolean;
  message?: string;
  error?: string;
  accounts_found?: number;
  total_positions?: number;
}

export interface IBKRSyncRequest {
  flex_query_token: string;
  flex_query_id: string;
  force_sync?: boolean;
}

export interface IBKRSyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  holdings?: any[];
  holdings_count?: number;
  total_value?: number;
  currency?: string;
}

export interface IBKRPeriodicSyncRequest {
  interval_minutes: number;
  enable: boolean;
}

export interface IBKRPeriodicSyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  task_id?: string;
  interval_minutes?: number;
}

export interface IBKRDisconnectRequest {
  confirm: boolean;
}

export interface IBKRDisconnectResponse {
  success: boolean;
  message?: string;
  error?: string;
  stopped_tasks?: number;
}

export interface IBKRSyncStatusResponse {
  account_name: string;
  sync_status: string;
  last_sync?: string;
  sync_error?: string;
  account_id?: string;
  account_name_ibkr?: string;
  holdings_count: number;
}

// API functions for IBKR integration
export const testIBKRConnection = async (request: IBKRTestConnectionRequest): Promise<IBKRTestConnectionResponse> => {
  try {
    const response = await api.post('/ibkr/test-connection', request);
    return response.data;
  } catch (error: any) {
    console.error('Error testing IBKR connection:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to test connection'
    };
  }
};

export const syncIBKRHoldings = async (
  portfolioId: string, 
  accountName: string, 
  request: IBKRSyncRequest
): Promise<IBKRSyncResponse> => {
  try {
    const response = await api.post(`/portfolio/${portfolioId}/accounts/${accountName}/ibkr-sync`, request);
    return response.data;
  } catch (error: any) {
    console.error('Error syncing IBKR holdings:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to sync holdings'
    };
  }
};

export const getIBKRSyncStatus = async (
  portfolioId: string, 
  accountName: string
): Promise<IBKRSyncStatusResponse> => {
  try {
    const response = await api.get(`/portfolio/${portfolioId}/accounts/${accountName}/ibkr-sync-status`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting IBKR sync status:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get sync status');
  }
};

export const getIBKRAccountSummary = async (
  portfolioId: string, 
  accountName: string
): Promise<any> => {
  try {
    const response = await api.get(`/portfolio/${portfolioId}/accounts/${accountName}/ibkr-summary`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting IBKR account summary:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to get account summary'
    };
  }
};

export const configureIBKRPeriodicSync = async (
  portfolioId: string, 
  accountName: string, 
  request: IBKRPeriodicSyncRequest
): Promise<IBKRPeriodicSyncResponse> => {
  try {
    const response = await api.post(`/portfolio/${portfolioId}/accounts/${accountName}/ibkr-periodic-sync`, request);
    return response.data;
  } catch (error: any) {
    console.error('Error configuring IBKR periodic sync:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to configure periodic sync'
    };
  }
};

export const disconnectIBKRAccount = async (
  portfolioId: string, 
  accountName: string, 
  request: IBKRDisconnectRequest
): Promise<IBKRDisconnectResponse> => {
  try {
    const response = await api.post(`/portfolio/${portfolioId}/accounts/${accountName}/ibkr-disconnect`, request);
    return response.data;
  } catch (error: any) {
    console.error('Error disconnecting IBKR account:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to disconnect account'
    };
  }
}; 