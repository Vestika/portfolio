import api from './api';
import { TagDefinition, TagValue, HoldingTags, TagLibrary } from '../types';

export class TagAPI {
  // Tag Library Management
  static async getUserTagLibrary(): Promise<TagLibrary> {
    const response = await api.get('/tags/library');
    return response.data;
  }

  static async createTagDefinition(tagDefinition: TagDefinition): Promise<TagDefinition> {
    const response = await api.post('/tags/definitions', tagDefinition);
    return response.data;
  }

  static async deleteTagDefinition(tagName: string): Promise<void> {
    // URL encode the tag name to handle special characters like ? # & etc.
    const encodedTagName = encodeURIComponent(tagName);
    await api.delete(`/tags/definitions/${encodedTagName}`);
  }

  static async adoptTemplateTag(templateName: string, customName?: string): Promise<TagDefinition> {
    const params = customName ? { custom_name: customName } : {};
    const encodedTemplateName = encodeURIComponent(templateName);
    const response = await api.post(`/tags/adopt-template/${encodedTemplateName}`, null, { params });
    return response.data;
  }

  // Holding Tags Management
  static async getHoldingTags(symbol: string, portfolioId?: string): Promise<HoldingTags> {
    const params = portfolioId ? { portfolio_id: portfolioId } : {};
    const encodedSymbol = encodeURIComponent(symbol);
    const response = await api.get(`/holdings/${encodedSymbol}/tags`, { params });
    return response.data;
  }

  static async setHoldingTag(
    symbol: string,
    tagName: string,
    tagValue: TagValue,
    portfolioId?: string
  ): Promise<HoldingTags> {
    const params = portfolioId ? { portfolio_id: portfolioId } : {};
    const encodedSymbol = encodeURIComponent(symbol);
    const encodedTagName = encodeURIComponent(tagName);
    const response = await api.put(`/holdings/${encodedSymbol}/tags/${encodedTagName}`, tagValue, { params });
    return response.data;
  }

  static async removeHoldingTag(
    symbol: string,
    tagName: string,
    portfolioId?: string
  ): Promise<void> {
    const params = portfolioId ? { portfolio_id: portfolioId } : {};
    const encodedSymbol = encodeURIComponent(symbol);
    const encodedTagName = encodeURIComponent(tagName);
    await api.delete(`/holdings/${encodedSymbol}/tags/${encodedTagName}`, { params });
  }

  static async getAllHoldingTags(portfolioId?: string): Promise<HoldingTags[]> {
    const params = portfolioId ? { portfolio_id: portfolioId } : {};
    const response = await api.get('/holdings/tags', { params });
    return response.data;
  }

  // Tag Search and Aggregation
  static async searchHoldingsByTags(
    tagFilters: Record<string, any>,
    portfolioId?: string
  ): Promise<{ symbols: string[]; filters_used: Record<string, any> }> {
    const params = {
      tag_filters: JSON.stringify(tagFilters),
      ...(portfolioId && { portfolio_id: portfolioId }),
    };
    const response = await api.get('/holdings/search', { params });
    return response.data;
  }

  static async getTagAggregation(
    tagName: string,
    portfolioId?: string
  ): Promise<{ tag_name: string; holdings: any[] }> {
    const params = portfolioId ? { portfolio_id: portfolioId } : {};
    const encodedTagName = encodeURIComponent(tagName);
    const response = await api.get(`/tags/${encodedTagName}/aggregation`, { params });
    return response.data;
  }

  // Template Tags
  static async getTemplateTags(): Promise<{ templates: Record<string, TagDefinition> }> {
    const response = await api.get('/tags/templates');
    return response.data;
  }
}

export default TagAPI; 