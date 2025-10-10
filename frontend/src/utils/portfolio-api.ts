import api from './api';

export interface CustomChart {
  chart_id: string;
  chart_title: string;
  tag_name: string;
  portfolio_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChartRequest {
  chart_title: string;
  tag_name: string;
  portfolio_id?: string;
}

class PortfolioAPI {
  async createCustomChart(data: CreateChartRequest): Promise<CustomChart> {
    const response = await api.post('/user/custom-charts', data);
    return response.data;
  }

  async getCustomCharts(portfolio_id?: string): Promise<CustomChart[]> {
    const params = portfolio_id ? { portfolio_id } : {};
    const response = await api.get('/user/custom-charts', { params });
    return response.data;
  }

  async deleteCustomChart(chart_id: string): Promise<void> {
    await api.delete(`/user/custom-charts/${chart_id}`);
  }
}

export default new PortfolioAPI();

