# News Feature Simplification

## Summary

The news functionality has been reorganized and simplified to improve performance, organization, and user experience.

## Changes Made

### Backend Changes

#### Organization
- **Before**: Single file at `/backend/app/endpoints/news.py`
- **After**: Directory structure at `/backend/app/endpoints/news/__init__.py`

#### Functionality Removed
- ✅ Removed feedback (like/dislike) endpoint and functionality
- ✅ Removed custom date range filtering
- ✅ Removed source filtering
- ✅ Removed free-text search filtering
- ✅ Removed pagination/infinite scroll with `next_window`
- ✅ Removed AI-generated keywords/topics (was disabled anyway)

#### Simplified Behavior
- **Date Range**: Fixed to last 7 days only (no older articles)
- **Keywords**: Auto-generated from user's portfolio holdings only
- **Fetch**: Single batch load (no lazy loading or pagination)
- **Response**: Simple list of articles with company logos

### Frontend Changes

#### Organization
- **Before**: Files scattered in `/frontend/src/components/`
  - `NewsView.tsx`
  - `NewsFeedView.tsx`
  - `NewsFilters.tsx`
- **After**: Organized directory at `/frontend/src/components/news/`
  - `NewsView.tsx`
  - `NewsFeedView.tsx`
  - `index.ts`

#### Functionality Removed
- ✅ Removed NewsFilters component entirely
- ✅ Removed search/filter UI
- ✅ Removed like/dislike buttons
- ✅ Removed "Read" link button
- ✅ Removed infinite scroll logic
- ✅ Removed lazy loading/pagination
- ✅ Removed complex state management for seen articles

#### Simplified Behavior
- **Loading**: Single load on mount, shows all articles
- **Interaction**: Click article card to open in new tab (entire card is clickable)
- **UI**: Clean, simple grid of news cards
- **State**: Minimal - just loading, error, and items array

### API Changes

#### Endpoint: `POST /api/news/feed`

**Request Before**:
```typescript
{
  start_date?: string,
  end_date?: string,
  topics?: string[],
  keywords?: string[],
  page_size?: number,
  sources?: string[],
  q?: string
}
```

**Request After**:
```typescript
{
  page_size?: number  // defaults to 99
}
```

**Response Before**:
```typescript
{
  items: NewsItem[],
  next_window: { start_date: string, end_date: string } | null,
  used_keywords: string[],
  used_topics: string[]
}
```

**Response After**:
```typescript
{
  items: NewsItem[],
  used_keywords: string[]
}
```

#### Removed Endpoints
- `POST /api/news/feedback` (like/dislike)
- `POST /api/news/seen` (tracking seen articles)

## Benefits

1. **Performance**: Single load instead of lazy pagination = faster, simpler
2. **Organization**: Clear directory structure for both backend and frontend
3. **Simplicity**: Removed unused features (AI keywords, feedback, complex filters)
4. **UX**: Cleaner interface, one-click article access
5. **Maintainability**: Less code, fewer edge cases, clearer structure

## Files Modified

### Backend
- Created: `/backend/app/endpoints/news/__init__.py`
- Deleted: `/backend/app/endpoints/news.py`

### Frontend
- Created: `/frontend/src/components/news/NewsView.tsx`
- Created: `/frontend/src/components/news/NewsFeedView.tsx`
- Created: `/frontend/src/components/news/index.ts`
- Modified: `/frontend/src/utils/news-api.ts`
- Modified: `/frontend/src/App.tsx` (updated import)
- Deleted: `/frontend/src/components/NewsView.tsx`
- Deleted: `/frontend/src/components/NewsFeedView.tsx`
- Deleted: `/frontend/src/components/NewsFilters.tsx`

## Migration Notes

- No database migrations needed
- Existing news data remains compatible
- Frontend automatically uses new simplified API
- Users will see a cleaner, faster news experience

