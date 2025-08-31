import { useEffect, useRef, useState } from 'react';
import { fetchNewsFeed, NewsItem, sendNewsFeedback } from '../utils/news-api';
import { ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react';
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
    <div className="flex gap-6 p-4">
      <aside className="w-80 shrink-0">
        <div className="sticky top-20">
          <NewsFilters value={filters} onChange={(v) => setFilters(v)} />
          <div className="mt-3 text-xs text-gray-400">Type to filter by title, description, source, topic, or domain. New articles load as you scroll.</div>
        </div>
      </aside>
      <main className="flex-1">
        <HeaderBar />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        {error && <div className="mt-4 text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">{error}</div>}
        <div ref={sentinelRef} />
        {loading && items.length > 0 && (
          <div className="mt-6 flex justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-gray-500 border-t-transparent rounded-full" />
          </div>
        )}
      </main>
    </div>
  );
}

function ArticleCard({ item, onFeedback }: { item: NewsItem; onFeedback: (id: string, action: 'like' | 'dislike') => void }) {
  const isPlaceholder = !item.imageUrl;
  const image = item.imageUrl ?? newsPlaceholder;
  let domain = '';
  try { domain = new URL(item.url).hostname.replace('www.', ''); } catch { domain = ''; }
  const dateStr = formatDate(item.publishedAt);
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-b from-gray-900 to-black hover:border-gray-700 transition-all">
      {/* Image top, fixed height to unify layout */}
      <div className="w-full h-40 bg-gray-800 overflow-hidden flex items-center justify-center">
        <img
          src={image}
          alt={item.title}
          className={`h-full w-full ${isPlaceholder ? 'object-contain p-6' : 'object-cover'}`}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = newsPlaceholder; }}
        />
      </div>
      {/* Content */}
      <div className="p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          {domain && <span className="px-2 py-0.5 rounded-full bg-gray-800/60 border border-gray-700">{domain}</span>}
          {dateStr && <span className="px-2 py-0.5 rounded-full bg-gray-800/60 border border-gray-700">{dateStr}</span>}
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 block font-semibold text-white leading-snug hover:text-indigo-300 transition-colors">
          <span className="line-clamp-2">{item.title}</span>
        </a>
        {item.description && (
          <p className="mt-2 text-sm text-gray-300 line-clamp-3">{item.description}</p>
        )}
        <div className="mt-3 flex items-center justify-center gap-2">
          <IconButton onClick={() => onFeedback(item.id, 'like')} ariaLabel="Like">
            <ThumbsUp className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={() => onFeedback(item.id, 'dislike')} ariaLabel="Dislike">
            <ThumbsDown className="h-4 w-4" />
          </IconButton>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors"
            aria-label="Open article"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function IconButton({ onClick, children, ariaLabel }: { onClick: () => void; children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function HeaderBar() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Personalized News</h1>
        <p className="text-sm text-gray-400">Fresh articles tailored to your portfolio. Keep scrolling to load more.</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-b from-gray-900 to-black p-4 animate-pulse">
      <div className="w-full h-40 bg-gray-800 rounded mb-3" />
      <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-800 rounded w-full mb-1" />
      <div className="h-3 bg-gray-800 rounded w-5/6" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full text-center py-16 border border-dashed border-gray-800 rounded-xl bg-black/20">
      <div className="text-4xl mb-2">📰</div>
      <div className="text-lg font-medium">No articles match your search</div>
      <div className="text-sm text-gray-400">Try a different keyword or clear the search.</div>
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


