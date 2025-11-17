// API client for Vestika backend
import { logger } from './utils';
import type { AutoImportOptions } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.vestika.io';

export class VestikaAPI {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const method = options.method || 'GET';
    const startTime = Date.now();

    // Log request
    logger.logApiRequest(endpoint, method, options.body ? JSON.parse(options.body as string) : undefined);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));

        // Log error response
        logger.logApiResponse(endpoint, method, duration, response.status, error);

        throw new Error(error.detail || error.error || 'Request failed');
      }

      const data = await response.json();

      // Log successful response
      logger.logApiResponse(endpoint, method, duration, response.status, data);

      return data;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log network or other errors
      logger.logApiResponse(endpoint, method, duration, 0, { error: error.message });

      throw error;
    }
  }

  // Extract holdings from HTML - returns session_id
  async extractHoldings(
    html: string,
    sourceUrl?: string,
    selector?: string,
    options?: {
      shared_config_id?: string;
      private_config_id?: string;
      trigger?: 'manual' | 'autosync';
      auto_import?: AutoImportOptions;
    }
  ) {
    const body: Record<string, unknown> = {
      html_body: html,
      source_url: sourceUrl,
      selector: selector,
    };

    if (options?.shared_config_id) {
      body.shared_config_id = options.shared_config_id;
    }

    if (options?.private_config_id) {
      body.private_config_id = options.private_config_id;
    }

    if (options?.trigger) {
      body.trigger = options.trigger;
    }

    if (options?.auto_import) {
      body.auto_import = options.auto_import;
    }

    return this.request('/api/import/extract', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Get extraction session
  async getExtractionSession(sessionId: string) {
    return this.request(`/api/import/sessions/${sessionId}`, {
      method: 'GET',
    });
  }

  // Import holdings from session
  async importHoldings(data: {
    session_id: string;
    portfolio_id: string;
    account_name?: string;
    account_type?: string;
    replace_holdings?: boolean;
  }) {
    return this.request('/api/import/holdings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Match configs for URL
  async matchConfigsForUrl(url: string) {
    const encodedUrl = encodeURIComponent(url);
    return this.request(`/api/import/configs/match?url=${encodedUrl}`);
  }

  // Shared configs
  async getSharedConfigs() {
    return this.request('/api/import/configs');
  }

  async createSharedConfig(config: any) {
    return this.request('/api/import/configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updateSharedConfig(id: string, config: any) {
    return this.request(`/api/import/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async deleteSharedConfig(id: string) {
    return this.request(`/api/import/configs/${id}`, {
      method: 'DELETE',
    });
  }

  // Private configs
  async getPrivateConfigs() {
    return this.request('/api/import/private-configs');
  }

  async createPrivateConfig(config: any) {
    return this.request('/api/import/private-configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updatePrivateConfig(id: string, config: any) {
    return this.request(`/api/import/private-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async deletePrivateConfig(id: string) {
    return this.request(`/api/import/private-configs/${id}`, {
      method: 'DELETE',
    });
  }

  // Portfolios
  async getPortfolios() {
    return this.request('/portfolios/raw');
  }

  async createPortfolio(portfolioName: string, baseCurrency: string = 'USD') {
    return this.request('/portfolio', {
      method: 'POST',
      body: JSON.stringify({
        portfolio_name: portfolioName,
        base_currency: baseCurrency,
      }),
    });
  }

  async createAccount(portfolioId: string, accountName: string, accountType: string = 'taxable-brokerage') {
    return this.request(`/portfolio/${portfolioId}/accounts`, {
      method: 'POST',
      body: JSON.stringify({
        account_name: accountName,
        account_type: accountType,
        holdings: [],
      }),
    });
  }
}

export const api = new VestikaAPI();
