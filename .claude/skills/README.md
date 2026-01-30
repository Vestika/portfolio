# Vestika UI/UX Expert Skills

Comprehensive UI/UX design knowledge for the Vestika project, compiled from 2026 industry standards, research, and best practices. These skills are version-controlled and shared with the team to ensure consistent design quality across the application.

## Project Integration

This skill set complements the existing Vestika design resources:
- **Project-specific guidelines**: `/context/design-principles.md` and `/context/style-guide.md` (Vestika brand)
- **Industry best practices**: `.claude/skills/` (Universal UI/UX knowledge)
- **Design review agents**: Available for automated compliance checking

When working on Vestika UI:
1. Follow Vestika brand guidelines in `/context/` first
2. Apply universal best practices from `.claude/skills/`
3. Ensure WCAG 2.2 Level AA compliance
4. Test with Playwright for visual verification

## Skills Available

### 1. `ui-ux-expert.md`
**Comprehensive UI/UX Design Guide**

A complete reference covering:
- Essential books and resources (top 10 must-read books)
- 2026 design philosophy and trends
- Platform-specific guidelines (iOS HIG, Material Design 3)
- Accessibility standards (WCAG 2.2)
- Mobile-first and responsive design
- Micro-interactions and animations
- Design systems and component libraries
- Dark mode design
- Form design and validation
- Data visualization and dashboards
- Common pitfalls to avoid
- Pre-launch checklists

**When to use:** For in-depth design guidance, detailed explanations, and comprehensive coverage of UI/UX topics.

### 2. `ui-ux-quick-reference.md`
**Quick Lookup Reference**

Fast access to common values and decisions:
- Contrast ratios (WCAG 2.2)
- Touch target sizes
- Animation timing
- Color systems
- Typography scales
- Spacing systems
- Responsive breakpoints
- Core Web Vitals
- Z-index scales
- Decision trees (modal vs toast vs tooltip)
- Keyboard shortcuts
- Accessibility quick checks

**When to use:** For quick lookups of specific values, ratios, or "should I use X?" decisions.

## How to Use

### In Claude Code CLI

These skills are automatically available in Claude Code. Reference them in your prompts:

```
"Review this form design using UI/UX best practices"

"What's the minimum touch target size for mobile?"

"Help me design a dashboard following 2026 best practices"

"Check if this component meets WCAG 2.2 accessibility standards"
```

### Vestika-Specific Examples

```
"Review the PortfolioView component for accessibility compliance"

"Design a mobile-friendly navigation for the holdings table"

"Check if the AI chat interface animations follow best practices"

"What's the best way to display the tags selector on mobile?"

"Review the dark mode implementation in the dashboard"

"Optimize the chart loading states following Core Web Vitals"
```

### Manual Reference

You can also read the files directly:

```bash
# View the comprehensive guide
cat ~/.claude/skills/ui-ux-expert.md

# View the quick reference
cat ~/.claude/skills/ui-ux-quick-reference.md

# Search for specific topics
grep -i "contrast ratio" ~/.claude/skills/ui-ux-quick-reference.md
```

## Knowledge Sources

This skill compilation is based on:

### Industry Standards
- **WCAG 2.2** (October 2023) - Web accessibility standards
- **iOS Human Interface Guidelines** (2026 updates) - Apple design system
- **Material Design 3** - Google's latest design system
- **Nielsen Norman Group** - UX research and guidelines
- **Interaction Design Foundation** - Design education resources

### Essential Books
1. **Refactoring UI** - Adam Wathan & Steve Schoger
2. **Don't Make Me Think** - Steve Krug
3. **The Design of Everyday Things** - Don Norman
4. **Designing with the Mind in Mind** - Jeff Johnson
5. **About Face: Interaction Design** - Alan Cooper et al.
6. **100 Things About People** - Susan Weinschenk
7. **Laws of UX** - Jon Yablonski
8. **Hooked** - Nir Eyal
9. **Lean UX** - Jeff Gothelf & Josh Seiden
10. **Practical UI** - Adham Dannaway

### 2026 Research Sources
- UX/UI design trends articles (2025-2026)
- Mobile app design best practices studies
- Performance optimization research (Core Web Vitals)
- Accessibility compliance requirements (April 2026 deadlines)
- Design system evolution (Figma, code integration)
- Motion design and micro-interactions research
- Dark mode adoption statistics
- Form validation UX studies
- Data visualization best practices

## Coverage Areas

### Design Foundations
✅ Color theory and palettes
✅ Typography and scales
✅ Spacing and layout systems
✅ Visual hierarchy
✅ Grid systems

### Accessibility
✅ WCAG 2.2 Level AA compliance
✅ Color contrast requirements
✅ Keyboard navigation
✅ Screen reader support
✅ Touch target sizing
✅ Motion sensitivity (prefers-reduced-motion)

### Platform Design
✅ iOS Human Interface Guidelines
✅ Material Design 3 (Android)
✅ Cross-platform considerations
✅ Responsive web design
✅ Mobile-first approach

### Interaction Design
✅ Micro-interactions
✅ Animation timing and easing
✅ Loading states (spinners, skeletons, progress)
✅ Empty states
✅ Error states
✅ Success feedback

### Component Design
✅ Buttons (hierarchy, states, sizes)
✅ Forms (fields, validation, multi-step)
✅ Navigation patterns
✅ Modals and dialogs
✅ Tooltips and popovers
✅ Cards and lists
✅ Data tables
✅ Charts and visualizations

### Advanced Topics
✅ Design systems and tokens
✅ Component libraries
✅ Dark mode implementation
✅ Dashboard design
✅ Data visualization
✅ Performance optimization
✅ AI-driven personalization (2026)
✅ Spatial computing (visionOS)

## Quick Examples

### Example 1: Check Button Contrast
**Question:** "Does my blue button (#3B82F6) on white background meet accessibility standards?"

**Quick Reference Check:**
- Required contrast for UI components: 3:1 (WCAG 2.2 AA)
- Blue #3B82F6 on white #FFFFFF: 4.5:1 ✅ Passes

### Example 2: Mobile Touch Target
**Question:** "How big should mobile buttons be?"

**Quick Reference:**
- iOS: 44x44 pt minimum
- Android: 48x48 dp minimum
- Web: 48x48 px recommended
- Spacing: 8-16px between targets

### Example 3: Animation Duration
**Question:** "How long should a modal fade-in take?"

**Quick Reference:**
- Modal open: 300-400ms with ease-out
- Modal close: 200-300ms with ease-in
- Never exceed 1 second for UI feedback

### Example 4: Form Validation
**Question:** "When should I show validation errors?"

**Decision Tree:**
- ✅ Inline validation on blur (22% better success rate)
- ✅ Show error immediately after leaving field
- ❌ Don't wait until submit
- ❌ Don't validate on every keystroke

## Maintenance

These skills are based on 2026 standards and best practices. As design standards evolve:

**Update triggers:**
- New WCAG versions
- Major iOS/Material Design updates
- Significant industry practice shifts
- New accessibility requirements

**Last Updated:** January 30, 2026

## Contributing

To update or expand these skills:

1. Research new standards/practices
2. Update relevant sections in markdown files
3. Add new decision trees or quick reference values
4. Include sources and citations
5. Update the "Last Updated" date

## Related Resources

### External Links
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design 3](https://m3.material.io/)
- [Nielsen Norman Group](https://www.nngroup.com/)
- [Web Content Accessibility](https://www.w3.org/WAI/)

### Tools
- **Contrast Checkers**: WebAIM, Colorable, Contrast Ratio
- **Accessibility Testing**: Axe DevTools, WAVE, Lighthouse
- **Design**: Figma, Sketch, Adobe XD
- **Prototyping**: ProtoPie, Principle, Framer
- **Animation**: Lottie, After Effects, GSAP

## License

This compilation is for educational and reference purposes. Individual sources and guidelines maintain their respective licenses and copyrights.

---

**Questions or suggestions?** Open an issue or contribute improvements to keep these skills current and comprehensive.
