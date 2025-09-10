import { useEffect, useRef, useState } from 'react';
import { fetchNewsFeed, NewsItem, sendNewsFeedback } from '../utils/news-api';
import { ExternalLink } from 'lucide-react';
import NewsFilters, { NewsFiltersValue } from './NewsFilters';
import newsPlaceholder from '../assets/news-placeholder.svg';

const CHUNK_SIZE = 33;

export default function NewsFeedView() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [buffer, setBuffer] = useState<NewsItem[]>([]);
  const [nextWindow, setNextWindow] = useState<{ start_date: string; end_date: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NewsFiltersValue>({});
  const seenIdsRef = useRef<Set<string>>(new Set());
  const hasScrolledRef = useRef<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    // initial load
    void loadServerBatch();
  }, []);

  async function loadServerBatch() {
    if (loading || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchNewsFeed({
        start_date: nextWindow?.start_date,
        end_date: nextWindow?.end_date,
      });
      const filtered = resp.items.filter((it) => !seenIdsRef.current.has(it.id));
      setBuffer(filtered);
      setNextWindow(resp.next_window);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }

  function revealMore() {
    if (buffer.length === 0) {
      // Avoid triggering a network fetch before the user has scrolled
      if (!hasScrolledRef.current) return;
      if (isFetchingRef.current) return;
      void loadServerBatch();
      return;
    }
    const next = buffer.slice(0, CHUNK_SIZE);
    const rest = buffer.slice(CHUNK_SIZE);
    setItems((prev) => [...prev, ...next]);
    setBuffer(rest);
  }

  useEffect(() => {
    if (items.length === 0 && buffer.length > 0) {
      revealMore();
    }
  }, [buffer]);

  // Infinite scroll observer
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Mark that the user has interacted by scrolling at least once
    function onScrollOnce() {
      hasScrolledRef.current = true;
      window.removeEventListener('scroll', onScrollOnce, true);
    }
    window.addEventListener('scroll', onScrollOnce, true);

    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        // Do not auto-load more until the user has scrolled
        if (entry.isIntersecting && hasScrolledRef.current) {
          revealMore();
        }
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScrollOnce, true);
    };
  }, [buffer, items]);

  async function onSeen(ids: string[]) {
    ids.forEach((id) => seenIdsRef.current.add(id));
  }

  async function onFeedback(articleId: string, action: 'like' | 'dislike') {
    try {
      await sendNewsFeedback(articleId, action);
    } catch {
      // ignore UI errors
    }
  }

  useEffect(() => {
    // mark first on-screen chunk as seen after render
    if (items.length > 0) {
      const ids = items.slice(Math.max(0, items.length - CHUNK_SIZE)).map((i) => i.id);
      void onSeen(ids);
    }
  }, [items.length]);

  const displayItems = (filters.q ? items.filter((it) => {
    const q = (filters.q || '').toLowerCase();
    const title = (it.title || '').toLowerCase();
    const desc = (it.description || '').toLowerCase();
    const src = (it.source || '').toLowerCase();
    const topic = (it.topic || '').toLowerCase();
    let domain = '';
    try { domain = new URL(it.url).hostname.toLowerCase(); } catch { domain = ''; }
    return title.includes(q) || desc.includes(q) || src.includes(q) || topic.includes(q) || domain.includes(q);
  }) : items);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          <aside className="w-80 shrink-0">
            <div className="sticky top-24">
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Filters</h2>
                <NewsFilters value={filters} onChange={(v) => setFilters(v)} />
                <div className="mt-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                  <div className="text-xs text-gray-400 leading-relaxed">
                    💡 <strong>Pro tip:</strong> Search by company names, sectors, or news sources. Articles load automatically as you scroll.
                  </div>
                </div>
              </div>
            </div>
          </aside>
          
          <main className="flex-1 min-w-0">
            <HeaderBar />
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayItems.map((it) => (
                <ArticleCard key={it.id} item={it} onFeedback={onFeedback} />
              ))}
              {!loading && displayItems.length === 0 && (
                <EmptyState />
              )}
              {loading && items.length === 0 && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}
            </div>
            
            {error && (
              <div className="mt-8 p-4 text-red-300 bg-red-950/30 border border-red-800/50 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="text-red-400">⚠️</span>
                  <span className="font-medium">Error loading news:</span>
                  <span>{error}</span>
                </div>
              </div>
            )}
            
            <div ref={sentinelRef} />
            
            {loading && items.length > 0 && (
              <div className="mt-8 flex justify-center">
                <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-full">
                  <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-gray-400">Loading more articles...</span>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ item, onFeedback }: { item: NewsItem; onFeedback: (id: string, action: 'like' | 'dislike') => void }) {
  const [feedbackState, setFeedbackState] = useState<'none' | 'liked' | 'disliked'>('none');
  const isPlaceholder = !item.imageUrl;
  const image = item.imageUrl ?? newsPlaceholder;
  let domain = '';
  try { domain = new URL(item.url).hostname.replace('www.', ''); } catch { domain = ''; }
  const dateStr = formatDate(item.publishedAt);

  const handleFeedback = async (action: 'like' | 'dislike') => {
    setFeedbackState(action === 'like' ? 'liked' : 'disliked');
    await onFeedback(item.id, action);
  };
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-sm hover:border-gray-700/70 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1 flex flex-col min-h-[400px]">
      {/* Image section with overlay */}
      <div className="relative w-full h-48 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
        <img
          src={image}
          alt={item.title}
          className={`h-full w-full ${isPlaceholder ? 'object-contain p-8 opacity-60' : 'object-cover group-hover:scale-105'} transition-transform duration-300`}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = newsPlaceholder; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Source and date badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Company logos */}
            {item.symbol_logos && item.symbol_logos.length > 0 && (
              <div className="flex items-center gap-1">
                {item.symbol_logos.slice(0, 3).map((logo, index) => (
                  <div
                    key={`${logo.symbol}-${index}`}
                    className="w-6 h-6 rounded-full bg-white/90 p-0.5 flex items-center justify-center"
                    title={logo.symbol}
                  >
                    <img
                      src={logo.logo_url}
                      alt={logo.symbol}
                      className="w-full h-full object-contain rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ))}
                {item.symbol_logos.length > 3 && (
                  <span className="text-xs text-gray-300 bg-gray-900/80 backdrop-blur-sm rounded-full px-2 py-1 border border-gray-700/50">
                    +{item.symbol_logos.length - 3}
                  </span>
                )}
              </div>
            )}
            {domain && (
              <span className="px-2.5 py-1 text-xs font-medium text-gray-200 bg-gray-900/80 backdrop-blur-sm rounded-full border border-gray-700/50">
                {domain}
              </span>
            )}
          </div>
          {dateStr && (
            <span className="px-2.5 py-1 text-xs font-medium text-gray-300 bg-gray-900/80 backdrop-blur-sm rounded-full border border-gray-700/50">
              {dateStr}
            </span>
          )}
        </div>
      </div>
      
      {/* Content section */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1">
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block group/link"
          >
            <h3 className="font-semibold text-white leading-tight line-clamp-2 group-hover/link:text-indigo-300 transition-colors duration-200 mb-3">
              {item.title}
            </h3>
          </a>
          
          {item.description && (
            <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
              {item.description}
            </p>
          )}
        </div>
        
        {/* Action buttons - always at bottom */}
        <div className="flex items-center justify-between h-9 mt-4">
          <div className="flex items-center gap-2 h-9">
            <button
              onClick={() => handleFeedback('like')}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Like article"
            >
              <span className={`text-sm transition-all duration-200 ${feedbackState === 'liked' ? 'scale-125 text-green-400' : 'hover:scale-110'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.818a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
              </span>
            </button>
            <button
              onClick={() => handleFeedback('dislike')}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Dislike article"
            >
              <span className={`text-sm transition-all duration-200 ${feedbackState === 'disliked' ? 'scale-125 text-red-400' : 'hover:scale-110'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.818a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                </svg>
              </span>
            </button>
          </div>
          
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 h-9 text-sm font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all duration-200"
            aria-label="Read full article"
          >
            <span>Read</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

function IconButton({ onClick, children, ariaLabel }: { onClick: () => void; children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 hover:scale-105 active:scale-95"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function HeaderBar() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-xl" />
      <div className="relative bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">📰</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Personalized News
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  AI-curated articles tailored to your portfolio
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Stay informed with the latest market insights, company updates, and financial news that matter to your investments. 
              <span className="text-indigo-400 font-medium"> Keep scrolling to discover more articles.</span>
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Live updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-sm p-5 animate-pulse">
      <div className="w-full h-48 bg-gray-800/50 rounded-xl mb-4" />
      <div className="h-5 bg-gray-800/50 rounded-lg w-3/4 mb-3" />
      <div className="h-3 bg-gray-800/50 rounded w-full mb-2" />
      <div className="h-3 bg-gray-800/50 rounded w-5/6 mb-4" />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-gray-800/50 rounded-lg" />
          <div className="h-9 w-9 bg-gray-800/50 rounded-lg" />
        </div>
        <div className="h-8 w-16 bg-gray-800/50 rounded-lg" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full text-center py-20 border border-dashed border-gray-700/50 rounded-2xl bg-gray-900/20 backdrop-blur-sm">
      <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🔍</span>
      </div>
      <div className="text-xl font-semibold text-white mb-2">No articles found</div>
      <div className="text-gray-400 max-w-md mx-auto leading-relaxed">
        No articles match your current search criteria. Try adjusting your filters or search terms to discover relevant news.
      </div>
    </div>
  );
}

function formatDate(d?: string | null) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return String(d);
  }
}


