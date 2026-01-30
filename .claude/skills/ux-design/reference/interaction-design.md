# Interaction Design - Comprehensive Guide

This file covers micro-interactions, animations, feedback patterns, and user interface states.

## Table of Contents

1. [Micro-Interactions](#micro-interactions)
2. [Animation Principles](#animation-principles)
3. [Feedback Patterns](#feedback-patterns)
4. [Loading States](#loading-states)
5. [Interface States](#interface-states)
6. [Gestures & Touch Interactions](#gestures--touch-interactions)
7. [Transitions & Page Changes](#transitions--page-changes)

---

## Micro-Interactions

**Definition**: Micro-interactions are small, single-purpose animations that provide feedback and enhance the user experience.

### The Four Parts of Micro-Interactions

1. **Trigger**: What initiates the interaction (user action or system event)
2. **Rules**: What happens during the interaction
3. **Feedback**: How the user knows what's happening
4. **Loops & Modes**: Meta-rules that govern the interaction

### Common Micro-Interactions

#### Button Press

**States**: Default → Hover → Active → Disabled

```tsx
// React + Tailwind implementation
const Button = ({ children, onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 rounded
        transition-all duration-200

        /* Default state */
        bg-blue-600 text-white

        /* Hover state */
        hover:bg-blue-700
        hover:shadow-md
        hover:-translate-y-0.5

        /* Active state (pressed) */
        active:translate-y-0
        active:shadow-sm

        /* Disabled state */
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:hover:translate-y-0
      `}
    >
      {children}
    </button>
  );
};
```

**Timing**:
- Hover transition: 150-200ms
- Active press: 100ms (instant feel)
- Shadow/transform together for cohesive feel

#### Checkbox/Toggle

**Principle**: Immediate visual confirmation of state change

```tsx
const Checkbox = ({ checked, onChange, label }) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`
          w-5 h-5 rounded border-2
          transition-all duration-200
          flex items-center justify-center
          ${checked
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300'
          }
        `}
      >
        {checked && (
          <svg
            className="w-3 h-3 text-white animate-scale-in"
            viewBox="0 0 12 10"
          >
            <polyline
              points="1.5 6 4.5 9 10.5 1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span>{label}</span>
    </label>
  );
};

// CSS animation
@keyframes scale-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 200ms ease-out;
}
```

#### Like/Favorite Button

**Principle**: Satisfying feedback that encourages repeated use

```tsx
const LikeButton = ({ liked, onToggle }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onToggle();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <button
      onClick={handleClick}
      className="relative"
      aria-label={liked ? "Unlike" : "Like"}
    >
      {/* Heart icon */}
      <HeartIcon
        className={`
          w-6 h-6 transition-all duration-300
          ${liked
            ? 'fill-red-500 stroke-red-500 scale-110'
            : 'fill-none stroke-gray-400'
          }
          ${isAnimating ? 'animate-heart-pop' : ''}
        `}
      />

      {/* Particles effect */}
      {isAnimating && (
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full animate-particle"
              style={{
                '--angle': `${i * 60}deg`,
                animationDelay: '0ms',
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
};

// CSS
@keyframes heart-pop {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.3); }
  50% { transform: scale(0.9); }
  75% { transform: scale(1.1); }
}

@keyframes particle {
  0% {
    transform: translate(-50%, -50%) translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform:
      translate(-50%, -50%)
      rotate(var(--angle))
      translate(30px, 0)
      scale(0);
    opacity: 0;
  }
}

.animate-particle {
  animation: particle 600ms ease-out forwards;
}
```

#### Input Focus

**Principle**: Clear indication of active field

```tsx
const Input = ({ label, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`
          w-full px-4 py-2 rounded-lg border-2
          transition-all duration-200

          ${isFocused
            ? 'border-blue-500 shadow-blue-100 shadow-lg'
            : 'border-gray-300'
          }

          focus:outline-none
        `}
      />

      {/* Floating label */}
      <label
        className={`
          absolute left-4 transition-all duration-200
          pointer-events-none

          ${isFocused || props.value
            ? 'top-0 -translate-y-1/2 text-xs bg-white px-1 text-blue-500'
            : 'top-1/2 -translate-y-1/2 text-base text-gray-400'
          }
        `}
      >
        {label}
      </label>
    </div>
  );
};
```

#### Tooltip

**Principle**: Provide contextual help without cluttering the interface

```tsx
const Tooltip = ({ children, content, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div
          className={`
            absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded
            whitespace-nowrap pointer-events-none

            /* Fade in */
            animate-fade-in

            /* Position */
            ${position === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2'}
            ${position === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2'}
            ${position === 'left' && 'right-full top-1/2 -translate-y-1/2 mr-2'}
            ${position === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-2'}
          `}
        >
          {content}

          {/* Arrow */}
          <div
            className={`
              absolute w-2 h-2 bg-gray-900 rotate-45
              ${position === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2'}
              ${position === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'}
            `}
          />
        </div>
      )}
    </div>
  );
};

// CSS
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}
```

---

## Animation Principles

### Disney's 12 Principles (Applied to UI)

#### 1. Timing

**Principle**: Different durations convey different meanings

**Guidelines**:
- **Fast (100-200ms)**: Micro-interactions (button press, checkbox)
- **Medium (200-400ms)**: State changes (expand/collapse, show/hide)
- **Slow (400-600ms)**: Page transitions, large movements
- **Never > 600ms**: Animations feel sluggish

```css
/* Quick feedback */
.button {
  transition: transform 150ms ease-out;
}

/* State change */
.dropdown {
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

/* Page transition */
.page-enter {
  animation: slide-in 400ms ease-out;
}
```

#### 2. Easing

**Principle**: Natural motion accelerates and decelerates

**Common Easing Functions**:

```css
/* Linear: Robotic, avoid except for color/opacity */
transition-timing-function: linear;

/* Ease-out: Starts fast, ends slow (entrances, expanding) */
transition-timing-function: cubic-bezier(0.0, 0.0, 0.2, 1);

/* Ease-in: Starts slow, ends fast (exits, collapsing) */
transition-timing-function: cubic-bezier(0.4, 0.0, 1, 1);

/* Ease-in-out: Smooth start and end (moving between positions) */
transition-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1);

/* Custom: Spring-like bounce */
transition-timing-function: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

**When to Use**:
- **Ease-out**: Elements entering (modals, dropdowns, tooltips)
- **Ease-in**: Elements exiting (closing modals, collapsing sections)
- **Ease-in-out**: Moving within viewport (sliding carousels)

```tsx
// Modal entrance: ease-out (fast start, gentle landing)
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
>
  <Modal />
</motion.div>

// Modal exit: ease-in (gentle start, fast end)
<motion.div
  exit={{ opacity: 0, scale: 0.9 }}
  transition={{ duration: 0.2, ease: [0.4, 0.0, 1, 1] }}
>
  <Modal />
</motion.div>
```

#### 3. Staging

**Principle**: Direct attention to what's important

**Staggered Animations**:
```tsx
// Animate list items in sequence
const List = ({ items }) => {
  return (
    <ul>
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.3,
            delay: i * 0.05, // Stagger by 50ms
          }}
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
};
```

**Sequential Reveals**:
```tsx
// Show elements one after another
<motion.div>
  <motion.h1
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0 }}
  >
    Welcome
  </motion.h1>

  <motion.p
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.1 }}
  >
    Get started below
  </motion.p>

  <motion.button
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay: 0.3 }}
  >
    Continue
  </motion.button>
</motion.div>
```

### Performance Considerations

**Performant Properties** (GPU-accelerated):
- `transform` (translate, scale, rotate)
- `opacity`

**Expensive Properties** (avoid animating):
- `width`, `height` (causes layout reflow)
- `top`, `left`, `margin`, `padding` (causes layout reflow)
- `background` (sometimes causes repaint)

```css
/* ❌ Bad: Animates width (layout reflow) */
.expand {
  transition: width 300ms;
  width: 100%;
}

/* ✓ Good: Animates scale (GPU-accelerated) */
.expand {
  transition: transform 300ms;
  transform: scaleX(1);
}

/* ❌ Bad: Animates top/left */
.move {
  transition: top 300ms, left 300ms;
}

/* ✓ Good: Animates transform */
.move {
  transition: transform 300ms;
  transform: translate(100px, 50px);
}
```

### Accessibility: Reduced Motion

**Always respect user preferences**:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// React: Check user preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

<motion.div
  animate={{ opacity: 1, x: 0 }}
  transition={{
    duration: prefersReducedMotion ? 0 : 0.3,
  }}
/>
```

---

## Feedback Patterns

### Visual Feedback

**Hover State**:
```css
.button {
  background: blue;
  transition: all 200ms ease-out;
}

.button:hover {
  background: darkblue;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}
```

**Active/Pressed State**:
```css
.button:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
```

**Focus State** (keyboard users):
```css
.button:focus-visible {
  outline: 2px solid blue;
  outline-offset: 2px;
}
```

### Haptic Feedback (Mobile)

**When to use**:
- Button presses (light impact)
- Toggle switches (medium impact)
- Destructive actions (heavy impact)
- Success/error notifications (notification feedback)

```typescript
// React Native
import { Haptics } from 'react-native-haptics';

const handlePress = () => {
  Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
  // Perform action
};

// Web (limited support)
if ('vibrate' in navigator) {
  navigator.vibrate(10); // 10ms vibration
}
```

### Audio Feedback

**Use sparingly**:
- Success sounds (payment processed, file uploaded)
- Error sounds (invalid action)
- Notification sounds (new message)

**Always**:
- Provide visual alternative
- Allow user to disable
- Keep volume reasonable

---

## Loading States

### Skeleton Screens

**Principle**: Show content structure while loading

```tsx
const SkeletonCard = () => {
  return (
    <div className="p-4 border rounded">
      {/* Avatar skeleton */}
      <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />

      {/* Text skeletons */}
      <div className="mt-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>

      {/* Button skeleton */}
      <div className="mt-4 h-10 bg-gray-200 rounded animate-pulse" />
    </div>
  );
};

// CSS pulse animation
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### Spinners

**When to use**: Unknown duration, simple loading

```tsx
const Spinner = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        border-gray-200 border-t-blue-600
        rounded-full animate-spin
      `}
    />
  );
};

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

### Progress Bars

**When to use**: Known duration, file uploads, multi-step processes

```tsx
const ProgressBar = ({ value, max = 100 }) => {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className="bg-blue-600 h-full transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};
```

### Loading Messages

**Progressive disclosure of delay**:

```tsx
const LoadingMessage = () => {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setMessage('Still loading...');
    }, 3000);

    const timer2 = setTimeout(() => {
      setMessage('This is taking longer than expected...');
    }, 8000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return <p className="text-gray-600">{message}</p>;
};
```

---

## Interface States

Every interactive element should have clear states:

### Button States

```tsx
type ButtonState = 'default' | 'hover' | 'active' | 'focus' | 'disabled' | 'loading';

const Button = ({ state, children, ...props }) => {
  const stateStyles = {
    default: 'bg-blue-600 text-white',
    hover: 'bg-blue-700 shadow-md',
    active: 'bg-blue-800 shadow-sm',
    focus: 'ring-2 ring-blue-500 ring-offset-2',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
    loading: 'bg-blue-600 text-white cursor-wait',
  };

  return (
    <button
      className={`px-4 py-2 rounded transition-all ${stateStyles[state]}`}
      disabled={state === 'disabled' || state === 'loading'}
      {...props}
    >
      {state === 'loading' ? (
        <>
          <Spinner size="sm" />
          <span className="ml-2">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
```

### Form Field States

```tsx
type FieldState = 'default' | 'focus' | 'error' | 'success' | 'disabled';

const FormField = ({ state, error, success, ...props }) => {
  const borderColors = {
    default: 'border-gray-300',
    focus: 'border-blue-500 ring-2 ring-blue-100',
    error: 'border-red-500 ring-2 ring-red-100',
    success: 'border-green-500 ring-2 ring-green-100',
    disabled: 'border-gray-200 bg-gray-50',
  };

  return (
    <div>
      <input
        className={`
          w-full px-4 py-2 rounded border-2 transition-all
          ${borderColors[state]}
          focus:outline-none
        `}
        disabled={state === 'disabled'}
        {...props}
      />

      {state === 'error' && error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <ErrorIcon className="w-4 h-4" />
          {error}
        </p>
      )}

      {state === 'success' && success && (
        <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
          <CheckIcon className="w-4 h-4" />
          {success}
        </p>
      )}
    </div>
  );
};
```

### Empty States

```tsx
const EmptyState = ({ title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-24 h-24 mb-6 bg-gray-100 rounded-full flex items-center justify-center">
        <EmptyIcon className="w-12 h-12 text-gray-400" />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      <p className="text-gray-600 mb-6 max-w-md">
        {description}
      </p>

      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

// Usage
<EmptyState
  title="No projects yet"
  description="Get started by creating your first project"
  action={{
    label: "Create Project",
    onClick: handleCreate,
  }}
/>
```

---

## Gestures & Touch Interactions

### Common Mobile Gestures

**Tap**: Primary action (like click)
**Long Press**: Context menu or additional options
**Swipe**: Navigate, delete, or reveal actions
**Pinch**: Zoom in/out
**Pull to Refresh**: Reload content

### Swipe to Delete

```tsx
const SwipeableListItem = ({ children, onDelete }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;

    // Only allow left swipe
    if (diff < 0) {
      setOffset(Math.max(diff, -100));
    }
  };

  const handleTouchEnd = () => {
    if (offset < -50) {
      // Swipe threshold reached, delete
      onDelete();
    } else {
      // Snap back
      setOffset(0);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete button revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-red-500 flex items-center justify-center">
        <TrashIcon className="text-white" />
      </div>

      {/* Content */}
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
```

### Pull to Refresh

```tsx
const PullToRefresh = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (window.scrollY === 0 && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        setPullDistance(Math.min(diff, 100));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex justify-center transition-all"
        style={{ height: pullDistance }}
      >
        {isRefreshing ? (
          <Spinner />
        ) : (
          pullDistance > 60 && <RefreshIcon />
        )}
      </div>

      {children}
    </div>
  );
};
```

---

## Transitions & Page Changes

### Page Transitions

**Slide Transition**:
```tsx
// Using Framer Motion
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    <Page />
  </motion.div>
</AnimatePresence>
```

**Fade Transition**:
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    <Page />
  </motion.div>
</AnimatePresence>
```

### Modal Transitions

```tsx
const Modal = ({ isOpen, onClose, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.0, 0.0, 0.2, 1] }}
            className="fixed inset-0 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
```

---

## Interaction Design Checklist

- [ ] All interactive elements have hover states
- [ ] All interactive elements have focus states (keyboard)
- [ ] All interactive elements have active/pressed states
- [ ] Touch targets are ≥ 44px on mobile
- [ ] Animations respect prefers-reduced-motion
- [ ] Loading states shown for operations > 1 second
- [ ] Error states provide clear feedback
- [ ] Success states provide confirmation
- [ ] Gestures work on mobile (swipe, pull-to-refresh)
- [ ] Transitions are smooth and < 600ms
- [ ] Micro-interactions provide satisfying feedback

---

**Sources**:
- Dan Saffer: "Microinteractions"
- Interaction Design Foundation: Animation Principles
- Material Design: Motion Guidelines
- iOS Human Interface Guidelines: Gestures
- Nielsen Norman Group: Animation in UX
