import api from './api';
import { auth } from '../firebase';

export type NewsItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  source: string;
  topic: string | null;
  keywords: string[];
  symbol_logos?: Array<{
    symbol: string;
    logo_url: string;
  }>;
};

export type NewsFeedResponse = {
  items: NewsItem[];
  used_keywords: string[];
};

export async function fetchNewsFeed(params?: {
  page_size?: number;
}): Promise<NewsFeedResponse> {
  const res = await api.post(`/api/news/feed`, params || {});
  return res.data as NewsFeedResponse;
}

export async function streamNewsFeed(
  onArticle: (article: NewsItem) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  onKeywords?: (keywords: string[]) => void
): Promise<void> {
  try {
    // Get Firebase auth token
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const token = await user.getIdToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/news/feed/stream`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to stream news feed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (!data.trim()) continue; // Skip empty data
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.done) {
              console.log('📰 [SSE] Stream done');
              onComplete();
            } else if (parsed.error) {
              console.error('📰 [SSE] Error:', parsed.error);
              onError(parsed.error);
            } else if (parsed.keywords && !parsed.id) {
              // Keywords message has keywords array but no id (differentiates from article)
              console.log('📰 [SSE] Keywords list received:', parsed.keywords);
              onKeywords?.(parsed.keywords);
            } else if (parsed.id && parsed.title) {
              // Article message has id and title
              console.log('📰 [SSE] Article received:', parsed.title);
              onArticle(parsed as NewsItem);
            }
          } catch (e) {
            console.warn('📰 [SSE] Parse error:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Failed to stream news');
  }
}
