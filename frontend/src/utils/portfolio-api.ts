import api from './api';

export interface CustomChart {
  chart_id: string;
  chart_title: string;
  tag_name: string;
  chart_type?: string; // 'pie', 'bar', 'stacked-bar', 'sunburst'
  portfolio_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChartRequest {
  chart_title: string;
  tag_name: string;
  chart_type?: string; // 'pie', 'bar', 'stacked-bar', 'sunburst'
  portfolio_id?: string;
}

// Chart marker interface for events like user join date
export interface ChartMarker {
  id: string;
  date: string;  // ISO date string
  label: string;
  description?: string;
  color?: string;
  icon?: string;  // Emoji or icon identifier
}

export type MiniChartTimeframe = '7d' | '30d' | '1y';

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

  async updateChartType(chart_id: string, chart_type: string): Promise<CustomChart> {
    const response = await api.patch(`/user/custom-charts/${chart_id}/chart-type`, { chart_type });
    return response.data;
  }

  // Chart markers (user join date, milestones, etc.)
  async getChartMarkers(): Promise<ChartMarker[]> {
    const response = await api.get('/chart-markers');
    return response.data.markers;
  }

  // Mini-chart timeframe preference
  async getMiniChartTimeframe(): Promise<MiniChartTimeframe> {
    const response = await api.get('/mini-chart-timeframe');
    return response.data.timeframe as MiniChartTimeframe;
  }

  async setMiniChartTimeframe(timeframe: MiniChartTimeframe): Promise<void> {
    await api.post('/mini-chart-timeframe', { timeframe });
  }
}

export default new PortfolioAPI();

