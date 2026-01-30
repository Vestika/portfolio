# UI/UX Quick Reference Guide

Quick lookup for common UI/UX values, ratios, and decisions.

## Contrast Ratios (WCAG 2.2)

| Element | Minimum Ratio | Level |
|---------|---------------|-------|
| Body text (<18pt) | 4.5:1 | AA |
| Large text (≥18pt or ≥14pt bold) | 3:1 | AA |
| UI components & icons | 3:1 | AA |
| Body text (<18pt) | 7:1 | AAA |
| Large text | 4.5:1 | AAA |

## Touch Target Sizes

| Platform | Minimum Size | Recommended |
|----------|--------------|-------------|
| iOS (HIG) | 44x44 pt | 44x44 pt |
| Android (Material) | 48x48 dp | 48x48 dp |
| Web | 44x44 px | 48x48 px |
| Spacing between | 8px | 8-16px |

## Animation Timing

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Micro-interaction | 150-300ms | ease-out |
| Button hover | 200ms | ease-out |
| Button press | 100ms | ease-in-out |
| Modal open | 300-400ms | ease-out |
| Modal close | 200-300ms | ease-in |
| Page transition | 300-500ms | ease-in-out |
| Toast notification | 300ms | ease-out |
| Skeleton shimmer | 1500-2000ms | linear |
| Loading spinner | 600ms | ease-in-out |

**Rule**: Never exceed 1 second for UI feedback

## Color Systems

### Dark Mode Colors

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background | #FFFFFF | #121212 |
| Surface L1 | #F5F5F5 | #1E1E1E |
| Surface L2 | #EEEEEE | #232323 |
| Surface L3 | #E0E0E0 | #252525 |
| Text Primary | #000000 | #E0E0E0 |
| Text Secondary | #666666 | #A0A0A0 |

### Semantic Colors

| State | Color | Usage |
|-------|-------|-------|
| Error | Red (#DC2626) | Errors, destructive actions |
| Warning | Yellow/Orange (#F59E0B) | Warnings, caution |
| Success | Green (#10B981) | Success, completion |
| Info | Blue (#3B82F6) | Information, neutral |

## Typography Scale

| Level | Desktop | Mobile | Weight | Line Height |
|-------|---------|--------|--------|-------------|
| H1 | 48-60px | 36-48px | 700 | 1.2 |
| H2 | 36-48px | 28-36px | 700 | 1.3 |
| H3 | 28-36px | 24-28px | 600 | 1.3 |
| H4 | 24-28px | 20-24px | 600 | 1.4 |
| H5 | 20-24px | 18-20px | 600 | 1.4 |
| H6 | 18-20px | 16-18px | 600 | 1.5 |
| Body | 16-18px | 16px | 400 | 1.5-1.6 |
| Small | 14px | 14px | 400 | 1.5 |
| Caption | 12px | 12px | 400 | 1.4 |

## Spacing System (8px Grid)

| Size | Value | Usage |
|------|-------|-------|
| 3xs | 2px | Borders, separators |
| 2xs | 4px | Icon padding, tight spacing |
| xs | 8px | Component internal padding |
| sm | 12px | Related elements |
| md | 16px | Standard spacing |
| lg | 24px | Section spacing |
| xl | 32px | Major sections |
| 2xl | 48px | Large gaps |
| 3xl | 64px | Page sections |
| 4xl | 96px | Hero sections |

## Responsive Breakpoints

| Size | Min Width | Target Devices |
|------|-----------|----------------|
| Mobile S | 320px | Small phones |
| Mobile M | 375px | Standard phones |
| Mobile L | 425px | Large phones |
| Tablet | 768px | Tablets, landscape phones |
| Laptop | 1024px | Laptops, small desktops |
| Desktop | 1440px | Standard desktops |
| 4K | 2560px | Large displays |

**Note**: Use content-driven breakpoints when possible

## Core Web Vitals (2026)

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | 2.5-4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | 200-500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | 0.1-0.25 | > 0.25 |

## Form Field Sizes

| Element | Height | Padding | Font Size |
|---------|--------|---------|-----------|
| Input (mobile) | 48-52px | 12-16px | 16px |
| Input (desktop) | 40-44px | 12-16px | 16px |
| Button (mobile) | 48px min | 16-24px | 16px |
| Button (desktop) | 40-44px | 16-32px | 14-16px |
| Checkbox/Radio | 20-24px | - | - |
| Tap area (checkbox) | 48x48px | - | - |

## Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| Base | 0 | Default content |
| Dropdown | 1000 | Dropdown menus |
| Sticky | 1020 | Sticky headers |
| Fixed | 1030 | Fixed UI elements |
| Modal backdrop | 1040 | Modal backgrounds |
| Modal | 1050 | Modal content |
| Popover | 1060 | Tooltips, popovers |
| Toast | 1070 | Toast notifications |
| Tooltip | 1080 | Tooltips on top |

## Icon Sizes

| Size | Pixels | Usage |
|------|--------|-------|
| xs | 12px | Inline with small text |
| sm | 16px | Inline with body text |
| md | 20px | Buttons, UI controls |
| lg | 24px | Navigation, headers |
| xl | 32px | Feature icons |
| 2xl | 48px | Hero sections |

## Border Radius

| Size | Value | Usage |
|------|-------|-------|
| none | 0 | Sharp edges |
| sm | 2px | Subtle rounding |
| md | 4px | Buttons, inputs |
| lg | 8px | Cards |
| xl | 12px | Large cards |
| 2xl | 16px | Modal windows |
| full | 50% or 9999px | Circular/pill shape |

## Shadow Elevation

| Level | Usage | CSS Example |
|-------|-------|-------------|
| 0 | No elevation | none |
| 1 | Hover state | 0 1px 2px rgba(0,0,0,0.05) |
| 2 | Buttons | 0 1px 3px rgba(0,0,0,0.1) |
| 3 | Cards | 0 4px 6px rgba(0,0,0,0.1) |
| 4 | Dropdowns | 0 10px 15px rgba(0,0,0,0.1) |
| 5 | Modals | 0 20px 25px rgba(0,0,0,0.1) |

## Loading States

| Pattern | When to Use | Duration |
|---------|-------------|----------|
| Spinner | Small actions (< 2s) | Until complete |
| Progress bar | Known duration | Show % complete |
| Skeleton screen | Initial page load | 500-2000ms |
| Shimmer | Loading lists/cards | 1500-2000ms loop |
| Optimistic update | Instant feedback | 0ms (fake instant) |

## Button Hierarchy

| Type | When to Use | Style |
|------|-------------|-------|
| Primary | Main action, 1 per section | Filled, bold color |
| Secondary | Alternative action | Outlined or subtle fill |
| Tertiary | Less important action | Text-only, minimal style |
| Ghost | Inline actions | No background, hover shows |
| Destructive | Delete, remove actions | Red color, careful placement |
| Disabled | Unavailable action | Low opacity, no interaction |

## Navigation Patterns

| Pattern | Best For | Platform |
|---------|----------|----------|
| Bottom tabs | Primary navigation | iOS, Mobile |
| Tab bar (top) | Content categories | Android, Material |
| Hamburger menu | Secondary navigation | Mobile (all platforms) |
| Sidebar | Desktop apps | Desktop |
| Top bar | App navigation | Desktop, Web |
| Breadcrumbs | Deep hierarchies | Desktop, Web |

## Dashboard Limits

| Element | Limit | Reason |
|---------|-------|--------|
| Visualizations per dashboard | 5-9 | Human brain limit (7±2) |
| Colors in palette | 3-5 | Cognitive load, consistency |
| Table rows (initial) | 10-25 | Scroll fatigue |
| Data points on chart | ~50 | Readability |
| Decimal places | 0-2 | Cognitive load |

## Decision Trees

### Should I use a modal?
- ✅ Critical user decision required
- ✅ Focus needed (prevent other actions)
- ✅ Quick task (< 30 seconds)
- ❌ Long form (use dedicated page)
- ❌ Just showing info (use inline or toast)
- ❌ Non-critical (use inline)

### Should I use a tooltip?
- ✅ Brief explanation (< 10 words)
- ✅ Non-critical information
- ✅ Icon or abbreviated term
- ❌ Long explanation (use help icon → modal)
- ❌ Critical information (show inline)
- ❌ Mobile (hard to hover)

### Should I use a toast notification?
- ✅ Success confirmation (saved, sent)
- ✅ Non-critical updates
- ✅ Auto-dismiss appropriate
- ❌ Error messages (use inline)
- ❌ Requires action (use modal)
- ❌ Critical information (use modal)

### Should I use a loading spinner?
- ✅ Action takes < 2 seconds
- ✅ Unknown duration
- ✅ Small component
- ❌ Page load (use skeleton)
- ❌ Long operation (use progress bar)
- ❌ List loading (use skeleton)

### Should I use animation?
- ✅ Provides feedback (button press)
- ✅ Guides attention (new item)
- ✅ Shows relationship (modal from button)
- ✅ < 500ms duration
- ❌ Purely decorative
- ❌ Slows down task
- ❌ No prefers-reduced-motion support

## Common Ratios

| Aspect Ratio | Usage |
|--------------|-------|
| 16:9 | Video, hero images |
| 4:3 | Traditional images |
| 3:2 | Photos |
| 1:1 | Square (profile pics, Instagram) |
| 9:16 | Vertical video (Stories, Reels) |
| 21:9 | Ultra-wide |

## File Size Targets

| Asset Type | Target | Maximum |
|------------|--------|---------|
| Hero image | < 100KB | 200KB |
| Thumbnail | < 20KB | 50KB |
| Icon (SVG) | < 5KB | 10KB |
| CSS bundle | < 50KB | 100KB |
| JS bundle | < 200KB | 500KB |
| Font file | < 50KB | 100KB |
| Total page | < 500KB | 1MB |

## Validation Timing

| Type | When to Validate | When to Show Error |
|------|------------------|-------------------|
| Required field | On blur | Immediately on blur |
| Email format | On blur | Immediately on blur |
| Password strength | On input | After 3 characters |
| Username availability | On blur + debounce | After API response |
| Form submission | On submit | Before submission |

## Error Message Formula

**Structure**: `[Problem] + [Reason] + [Solution]`

**Examples**:
- ❌ "Invalid email"
- ✅ "Email must include an @ symbol"

- ❌ "Error 401"
- ✅ "Session expired. Please log in again."

- ❌ "Can't proceed"
- ✅ "Select at least one option to continue"

## Keyboard Shortcuts (Web)

| Action | Shortcut | Usage |
|--------|----------|-------|
| Submit form | Enter | When focus in form |
| Close modal | Esc | Any modal/overlay |
| Search | Cmd/Ctrl + K | Global search |
| Save | Cmd/Ctrl + S | Edit forms |
| Undo | Cmd/Ctrl + Z | Text inputs |
| Navigate | Tab | Next interactive element |
| Navigate back | Shift + Tab | Previous element |
| Select | Space | Checkboxes, buttons |
| Toggle | Arrow keys | Radio groups, toggles |

## Accessibility Quick Checks

✅ **Before Launch:**
- [ ] Can navigate entire site with keyboard only
- [ ] Focus indicator visible on all interactive elements
- [ ] All images have alt text (or alt="" if decorative)
- [ ] Color contrast meets 4.5:1 (text) and 3:1 (UI)
- [ ] Form labels present and associated
- [ ] Error messages linked to fields
- [ ] No content flashes more than 3 times per second
- [ ] Headings in logical order (h1 → h2 → h3)
- [ ] Touch targets at least 48x48px
- [ ] Works with screen reader (test with VoiceOver/NVDA)

## Mobile-First Considerations

| Consideration | Mobile | Desktop |
|---------------|--------|---------|
| Navigation | Hamburger/bottom tabs | Horizontal menu |
| Touch targets | 48x48px minimum | 40x40px acceptable |
| Font size | 16px minimum (no zoom) | 14-16px acceptable |
| Form fields | 48-52px height | 40-44px acceptable |
| Images | WebP/AVIF, lazy load | Higher quality OK |
| Tables | Horizontal scroll | Full width |
| Modals | Full screen on mobile | Centered overlay |

## When in Doubt

**✅ Follow these principles:**
1. **User First**: Does this help or hinder the user?
2. **Accessibility**: Can everyone use this?
3. **Simplicity**: Is there a simpler way?
4. **Consistency**: Does this match existing patterns?
5. **Performance**: Is this fast enough?
6. **Standards**: What do platform guidelines say?

**📚 Check these resources:**
- Platform guidelines (iOS HIG, Material Design)
- WCAG 2.2 standards
- Nielsen Norman Group articles
- Existing design system documentation

**🧪 Test with:**
- Real users (not just designers/developers)
- Multiple devices and browsers
- Keyboard only
- Screen reader
- Slow network connection

---

**Last Updated**: January 2026
**Source**: Compiled from WCAG 2.2, iOS HIG, Material Design 3, and industry best practices
