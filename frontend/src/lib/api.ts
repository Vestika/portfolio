import {ApiResponse, PaginatedResponse} from "@/lib/types.ts";

class ApiClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string = 'http://localhost:8000/api/v1') {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: errorText || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Generic CRUD methods
  async create<T>(endpoint: string, data: Partial<T>): Promise<ApiResponse<{ id: string }>> {
    return this.request(`/${endpoint}/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getById<T>(endpoint: string, id: string): Promise<ApiResponse<T>> {
    return this.request(`/${endpoint}/${id}`);
  }

  async list<T>(
    endpoint: string,
    params: { skip?: number; limit?: number } = {}
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', params.skip.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request(`/${endpoint}/${query ? `?${query}` : ''}`);
  }

  async update<T>(endpoint: string, id: string, data: Partial<T>): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/${endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string, id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/${endpoint}/${id}`, {
      method: 'DELETE',
    });
  }

  // Nested resource methods
  async createNested<T>(
    parentEndpoint: string,
    parentId: string,
    childEndpoint: string,
    data: Partial<T>
  ): Promise<ApiResponse<{ id: string }>> {
    return this.request(`/${parentEndpoint}/${parentId}/${childEndpoint}/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listNested<T>(
    parentEndpoint: string,
    parentId: string,
    childEndpoint: string,
    params: { skip?: number; limit?: number } = {}
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', params.skip.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request(`/${parentEndpoint}/${parentId}/${childEndpoint}/${query ? `?${query}` : ''}`);
  }

  async getNestedById<T>(
    parentEndpoint: string,
    parentId: string,
    childEndpoint: string,
    childId: string
  ): Promise<ApiResponse<T>> {
    return this.request(`/${parentEndpoint}/${parentId}/${childEndpoint}/${childId}`);
  }

  async updateNested<T>(
    parentEndpoint: string,
    parentId: string,
    childEndpoint: string,
    childId: string,
    data: Partial<T>
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/${parentEndpoint}/${parentId}/${childEndpoint}/${childId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNested(
    parentEndpoint: string,
    parentId: string,
    childEndpoint: string,
    childId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/${parentEndpoint}/${parentId}/${childEndpoint}/${childId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
