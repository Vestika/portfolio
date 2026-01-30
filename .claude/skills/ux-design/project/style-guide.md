# Project-Specific Style Guide

**Note**: This file references the main project style guide located at `/Users/ben/Projects/pikaplay/context/style-guide.md`.

## How to Use

When working on this project (PikaPlay), always refer to the project-specific style guide for:

- Brand colors (primary, secondary, accent)
- Typography (font families, sizes, weights)
- Spacing system (margins, padding, gaps)
- Border radius conventions
- Shadow/elevation system
- Animation durations
- Breakpoint definitions
- Component-specific styling rules

## Reading the Project File

Use the Read tool to access the full style guide:

```
Read file: /Users/ben/Projects/pikaplay/context/style-guide.md
```

## Integration with UX Skill

The UX Design skill provides **universal design principles** (color theory, typography best practices, WCAG compliance).

The project style guide provides **specific implementation** (exact color values, font choices, spacing scale).

**Workflow**:
1. Understand universal principles (e.g., "use 4.5:1 contrast ratio")
2. Apply project-specific values (e.g., "primary color is #2563eb")
3. Verify implementation meets both universal standards and project conventions
4. If project values violate best practices (e.g., low contrast), flag for review

## Style Guide Contents (Typical)

**Colors**:
- Primary, secondary, accent colors
- Semantic colors (success, error, warning, info)
- Neutral palette (gray scale)
- Text colors (primary, secondary, tertiary)
- Background colors

**Typography**:
- Font families (heading, body, mono)
- Font size scale (xs, sm, base, lg, xl, 2xl, etc.)
- Font weights (normal, medium, semibold, bold)
- Line heights
- Letter spacing

**Spacing**:
- Spacing scale (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24)
- Component-specific spacing rules

**Borders & Radius**:
- Border widths
- Border radius scale
- Border colors

**Shadows**:
- Elevation levels (sm, md, lg, xl, 2xl)
- Shadow values

**Breakpoints**:
- Mobile, tablet, desktop dimensions

**Animation**:
- Transition durations
- Easing functions

## Quick Reference Checklist

Before implementing styled components:
- [ ] Read project style guide
- [ ] Use defined color palette (don't create new colors)
- [ ] Follow spacing scale (don't use arbitrary values)
- [ ] Use defined typography scale
- [ ] Verify colors meet WCAG contrast requirements
- [ ] Test on all breakpoints defined in guide
- [ ] Use defined animation durations

## Common Mistakes to Avoid

❌ **Creating arbitrary colors**: Use palette from style guide
❌ **Random spacing values**: Use defined spacing scale
❌ **Inconsistent border radius**: Follow established patterns
❌ **Custom font sizes**: Use typography scale
❌ **Ignoring breakpoints**: Test at defined breakpoints

✓ **Use design tokens**: Reference variables/constants
✓ **Follow patterns**: Match existing component styles
✓ **Test thoroughly**: Verify on mobile, tablet, desktop
✓ **Maintain consistency**: New components should match existing aesthetic

---

**File location**: `/Users/ben/Projects/pikaplay/context/style-guide.md`
