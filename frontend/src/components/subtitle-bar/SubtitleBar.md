# SubtitleBar Component

A reusable sticky subtitle/metrics bar component used across multiple views to display contextual metrics and information in a consistent style.

## Components

### `SubtitleBar`

The main container for the subtitle bar that handles sticky positioning and layout.

**Props:**
- `topOffset` (optional): Offset from top in pixels for sticky positioning (e.g., "77px", "114px"). Default: "77px"
- `zIndex` (optional): Z-index for the sticky bar. Default: 20
- `children`: Child components to render (typically `MetricChip` components)

### `MetricChip`

Individual metric chip component for displaying metrics with icons, labels, and values.

**Props:**
- `icon` (optional): Icon element to display (e.g., `<Wallet size={14} />`)
- `label` (optional): Label text for the metric
- `value` (optional): Value to display (can be string, number, or ReactNode for complex content)
- `valueColor` (optional): Color variant for the value text. Default: "text-blue-400"
- `iconColor` (optional): Color variant for the icon. Default: "text-blue-400"
- `action` (optional): Action buttons or additional content
- `title` (optional): Title for hover tooltip
- `onClick` (optional): Click handler for the chip
- `className` (optional): Custom className for the chip

### `SubtitleBarSpacer`

A spacer component to push content to the right side of the subtitle bar.

## Usage Examples

### Basic Usage

```tsx
import { SubtitleBar, MetricChip } from '@/components/common/SubtitleBar';
import { Tags } from 'lucide-react';

<SubtitleBar topOffset="114px">
  <MetricChip
    icon={<Tags size={14} />}
    iconColor="text-blue-400"
    label="Tags:"
    value={tagCount}
    valueColor="text-blue-400"
  />
</SubtitleBar>
```

### With Multiple Chips

```tsx
<SubtitleBar topOffset="77px" zIndex={10}>
  <MetricChip
    icon={<Wallet size={14} />}
    iconColor="text-green-400"
    label="Total:"
    value="$10,000 USD"
    valueColor="text-green-400"
  />
  <MetricChip
    icon={<Coins size={14} />}
    iconColor="text-sky-400"
    label="Cash:"
    value="$5,000"
    valueColor="text-sky-400"
  />
</SubtitleBar>
```

### With Spacer (Right-aligned Items)

```tsx
<SubtitleBar>
  <MetricChip label="Articles:" value={10} />
  <MetricChip label="Keywords:" value={50} />
  
  <SubtitleBarSpacer />
  
  <MetricChip
    icon={<span className="w-2 h-2 rounded-full bg-green-400" />}
    label="Status:"
    value="Online"
    valueColor="text-green-400"
  />
</SubtitleBar>
```

### With Custom Action

```tsx
<MetricChip
  label={`"${selectedWord}"`}
  valueColor="text-amber-300"
  action={
    <button onClick={() => clearFilter()} className="ml-1">
      <X size={12} />
    </button>
  }
/>
```

### With Custom SVG Icon

```tsx
<MetricChip
  icon={
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5..." />
    </svg>
  }
  iconColor="text-purple-400"
  label="Custom:"
  value={count}
  valueColor="text-purple-400"
/>
```

## Design Principles

1. **Consistency**: All subtitle bars share the same visual style, positioning, and behavior
2. **Flexibility**: Components accept various prop types to support different use cases
3. **Composability**: Built from small, reusable components that can be combined
4. **Accessibility**: Includes proper ARIA attributes and semantic HTML
5. **Responsive**: Adapts to different screen sizes with flex-wrap behavior

## Current Usage

The SubtitleBar component is currently used in:
- **PortfolioSummary.tsx**: Displays total value, cash holdings, IBIT BTC equivalent, and market status
- **ManageTagsView.tsx**: Shows tag counts (total tags, tagged symbols, untagged symbols)
- **NewsFeedView.tsx**: Displays article count, keyword count, and active filter

## Migration Guide

If you have an existing metrics bar, here's how to migrate:

**Before:**
```tsx
<div className="sticky z-20 bg-gray-800 border-t border-b border-gray-700" style={{ top: '114px' }}>
  <div className="container mx-auto flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 py-1.5 px-2 sm:px-4 overflow-x-auto">
    <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
      <Tags size={14} className="text-blue-400 mr-1.5" />
      <span className="text-xs font-medium mr-1">Tags:</span>
      <span className="text-xs text-blue-400">{count}</span>
    </div>
  </div>
</div>
```

**After:**
```tsx
import { SubtitleBar, MetricChip } from '@/components/common/SubtitleBar';

<SubtitleBar topOffset="114px">
  <MetricChip
    icon={<Tags size={14} />}
    iconColor="text-blue-400"
    label="Tags:"
    value={count}
    valueColor="text-blue-400"
  />
</SubtitleBar>
```

