# Personalized News Feed Implementation

Personalized, infinite-scroll news feed tailored to each user based on their portfolios. Fetch news from the last 7 days, allow filtering (date, topic, source, keywords), and ensure users do not see duplicates they already viewed. Use the `gnews` package for sourcing articles and Gemini to generate user-specific keywords and valid GNews topics.

Reference: [gnews on PyPI](https://pypi.org/project/gnews/)

## Completed Tasks

- [x] Create this feature task list document

## In Progress Tasks

- [ ] None

## Future Tasks

- [ ] Design backend data model to store per-user seen article IDs
- [ ] Implement Gemini prompt to derive keywords and valid GNews topics from user holdings
- [ ] Build GNews client wrapper (7-day window, topics, keywords, pagination)
- [ ] Implement server-side deduplication (canonical URL, fallback: title+publisher+date)
- [ ] Create backend feed API (date-window pagination via start_date/end_date, filters, mark-as-seen)
- [ ] Add server bulk fetch (e.g., max_results=99) and client chunking (render 33 at a time)
- [ ] Build frontend `NewsFeedView` with infinite scroll and internal chunking of server batch
- [ ] Add filters UI (date range, topics multi-select, sources, keywords)
- [ ] Implement card tiles with image (placeholder if missing), title, description, source, date
- [ ] Add like/dislike actions on each tile; wire to feedback API; update UI state
- [ ] Persist user feedback (like/dislike) per article with timestamp and user id
- [ ] Use feedback and seen-state to refine personalization (future improvement)
- [ ] Add caching and basic rate limiting for external fetches
- [ ] Add tests (unit and integration) plus logging/monitoring

## Implementation Plan

### Overview and Data Flow

1. Aggregate user context
   - Collect holdings across all user portfolios (symbols, names, sectors, tags).
2. Keyword and topic generation (Gemini)
   - Prompt Gemini with holdings to output:
     - A concise ranked list of search keywords
     - A subset of valid GNews topics only (restricted to allowed list)
   - Validate and normalize topics to the allowed set before use.
3. Fetch news via GNews
   - Time range: last 7 days using `start_date` and `end_date`
   - Fetch by topic (`get_news_by_topic`) and by keyword (`get_news`)
   - Merge results and deduplicate by canonical URL (fallback hash).
4. Personalize and filter
   - Exclude items already seen by the user (server-side)
   - Support client filters (date, topics, sources, keywords)
5. Serve feed
   - Date-window pagination using `start_date`/`end_date`; stable ordering by published date
   - Server fetches a bulk batch (e.g., up to 99 items) per request; client renders in sub-pages of 33 and requests the next server batch when depleted
6. Persist seen-state and feedback
   - Store per-user seen article IDs and per-article feedback (like/dislike with timestamp)

### API (Proposed)

- POST `/api/news/feed`
  - Query: `page_size` (e.g., 99), `start_date`, `end_date`, `topics[]`, `sources[]`, `keywords[]`
  - Response: `{ items: NewsItem[], next_window: { start_date: string, end_date: string } | null }`
- POST `/api/news/seen`
  - Body: `{ articleIds: string[] }`
  - Marks articles as seen for the authenticated user
- POST `/api/news/feedback`
  - Body: `{ articleId: string, action: 'like' | 'dislike' }`
  - Persists user feedback for the article; returns updated feedback summary if needed

### Pagination Model

- Initial window: `end_date = now`, `start_date = end_date - 7d` (default)
- Next page (older): `next_end_date = (oldest(items).publishedAt) - 1s`, `next_start_date = next_end_date - 7d`
- Server returns up to `page_size` items for the window; client shows 33 at a time internally

### News Item Shape (server response)

{
  id: string,          // stable hash from canonical URL
  title: string,
  description: string,
  url: string,
  imageUrl: string | null,
  publishedAt: string, // ISO
  source: string,      // publisher name or domain
  topic: string | null,
  keywords: string[]
}

### Feedback Model (server)

{
  userId: string,
  articleId: string,
  action: 'like' | 'dislike',
  createdAt: string // ISO
}

### Deduplication Strategy

- Primary: normalized canonical URL (strip tracking params)
- Secondary: normalized (title, source, published_date)
- Server guarantees uniqueness; client keeps a safety set by `id`

### Topics Handling

- Gemini must return topics limited to the official GNews list below
- Validate and map to exact constants before calling GNews

Allowed topics: WORLD, NATION, BUSINESS, TECHNOLOGY, ENTERTAINMENT, SPORTS, SCIENCE, HEALTH, POLITICS, CELEBRITIES, TV, MUSIC, MOVIES, THEATER, SOCCER, CYCLING, MOTOR SPORTS, TENNIS, COMBAT SPORTS, BASKETBALL, BASEBALL, FOOTBALL, SPORTS BETTING, WATER SPORTS, HOCKEY, GOLF, CRICKET, RUGBY, ECONOMY, PERSONAL FINANCE, FINANCE, DIGITAL CURRENCIES, MOBILE, ENERGY, GAMING, INTERNET SECURITY, GADGETS, VIRTUAL REALITY, ROBOTICS, NUTRITION, PUBLIC HEALTH, MENTAL HEALTH, MEDICINE, SPACE, WILDLIFE, ENVIRONMENT, NEUROSCIENCE, PHYSICS, GEOLOGY, PALEONTOLOGY, SOCIAL SCIENCES, EDUCATION, JOBS, ONLINE EDUCATION, HIGHER EDUCATION, VEHICLES, ARTS-DESIGN, BEAUTY, FOOD, TRAVEL, SHOPPING, HOME, OUTDOORS, FASHION.

### Frontend

- `NewsFeedView`
  - Infinite scroll (date-window pagination)
  - Render server batch internally in chunks of 33; prefetch next when near depletion
  - Card tiles with image (placeholder if missing), title, description, source, date
  - Like/Dislike buttons per tile; optimistic UI updates; hide disliked if required
  - Filters panel: date range (default 7 days), topics multi-select, sources, keywords
  - Client-side dedupe set; optimistic mark-as-seen on open/click

### Backend

- GNews client wrapper
  - Parameters: `language`, `country`, `start_date`, `end_date`, `max_results` (e.g., 99), `exclude_websites`
  - Fetch both by topic and keyword, then union and dedupe
- Keyword/topic generation
  - Gemini prompt consumes holdings (symbols, names, sectors, tags)
  - Output JSON: `{ keywords: string[], topics: string[] }`
- Persistence
  - Extend user preferences/profile with `seen_article_ids`
  - Add feedback storage: `news_feedback` collection/table (userId, articleId, action, createdAt)
  - Optional cache (memory/redis) for fetched pages
- Observability
  - Structured logs, error handling, request IDs

### Environment and Config

- `GEMINI_API_KEY` for keyword/topic generation
- `GNEWS_LANGUAGE`, `GNEWS_COUNTRY` defaults (e.g., `en`, `US`)
- Optional `GNEWS_PROXY`

## Relevant Files

- `backend/services/news/service.py` — Orchestrates keyword/topic generation, fetching, dedupe
- `backend/services/news/gnews_client.py` — GNews SDK wrapper
- `backend/services/news/keyword_generator.py` — Gemini integration
- `backend/app/main.py` — Register news API routes
- `backend/models/user_preferences.py` — Extend to store `seen_article_ids`
- `backend/models/news_feedback.py` — New model for like/dislike feedback
- `frontend/src/components/NewsFeedView.tsx` — Main feed view (infinite scroll)
- `frontend/src/components/NewsFilters.tsx` — Filters UI
- `frontend/src/utils/news-api.ts` — Client for news endpoints and feedback
- `frontend/src/types.ts` — Types for `NewsItem`, filters, responses, feedback

## Notes

- Default server window: last 7 days; UI can expand/narrow
- Respect rate limits; backoff and caching recommended
- Accessibility: semantic cards, keyboard navigation, alt text for images
- Internationalization: language/country configurable for GNews
