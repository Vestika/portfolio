import api from './api';

export interface AIAnalysisResponse {
  portfolio_id: string;
  analysis: string;
  timestamp: string;
  model_used: string;
  portfolio_summary: {
    total_value: number;
    base_currency: string;
    accounts_count: number;
    holdings_count: number;
  };
}

export interface ChatMessageRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  timestamp: string;
  model_used: string;
  question: string;
}

export interface ChatSession {
  _id: string;
  user_id: string;
  portfolio_id: string;
  created_at: string;
  last_activity: string;
  messages: ChatMessage[];
  is_active: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSessionMessages {
  session_id: string;
  portfolio_id: string;
  messages: ChatMessage[];
  created_at: string;
  last_activity: string;
}

// AI Portfolio Analysis
export const analyzePortfolio = async (portfolioId: string): Promise<AIAnalysisResponse> => {
  try {
    const response = await api.post(`/portfolio/${portfolioId}/analyze`);
    return response.data;
  } catch (error) {
    console.error('Error analyzing portfolio:', error);
    throw error;
  }
};

// AI Chat Functions
export const chatWithAnalyst = async (
  portfolioId: string, 
  message: string, 
  sessionId?: string
): Promise<ChatResponse> => {
  try {
    const request: ChatMessageRequest = {
      message,
      session_id: sessionId
    };
    
    const response = await api.post(`/portfolio/${portfolioId}/chat`, request);
    return response.data;
  } catch (error) {
    console.error('Error chatting with AI analyst:', error);
    throw error;
  }
};

// Chat Session Management
export const getChatSessions = async (portfolioId: string): Promise<ChatSession[]> => {
  try {
    const response = await api.get(`/portfolio/${portfolioId}/chat/sessions`);
    return response.data;
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    throw error;
  }
};

export const getChatSessionMessages = async (
  portfolioId: string, 
  sessionId: string
): Promise<ChatSessionMessages> => {
  try {
    const response = await api.get(`/portfolio/${portfolioId}/chat/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting chat session messages:', error);
    throw error;
  }
};

export const closeChatSession = async (portfolioId: string, sessionId: string): Promise<void> => {
  try {
    await api.delete(`/portfolio/${portfolioId}/chat/sessions/${sessionId}`);
  } catch (error) {
    console.error('Error closing chat session:', error);
    throw error;
  }
};

export const searchChatHistory = async (
  portfolioId: string, 
  query: string
): Promise<ChatSession[]> => {
  try {
    const response = await api.get(`/portfolio/${portfolioId}/chat/search`, {
      params: { query }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching chat history:', error);
    throw error;
  }
}; 