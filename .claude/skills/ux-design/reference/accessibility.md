# Accessibility - Comprehensive Guide

This file covers WCAG 2.1 guidelines, inclusive design practices, and accessibility implementation details.

## Table of Contents

1. [WCAG 2.1 Overview](#wcag-21-overview)
2. [Color & Contrast](#color--contrast)
3. [Keyboard Navigation](#keyboard-navigation)
4. [Screen Readers & ARIA](#screen-readers--aria)
5. [Touch Targets & Mobile](#touch-targets--mobile)
6. [Content & Structure](#content--structure)
7. [Forms & Error Handling](#forms--error-handling)
8. [Multimedia & Media](#multimedia--media)

---

## WCAG 2.1 Overview

**WCAG** (Web Content Accessibility Guidelines) defines how to make web content accessible to people with disabilities.

### Conformance Levels

**Level A** (Minimum):
- Basic accessibility features
- Easiest to achieve
- Still leaves many barriers

**Level AA** (Standard):
- **Industry standard and legal requirement in many jurisdictions**
- Addresses major barriers
- Target for most websites/apps

**Level AAA** (Enhanced):
- Highest level of accessibility
- Not always possible for all content
- Use as aspiration where feasible

### Four Principles (POUR)

**1. Perceivable**: Information must be presentable to users in ways they can perceive
**2. Operable**: User interface components must be operable
**3. Understandable**: Information and operation must be understandable
**4. Robust**: Content must be robust enough to work with current and future technologies

---

## Color & Contrast

### Contrast Ratios (WCAG 2.1)

**Level AA Requirements**:
- **Normal text** (< 18px regular, < 14px bold): **4.5:1**
- **Large text** (≥ 18px regular, ≥ 14px bold): **3:1**
- **UI components** (buttons, borders, icons): **3:1**

**Level AAA Requirements**:
- **Normal text**: **7:1**
- **Large text**: **4.5:1**

### Testing Contrast

```typescript
// Use browser DevTools or online tools:
// - Chrome DevTools: Inspect > Contrast ratio shown in color picker
// - https://webaim.org/resources/contrastchecker/
// - https://contrast-ratio.com/

// Example checks:
// #000000 on #FFFFFF = 21:1 ✓ Passes AAA
// #333333 on #FFFFFF = 12.6:1 ✓ Passes AAA
// #666666 on #FFFFFF = 5.7:1 ✓ Passes AA, ✗ Fails AAA
// #999999 on #FFFFFF = 2.8:1 ✗ Fails AA (too low for body text)
```

### Common Contrast Failures

```css
/* ❌ FAILS: Light gray on white (1.5:1) */
.error {
  color: #e0e0e0;
  background: #ffffff;
}

/* ✓ PASSES: Dark red on white (5.9:1) */
.error {
  color: #c92a2a;
  background: #ffffff;
}

/* ❌ FAILS: Blue link on blue background (2.1:1) */
.link {
  color: #60a5fa;
  background: #3b82f6;
}

/* ✓ PASSES: White link on blue background (4.5:1) */
.link {
  color: #ffffff;
  background: #2563eb;
}
```

### Color-Blind Safe Palettes

**Don't rely on red/green distinction**:
```tsx
// Bad: Only color differentiates status
<Status className="text-red-500">Failed</Status>
<Status className="text-green-500">Passed</Status>

// Good: Icon + color + text
<Status className="text-red-600">
  <XCircleIcon />
  <span>Failed</span>
</Status>
<Status className="text-green-600">
  <CheckCircleIcon />
  <span>Passed</span>
</Status>
```

**Use color-blind safe combinations**:
- Blue + Orange (instead of blue + red)
- Blue + Yellow (high contrast)
- Purple + Green (safe for most types)

**Test with simulators**:
- Chrome DevTools: Rendering → Emulate vision deficiencies
- Protanopia (red-blind): ~1% of men
- Deuteranopia (green-blind): ~1% of men
- Protanomaly (red-weak): ~1% of men
- Deuteranomaly (green-weak): ~6% of men

### Non-Color Indicators

```tsx
// Use multiple differentiators
<Chart>
  <Line
    name="Revenue"
    stroke="#3b82f6"
    strokeWidth={3}
  />
  <Line
    name="Expenses"
    stroke="#ef4444"
    strokeWidth={3}
    strokeDasharray="5 5" // Dashed line
  />
  <Line
    name="Profit"
    stroke="#10b981"
    strokeWidth={2}
    // Different thickness
  />
</Chart>

// Always label lines directly if possible
```

---

## Keyboard Navigation

### Tab Order

**Principle**: Interactive elements must be accessible via Tab key in logical order.

**Implementation**:
```tsx
// Natural tab order (HTML order)
<form>
  <input name="firstName" />  {/* Tab stop 1 */}
  <input name="lastName" />   {/* Tab stop 2 */}
  <input name="email" />      {/* Tab stop 3 */}
  <button type="submit">Submit</button> {/* Tab stop 4 */}
</form>

// Avoid: Overriding tab order with tabIndex
// Only use tabIndex in specific cases:
// - tabIndex="0": Add to natural tab order
// - tabIndex="-1": Remove from tab order (but still focusable programmatically)
// - Never use tabIndex > 0 (creates unpredictable order)
```

### Focus Indicators

**WCAG Requirement**: Focus indicators must be visible and have sufficient contrast (3:1).

```css
/* ❌ Bad: Removed focus outline */
button:focus {
  outline: none;
}

/* ✓ Good: Custom focus style */
button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Alternative: Ring style */
button:focus-visible {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
}

/* For inputs */
input:focus-visible {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
```

### Keyboard Shortcuts

**Common patterns**:
- **Tab**: Move to next focusable element
- **Shift + Tab**: Move to previous focusable element
- **Enter**: Activate button/link
- **Space**: Activate button, toggle checkbox
- **Arrow keys**: Navigate within components (menus, tabs, sliders)
- **Escape**: Close modals/dialogs
- **Home/End**: Jump to start/end of list

**Implementation**:
```tsx
const Dialog = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <div role="dialog" aria-modal="true">
      {/* Dialog content */}
    </div>
  );
};
```

### Focus Trapping

**Principle**: When a modal is open, focus should stay within the modal.

```tsx
import { useRef, useEffect } from 'react';

const Modal = ({ isOpen, onClose, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements?.length) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50"
    >
      {children}
    </div>
  );
};
```

### Skip Links

**Principle**: Provide a way to skip repetitive content (navigation, headers).

```tsx
const Layout = ({ children }) => {
  return (
    <>
      {/* Skip link (hidden until focused) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-600 focus:border-2 focus:border-blue-600"
      >
        Skip to main content
      </a>

      <Header />
      <Navigation />

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>

      <Footer />
    </>
  );
};
```

---

## Screen Readers & ARIA

### Semantic HTML

**Always prefer semantic HTML over ARIA**:

```html
<!-- ❌ Bad: Generic div with ARIA -->
<div role="button" tabindex="0" onclick="handleClick()">
  Click me
</div>

<!-- ✓ Good: Native button -->
<button onclick="handleClick()">
  Click me
</button>

<!-- ❌ Bad: Div with role -->
<div role="heading" aria-level="1">Title</div>

<!-- ✓ Good: Semantic heading -->
<h1>Title</h1>
```

### ARIA Labels

**Use when text content isn't descriptive enough**:

```tsx
// Icon-only buttons need labels
<button aria-label="Delete item">
  <TrashIcon />
</button>

// Image buttons
<button aria-label="Close modal">
  <XIcon />
</button>

// Links with only images
<a href="/profile" aria-label="View your profile">
  <img src="/avatar.jpg" alt="" />
</a>

// Complex inputs
<input
  type="search"
  aria-label="Search products"
  placeholder="Search..."
/>
```

### ARIA Descriptions

**Use for additional context**:

```tsx
<input
  type="password"
  aria-label="Password"
  aria-describedby="password-requirements"
/>
<div id="password-requirements">
  Password must be at least 8 characters and include a number
</div>

// Error messages
<input
  type="email"
  aria-label="Email"
  aria-describedby="email-error"
  aria-invalid={hasError}
/>
{hasError && (
  <div id="email-error" role="alert">
    Please enter a valid email address
  </div>
)}
```

### ARIA Live Regions

**Announce dynamic content changes**:

```tsx
// Polite: Wait for screen reader to finish current announcement
<div aria-live="polite">
  {itemsAdded} items added to cart
</div>

// Assertive: Interrupt immediately (use sparingly)
<div aria-live="assertive" role="alert">
  Error: Payment failed. Please try again.
</div>

// Status: Non-critical updates
<div aria-live="polite" role="status">
  Saving... Saved successfully!
</div>
```

### ARIA States

```tsx
// Expanded/collapsed
<button
  aria-expanded={isOpen}
  aria-controls="dropdown-menu"
  onClick={toggle}
>
  Menu
</button>
<div id="dropdown-menu" hidden={!isOpen}>
  {/* Menu items */}
</div>

// Selected state (tabs, options)
<button
  role="tab"
  aria-selected={isActive}
  aria-controls="panel-1"
>
  Tab 1
</button>

// Pressed state (toggle buttons)
<button
  aria-pressed={isPressed}
  onClick={toggle}
>
  {isPressed ? 'Mute' : 'Unmute'}
</button>

// Disabled state (prefer HTML disabled attribute)
<button disabled>
  Cannot click
</button>
```

### Screen Reader-Only Text

```css
/* Visually hidden but accessible to screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Show when focused (for skip links) */
.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

```tsx
// Usage
<button>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete item</span>
</button>
```

---

## Touch Targets & Mobile

### Minimum Touch Target Size

**WCAG 2.1 Level AAA**: 44x44px (CSS pixels)
**iOS Human Interface Guidelines**: 44x44pt
**Material Design**: 48x48dp

**Implementation**:
```css
/* Ensure minimum touch target */
.button {
  min-width: 44px;
  min-height: 44px;
  padding: 12px 16px;
}

/* Use padding to increase touch area without changing visual size */
.icon-button {
  padding: 12px; /* Increases touch area */
  margin: -12px; /* Maintains visual spacing */
}
```

### Touch Target Spacing

**Minimum spacing**: 8px between touch targets

```tsx
<div className="flex gap-2"> {/* 8px gap */}
  <button className="p-3">Action 1</button>
  <button className="p-3">Action 2</button>
  <button className="p-3">Action 3</button>
</div>
```

### Thumb Zone Optimization

```
Mobile Screen (Portrait):
┌─────────────────┐
│ Hard to reach   │ Top corners (one-handed use)
│                 │
│ Easy to reach   │ Center (natural thumb arc)
│                 │
│ Easiest         │ Bottom (thumb rests here)
└─────────────────┘
```

**Implementation**:
```tsx
// Place primary actions at bottom on mobile
<MobileView>
  <Header /> {/* Info only */}
  <Content /> {/* Scrollable content */}
  <StickyFooter> {/* Bottom: Easy thumb access */}
    <Button fullWidth variant="primary">
      Continue
    </Button>
  </StickyFooter>
</MobileView>
```

---

## Content & Structure

### Heading Hierarchy

**Never skip heading levels**:

```html
<!-- ❌ Bad: Skips from h1 to h3 -->
<h1>Page Title</h1>
<h3>Section Title</h3>

<!-- ✓ Good: Logical hierarchy -->
<h1>Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>
<h2>Another Section</h2>
```

**One H1 per page**:
```tsx
<Layout>
  <h1>Page Title</h1> {/* Only one h1 */}

  <section>
    <h2>Section 1</h2>
    <p>Content...</p>
  </section>

  <section>
    <h2>Section 2</h2>
    <h3>Subsection 2.1</h3>
    <p>Content...</p>
  </section>
</Layout>
```

### Semantic HTML

```tsx
// Use semantic elements
<Layout>
  <header>
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <article>
      <h1>Article Title</h1>
      <p>Content...</p>
    </article>

    <aside>
      <h2>Related Links</h2>
      <ul>
        <li><a href="/related">Related Article</a></li>
      </ul>
    </aside>
  </main>

  <footer>
    <p>&copy; 2026 Company Name</p>
  </footer>
</Layout>
```

### Link Text

**Descriptive link text** (not "click here"):

```html
<!-- ❌ Bad: Non-descriptive -->
<a href="/report.pdf">Click here</a> to download the report.

<!-- ✓ Good: Descriptive -->
<a href="/report.pdf">Download the annual report (PDF, 2MB)</a>

<!-- ❌ Bad: Generic -->
Learn more about our services <a href="/services">here</a>.

<!-- ✓ Good: Descriptive -->
Learn more about <a href="/services">our web design services</a>.
```

### Alt Text

**Rules**:
- Decorative images: `alt=""` (empty, not omitted)
- Informative images: Describe content/function
- Complex images: Use `aria-describedby` for detailed description

```tsx
// Decorative (no alt text needed)
<img src="/decorative-pattern.svg" alt="" />

// Informative
<img
  src="/chart.png"
  alt="Bar chart showing 50% increase in sales from 2025 to 2026"
/>

// Functional (image as button)
<button>
  <img src="/trash-icon.svg" alt="Delete" />
</button>

// Complex diagram
<img
  src="/architecture-diagram.png"
  alt="System architecture diagram"
  aria-describedby="architecture-description"
/>
<div id="architecture-description" className="sr-only">
  The diagram shows three layers: frontend, API, and database.
  The frontend communicates with the API via REST, and the API
  queries the PostgreSQL database.
</div>
```

### Language

**Declare language**:
```html
<html lang="en">
  <head>
    <title>Page Title</title>
  </head>
  <body>
    <p>This is English content.</p>

    <!-- Mark language changes -->
    <p lang="es">Este es contenido en español.</p>
    <p lang="he" dir="rtl">זה תוכן בעברית</p>
  </body>
</html>
```

---

## Forms & Error Handling

### Form Labels

**Every input needs a label**:

```tsx
// ❌ Bad: No label
<input type="text" placeholder="Name" />

// ✓ Good: Visible label
<label htmlFor="name">Name</label>
<input id="name" type="text" />

// ✓ Good: Visually hidden label (if design requires)
<label htmlFor="search" className="sr-only">Search</label>
<input id="search" type="search" placeholder="Search..." />

// ✓ Good: aria-label (last resort)
<input type="search" aria-label="Search products" />
```

### Required Fields

**Mark required fields clearly**:

```tsx
<label htmlFor="email">
  Email
  <span aria-label="required">*</span>
</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
/>

// Or use text
<label htmlFor="email">
  Email (required)
</label>
```

### Error Messages

**Associate errors with fields**:

```tsx
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby="email-error"
  />
  {hasError && (
    <div id="email-error" role="alert" className="text-red-600">
      Please enter a valid email address (e.g., user@example.com)
    </div>
  )}
</div>
```

### Validation

**Inline validation timing**:
- ✓ Validate on blur (when field loses focus)
- ✗ Don't validate on every keystroke (too aggressive)
- ✓ Show success indicator after valid input

```tsx
const EmailField = () => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const validate = (email: string) => {
    if (!email) {
      return 'Email is required';
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validate(value));
  };

  const isValid = touched && !error;

  return (
    <div>
      <label htmlFor="email">Email</label>
      <div className="relative">
        <input
          id="email"
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={touched && !!error}
          aria-describedby={error ? 'email-error' : undefined}
          className={`
            ${touched && error ? 'border-red-500' : ''}
            ${isValid ? 'border-green-500' : ''}
          `}
        />
        {isValid && (
          <CheckIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
        )}
      </div>
      {touched && error && (
        <div id="email-error" role="alert" className="text-red-600 text-sm mt-1">
          {error}
        </div>
      )}
    </div>
  );
};
```

### Form Submission

**Announce submission status**:

```tsx
const Form = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      await submitForm();
      setStatus('success');
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}

      <button
        type="submit"
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
      >
        {status === 'loading' ? 'Submitting...' : 'Submit'}
      </button>

      {/* Announce status to screen readers */}
      <div aria-live="polite" role="status">
        {status === 'success' && 'Form submitted successfully!'}
        {status === 'error' && 'Form submission failed. Please try again.'}
      </div>
    </form>
  );
};
```

---

## Multimedia & Media

### Images

```tsx
// Informative image
<img src="/product.jpg" alt="Red sneakers with white laces" />

// Decorative image (no alt text)
<img src="/background-pattern.svg" alt="" aria-hidden="true" />

// Linked image
<a href="/product/123">
  <img src="/product.jpg" alt="View details for red sneakers" />
</a>
```

### Video

**Requirements**:
- Captions (for deaf users)
- Audio description (for blind users)
- Keyboard controls

```tsx
<video controls>
  <source src="/video.mp4" type="video/mp4" />
  <track
    kind="captions"
    src="/captions-en.vtt"
    srclang="en"
    label="English"
    default
  />
  <track
    kind="captions"
    src="/captions-es.vtt"
    srclang="es"
    label="Español"
  />
  <track
    kind="descriptions"
    src="/descriptions.vtt"
    srclang="en"
    label="Audio descriptions"
  />
</video>
```

### Audio

```tsx
<audio controls>
  <source src="/podcast.mp3" type="audio/mpeg" />
  <track
    kind="captions"
    src="/transcript.vtt"
    srclang="en"
    label="English transcript"
  />
</audio>

// Provide transcript alongside audio
<details>
  <summary>View transcript</summary>
  <div>
    <p>[00:00] Welcome to the podcast...</p>
    <p>[00:15] Today we're discussing...</p>
  </div>
</details>
```

---

## Accessibility Checklist

### Perception
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Color is not the only way to convey information
- [ ] All images have appropriate alt text
- [ ] Text can be resized to 200% without breaking layout
- [ ] No content is conveyed through color alone

### Operation
- [ ] All functionality available via keyboard
- [ ] Focus indicators are visible (3:1 contrast)
- [ ] No keyboard traps
- [ ] Touch targets are ≥ 44px
- [ ] Sufficient spacing between touch targets (8px)

### Understanding
- [ ] Clear heading hierarchy (no skipped levels)
- [ ] Descriptive link text (no "click here")
- [ ] Form fields have clear labels
- [ ] Error messages are clear and helpful
- [ ] Language is declared (lang attribute)

### Robustness
- [ ] Valid HTML
- [ ] ARIA used correctly (prefer semantic HTML)
- [ ] Works with screen readers (NVDA, JAWS, VoiceOver)
- [ ] Works on mobile screen readers (TalkBack, VoiceOver)

---

## Testing Tools

### Automated Testing
- **axe DevTools** (browser extension)
- **Lighthouse** (Chrome DevTools)
- **WAVE** (browser extension)
- **Pa11y** (command-line tool)

### Manual Testing
- **Keyboard navigation**: Tab through entire page
- **Screen readers**:
  - **Windows**: NVDA (free), JAWS
  - **Mac**: VoiceOver (built-in)
  - **Mobile**: TalkBack (Android), VoiceOver (iOS)
- **Color-blind simulation**: Chrome DevTools
- **Zoom**: Test at 200% zoom level

---

**Sources**:
- WCAG 2.1 Guidelines (W3C)
- WebAIM: Accessibility resources and checkers
- A11y Project: Community-driven accessibility resources
- Nielsen Norman Group: Accessibility usability
- iOS Human Interface Guidelines: Accessibility
- Material Design: Accessibility guidelines
