import api from './api';
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
  next_window: { start_date: string; end_date: string } | null;
  used_keywords: string[];
  used_topics: string[];
};

export async function fetchNewsFeed(params: {
  start_date?: string;
  end_date?: string;
  page_size?: number; // server batch size (e.g., 99)
  q?: string;
}): Promise<NewsFeedResponse> {
  const res = await api.post(`/api/news/feed`, params);
  return res.data as NewsFeedResponse;
}

export async function markNewsSeen(articleIds: string[]): Promise<{ ok: boolean; count: number }> {
  const res = await api.post(`/api/news/seen`, { articleIds });
  return res.data as { ok: boolean; count: number };
}

export async function sendNewsFeedback(articleId: string, action: 'like' | 'dislike'): Promise<{ ok: boolean }> {
  const res = await api.post(`/api/news/feedback`, { articleId, action });
  return res.data as { ok: boolean };
}


