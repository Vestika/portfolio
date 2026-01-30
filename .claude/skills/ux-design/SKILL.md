---
name: ux-design
description: Apply comprehensive UI/UX best practices and design principles. Use when designing or reviewing frontend interfaces, components, layouts, or user interactions.
argument-hint: [optional: specific component or page]
allowed-tools: [Read, Grep, Glob, WebFetch]
model: sonnet
---

# UI/UX Design Skill

This skill provides comprehensive UI/UX design guidance based on authoritative sources and industry best practices. It consolidates principles from Don Norman, Steve Krug, Nielsen Norman Group, and modern 2026 design standards.

## When to Use This Skill

**Auto-invoke this skill when:**
- Designing new UI components or pages
- Reviewing or refactoring existing interfaces
- Making layout, color, or typography decisions
- Implementing user interactions or animations
- Working on forms, navigation, or information architecture
- Ensuring accessibility compliance
- Optimizing mobile or responsive experiences

**Manual invocation:**
```
/ux-design                    # General UI/UX guidance
/ux-design Button component   # Specific component review
/ux-design Login form         # Specific page/feature review
```

## Core Workflow

When working on UI/UX tasks, follow this systematic approach:

### 1. Understand Context
- **Read project design guidelines** (if available):
  - Check `context/design-principles.md` for project-specific rules
  - Check `context/style-guide.md` for brand standards
  - Review existing components for established patterns

- **Identify the task type**:
  - New component/page design
  - Existing component improvement
  - Interaction design (animations, micro-interactions)
  - Form design or validation
  - Accessibility improvement
  - Responsive/mobile optimization

### 2. Apply Core Principles

Use **Nielsen's 10 Usability Heuristics** as your foundation (see Quick Reference below).

Apply the **7 Fundamental UX Principles for 2026**:
1. **User-Centered Design**: Design for real user needs, not assumptions
2. **Accessibility First**: WCAG 2.1 Level AA minimum (4.5:1 contrast, keyboard nav)
3. **Consistency & Standards**: Follow platform conventions and internal patterns
4. **Clarity & Simplicity**: Minimize cognitive load, one primary action per screen
5. **Feedback & Communication**: Provide immediate, clear feedback for all actions
6. **Error Prevention & Recovery**: Prevent errors; make recovery easy when they occur
7. **Mobile-First & Responsive**: Design for smallest screen first, enhance progressively

### 3. Reference Detailed Guidance

Load supporting files **only when needed** (progressive disclosure):

- **`reference/ux-principles.md`**: Nielsen's heuristics, cognitive load theory, mental models
- **`reference/visual-design.md`**: Gestalt principles, color theory, typography, layout
- **`reference/interaction-design.md`**: Micro-interactions, animations, feedback patterns
- **`reference/accessibility.md`**: WCAG guidelines, keyboard navigation, screen readers
- **`reference/design-patterns.md`**: Atomic design, common patterns, information architecture
- **`reference/form-design.md`**: Form validation, error handling, input best practices
- **`reference/resources.md`**: Books, tools, authoritative sources

### 4. Make Decisions

Use these decision frameworks:

**Color Decisions:**
- Ensure 4.5:1 contrast ratio for text (WCAG AA)
- Use 7:1 for AAA compliance (large text can use 4.5:1)
- Test with color-blind simulators
- Reference: `reference/visual-design.md` (Color Theory section)

**Typography Decisions:**
- Body text: 16px minimum on mobile, 18px recommended
- Line height: 1.5-1.75 for body text
- Line length: 50-75 characters for optimal readability
- Establish clear hierarchy (H1 > H2 > H3 > body)
- Reference: `reference/visual-design.md` (Typography section)

**Touch Target Decisions:**
- Minimum: 44x44px for all interactive elements (WCAG)
- Recommended: 48x48px for better usability
- Spacing: 8px minimum between targets
- Reference: `reference/accessibility.md` (Touch Targets section)

**Animation Decisions:**
- Duration: 200-300ms for small elements, 300-500ms for large
- Easing: ease-out for entrances, ease-in for exits
- Respect prefers-reduced-motion
- Reference: `reference/interaction-design.md` (Animation Timing section)

**Layout Decisions:**
- Mobile-first: Design for 375px width first
- Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Use responsive units (rem, %, vh/vw)
- Reference: `reference/visual-design.md` (Responsive Design section)

### 5. Provide Actionable Recommendations

Structure your output as:

```markdown
## [Component/Page Name] - UI/UX Review

### Summary
[Brief overview of changes or recommendations]

### Improvements

#### 1. [Specific Issue]
**Problem**: [What's wrong and why it matters]
**Solution**: [Specific fix with rationale]
**Principle**: [Which heuristic/principle this addresses]

[Code example if applicable]

**Reference**: [Link to supporting file section]

#### 2. [Next Issue]
...

### Accessibility Checklist
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Keyboard navigation works
- [ ] Screen reader labels present
- [ ] Touch targets ≥44px
- [ ] Focus indicators visible

### References
- [Source 1 from resources.md]
- [Source 2 from resources.md]
```

## Quick Reference: Nielsen's 10 Usability Heuristics

These are the foundation of all UX decisions (detailed in `reference/ux-principles.md`):

### 1. Visibility of System Status
Keep users informed about what's happening through timely feedback.
- **Examples**: Loading spinners, progress bars, success messages, "Saving..." indicators
- **Timing**: Feedback within 0.1s feels instant, 1s maintains flow, >1s needs indicator

### 2. Match Between System and Real World
Speak the user's language with familiar concepts and conventions.
- **Examples**: Trash icon for delete, calendar picker for dates, familiar terminology
- **Avoid**: Technical jargon, system-oriented language

### 3. User Control and Freedom
Provide clear "emergency exits" for mistaken actions.
- **Examples**: Undo/redo, cancel buttons, "Are you sure?" confirmations, breadcrumbs
- **Pattern**: Easy to enter, easy to exit

### 4. Consistency and Standards
Follow platform and industry conventions so users don't wonder if different words/actions mean the same thing.
- **Examples**: Links are underlined/blue, CTAs are top-right, primary button is most prominent
- **Internal**: Use design system/component library consistently

### 5. Error Prevention
Design to prevent problems from occurring in the first place.
- **Examples**: Disable invalid options, constrain inputs (date pickers vs free text), confirm destructive actions
- **Better than**: Good error messages

### 6. Recognition Rather Than Recall
Minimize memory load by making options visible and providing context.
- **Examples**: Show recently used items, provide autocomplete, display selected filters
- **Avoid**: Multi-step processes requiring memory, hidden navigation

### 7. Flexibility and Efficiency of Use
Provide accelerators for expert users while remaining accessible to novices.
- **Examples**: Keyboard shortcuts, bulk actions, customizable workflows, templates
- **Balance**: Don't sacrifice simplicity for power users

### 8. Aesthetic and Minimalist Design
Remove unnecessary elements that compete with relevant information.
- **Examples**: Clean layouts, focused content, progressive disclosure
- **Question**: Does each element serve the user's current goal?

### 9. Help Users Recognize, Diagnose, and Recover from Errors
Error messages should be in plain language, precisely indicate the problem, and suggest a solution.
- **Format**: "❌ Email address is required" (not "Error 422")
- **Include**: What happened, why it happened, how to fix it

### 10. Help and Documentation
Provide searchable, task-focused help when needed.
- **Best**: System doesn't need explanation
- **Good**: Contextual tooltips, inline help text
- **Acceptable**: Comprehensive docs/FAQ

## Project-Specific Integration

### Loading Project Context

When working on PikaPlay or any project, check for:

```typescript
// 1. Check for design principles
const designPrinciplesPath = "context/design-principles.md";
// Read this file for project-specific rules

// 2. Check for style guide
const styleGuidePath = "context/style-guide.md";
// Read this file for brand colors, typography, spacing

// 3. Check for component patterns
// Look at existing components to understand established patterns
```

### PikaPlay-Specific Guidelines

If working on PikaPlay:
1. **Brand Colors**: Reference `context/style-guide.md` for primary/secondary colors
2. **Component Patterns**: Follow established patterns in `frontend/src/components/`
3. **Design Principles**: Adhere to rules in `context/design-principles.md`
4. **i18n**: Ensure all text is internationalized (English, Hebrew, Spanish)
5. **Mobile-First**: PikaPlay is mobile-focused (parent app for babies)

## Common Decision Frameworks

### When to Use Modals vs Pages
**Use Modal:**
- Quick, focused task (< 2 minutes)
- Action relates to current context
- User needs to reference background content
- Examples: Confirm delete, quick form, image preview

**Use New Page:**
- Complex, multi-step process
- Task is self-contained
- User will spend >2 minutes
- Examples: Settings, full profile edit, content creation

### When to Use Inline Validation
**Always use inline validation for:**
- Email format
- Password requirements
- Username availability
- Required fields

**Validate on blur** (when field loses focus), not on every keystroke (too aggressive).

**Show success indicators** for validated fields (✓ green checkmark).

### When to Add Animations
**Do animate:**
- State transitions (expand/collapse, show/hide)
- User-triggered actions (button clicks, form submits)
- Loading states (skeletons, spinners)
- Micro-interactions (hover, focus)

**Don't animate:**
- Initial page load (unless onboarding)
- Background updates
- When user has prefers-reduced-motion enabled

**Duration rules:**
- Micro-interactions: 100-200ms
- Small elements: 200-300ms
- Large elements: 300-500ms
- Page transitions: 400-600ms

### Information Hierarchy Framework

Apply **Gestalt Principles** (detailed in `reference/visual-design.md`):

1. **Proximity**: Group related items close together
2. **Similarity**: Similar items should look similar (color, shape, size)
3. **Closure**: Users complete incomplete shapes (use for loading states)
4. **Continuity**: Eyes follow paths (use for guiding attention)
5. **Figure-Ground**: Clear foreground vs background (use for modals, focus)

**Visual Hierarchy Checklist:**
- [ ] One clear primary action per screen
- [ ] Focal point is obvious (size, color, position)
- [ ] Related items are grouped (whitespace, borders, backgrounds)
- [ ] Typography hierarchy is clear (H1 > H2 > body)
- [ ] Color guides attention (primary color for key actions)

## Accessibility-First Checklist

Before marking any UI work complete, verify:

### Color & Contrast
- [ ] Text contrast ≥ 4.5:1 (WCAG AA) for body text
- [ ] Large text contrast ≥ 3:1 (18px+ bold or 24px+ regular)
- [ ] UI component contrast ≥ 3:1 (borders, icons, focus indicators)
- [ ] Don't rely on color alone (use icons, text, patterns)
- [ ] Test with color-blind simulator

### Keyboard Navigation
- [ ] All interactive elements accessible via Tab
- [ ] Tab order is logical (top-to-bottom, left-to-right)
- [ ] Focus indicators are clearly visible (outline, border, background)
- [ ] Can dismiss modals with Escape
- [ ] Can activate buttons/links with Enter/Space
- [ ] No keyboard traps

### Screen Readers
- [ ] All images have alt text (or alt="" if decorative)
- [ ] All buttons/links have descriptive labels
- [ ] ARIA labels for icon buttons
- [ ] Form inputs have associated labels
- [ ] Error messages are announced
- [ ] Dynamic content changes are announced (aria-live)

### Touch Targets (Mobile)
- [ ] All interactive elements ≥ 44x44px
- [ ] 8px spacing between touch targets
- [ ] Thumb-zone optimization (bottom of screen for primary actions)

### Content & Structure
- [ ] Semantic HTML (header, nav, main, footer, article)
- [ ] Heading hierarchy is correct (no skipped levels)
- [ ] Link text is descriptive (not "click here")
- [ ] Text can resize to 200% without breaking
- [ ] Content is understandable at grade 8-9 reading level

**Full details**: See `reference/accessibility.md`

## Progressive Disclosure Strategy

To respect context budget, reference supporting files **only when needed**:

### Initial Task Assessment
Start with this SKILL.md file only. It contains:
- Nielsen's 10 heuristics (quick reference)
- 7 fundamental UX principles
- Common decision frameworks
- Accessibility checklist

### When to Load Supporting Files

**Load `reference/ux-principles.md` when:**
- Need deep understanding of cognitive load
- Designing complex interactions
- Resolving usability issues
- Need mental model concepts

**Load `reference/visual-design.md` when:**
- Making color/typography decisions
- Creating layouts
- Applying visual hierarchy
- Need Gestalt principles details

**Load `reference/interaction-design.md` when:**
- Designing animations
- Creating micro-interactions
- Implementing hover/focus states
- Designing loading states

**Load `reference/accessibility.md` when:**
- Conducting accessibility audit
- Implementing ARIA labels
- Optimizing keyboard navigation
- Need WCAG compliance details

**Load `reference/design-patterns.md` when:**
- Building new component library
- Need common UI patterns
- Designing navigation systems
- Structuring information architecture

**Load `reference/form-design.md` when:**
- Designing forms
- Implementing validation
- Writing error messages
- Creating multi-step flows

**Load `reference/resources.md` when:**
- Need to cite sources
- Want to recommend further reading
- Looking for specific tools
- Checking authoritative references

## Common Pitfalls to Avoid

### Visual Design Pitfalls
❌ **Low contrast text**: "This gray looks modern" → Fails WCAG
✅ **Solution**: Use contrast checker, aim for 4.5:1 minimum

❌ **Too many fonts**: Using 3+ font families
✅ **Solution**: 1-2 font families, vary weight/size for hierarchy

❌ **Insufficient whitespace**: Cramming content
✅ **Solution**: Use 8px spacing unit, group related items

❌ **Inconsistent spacing**: Random margins/paddings
✅ **Solution**: Use spacing scale (4, 8, 16, 24, 32, 48px)

### Interaction Pitfalls
❌ **No loading feedback**: User doesn't know system is working
✅ **Solution**: Show spinner/skeleton within 1 second

❌ **Slow animations**: 1000ms+ animations feel sluggish
✅ **Solution**: Keep under 500ms, use 200-300ms for most

❌ **No hover states**: User unsure if element is clickable
✅ **Solution**: Add hover effect (color change, underline, shadow)

❌ **Tiny touch targets**: 32x32px buttons on mobile
✅ **Solution**: Minimum 44x44px, ideally 48x48px

### Form Pitfalls
❌ **Validation on keystroke**: "Email is invalid" after typing 1 character
✅ **Solution**: Validate on blur or submit

❌ **Vague error messages**: "Invalid input"
✅ **Solution**: "Email must include @ and domain (e.g., user@example.com)"

❌ **No success feedback**: Form submits with no confirmation
✅ **Solution**: Show success message, disable submit button, redirect

❌ **Required fields not marked**: User submits, gets errors
✅ **Solution**: Mark required with * or "Required" label

### Accessibility Pitfalls
❌ **Color-only indicators**: Red for error, green for success (only)
✅ **Solution**: Add icons (❌ ✓) and text labels

❌ **Missing alt text**: `<img src="chart.png">`
✅ **Solution**: `<img src="chart.png" alt="Bar chart showing sales growth">`

❌ **Unlabeled icon buttons**: `<button><Icon /></button>`
✅ **Solution**: `<button aria-label="Delete item"><Icon /></button>`

❌ **No focus indicators**: Removed outline for aesthetics
✅ **Solution**: Custom focus style (outline or border, 2px+, high contrast)

## Quick Decision Trees

### Color Selection Decision Tree
```
Need to choose a color?
├─ Is it for text?
│  ├─ Body text? → Use 4.5:1 contrast minimum (WCAG AA)
│  ├─ Large text (18px+ bold)? → Use 3:1 contrast minimum
│  └─ Decorative? → Can use any color (but consider brand)
├─ Is it for UI element (button, border)?
│  ├─ Interactive? → Use 3:1 contrast, ensure focus state
│  ├─ Disabled? → Use muted color, ensure 3:1 contrast still
│  └─ Decorative? → Follow brand guidelines
└─ Is it for status indication?
   ├─ Success? → Green + checkmark icon
   ├─ Error? → Red + X icon + descriptive text
   ├─ Warning? → Yellow/orange + warning icon
   └─ Info? → Blue + info icon
   (Never use color alone!)
```

### Animation Decision Tree
```
Should this have animation?
├─ Is it user-triggered? (click, hover, focus)
│  ├─ Yes → Animate with 200-300ms
│  └─ No → Skip animation (unless state change)
├─ Is it a state change? (show/hide, expand/collapse)
│  ├─ Yes → Animate with 300-400ms
│  └─ No → Check if loading state
├─ Is it a loading state?
│  ├─ Yes → Use skeleton or spinner (respects prefers-reduced-motion)
│  └─ No → Probably don't animate
└─ Does it enhance understanding?
   ├─ Yes → Use subtle animation (200-300ms)
   └─ No → Skip it (avoid gratuitous animation)
```

### Layout Decision Tree
```
How should this layout?
├─ Is it a list of items?
│  ├─ Homogeneous items? → Use grid or flex with consistent spacing
│  ├─ Heterogeneous items? → Use flex column with varied spacing
│  └─ Many items? → Add pagination or infinite scroll
├─ Is it a form?
│  ├─ Short (< 5 fields)? → Single column, full width
│  ├─ Long (5-10 fields)? → Single column, group related fields
│  └─ Very long (10+ fields)? → Multi-step form or tabs
├─ Is it content + sidebar?
│  ├─ Mobile? → Stack vertically (content first, then sidebar)
│  ├─ Tablet? → Sidebar below content or hidden in drawer
│  └─ Desktop? → Sidebar left or right, 1/4 to 1/3 width
└─ Is it a dashboard?
   ├─ Few widgets (1-4)? → Use grid with equal sizing
   ├─ Many widgets (5+)? → Use grid with varied sizes
   └─ Customizable? → Allow drag-and-drop reordering
```

## Success Criteria

UI/UX work is complete when:

### Functional
- [ ] All user interactions work as expected
- [ ] All states are handled (default, hover, focus, active, disabled, loading, error)
- [ ] No console errors or warnings
- [ ] Works on target browsers (Chrome, Firefox, Safari, Edge)

### Visual
- [ ] Matches design system or style guide
- [ ] Visual hierarchy is clear
- [ ] Spacing is consistent (using spacing scale)
- [ ] Typography hierarchy is established
- [ ] Colors follow brand guidelines

### Accessible
- [ ] Passes WCAG 2.1 Level AA
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast is sufficient
- [ ] Touch targets are adequate

### Responsive
- [ ] Works on mobile (375px+)
- [ ] Works on tablet (768px+)
- [ ] Works on desktop (1024px+)
- [ ] No horizontal scrolling
- [ ] Touch-friendly on mobile

### Usable
- [ ] Follows Nielsen's 10 heuristics
- [ ] Minimizes cognitive load
- [ ] Provides clear feedback
- [ ] Prevents and handles errors well
- [ ] Is intuitive and learnable

## Next Steps

After applying this skill:
1. Implement recommended changes
2. Test with real users if possible
3. Run accessibility audit (lighthouse, axe)
4. Get design review from team
5. Document patterns for future reference

## Supporting Files Reference

- `reference/ux-principles.md` - Nielsen's heuristics, cognitive load, mental models (800 lines)
- `reference/visual-design.md` - Gestalt, color, typography, layout (700 lines)
- `reference/interaction-design.md` - Micro-interactions, animations, feedback (600 lines)
- `reference/accessibility.md` - WCAG guidelines, inclusive design (700 lines)
- `reference/design-patterns.md` - Atomic design, common patterns, IA (800 lines)
- `reference/form-design.md` - Validation, error handling, inputs (500 lines)
- `reference/resources.md` - Books, sources, tools, citations (300 lines)

---

**Last Updated**: 2026-01-27
**Based on**: Nielsen Norman Group, IxDF, Don Norman, Steve Krug, WCAG 2.1, and 2026 UX trends
