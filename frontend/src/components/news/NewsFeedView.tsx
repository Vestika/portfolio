import { useEffect, useState, useMemo } from 'react';
import { streamNewsFeed, NewsItem } from '../../utils/news-api';
import NewsWordCloud from './NewsWordCloud';
import { useMixpanel } from '../../contexts/MixpanelContext';

export default function NewsFeedView() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { track } = useMixpanel();

  // Memoize callback to prevent re-creating on every render
  const handleWordClick = useMemo(() => (word: string) => {
    // Mixpanel: Track word cloud interaction
    track('feature_news_word_cloud_clicked', {
      has_filter: true, // Don't send actual word for privacy
    });

    setSelectedWord(prevWord => prevWord === word ? null : word);
  }, [track]);

  useEffect(() => {
    // Mixpanel: Track news feed opened
    track('feature_news_feed_opened', {
      holdings_count: items.length, // This will be 0 initially, but still tracks the open
    });

    // Only load once - cache results
    if (!hasLoaded) {
      loadNews();
    }
  }, [hasLoaded, track]);

  async function loadNews() {
    setLoading(true);
    setError(null);
    setItems([]); // Clear old items
    setKeywords([]); // Clear old keywords
    
    try {
      await streamNewsFeed(
        // onArticle: Add each article as it arrives
        (article) => {
          console.log('📰 [FRONTEND] Received article:', article.title);
          setItems((prev) => [...prev, article]);
        },
        // onComplete: Stream finished
        () => {
          setLoading(false);
          setHasLoaded(true);
          console.log('📰 [FRONTEND] News stream completed');
        },
        // onError: Handle errors
        (err) => {
          console.error('📰 [FRONTEND] Stream error:', err);
          setError(err);
          setLoading(false);
        },
        // onKeywords: Set keywords immediately
        (kw) => {
          console.log('📰 [FRONTEND] Received keywords:', kw);
          setKeywords(kw);
        }
      );
    } catch (e: unknown) {
      console.error('📰 [FRONTEND] Load error:', e);
      setError(e instanceof Error ? e.message : 'Failed to load news');
      setLoading(false);
    }
  }

  // Filter and sort articles by selected word and date
  const filteredItems = useMemo(() => {
    let filtered = selectedWord
      ? items.filter(item => 
          item.title.toLowerCase().includes(selectedWord.toLowerCase()) ||
          item.description?.toLowerCase().includes(selectedWord.toLowerCase())
        )
      : items;
    
    // Sort by date (newest first)
    return filtered.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [items, selectedWord]);

  return (
    <>
      {/* Header Section - matching Portfolio/Tags style */}
      <div className="sticky z-30 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700" style={{ top: '37px' }}>
        <div className="container mx-auto flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">
              Personalized News
            </h1>
            <p className="text-sm text-gray-400 mt-0">
              AI-curated articles from the last week, tailored to your portfolio
            </p>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="sticky z-20 bg-gray-800 border-t border-b border-gray-700" style={{ top: '114px' }}>
        <div className="container mx-auto flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 py-1.5 px-2 sm:px-4 overflow-x-auto">
          <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
            <svg className="w-3.5 h-3.5 text-blue-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span className="text-xs font-medium mr-1">Articles:</span>
            <span className="text-xs text-blue-400">{items.length}</span>
          </div>
          <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
            <svg className="w-3.5 h-3.5 text-purple-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-xs font-medium mr-1">Keywords:</span>
            <span className="text-xs text-purple-400">{keywords.length}</span>
          </div>
          {selectedWord && (
            <div className="flex items-center bg-amber-500/20 rounded-full pl-3 pr-2 py-1 border border-amber-500/30">
              <span className="text-xs font-medium text-amber-300">"{selectedWord}"</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWord(null);
                }}
                className="ml-1.5 text-amber-400 hover:text-amber-300 flex items-center justify-center w-3 h-3"
                title="Clear filter"
              >
                <span className="text-[10px] font-bold">✕</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
        <div className="container mx-auto px-4 py-8">
          {/* Word Cloud - standalone chart without container */}
          {items.length > 0 && (
            <div className="mb-8 h-80">
              <NewsWordCloud 
                titles={items.map(item => item.title)} 
                onWordClick={handleWordClick}
                selectedWord={selectedWord || undefined}
              />
            </div>
          )}
          
          {/* Keywords List - shown immediately */}
          {keywords.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                Tracking Symbols ({keywords.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {keywords.sort().map((keyword, index) => (
                  <button
                    key={`${keyword}-${index}`}
                    onClick={() => handleWordClick(keyword)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                      selectedWord === keyword
                        ? 'text-amber-300 bg-amber-500/20 border-amber-500/40'
                        : 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20'
                    }`}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <ArticleCard key={item.id} item={item} />
            ))}
            
            {!loading && filteredItems.length === 0 && items.length > 0 && (
              <div className="col-span-full text-center py-20 border border-dashed border-gray-700/50 rounded-2xl bg-gray-900/20 backdrop-blur-sm">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <div className="text-xl font-semibold text-white mb-2">No articles found</div>
                <div className="text-gray-400 max-w-md mx-auto leading-relaxed mb-4">
                  No articles contain the word "{selectedWord}". Try selecting a different word or clear the filter.
                </div>
                <button
                  onClick={() => setSelectedWord(null)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Clear filter
                </button>
              </div>
            )}
            
            {!loading && items.length === 0 && (
              <EmptyState />
            )}
            
            {loading && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
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
        </div>
      </div>
    </>
  );
}

function ArticleCard({ item }: { item: NewsItem }) {
  const hasImage = !!item.imageUrl;
  const image = item.imageUrl;
  
  let domain = '';
  try { domain = new URL(item.url).hostname.replace('www.', ''); } catch { domain = ''; }
  const dateStr = formatDate(item.publishedAt);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-sm hover:border-gray-700/70 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer"
    >
      {/* Image section with overlay - thinner banner */}
      <div className="relative w-full h-12 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
        {hasImage ? (
          <img
            src={image!}
            alt={item.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { 
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.style.background = 'linear-gradient(to bottom right, rgb(31, 41, 55), rgb(17, 24, 39))';
              }
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-gray-800 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {domain && (
              <span className="px-2 py-0.5 text-xs font-medium text-gray-200 bg-gray-900/90 backdrop-blur-sm rounded-full border border-gray-700/50">
                {domain}
              </span>
            )}
          </div>
          {dateStr && (
            <span className="px-2 py-0.5 text-xs font-medium text-gray-300 bg-gray-900/80 backdrop-blur-sm rounded-full border border-gray-700/50">
              {dateStr}
            </span>
          )}
        </div>
      </div>
      
      {/* Content section - keyword and title only */}
      <div className="p-4 flex flex-col">
        {/* Keyword indicator */}
        {item.keywords && item.keywords.length > 0 && (
          <div className="mb-2">
            <span className="px-2 py-0.5 text-xs font-medium text-indigo-300 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              {item.keywords[0]}
            </span>
          </div>
        )}
        
        <h3 className="font-semibold text-white leading-tight line-clamp-3 group-hover:text-indigo-300 transition-colors duration-200">
          {item.title}
        </h3>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-sm overflow-hidden animate-pulse flex flex-col">
      <div className="w-full h-12 bg-gray-800/50" />
      <div className="p-4 flex flex-col">
        <div className="h-4 bg-gray-800/50 rounded w-16 mb-2" />
        <div className="h-5 bg-gray-800/50 rounded-lg w-3/4 mb-1" />
        <div className="h-4 bg-gray-800/50 rounded w-5/6" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full text-center py-20 border border-dashed border-gray-700/50 rounded-2xl bg-gray-900/20 backdrop-blur-sm">
      <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">📰</span>
      </div>
      <div className="text-xl font-semibold text-white mb-2">No news articles found</div>
      <div className="text-gray-400 max-w-md mx-auto leading-relaxed">
        We couldn't find any news articles related to your portfolio from the last week. Check back soon!
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
