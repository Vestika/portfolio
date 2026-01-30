# UX Design Skill for Claude Code

A comprehensive UI/UX design skill that consolidates best practices from authoritative sources (Nielsen Norman Group, Don Norman, Steve Krug, WCAG 2.1) with project-specific guidelines.

## Created: 2026-01-27

## Skill Structure

```
.claude/skills/ux-design/
├── SKILL.md (558 lines)          # Main skill file - start here
├── reference/                     # Universal UX/UI best practices
│   ├── ux-principles.md (1,241 lines)      # Nielsen's heuristics, cognitive load
│   ├── visual-design.md (1,084 lines)      # Gestalt, color, typography
│   ├── interaction-design.md (1,059 lines) # Micro-interactions, animations
│   ├── accessibility.md (1,026 lines)      # WCAG 2.1 guidelines
│   ├── design-patterns.md (1,070 lines)    # Atomic design, UI patterns
│   ├── form-design.md (962 lines)          # Form validation, error handling
│   └── resources.md (598 lines)            # Books, tools, sources
└── project/                       # Project-specific integration
    ├── design-principles.md       # Links to /context/design-principles.md
    └── style-guide.md             # Links to /context/style-guide.md
```

**Total: ~7,500 lines of comprehensive UX/UI guidance**

## How to Use

### Manual Invocation

```bash
/ux-design                      # General UX guidance
/ux-design Button component     # Specific component review
/ux-design Login form           # Specific feature review
```

### Auto-Invocation

Claude will automatically use this skill when:
- Designing new UI components or pages
- Reviewing or refactoring interfaces
- Making layout, color, or typography decisions
- Implementing user interactions
- Working on forms or navigation
- Ensuring accessibility compliance

### Skill Workflow

1. **SKILL.md** provides core principles and quick references
2. **Reference files** provide deep-dive guidance (loaded as needed)
3. **Project files** integrate project-specific requirements

### Progressive Disclosure

The skill uses progressive disclosure to respect context budget:
- Start with SKILL.md (quick reference)
- Load specific reference files only when needed
- Reference project files for project-specific rules

## Content Overview

### SKILL.md (Main Entry Point)
- When to use this skill
- Core workflow for UI/UX tasks
- Nielsen's 10 Usability Heuristics (quick reference)
- 7 Fundamental UX Principles for 2026
- Common decision frameworks
- Accessibility checklist
- Progressive disclosure strategy

### reference/ux-principles.md
- Nielsen's 10 Usability Heuristics (detailed)
- Cognitive Load Theory
- Mental Models
- 7 UX Principles for 2026
- User-Centered Design Process
- UX Laws (Fitts, Hick, Jakob, Miller)

### reference/visual-design.md
- Gestalt Principles (proximity, similarity, closure, etc.)
- Color Theory & Accessibility (WCAG contrast ratios)
- Typography (font selection, type scales, readability)
- Visual Hierarchy
- Layout & Spacing (8-point grid)
- Responsive Design (breakpoints, mobile-first)
- Design Systems & Tokens

### reference/interaction-design.md
- Micro-Interactions (button press, checkbox, tooltip)
- Animation Principles (timing, easing, performance)
- Feedback Patterns (visual, haptic, audio)
- Loading States (skeleton screens, spinners, progress bars)
- Interface States (hover, focus, active, disabled, loading)
- Gestures & Touch Interactions
- Transitions & Page Changes

### reference/accessibility.md
- WCAG 2.1 Overview (Level A, AA, AAA)
- Color & Contrast (4.5:1 for text, 3:1 for UI)
- Keyboard Navigation (tab order, focus indicators)
- Screen Readers & ARIA
- Touch Targets (44px minimum)
- Content & Structure (semantic HTML, headings)
- Forms & Error Handling

### reference/design-patterns.md
- Atomic Design (atoms → molecules → organisms → templates → pages)
- Common UI Patterns (cards, modals, tabs, accordion, dropdown)
- Navigation Patterns (horizontal, sidebar, bottom nav, breadcrumbs)
- Information Architecture
- Mobile-Specific Patterns (pull-to-refresh, swipe, bottom sheet)
- Data Display Patterns (tables, lists, pagination)

### reference/form-design.md
- Form Layout & Structure (single column, label position)
- Input Fields (text, select, radio, checkbox, date, file upload)
- Validation Patterns (when to validate, timing)
- Error Handling (error messages, inline errors, form-level errors)
- Multi-Step Forms (progress indicator, step navigation)
- Form Submission (loading state, success confirmation)

### reference/resources.md
- Classic Books (Don Norman, Steve Krug, Nir Eyal, Brad Frost)
- Modern Books & Guides (Refactoring UI, Laws of UX, Form Design Patterns)
- Authoritative Websites (Nielsen Norman Group, IxDF, Smashing Magazine, A11y Project)
- Design Tools (Figma, Sketch, color tools, typography tools, icon libraries)
- Accessibility Tools (axe, Lighthouse, WAVE, screen readers)
- Learning Platforms (Coursera, IxDF, Nielsen Norman Group)
- Research Sources (all articles and studies cited)

### project/design-principles.md
- References `/context/design-principles.md`
- Integration guidance for project-specific rules
- PikaPlay context (mobile-first, i18n, target users)

### project/style-guide.md
- References `/context/style-guide.md`
- Guidance on using project-specific design tokens
- Common mistakes to avoid

## Key Features

✅ **Comprehensive**: Covers all aspects of UX/UI design
✅ **Authoritative**: Based on Nielsen Norman Group, Don Norman, WCAG 2.1, etc.
✅ **Practical**: Includes code examples and implementation patterns
✅ **Modern**: Updated for 2026 trends (AI, accessibility-first, mobile-first)
✅ **Progressive**: Loads details only when needed (context-efficient)
✅ **Project-Aware**: Integrates with existing project guidelines
✅ **Accessible**: Strong focus on WCAG 2.1 compliance
✅ **Well-Cited**: All sources documented in resources.md

## Testing the Skill

### Functional Tests
- [ ] Skill appears in `/` menu
- [ ] Can be invoked with `/ux-design`
- [ ] Can be invoked with arguments: `/ux-design Button component`
- [ ] Claude auto-invokes when working on UI/UX tasks
- [ ] Supporting files are accessible via relative paths
- [ ] Project files load correctly

### Content Tests
- [ ] Nielsen's heuristics are accurate
- [ ] WCAG guidelines are correct (4.5:1 AA, 7:1 AAA)
- [ ] Gestalt principles are well-explained
- [ ] Color contrast ratios are accurate
- [ ] All sources are cited in resources.md

### Integration Tests
- [ ] Works with PikaPlay's design-principles.md
- [ ] Works with PikaPlay's style-guide.md
- [ ] Provides project-specific recommendations
- [ ] Respects brand colors and typography

## Usage Examples

### Example 1: Designing a New Button Component

```
User: "Create a primary button component"

Claude invokes /ux-design skill:
1. References SKILL.md for button state guidelines
2. Loads interaction-design.md for hover/active states
3. Loads accessibility.md for touch target size (44px minimum)
4. Loads visual-design.md for color contrast (4.5:1 minimum)
5. Checks project/style-guide.md for brand colors
6. Creates button with all states (default, hover, active, focus, disabled)
7. Ensures WCAG AA compliance
```

### Example 2: Reviewing a Form

```
User: "Review this login form for UX issues"

Claude invokes /ux-design skill:
1. References SKILL.md for quick form checklist
2. Loads form-design.md for validation patterns
3. Loads accessibility.md for label requirements
4. Checks field labels, validation timing, error messages
5. Verifies keyboard navigation, touch targets
6. Provides specific recommendations with rationale
```

### Example 3: Checking Color Contrast

```
User: "Is #999999 text on white background accessible?"

Claude invokes /ux-design skill:
1. References visual-design.md color section
2. Calculates contrast: #999999 on #FFFFFF = 2.8:1
3. Reports: ✗ Fails WCAG AA (4.5:1 required for body text)
4. Suggests alternatives: #666666 (5.7:1) or #333333 (12.6:1)
5. References resources.md for contrast checker tools
```

## Benefits

1. **Consistency**: All UI/UX work follows established best practices
2. **Education**: Team learns from authoritative sources
3. **Efficiency**: Quick reference without searching documentation
4. **Quality**: Designs meet accessibility and usability standards
5. **Project Alignment**: Integrates with existing design guidelines
6. **Future-Proof**: Based on 2026 trends and standards
7. **Comprehensive**: Single source for all UX/UI questions

## Maintenance

### Updating the Skill

To update with new best practices:
1. Edit relevant reference file (e.g., `visual-design.md`)
2. Add new sources to `resources.md`
3. Update version date in files
4. Test with real components

### Adding New Sections

To add new content:
1. Determine if it fits in existing reference file
2. If new topic, create new reference file
3. Link from SKILL.md progressive disclosure section
4. Document in this README

## Sources

All recommendations are based on research from:

**Classic Literature**:
- The Design of Everyday Things - Don Norman
- Don't Make Me Think - Steve Krug
- Hooked - Nir Eyal
- Atomic Design - Brad Frost
- Lean UX - Jeff Gothelf

**Authoritative Sources**:
- Nielsen Norman Group (10 Usability Heuristics, research articles)
- WCAG 2.1 Guidelines (W3C)
- Material Design (Google)
- iOS Human Interface Guidelines (Apple)
- Interaction Design Foundation

**Modern Resources**:
- Refactoring UI (Adam Wathan & Steve Schoger)
- Laws of UX (Jon Yablonski)
- UX Design Institute (2026 principles)

See `resources.md` for complete list of sources with links.

---

## Quick Start

1. **First time using**: Read `SKILL.md` to understand workflow
2. **Working on UI**: Invoke `/ux-design [component-name]`
3. **Need deep dive**: Reference specific files in `reference/` directory
4. **Project-specific**: Check `project/` files for PikaPlay guidelines

## Success Metrics

UI/UX work is complete when:
- ✅ Follows Nielsen's 10 heuristics
- ✅ Meets WCAG 2.1 Level AA
- ✅ Works on all breakpoints (mobile, tablet, desktop)
- ✅ All interactive states implemented (hover, focus, active, disabled)
- ✅ Project design principles followed
- ✅ Code is accessible (keyboard nav, screen readers)

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-01-27
**Author**: Claude Code Implementation
**License**: Project-specific (PikaPlay)
