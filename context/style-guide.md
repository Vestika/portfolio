# Frontend Style Guide

This document defines coding conventions, patterns, and best practices for the Vestika frontend codebase. It integrates brand guidelines with Anthropic's recommendations for AI-assisted development and our established React/TypeScript patterns.

## Table of Contents

1. [Brand Guidelines](#brand-guidelines)
2. [File Organization](#file-organization)
3. [TypeScript Conventions](#typescript-conventions)
4. [Component Structure](#component-structure)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Styling Guidelines](#styling-guidelines)
8. [React Patterns](#react-patterns)
9. [Error Handling](#error-handling)
10. [Performance Optimization](#performance-optimization)
11. [Testing Practices](#testing-practices)
12. [AI-Assisted Development Guidelines](#ai-assisted-development-guidelines)

---

## Brand Guidelines

### Brand Identity

**Vestika** is a modern, AI-powered portfolio management system with a clean, professional aesthetic that emphasizes clarity and precision in financial data visualization.

#### Brand Name
- **Name**: Vestika
- **Pronunciation**: ves-TEE-kah
- **Capitalization**: Always capitalize the first letter: "Vestika" (never "vestika" or "VESTIKA")

#### Tagline
- "A portfolio management system"
- Keep it simple and descriptive

---

### Color Palette

#### Primary Colors

**Background & Structure**
```css
/* Main background - Pure black for maximum contrast */
background-color: #000000;  /* black */

/* Surface colors - Dark grays for cards and panels */
background-color: #1a1a1a;  /* gray-900 equivalent */
background-color: #262626;  /* gray-800 */
background-color: #171717;  /* gray-900 dark variant */
```

**Text Colors**
```css
/* Primary text - White for main content */
color: #ffffff;              /* white */
color: rgba(255, 255, 255, 0.87);  /* white with slight transparency */

/* Secondary text - Gray variations */
color: #d4d4d4;              /* gray-300 */
color: #a3a3a3;              /* gray-400 */
color: #737373;              /* gray-500 */
```

**Accent Color - Pink Glow**
```css
/* Brand accent - Pink/magenta for highlights and brand elements */
color: rgb(251, 46, 118);    /* Primary pink */

/* Pink glow effect (used on logo) */
text-shadow:
  0 0 3px rgb(251, 46, 118),
  0 0 5px rgba(251, 46, 118, 0.7),
  0 0 6px rgba(251, 46, 118, 0.4);
```

**Interactive Colors**
```css
/* Links and interactive elements */
color: #646cff;              /* Primary blue */
color: #535bf2;              /* Hover blue */

/* Action buttons */
background-color: #3b82f6;   /* blue-600 */
background-color: #2563eb;   /* blue-700 (hover) */
```

**Status Colors**
```css
/* Success/Positive */
color: #22c55e;              /* green-500 */
background-color: #16a34a;   /* green-600 */

/* Warning */
color: #eab308;              /* yellow-500 */
background-color: #ca8a04;   /* yellow-600 */

/* Error/Destructive */
color: #ef4444;              /* red-500 */
background-color: #dc2626;   /* red-600 */
background-color: #7f1d1d;   /* red-900 for backgrounds */
```

**Border Colors**
```css
/* Subtle borders */
border-color: #374151;       /* gray-800 border */
border-color: #1f2937;       /* gray-700 border */
```

#### Color Usage Guidelines

✅ **Do:**
- Use pure black (`#000000`) for main backgrounds
- Use white (`#ffffff`) for primary text on dark backgrounds
- Use gray-800/900 (`#1a1a1a`, `#262626`) for card backgrounds and panels
- Use pink glow effect (`rgb(251, 46, 118)`) sparingly for brand elements (logo, special highlights)
- Use blue (`#3b82f6`) for primary action buttons
- Use semantic colors (green, yellow, red) for status indicators

❌ **Don't:**
- Don't use light backgrounds (the app is dark-mode only)
- Don't overuse the pink glow effect - reserve it for the brand logo
- Don't use pink for interactive elements (use blue instead)
- Avoid gray text on gray backgrounds (ensure sufficient contrast)

---

### Typography

#### Font Families

**Display Font (Brand)**
```css
font-family: 'Poiret One', sans-serif;
```
- **Usage**: Logo, brand name, special headings only
- **Characteristics**: Elegant, modern, geometric sans-serif
- **Weight**: Regular (400)
- **Example**:
  ```tsx
  <h1 style={{ fontFamily: "'Poiret One', sans-serif" }}>
    Vestika
  </h1>
  ```

**Body Font (Primary)**
```css
font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
```
- **Usage**: All body text, UI elements, data tables
- **Characteristics**: Clean, highly legible, optimized for screens
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Fallback chain**: Inter → system-ui → Avenir → Helvetica → Arial → sans-serif

**Chart/Visualization Font**
```css
font-family: system-ui, -apple-system, sans-serif;
```
- **Usage**: Chart labels, axis text, data visualizations
- **Characteristics**: System native font for optimal rendering

#### Font Sizes (Tailwind Classes)

```css
/* Headings */
.text-6xl { font-size: 3.75rem; }   /* 60px - Hero/Modal titles */
.text-3xl { font-size: 1.875rem; }  /* 30px - Page titles */
.text-2xl { font-size: 1.5rem; }    /* 24px - Section headers */
.text-xl  { font-size: 1.25rem; }   /* 20px - Card titles */
.text-lg  { font-size: 1.125rem; }  /* 18px - Subheadings, logo */

/* Body */
.text-base { font-size: 1rem; }     /* 16px - Default body text */
.text-sm   { font-size: 0.875rem; } /* 14px - Secondary text, labels */
.text-xs   { font-size: 0.75rem; }  /* 12px - Captions, helper text */
```

#### Typography Best Practices

✅ **Do:**
- Use `'Poiret One'` only for the brand name "Vestika"
- Use Inter for all UI text and data
- Maintain consistent hierarchy: larger/bolder for more important content
- Use `font-medium` (500) or `font-semibold` (600) for emphasis
- Ensure text has sufficient contrast against backgrounds (WCAG AA minimum)

❌ **Don't:**
- Don't use Poiret One for body text or UI elements
- Don't use too many font weights in a single view (stick to 2-3)
- Don't use font sizes smaller than `text-xs` (12px)
- Avoid mixing system fonts with Inter in the same component

---

### Logo & Brand Mark

#### Logo Usage

**Text Logo with Glow Effect**
```tsx
<h1
  className="text-lg sm:text-xl text-white hover:text-gray-300 transition-colors"
  style={{
    fontFamily: "'Poiret One', sans-serif",
    textShadow: '0 0 3px rgb(251, 46, 118), 0 0 5px rgba(251, 46, 118, 0.7), 0 0 6px rgba(251, 46, 118, 0.4)'
  }}
>
  Vestika
</h1>
```

**Logo Specifications:**
- Font: Poiret One
- Size: `text-lg` (18px) on mobile, `text-xl` (20px) on desktop
- Color: White (`#ffffff`)
- Effect: Pink glow with 3 layers of shadow
- Hover state: Transitions to `text-gray-300`
- Interactive: Clickable to open About modal

#### Logo Placement
- **Primary location**: Top-left corner of TopBar
- **Spacing**: 3-4 units gap from left edge (`px-4 sm:px-6`)
- **Always visible**: Fixed position via sticky header (`sticky top-0 z-50`)

#### Logo Usage Guidelines

✅ **Do:**
- Always use the pink glow effect with the logo
- Maintain the hover interaction (gray-300 on hover)
- Keep logo clickable to About modal
- Use responsive sizing (`text-lg sm:text-xl`)

❌ **Don't:**
- Don't remove the glow effect from the brand name
- Don't change the font from Poiret One
- Don't use the glow effect on other text elements
- Don't place logo anywhere except the top-left corner

---

### Spacing & Layout

#### Spacing Scale (Tailwind)

```css
/* Padding/Margin values */
.p-1  { padding: 0.25rem; }   /* 4px */
.p-2  { padding: 0.5rem; }    /* 8px */
.p-3  { padding: 0.75rem; }   /* 12px */
.p-4  { padding: 1rem; }      /* 16px - Most common for cards */
.p-6  { padding: 1.5rem; }    /* 24px - Large cards */
.p-8  { padding: 2rem; }      /* 32px - Page containers */

/* Gap for flex/grid */
.gap-2 { gap: 0.5rem; }       /* 8px - Tight spacing */
.gap-3 { gap: 0.75rem; }      /* 12px - Icon + text */
.gap-4 { gap: 1rem; }         /* 16px - Standard spacing */
.gap-6 { gap: 1.5rem; }       /* 24px - Section spacing */
```

#### Container Widths

```css
/* Full width with padding */
.w-full { width: 100%; }
.max-w-7xl { max-width: 80rem; }      /* 1280px - Main container */
.max-w-5xl { max-width: 64rem; }      /* 1024px - Modal content */
.max-w-3xl { max-width: 48rem; }      /* 768px - Text content */

/* Responsive viewport widths */
.w-[95vw] { width: 95vw; }            /* Nearly full viewport */
```

#### Layout Patterns

**Standard Page Layout:**
```tsx
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Page content */}
</div>
```

**Card/Panel:**
```tsx
<div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
  {/* Card content */}
</div>
```

**Section Spacing:**
```tsx
<div className="space-y-4">  {/* Vertical spacing between items */}
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

### UI Components

#### Buttons

**Primary Button (Action)**
```tsx
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
  Save
</button>
```

**Secondary Button (Subtle)**
```tsx
<button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors">
  Cancel
</button>
```

**Destructive Button**
```tsx
<button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors">
  Delete
</button>
```

**Ghost Button (Minimal)**
```tsx
<button className="text-gray-400 hover:text-white transition-colors bg-transparent">
  Skip
</button>
```

#### Input Fields

**Standard Input**
```tsx
<input
  type="text"
  className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
  placeholder="Enter value..."
/>
```

**Select Dropdown**
```tsx
<select className="w-full bg-gray-900 text-white rounded-md px-3 py-2 border border-gray-700">
  <option value="">Choose option</option>
  <option value="1">Option 1</option>
</select>
```

#### Cards & Panels

**Standard Card**
```tsx
<div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
  <h3 className="text-lg font-semibold text-white mb-2">Card Title</h3>
  <p className="text-gray-300">Card content</p>
</div>
```

**Nested Panel (darker)**
```tsx
<div className="bg-gray-900 rounded-md p-3 border border-gray-700">
  {/* Darker panel for nested content */}
</div>
```

#### Borders & Rounded Corners

```css
/* Border radius */
.rounded      { border-radius: 0.25rem; }  /* 4px - Subtle */
.rounded-md   { border-radius: 0.375rem; } /* 6px - Standard */
.rounded-lg   { border-radius: 0.5rem; }   /* 8px - Cards */
.rounded-full { border-radius: 9999px; }   /* Circular - Avatars, badges */

/* Border widths */
.border       { border-width: 1px; }       /* Default */
.border-2     { border-width: 2px; }       /* Emphasis (active states) */
.border-b     { border-bottom-width: 1px; } /* Dividers */
.border-b-2   { border-bottom-width: 2px; } /* Active nav items */
```

---

### Icons & Imagery

#### Icon Library
- **Library**: Lucide React (`lucide-react`)
- **Default size**: `h-4 w-4` (16px) for inline icons
- **Large icons**: `h-5 w-5` (20px) or `h-6 w-6` (24px) for standalone icons
- **Color**: Inherit from parent or `text-gray-400` for subtle icons

**Icon Usage Examples:**
```tsx
import { PieChart, Tags, Wrench, Bot, Newspaper } from 'lucide-react'

// Navigation icon
<PieChart className="h-4 w-4" />

// Icon button
<button className="text-gray-400 hover:text-white">
  <Settings className="h-5 w-5" />
</button>
```

#### Stock/Security Logos
- **Location**: Displayed next to symbols in holdings tables
- **Size**: Small, consistent sizing
- **Fallback**: First letter of symbol if logo unavailable
- **Storage**: URLs in `global_logos` from API

#### User Avatars
- **Shape**: Circular (`rounded-full`)
- **Size**: `h-8 w-8` for topbar, `h-12 w-12` for profile cards
- **Source**: Google profile pictures or Firebase auth avatars
- **Fallback**: User initials on colored background

---

### Animations & Transitions

#### Transition Classes

```css
/* Standard transitions */
.transition-colors    /* Color changes (200ms) */
.transition-all       /* All properties (200ms) */
.transition-opacity   /* Fade in/out */
.transition-transform /* Movement/scaling */

/* Duration modifiers */
.duration-200  /* 200ms - Quick (default) */
.duration-300  /* 300ms - Standard */
.duration-500  /* 500ms - Slow, smooth */
```

#### Common Animation Patterns

**Hover Effects:**
```tsx
// Text color change
<button className="text-gray-400 hover:text-white transition-colors">

// Background change
<div className="bg-blue-600 hover:bg-blue-700 transition-colors">

// Scale up slightly
<img className="hover:scale-105 transition-transform">
```

**Loading States:**
```tsx
// Skeleton shimmer
<div className="animate-pulse bg-gray-800 rounded-lg h-20" />

// Fade in when loaded
<div className="transition-opacity duration-500 opacity-0 data-loaded:opacity-100">
```

**Modal/Dialog Entry:**
```tsx
// Backdrop blur + fade
<div className="backdrop-blur-md bg-black/80 transition-opacity">

// Content slide up (handled by Radix UI Dialog)
```

---

### Responsive Design

#### Breakpoints (Tailwind)

```css
/* Mobile first approach */
/* Default: < 640px (mobile) */

sm:  /* ≥ 640px  (large phones, small tablets) */
md:  /* ≥ 768px  (tablets) */
lg:  /* ≥ 1024px (laptops) */
xl:  /* ≥ 1280px (desktops) */
2xl: /* ≥ 1536px (large desktops) */
```

#### Responsive Patterns

**Hide on Mobile, Show on Desktop:**
```tsx
<nav className="hidden md:flex items-center gap-6">
  {/* Desktop navigation */}
</nav>
```

**Show on Mobile, Hide on Desktop:**
```tsx
<button className="md:hidden">
  <Menu className="h-5 w-5" />
</button>
```

**Responsive Sizing:**
```tsx
// Padding
<div className="px-4 sm:px-6 lg:px-8">

// Font size
<h1 className="text-lg sm:text-xl md:text-2xl">

// Layout direction
<div className="flex flex-col md:flex-row gap-4">
```

**Mobile Menu Pattern:**
```tsx
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

return (
  <>
    {/* Hamburger button (mobile only) */}
    <button
      className="md:hidden text-gray-400"
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
    >
      {isMobileMenuOpen ? <X /> : <Menu />}
    </button>

    {/* Mobile menu overlay */}
    {isMobileMenuOpen && (
      <div className="md:hidden absolute top-full left-0 right-0 bg-gray-900 border-t border-gray-800">
        {/* Mobile nav items */}
      </div>
    )}
  </>
)
```

---

### Accessibility Guidelines

#### Color Contrast
- **WCAG AA minimum**: 4.5:1 for normal text, 3:1 for large text
- White text on black background: ✅ Excellent (21:1)
- Gray-300 text on gray-900 background: ✅ Good (≈8:1)
- Gray-400 text on gray-800 background: ⚠️ Check for small text

#### Interactive Elements
```tsx
// Focus states
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900">

// Keyboard navigation
<div role="button" tabIndex={0} onKeyDown={handleKeyPress}>

// ARIA labels
<button aria-label="Close modal">
  <X className="h-4 w-4" />
</button>
```

#### Screen Reader Support
- Use semantic HTML (`<nav>`, `<main>`, `<header>`)
- Provide alt text for images: `alt="Company logo for AAPL"`
- Label form inputs: `<label htmlFor="symbol">Symbol</label>`
- Use ARIA roles when needed: `role="dialog"`, `role="menu"`

---

### Brand Voice & Messaging

#### Tone
- **Professional** but approachable
- **Data-driven** and precise
- **Helpful** without being condescending
- **Modern** and tech-forward

#### Key Messages
- "Portfolio management made simple"
- "AI-powered insights for your investments"
- "Track, analyze, and optimize your financial future"

#### Writing Style
- Use active voice
- Be concise and direct
- Avoid jargon unless necessary
- Explain financial terms when used

**Example UI Copy:**

✅ **Good:**
- "Add your first holding to get started"
- "Portfolio value: $123,456"
- "Last updated 5 minutes ago"

❌ **Avoid:**
- "Please proceed to add securities to your account"
- "Total portfolio valuation: $123,456.00 USD"
- "Timestamp: 2025-10-25T14:30:00Z"

---

### Design Principles

1. **Clarity First**: Financial data should be immediately understandable
2. **Consistency**: Use established patterns throughout the application
3. **Performance**: Optimize for fast loading and smooth interactions
4. **Mobile-Friendly**: Responsive design is mandatory, not optional
5. **Accessibility**: Design for all users, including those with disabilities

---

## File Organization

### Directory Structure

```
frontend/src/
├── components/          # Feature components and views
│   ├── ui/             # Reusable UI primitives (Radix UI + Tailwind)
│   ├── PortfolioView.tsx
│   ├── AIChat.tsx
│   └── ...
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── utils/              # API clients and utilities
│   ├── api.ts         # Axios client with auth
│   ├── tag-api.ts     # Tag service API
│   └── portfolio-api.ts
├── types.ts            # Central type definitions
├── App.tsx             # Main application component
└── main.tsx            # Entry point
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Component files** | PascalCase | `PortfolioView.tsx`, `TopBar.tsx` |
| **Utility files** | kebab-case | `tag-api.ts`, `portfolio-api.ts` |
| **Component names** | PascalCase | `function PortfolioView() {}` |
| **Variables/functions** | camelCase | `const handleClick`, `isLoading` |
| **Constants** | UPPER_SNAKE_CASE | `const API_TIMEOUT = 5000` |
| **Interfaces** | PascalCase | `interface PortfolioViewProps` |
| **Types** | PascalCase | `type NavigationView = 'portfolios'` |
| **Enums** | PascalCase | `enum TagType { ENUM = "enum" }` |

### Import Organization

Organize imports in this order with blank lines between groups:

```typescript
// 1. React imports
import React, { useState, useEffect, useCallback } from 'react';

// 2. Third-party libraries
import { Menu, X, ChevronDown } from 'lucide-react';

// 3. Local contexts and hooks
import { usePortfolioData } from '../contexts/PortfolioDataContext';

// 4. Local components
import { Button } from './ui/button';

// 5. Types and utilities
import { SecurityHolding } from '../types';
import api from '../utils/api';
```

### Export Patterns

**Prefer named exports:**
```typescript
// ✅ Good
export function TopBar({ currentView }: TopBarProps) { }
```

**Use default exports** for singleton services:
```typescript
// ✅ Good
class TagAPI { }
export default TagAPI;
```

---

## TypeScript Conventions

### Type Definitions

**Central types file** (`src/types.ts`):
```typescript
export interface SecurityHolding {
  symbol: string;
  security_type: string;
  total_value: number;
}

export enum TagType {
  ENUM = "enum",
  SCALAR = "scalar"
}
```

**Component props** (top of component file):
```typescript
interface HoldingTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
}
```

### Type Annotations

**Always annotate return types** for public APIs:
```typescript
// ✅ Good
export async function getUserTagLibrary(): Promise<TagLibrary> {
  return response.data;
}
```

**Use type inference** for obvious local variables:
```typescript
// ✅ Good
const [isOpen, setIsOpen] = useState(false);
const total = holdings.reduce((sum, h) => sum + h.total_value, 0);
```

---

## Component Structure

### Standard Template

```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';

// 2. Interface definitions
interface ComponentProps {
  data: SecurityHolding[];
}

// 3. Component definition
export function ComponentName({ data }: ComponentProps) {
  // 4. State hooks
  const [selected, setSelected] = useState(null);

  // 5. Context hooks
  const { allPortfoliosData } = usePortfolioData();

  // 6. Effect hooks
  useEffect(() => {
    console.log('🔄 [Component] Data updated');
  }, [data]);

  // 7. Event handlers
  const handleClick = useCallback((id: string) => {
    setSelected(id);
  }, []);

  // 8. Early returns
  if (!data) return null;

  // 9. Main render
  return <div>{/* JSX */}</div>;
}
```

---

## State Management

### Context API

```typescript
const PortfolioDataContext = createContext<ContextType | undefined>(undefined);

export const usePortfolioData = () => {
  const context = useContext(PortfolioDataContext);
  if (!context) {
    throw new Error('usePortfolioData must be used within Provider');
  }
  return context;
};

export const PortfolioDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState(null);

  return (
    <PortfolioDataContext.Provider value={{ data }}>
      {children}
    </PortfolioDataContext.Provider>
  );
};
```

### Data Loading Strategy

**Load ALL data once** at startup:
```typescript
const initializeApp = useCallback(async () => {
  await loadAllPortfoliosData();
}, []);

// Portfolio switching is instant (no API call, just filtering)
const switchPortfolio = (portfolioId: string) => {
  setSelectedPortfolioId(portfolioId);
};
```

---

## API Integration

### Centralized Client (`src/utils/api.ts`)

```typescript
import axios from 'axios';
import { auth } from '../firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Token caching with 5-minute buffer
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getAuthToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const now = Date.now();
  const bufferTime = 5 * 60 * 1000;

  if (cachedToken && tokenExpiry > now + bufferTime) {
    return cachedToken;
  }

  const token = await user.getIdToken(false);
  cachedToken = token;
  return token;
};

api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### API Service Classes

```typescript
export class TagAPI {
  static async getUserTagLibrary(): Promise<TagLibrary> {
    const response = await api.get('/tags/library');
    return response.data;
  }
}
```

---

## Styling Guidelines

### Tailwind CSS First

```tsx
// ✅ Good
<div className="bg-gray-900 text-white flex items-center px-4 py-2 rounded-lg">
  <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
    Save
  </button>
</div>
```

### Responsive Design

```tsx
// Mobile first
<div className="hidden md:flex items-center gap-6">
  {/* Desktop only */}
</div>

<button className="md:hidden">
  <Menu />  {/* Mobile only */}
</button>
```

### Conditional Classes

```tsx
import { cn } from '@/lib/utils';

<button
  className={cn(
    "px-4 py-2 rounded",
    isActive && "bg-blue-600 text-white",
    !isActive && "bg-gray-200"
  )}
>
```

---

## React Patterns

### Custom Hooks

```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

### useCallback & useMemo

```typescript
// Memoize callbacks
const handleChange = useCallback((names: string[]) => {
  setSelectedAccountNames(names);
}, []);

// Memoize computations
const sortedHoldings = useMemo(() => {
  return holdings.sort((a, b) => b.total_value - a.total_value);
}, [holdings]);
```

---

## Error Handling

### Try-Catch Pattern

```typescript
const handleSave = async () => {
  try {
    const result = await TagAPI.setHoldingTag(symbol, tagName, value);
    setTags(result);
  } catch (error: any) {
    console.error('❌ [TagManager] Error:', error);

    if (error.response?.status === 400) {
      setError('Invalid input');
    } else {
      setError(error.message);
    }
  }
};
```

### Loading States

```typescript
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
return <Content data={data} />;
```

### Console Logging

```typescript
console.log('🚀 [Module] Starting');
console.log('✅ [Module] Success');
console.error('❌ [Module] Error:', err);
console.warn('⚠️ [Module] Warning');
console.log('🎯 [Module] User action');
```

---

## Performance Optimization

### React.memo

```typescript
export const HoldingsTable = React.memo(({
  holdings,
  onRowClick
}: Props) => {
  return <table>{/* ... */}</table>;
});
```

### Lazy Loading

```typescript
import { lazy, Suspense } from 'react';

const AIChat = lazy(() => import('./components/AIChat'));

<Suspense fallback={<Skeleton />}>
  <AIChat />
</Suspense>
```

---

## Testing Practices

### Test-Driven Development

Following Anthropic's recommendations:

1. Write tests first
2. Confirm tests fail
3. Implement code
4. Verify tests pass

```typescript
describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });
});
```

---

## AI-Assisted Development Guidelines

### CLAUDE.md Files

Create context files to guide Claude Code:

- **Project-level** (`/CLAUDE.md`): Development commands, architecture
- **Context-level** (`/context/*.md`): Feature docs, design principles

### Planning Before Coding

1. Ask Claude to explore relevant files
2. Request a plan before implementation
3. Review and approve the plan
4. Proceed step-by-step
5. Write tests to verify

### Context Preservation

- Use `/clear` between tasks
- Maintain Markdown checklists for complex tasks
- Document in `/context/` directory

### Simplicity First

Anthropic emphasizes: **"Start with simple, composable patterns"**

```typescript
// ✅ Good - Simple
export function useTagLibrary() {
  const [library, setLibrary] = useState(null);
  useEffect(() => {
    TagAPI.getUserTagLibrary().then(setLibrary);
  }, []);
  return library;
}

// ❌ Bad - Over-engineered
// Don't add complexity without proven need
```

---

## Summary

This style guide reflects:
1. **Brand identity** - Vestika's visual language and design system
2. **Code patterns** - Established React/TypeScript conventions
3. **Anthropic best practices** - AI-assisted development guidelines

**For Claude Code**: Reference this guide when working on frontend features. Update as patterns evolve.

**For developers**: This is a living document. Propose changes via PR when identifying better patterns.

---

*Last updated: 2025-10-25*
*Version: 1.0*
