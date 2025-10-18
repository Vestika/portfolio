// API client for Vestika backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export class VestikaAPI {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.detail || error.error || 'Request failed');
    }

    return response.json();
  }

  // Extract holdings from HTML
  async extractHoldings(html: string, configId: string, portfolioId?: string) {
    return this.request('/api/extension/extract', {
      method: 'POST',
      body: JSON.stringify({
        html_body: html,
        extension_config_id: configId,
        portfolio_id: portfolioId,
      }),
    });
  }

  // Import holdings
  async importHoldings(data: {
    portfolio_id: string;
    account_id?: string;
    account_name?: string;
    account_type?: string;
    holdings: Array<{ symbol: string; units: number }>;
    replace_holdings?: boolean;
  }) {
    return this.request('/api/extension/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Shared configs
  async getSharedConfigs() {
    return this.request('/api/extension/configs');
  }

  async createSharedConfig(config: any) {
    return this.request('/api/extension/configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updateSharedConfig(id: string, config: any) {
    return this.request(`/api/extension/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async deleteSharedConfig(id: string) {
    return this.request(`/api/extension/configs/${id}`, {
      method: 'DELETE',
    });
  }

  // Private configs
  async getPrivateConfigs() {
    return this.request('/api/extension/private-configs');
  }

  async createPrivateConfig(config: any) {
    return this.request('/api/extension/private-configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updatePrivateConfig(id: string, config: any) {
    return this.request(`/api/extension/private-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async deletePrivateConfig(id: string) {
    return this.request(`/api/extension/private-configs/${id}`, {
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
