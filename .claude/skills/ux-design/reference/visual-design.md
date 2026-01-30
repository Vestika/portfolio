# Visual Design - Comprehensive Guide

This file covers visual design principles including Gestalt theory, color, typography, layout, and responsive design.

## Table of Contents

1. [Gestalt Principles](#gestalt-principles)
2. [Color Theory & Accessibility](#color-theory--accessibility)
3. [Typography](#typography)
4. [Visual Hierarchy](#visual-hierarchy)
5. [Layout & Spacing](#layout--spacing)
6. [Responsive Design](#responsive-design)
7. [Design Systems & Tokens](#design-systems--tokens)

---

## Gestalt Principles

Gestalt principles describe how humans perceive visual elements as organized patterns. These principles are fundamental to effective visual design.

### 1. Proximity

**Principle**: Objects that are close together are perceived as related.

**Application**:
```tsx
// Bad: Equal spacing makes relationships unclear
<Form>
  <Label>Name</Label>
  <Input /> {/* 16px gap */}
  <Label>Email</Label>  {/* 16px gap */}
  <Input /> {/* 16px gap */}
</Form>

// Good: Close spacing groups label with input
<Form>
  <FormField>
    <Label>Name</Label>  {/* 4px gap */}
    <Input />
  </FormField>  {/* 24px gap to next field */}
  <FormField>
    <Label>Email</Label>  {/* 4px gap */}
    <Input />
  </FormField>
</Form>
```

**Guidelines**:
- Label-to-input: 4-8px
- Between form fields: 16-24px
- Between form sections: 32-48px
- Related buttons: 8px
- Unrelated buttons: 16-24px

### 2. Similarity

**Principle**: Objects that share visual characteristics (color, shape, size) are perceived as related.

**Application**:
```tsx
// Use similar styling for related elements
<Navigation>
  {/* All nav items have same style */}
  <NavItem>Home</NavItem>
  <NavItem>Products</NavItem>
  <NavItem>About</NavItem>

  {/* CTA is different style */}
  <NavItem variant="primary">Sign Up</NavItem>
</Navigation>
```

**Guidelines**:
- Use consistent button styles for similar actions
- Use color coding for categories (e.g., tags, labels)
- Keep icon style consistent (all outlined or all filled)
- Use similar card designs for similar content types

### 3. Closure

**Principle**: Humans perceive incomplete shapes as complete.

**Application**:
```tsx
// Skeleton screens leverage closure
<SkeletonCard>
  <SkeletonCircle /> {/* User sees avatar */}
  <SkeletonLine width="60%" /> {/* User sees title */}
  <SkeletonLine width="100%" /> {/* User sees description */}
  <SkeletonLine width="80%" />
</SkeletonCard>

// Progress indicators
<ProgressCircle value={75} /> {/* Incomplete circle suggests progress */}
```

**Guidelines**:
- Use skeleton screens for loading states
- Partial borders can suggest full containers
- Dashed lines suggest connectivity

### 4. Continuity

**Principle**: Eyes follow continuous paths and prefer smooth, continuous lines over jagged ones.

**Application**:
```tsx
// Use continuity to guide attention
<Timeline>
  <TimelineItem>
    <TimelineDot />
    <TimelineContent>Step 1</TimelineContent>
  </TimelineItem>
  <TimelineConnector /> {/* Line creates continuity */}
  <TimelineItem>
    <TimelineDot />
    <TimelineContent>Step 2</TimelineContent>
  </TimelineItem>
  <TimelineConnector />
  <TimelineItem>
    <TimelineDot />
    <TimelineContent>Step 3</TimelineContent>
  </TimelineItem>
</Timeline>
```

**Guidelines**:
- Align elements along invisible grid lines
- Use connecting lines for related items
- Create visual paths with color, spacing, or arrows
- Use consistent left/right alignment

### 5. Figure-Ground

**Principle**: Humans distinguish objects (figure) from background (ground).

**Application**:
```tsx
// Modal creates clear figure-ground separation
<Modal>
  <ModalOverlay /> {/* Semi-transparent background (ground) */}
  <ModalContent> {/* Elevated, distinct content (figure) */}
    <ModalHeader>Title</ModalHeader>
    <ModalBody>Content</ModalBody>
  </ModalContent>
</Modal>
```

**CSS Implementation**:
```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5); /* Ground */
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); /* Elevates figure */
  border-radius: 8px;
}
```

**Guidelines**:
- Use shadows to create elevation
- Overlays for modals: 50% black opacity
- High contrast between figure and ground
- Blur background for focus (backdrop-filter)

### 6. Common Fate

**Principle**: Elements moving in the same direction are perceived as related.

**Application**:
```tsx
// Animate related elements together
const handleExpand = () => {
  // All related items animate together
  gsap.to('.related-items', {
    opacity: 1,
    y: 0,
    stagger: 0.05, // Slight stagger maintains relationship
    duration: 0.3,
  });
};
```

### 7. Symmetry and Order

**Principle**: Symmetric elements are perceived as belonging together and create a sense of balance.

**Application**:
```tsx
// Symmetric layouts feel balanced
<Header>
  <Logo /> {/* Left side */}
  <Navigation /> {/* Center */}
  <UserMenu /> {/* Right side - balances logo */}
</Header>

// Use grid for order
<Grid cols={3} gap={4}>
  <Card />
  <Card />
  <Card />
</Grid>
```

---

## Color Theory & Accessibility

### Color Psychology

**Color Meanings** (Western culture):
- **Red**: Danger, error, urgency, passion, energy
- **Green**: Success, confirmation, growth, nature, safety
- **Blue**: Trust, calm, professional, technology
- **Yellow**: Warning, caution, optimism, energy
- **Orange**: Warmth, creativity, enthusiasm, call-to-action
- **Purple**: Luxury, creativity, wisdom, spirituality
- **Gray**: Neutral, professional, subtle, background
- **Black**: Power, elegance, sophistication, premium
- **White**: Purity, simplicity, cleanliness, space

**Note**: Color meanings vary by culture. Red = luck in China, mourning in South Africa.

### Color Systems

**HSL (Hue, Saturation, Lightness)**:
- **Hue**: Color (0-360°) - 0=red, 120=green, 240=blue
- **Saturation**: Intensity (0-100%) - 0=gray, 100=vivid
- **Lightness**: Brightness (0-100%) - 0=black, 50=pure color, 100=white

```css
/* HSL is easier to work with than hex */
--primary: hsl(220, 90%, 56%); /* Blue */
--primary-hover: hsl(220, 90%, 46%); /* Darker blue (reduce lightness) */
--primary-light: hsl(220, 90%, 96%); /* Light blue background */
```

**Building a Color Palette**:
```typescript
// Start with primary color
const primary = {
  50: 'hsl(220, 90%, 96%)',  // Lightest
  100: 'hsl(220, 90%, 92%)',
  200: 'hsl(220, 90%, 84%)',
  300: 'hsl(220, 90%, 76%)',
  400: 'hsl(220, 90%, 68%)',
  500: 'hsl(220, 90%, 56%)',  // Base
  600: 'hsl(220, 90%, 48%)',
  700: 'hsl(220, 90%, 40%)',
  800: 'hsl(220, 90%, 32%)',
  900: 'hsl(220, 90%, 24%)',  // Darkest
};

// Use in code
<Button className="bg-primary-500 hover:bg-primary-600">
  Click Me
</Button>
```

### WCAG Contrast Requirements

**Minimum Contrast Ratios**:

**Level AA** (Minimum standard):
- **Normal text** (< 18px or < 14px bold): **4.5:1**
- **Large text** (≥ 18px or ≥ 14px bold): **3:1**
- **UI components** (buttons, form borders, icons): **3:1**

**Level AAA** (Enhanced standard):
- **Normal text**: **7:1**
- **Large text**: **4.5:1**

**Checking Contrast**:
```typescript
// Use online tools:
// - https://webaim.org/resources/contrastchecker/
// - https://contrast-ratio.com/

// Example: White text on blue background
// #FFFFFF on #1E40AF
// Contrast: 8.59:1 ✓ Passes WCAG AAA

// Example: Light gray text on white background
// #D1D5DB on #FFFFFF
// Contrast: 2.12:1 ✗ Fails WCAG AA (4.5:1 required)
```

**Common Contrast Failures**:
```css
/* ❌ FAILS: Gray text on white (1.5:1) */
.text-gray-300 {
  color: #d1d5db; /* Too light */
}

/* ✓ PASSES: Dark gray text on white (7.0:1) */
.text-gray-700 {
  color: #374151; /* Dark enough */
}

/* ❌ FAILS: Light blue on white (2.8:1) */
.text-blue-400 {
  color: #60a5fa;
}

/* ✓ PASSES: Medium blue on white (4.5:1) */
.text-blue-600 {
  color: #2563eb;
}
```

### Color Accessibility Best Practices

**Don't Rely on Color Alone**:
```tsx
// Bad: Color is only indicator
<StatusBadge className="bg-red-500">Error</StatusBadge>
<StatusBadge className="bg-green-500">Success</StatusBadge>

// Good: Color + icon + text
<StatusBadge variant="error">
  <XIcon />
  Error
</StatusBadge>
<StatusBadge variant="success">
  <CheckIcon />
  Success
</StatusBadge>
```

**Color Blindness Considerations**:
- **Red-Green Color Blindness** (8% of men, 0.5% of women):
  - Use blue/orange instead of red/green
  - Add patterns or labels
  - Test with color-blind simulator

```tsx
// Good: Use multiple differentiators
<Chart>
  <Line color="blue" strokeWidth={2} /> {/* Solid */}
  <Line color="orange" strokeWidth={2} strokeDasharray="5,5" /> {/* Dashed */}
  <Line color="purple" strokeWidth={3} /> {/* Thicker */}
</Chart>
```

**Test Your Colors**:
- Chrome DevTools: Rendering → Emulate vision deficiencies
- Online: https://www.color-blindness.com/coblis-color-blindness-simulator/

### Semantic Color Usage

```typescript
// Define semantic colors
const colors = {
  // Brand
  primary: '#2563eb',    // Blue - main actions
  secondary: '#7c3aed',  // Purple - secondary actions

  // Semantic
  success: '#10b981',    // Green - confirmations, success states
  warning: '#f59e0b',    // Orange - warnings, cautions
  error: '#ef4444',      // Red - errors, destructive actions
  info: '#3b82f6',       // Blue - informational messages

  // Neutral
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',

  // Text
  'text-primary': '#0f172a',     // Body text (16.9:1)
  'text-secondary': '#475569',   // Less important text (7.9:1)
  'text-tertiary': '#94a3b8',    // Subtle text (3.8:1) - use for large text only
};
```

---

## Typography

### Font Selection

**Font Categories**:
- **Serif**: Traditional, trustworthy, formal (Georgia, Times, Merriweather)
- **Sans-serif**: Modern, clean, readable (Inter, Roboto, Open Sans)
- **Monospace**: Code, technical content (JetBrains Mono, Fira Code)

**Pairing Fonts**:
```css
/* Safe approach: One font family, vary weight/size */
body {
  font-family: 'Inter', sans-serif;
}

h1, h2, h3 {
  font-weight: 700; /* Bold for headings */
}

body {
  font-weight: 400; /* Regular for body */
}

/* Advanced: Two fonts */
body {
  font-family: 'Inter', sans-serif; /* Sans-serif for UI */
}

h1, h2, h3 {
  font-family: 'Merriweather', serif; /* Serif for headings */
}
```

**Never use more than 2 font families.**

### Type Scale

**Modular Scale** (1.250 - Major Third):
```typescript
// Base: 16px
const typeScale = {
  xs: '0.64rem',   // 10.24px
  sm: '0.8rem',    // 12.8px
  base: '1rem',    // 16px
  lg: '1.25rem',   // 20px
  xl: '1.563rem',  // 25px
  '2xl': '1.953rem', // 31.25px
  '3xl': '2.441rem', // 39.06px
  '4xl': '3.052rem', // 48.83px
  '5xl': '3.815rem', // 61.04px
};
```

**Usage**:
```css
.text-xs { font-size: 0.64rem; }    /* Fine print */
.text-sm { font-size: 0.8rem; }     /* Secondary text */
.text-base { font-size: 1rem; }     /* Body text (16px) */
.text-lg { font-size: 1.25rem; }    /* Lead paragraph */
.text-xl { font-size: 1.563rem; }   /* H4 */
.text-2xl { font-size: 1.953rem; }  /* H3 */
.text-3xl { font-size: 2.441rem; }  /* H2 */
.text-4xl { font-size: 3.052rem; }  /* H1 */
.text-5xl { font-size: 3.815rem; }  /* Display */
```

### Readability Guidelines

**Font Size**:
- **Minimum body text**: 16px (1rem)
- **Ideal body text**: 18px (1.125rem)
- **Maximum line length**: 50-75 characters (optimal: 66)
- **Mobile body text**: 16px minimum (never smaller)

**Line Height (Leading)**:
```css
/* Body text: 1.5-1.75 */
body {
  line-height: 1.6; /* 16px font = 25.6px line height */
}

/* Headings: 1.2-1.4 (tighter) */
h1, h2, h3 {
  line-height: 1.3;
}

/* Small text: 1.5-1.6 */
.text-sm {
  line-height: 1.5;
}

/* Long-form content: 1.75-2 */
article p {
  line-height: 1.75;
}
```

**Line Length (Measure)**:
```css
/* Ideal: 50-75 characters per line */
.prose {
  max-width: 65ch; /* ch = width of "0" character */
}

/* Alternative: pixels */
.article {
  max-width: 680px; /* ~65-75 chars at 16px */
}
```

**Letter Spacing (Tracking)**:
```css
/* Default: 0 (most fonts are well-spaced) */
body {
  letter-spacing: 0;
}

/* Increase for uppercase */
.uppercase {
  letter-spacing: 0.05em;
}

/* Increase for very large text */
.text-5xl {
  letter-spacing: -0.02em; /* Slightly tighter */
}
```

### Typography Hierarchy

**Establishing Clear Hierarchy**:
```tsx
<Article>
  {/* H1: Largest, boldest, unique */}
  <h1 className="text-4xl font-bold mb-6">
    Main Article Title
  </h1>

  {/* Lead paragraph: Larger, lighter */}
  <p className="text-lg text-gray-600 mb-8">
    This is the lead paragraph that summarizes the article.
  </p>

  {/* H2: Section headers */}
  <h2 className="text-2xl font-semibold mt-12 mb-4">
    Section Title
  </h2>

  {/* Body: Base size, regular weight */}
  <p className="text-base mb-4">
    This is regular body text with good readability.
  </p>

  {/* H3: Subsection headers */}
  <h3 className="text-xl font-semibold mt-8 mb-3">
    Subsection Title
  </h3>

  {/* Secondary text: Smaller, lighter */}
  <p className="text-sm text-gray-500 mt-2">
    Published on January 27, 2026
  </p>
</Article>
```

**Visual Weight Combinations**:
```typescript
// Hierarchy through size + weight + color
const textStyles = {
  h1: 'text-4xl font-bold text-gray-900',
  h2: 'text-2xl font-semibold text-gray-900',
  h3: 'text-xl font-semibold text-gray-800',
  h4: 'text-lg font-medium text-gray-800',
  body: 'text-base font-normal text-gray-700',
  small: 'text-sm font-normal text-gray-600',
  caption: 'text-xs font-normal text-gray-500',
};
```

---

## Visual Hierarchy

Visual hierarchy guides users' attention through the interface.

### Size and Scale

**Primary, Secondary, Tertiary Actions**:
```tsx
<ActionGroup>
  {/* Primary: Largest, most prominent */}
  <Button size="lg" variant="primary">
    Create Project
  </Button>

  {/* Secondary: Medium size, less prominent */}
  <Button size="md" variant="secondary">
    Import
  </Button>

  {/* Tertiary: Smallest, subtle */}
  <Button size="sm" variant="ghost">
    Cancel
  </Button>
</ActionGroup>
```

### Color and Contrast

**Using Color to Guide Attention**:
```tsx
// High contrast = high importance
<div className="bg-white"> {/* Ground */}
  <Button className="bg-blue-600 text-white"> {/* High contrast figure */}
    Primary Action
  </Button>
  <Button className="bg-gray-200 text-gray-700"> {/* Lower contrast */}
    Secondary Action
  </Button>
</div>
```

### Position and Layout

**F-Pattern** (for text-heavy pages):
- Users scan horizontally at top
- Move down left side
- Scan horizontally again (shorter)

**Z-Pattern** (for simpler pages):
- Scan top-left to top-right
- Diagonal to bottom-left
- Scan bottom-left to bottom-right

**Application**:
```tsx
// Z-pattern for landing page
<Hero>
  <Logo /> {/* Top-left */}
  <Navigation /> {/* Top-right */}
  {/* Diagonal implied by visual flow */}
  <Headline /> {/* Center */}
  <CTAButton /> {/* Bottom-right */}
</Hero>
```

### Visual Weight

**Elements that draw attention**:
1. **Size**: Larger elements noticed first
2. **Color**: High contrast, bright colors
3. **Position**: Top and left (in LTR languages)
4. **Whitespace**: Isolated elements stand out
5. **Imagery**: Photos and illustrations
6. **Movement**: Animations (use sparingly)

---

## Layout & Spacing

### Spacing Scale

**8-Point Grid System**:
```typescript
// Base unit: 8px
const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem',  // 8px
  3: '0.75rem', // 12px
  4: '1rem',    // 16px
  5: '1.25rem', // 20px
  6: '1.5rem',  // 24px
  8: '2rem',    // 32px
  10: '2.5rem', // 40px
  12: '3rem',   // 48px
  16: '4rem',   // 64px
  20: '5rem',   // 80px
  24: '6rem',   // 96px
};
```

**Usage Guidelines**:
- **Tight spacing (4-8px)**: Related items (label-input, icon-text)
- **Medium spacing (16-24px)**: Form fields, list items
- **Wide spacing (32-48px)**: Sections, content blocks
- **Extra-wide spacing (64-96px)**: Major sections, page margins

### Layout Patterns

**Single Column** (Mobile-First):
```tsx
<Layout className="max-w-2xl mx-auto px-4">
  <Header />
  <Main>
    <Article />
  </Main>
  <Footer />
</Layout>
```

**Sidebar Layout**:
```tsx
<Layout className="flex">
  <Sidebar className="w-64 flex-shrink-0">
    <Navigation />
  </Sidebar>
  <Main className="flex-1">
    <Content />
  </Main>
</Layout>
```

**Grid Layout**:
```tsx
<Grid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card />
  <Card />
  <Card />
  <Card />
  <Card />
  <Card />
</Grid>
```

### Whitespace (Negative Space)

**Macro Whitespace**: Space between major sections
**Micro Whitespace**: Space between elements within a section

```css
/* Macro whitespace: Breathing room between sections */
.section {
  padding: 4rem 0; /* 64px top/bottom */
}

/* Micro whitespace: Within a card */
.card {
  padding: 1.5rem; /* 24px all sides */
}

.card-title {
  margin-bottom: 0.5rem; /* 8px */
}

.card-description {
  margin-bottom: 1rem; /* 16px */
}
```

**More whitespace = More premium feel**:
```tsx
// Cramped (budget feel)
<Card className="p-3 m-2">
  <Title className="mb-2">Title</Title>
  <Content className="text-sm" />
</Card>

// Spacious (premium feel)
<Card className="p-8 m-6">
  <Title className="mb-6 text-2xl">Title</Title>
  <Content className="text-lg leading-relaxed" />
</Card>
```

---

## Responsive Design

### Breakpoints

**Standard Breakpoints**:
```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / small desktop
  xl: '1280px',  // Desktop
  '2xl': '1536px', // Large desktop
};
```

**Mobile-First Approach**:
```css
/* Default: Mobile (0-639px) */
.container {
  padding: 1rem;
}

/* Tablet and up (640px+) */
@media (min-width: 640px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop and up (1024px+) */
@media (min-width: 1024px) {
  .container {
    padding: 4rem;
  }
}
```

### Responsive Typography

**Fluid Typography**:
```css
/* Scales smoothly between viewports */
h1 {
  font-size: clamp(2rem, 5vw, 4rem);
  /* Min: 32px, Preferred: 5% of viewport, Max: 64px */
}

/* Alternative: Step-based */
h1 {
  font-size: 2rem; /* 32px mobile */
}

@media (min-width: 768px) {
  h1 {
    font-size: 3rem; /* 48px tablet */
  }
}

@media (min-width: 1024px) {
  h1 {
    font-size: 4rem; /* 64px desktop */
  }
}
```

### Responsive Layout Patterns

**Stack on Mobile, Side-by-Side on Desktop**:
```tsx
<div className="flex flex-col md:flex-row gap-4">
  <Sidebar className="md:w-1/4" />
  <Main className="md:w-3/4" />
</div>
```

**Grid: 1 Column → 2 Columns → 3 Columns**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card />
  <Card />
  <Card />
</div>
```

**Hide/Show Elements**:
```tsx
{/* Mobile menu */}
<MobileMenu className="md:hidden" />

{/* Desktop navigation */}
<Navigation className="hidden md:block" />
```

### Touch Optimization

**Touch Target Size**:
- **Minimum**: 44x44px (WCAG)
- **Recommended**: 48x48px
- **Spacing**: 8px between targets

```css
/* Mobile buttons: Larger */
.button {
  padding: 12px 24px; /* 48px height with 16px text */
  min-width: 48px;
}

/* Desktop: Can be slightly smaller */
@media (min-width: 1024px) {
  .button {
    padding: 8px 16px; /* 40px height */
  }
}
```

**Thumb Zone Optimization**:
```
Mobile Screen (Portrait):
┌─────────────────┐
│   Hard to Reach │ Top corners
│                 │
│  Easy to Reach  │ Center and bottom
│                 │
│ [Primary CTA]  │ Bottom center (easiest)
└─────────────────┘
```

```tsx
// Place primary actions at bottom on mobile
<MobileLayout>
  <Header /> {/* Top: Info only */}
  <Content /> {/* Middle: Content */}
  <Footer>
    <Button className="w-full"> {/* Bottom: Action */}
      Continue
    </Button>
  </Footer>
</MobileLayout>
```

---

## Design Systems & Tokens

### Design Tokens

**Definition**: Design tokens are named entities that store visual design attributes (colors, spacing, typography).

**Structure**:
```typescript
// tokens/colors.ts
export const colors = {
  // Primitive tokens (raw values)
  blue: {
    50: '#eff6ff',
    500: '#3b82f6',
    900: '#1e3a8a',
  },
  gray: {
    50: '#f9fafb',
    500: '#6b7280',
    900: '#111827',
  },

  // Semantic tokens (meaning-based)
  primary: {
    DEFAULT: 'var(--blue-500)',
    hover: 'var(--blue-600)',
    light: 'var(--blue-50)',
  },
  text: {
    primary: 'var(--gray-900)',
    secondary: 'var(--gray-600)',
    tertiary: 'var(--gray-400)',
  },
  background: {
    DEFAULT: 'var(--white)',
    muted: 'var(--gray-50)',
    accent: 'var(--blue-50)',
  },
};

// tokens/spacing.ts
export const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
};

// tokens/typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'sans-serif'],
    serif: ['Merriweather', 'serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};
```

### Component Library Structure

**Atomic Design Hierarchy**:
```
Atoms (basic building blocks):
  - Button
  - Input
  - Label
  - Icon

Molecules (simple combinations):
  - FormField (Label + Input + Error)
  - SearchBox (Input + Icon)
  - Card Header (Avatar + Title + Subtitle)

Organisms (complex components):
  - Navigation Bar
  - Form
  - Card
  - Modal

Templates (page layouts):
  - Dashboard Layout
  - Article Layout
  - Settings Layout

Pages (specific instances):
  - Home Page
  - Profile Page
  - Settings Page
```

**Component Example**:
```tsx
// atoms/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
}: ButtonProps) => {
  const baseStyles = 'rounded font-medium transition-colors';

  const variantStyles = {
    primary: 'bg-primary hover:bg-primary-hover text-white',
    secondary: 'bg-secondary hover:bg-secondary-hover text-white',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
    destructive: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

---

## Visual Design Checklist

Before finalizing any visual design:

### Color
- [ ] All text meets WCAG AA contrast (4.5:1 minimum)
- [ ] Color is not the only way to convey information
- [ ] Design tested with color-blind simulator
- [ ] Semantic colors used consistently (red=error, green=success)

### Typography
- [ ] Body text is at least 16px
- [ ] Line height is 1.5-1.75 for body text
- [ ] Line length is 50-75 characters
- [ ] Clear hierarchy (H1 > H2 > H3 > body)
- [ ] Using 1-2 font families maximum

### Layout
- [ ] Using consistent spacing scale (8px grid)
- [ ] Sufficient whitespace around elements
- [ ] Related items grouped with proximity
- [ ] Clear visual hierarchy (size, color, position)
- [ ] Responsive at all breakpoints

### Gestalt Principles
- [ ] Related items are grouped (proximity)
- [ ] Similar items look similar (similarity)
- [ ] Elements aligned along grid (continuity)
- [ ] Clear figure-ground separation (modals, cards)

### Responsive
- [ ] Mobile-first approach
- [ ] Touch targets ≥ 44px on mobile
- [ ] Primary actions in thumb zone (bottom)
- [ ] No horizontal scrolling
- [ ] Fluid typography scales smoothly

---

**Sources**:
- Interaction Design Foundation: "Gestalt Principles"
- WCAG 2.1 Guidelines: Color Contrast
- Nielsen Norman Group: Typography, Visual Hierarchy, Whitespace
- Brad Frost: "Atomic Design"
- Refactoring UI: Typography, Color, Layout best practices