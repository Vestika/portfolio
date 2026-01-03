# Title Bar Component

Reusable title bar component used across Portfolio, Tags, and News views.

## Features

- **Sticky positioning**: Stays visible at the top of the page (below the main navigation at 37px offset)
- **Consistent styling**: Dark background (`bg-gray-800`) with bottom border
- **Flexible layout**: Supports custom left and right content areas
- **Responsive**: Right content hides on mobile devices (shown only on `md` breakpoint and above)

## Usage

### Simple Title with Subtitle

```tsx
import { TitleBar } from '@/components/title-bar';

<TitleBar
  leftContent={<h1 className="text-2xl font-bold">My Title</h1>}
  subtitle="Description text goes here"
/>
```

### With Portfolio Selector

```tsx
import { TitleBar } from '@/components/title-bar';
import PortfolioSelector from './PortfolioSelector';

<TitleBar
  leftContent={
    <PortfolioSelector
      portfolios={availablePortfolios}
      selectedPortfolioId={selectedPortfolioId}
      onPortfolioChange={setSelectedPortfolioId}
      userName={userName}
      titleSuffix="Tags"
    />
  }
  subtitle="Manage custom tags for your holdings"
  rightContent={
    <>
      <button>Create Tag</button>
      <button>Help</button>
    </>
  }
/>
```

### With Action Buttons

```tsx
import { TitleBar } from '@/components/title-bar';
import { Plus, HelpCircle } from 'lucide-react';

<TitleBar
  leftContent={<h1 className="text-2xl font-bold">News</h1>}
  subtitle="Latest updates"
  rightContent={
    <>
      <button className="flex items-center gap-2">
        <Plus size={16} />
        <span>Add Item</span>
      </button>
      <button>
        <HelpCircle size={20} />
      </button>
    </>
  }
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `leftContent` | `ReactNode` | Yes | Content for the left side (title, selector, etc.) |
| `subtitle` | `string` | No | Subtitle text shown below the main content |
| `rightContent` | `ReactNode` | No | Action buttons or indicators for the right side |
| `className` | `string` | No | Additional CSS classes for the container |

## Styling Notes

- The component uses Tailwind CSS classes
- Default positioning: `sticky z-30` with `top: 37px`
- Background: `bg-gray-800` with `border-b border-gray-700`
- Right content automatically hides on mobile (`hidden md:flex`)

## Examples in Codebase

- **Portfolio View**: Uses with PortfolioSelector and account cards
- **Tags View**: Uses with PortfolioSelector and Create Tag/Help buttons  
- **News View**: Uses with simple title and loading indicator

