# Design Patterns - Comprehensive Guide

This file covers atomic design methodology, common UI patterns, information architecture, and navigation systems.

## Table of Contents

1. [Atomic Design](#atomic-design)
2. [Common UI Patterns](#common-ui-patterns)
3. [Navigation Patterns](#navigation-patterns)
4. [Information Architecture](#information-architecture)
5. [Mobile-Specific Patterns](#mobile-specific-patterns)
6. [Data Display Patterns](#data-display-patterns)

---

## Atomic Design

**Definition**: Atomic Design is a methodology for creating design systems with five distinct levels of complexity.

### The Five Levels

```
Atoms → Molecules → Organisms → Templates → Pages
```

#### 1. Atoms (Basic Building Blocks)

**Definition**: The smallest functional units (buttons, inputs, labels, icons).

**Examples**:
```tsx
// Button (atom)
export const Button = ({ children, variant = 'primary', ...props }) => (
  <button
    className={`px-4 py-2 rounded ${variants[variant]}`}
    {...props}
  >
    {children}
  </button>
);

// Input (atom)
export const Input = ({ type = 'text', ...props }) => (
  <input
    type={type}
    className="px-4 py-2 border rounded"
    {...props}
  />
);

// Label (atom)
export const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium">
    {children}
  </label>
);

// Icon (atom)
export const Icon = ({ name, size = 24 }) => (
  <svg width={size} height={size}>
    {/* Icon path */}
  </svg>
);
```

#### 2. Molecules (Simple Combinations)

**Definition**: Groups of atoms functioning together as a unit.

**Examples**:
```tsx
// FormField (molecule): Label + Input + Error
export const FormField = ({ label, error, ...inputProps }) => (
  <div className="space-y-1">
    <Label htmlFor={inputProps.id}>{label}</Label>
    <Input {...inputProps} />
    {error && <ErrorText>{error}</ErrorText>}
  </div>
);

// SearchBox (molecule): Input + Icon
export const SearchBox = ({ onSearch }) => (
  <div className="relative">
    <Input
      type="search"
      placeholder="Search..."
      onChange={(e) => onSearch(e.target.value)}
    />
    <Icon name="search" className="absolute right-3 top-1/2 -translate-y-1/2" />
  </div>
);

// CardHeader (molecule): Avatar + Title + Subtitle
export const CardHeader = ({ avatar, title, subtitle }) => (
  <div className="flex items-center gap-3">
    <Avatar src={avatar} />
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </div>
  </div>
);
```

#### 3. Organisms (Complex Components)

**Definition**: Groups of molecules and/or atoms forming distinct interface sections.

**Examples**:
```tsx
// Navigation (organism)
export const Navigation = ({ items, user }) => (
  <nav className="flex items-center justify-between p-4 border-b">
    <Logo />
    <ul className="flex gap-4">
      {items.map(item => (
        <NavItem key={item.id} href={item.href}>
          {item.label}
        </NavItem>
      ))}
    </ul>
    <UserMenu user={user} />
  </nav>
);

// ProductCard (organism)
export const ProductCard = ({ product }) => (
  <div className="border rounded-lg overflow-hidden">
    <img src={product.image} alt={product.name} />
    <div className="p-4">
      <CardHeader
        title={product.name}
        subtitle={product.category}
      />
      <p className="mt-2 text-gray-600">{product.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <Price amount={product.price} />
        <Button onClick={() => addToCart(product)}>
          Add to Cart
        </Button>
      </div>
    </div>
  </div>
);

// LoginForm (organism)
export const LoginForm = ({ onSubmit }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <FormField
      label="Email"
      type="email"
      id="email"
      required
    />
    <FormField
      label="Password"
      type="password"
      id="password"
      required
    />
    <div className="flex items-center justify-between">
      <Checkbox label="Remember me" />
      <Link href="/forgot-password">Forgot password?</Link>
    </div>
    <Button type="submit" fullWidth>
      Log In
    </Button>
  </form>
);
```

#### 4. Templates (Page Layouts)

**Definition**: Page-level components that define content structure (no real data).

**Examples**:
```tsx
// DashboardTemplate (template)
export const DashboardTemplate = ({
  header,
  sidebar,
  mainContent,
  widgets,
}) => (
  <div className="min-h-screen">
    <header className="sticky top-0 z-50">
      {header}
    </header>
    <div className="flex">
      <aside className="w-64 border-r">
        {sidebar}
      </aside>
      <main className="flex-1 p-6">
        {mainContent}
        <div className="grid grid-cols-3 gap-6 mt-6">
          {widgets}
        </div>
      </main>
    </div>
  </div>
);

// ArticleTemplate (template)
export const ArticleTemplate = ({
  breadcrumbs,
  title,
  metadata,
  content,
  sidebar,
}) => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    {breadcrumbs}
    <div className="grid grid-cols-3 gap-8 mt-8">
      <article className="col-span-2">
        <h1 className="text-4xl font-bold">{title}</h1>
        {metadata}
        <div className="prose mt-8">{content}</div>
      </article>
      <aside>{sidebar}</aside>
    </div>
  </div>
);
```

#### 5. Pages (Specific Instances)

**Definition**: Templates populated with real data.

**Examples**:
```tsx
// HomePage (page)
export const HomePage = () => {
  const user = useUser();
  const stats = useStats();

  return (
    <DashboardTemplate
      header={<Navigation user={user} />}
      sidebar={<Sidebar items={navItems} />}
      mainContent={<WelcomeMessage user={user} />}
      widgets={stats.map(stat => <StatWidget key={stat.id} {...stat} />)}
    />
  );
};

// BlogPostPage (page)
export const BlogPostPage = ({ postId }) => {
  const post = usePost(postId);

  return (
    <ArticleTemplate
      breadcrumbs={<Breadcrumbs path={['Blog', post.category, post.title]} />}
      title={post.title}
      metadata={<ArticleMeta author={post.author} date={post.date} />}
      content={<MDXContent source={post.content} />}
      sidebar={<RelatedPosts category={post.category} />}
    />
  );
};
```

---

## Common UI Patterns

### Cards

**Use cases**: Display content in contained, scannable format

```tsx
// Basic card
export const Card = ({ children, ...props }) => (
  <div className="bg-white rounded-lg border shadow-sm p-6" {...props}>
    {children}
  </div>
);

// Card with sections
export const Card = ({ header, children, footer }) => (
  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
    {header && (
      <div className="px-6 py-4 border-b bg-gray-50">
        {header}
      </div>
    )}
    <div className="px-6 py-4">
      {children}
    </div>
    {footer && (
      <div className="px-6 py-4 border-t bg-gray-50">
        {footer}
      </div>
    )}
  </div>
);

// Clickable card
export const ClickableCard = ({ href, children }) => (
  <Link
    href={href}
    className="block bg-white rounded-lg border shadow-sm p-6 transition-all hover:shadow-md hover:-translate-y-1"
  >
    {children}
  </Link>
);
```

### Modals/Dialogs

**Use cases**: Focused tasks, confirmations, forms

```tsx
// Modal component
export const Modal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <XIcon />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Usage: Confirmation dialog
<Modal
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  title="Confirm Delete"
  footer={
    <>
      <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </>
  }
>
  <p>Are you sure you want to delete this item? This action cannot be undone.</p>
</Modal>
```

### Tabs

**Use cases**: Organize related content into separate views

```tsx
export const Tabs = ({ tabs, defaultTab }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div>
      {/* Tab list */}
      <div
        role="tablist"
        className="flex border-b"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="py-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};
```

### Accordion

**Use cases**: Progressive disclosure, FAQ, collapsible sections

```tsx
export const Accordion = ({ items, allowMultiple = false }) => {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggle = (id: string) => {
    if (allowMultiple) {
      setOpenItems(prev =>
        prev.includes(id)
          ? prev.filter(item => item !== id)
          : [...prev, id]
      );
    } else {
      setOpenItems(prev => prev.includes(id) ? [] : [id]);
    }
  };

  return (
    <div className="space-y-2">
      {items.map(item => {
        const isOpen = openItems.includes(item.id);

        return (
          <div key={item.id} className="border rounded">
            <button
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="w-full px-4 py-3 flex items-center justify-between text-left font-medium hover:bg-gray-50"
            >
              {item.title}
              <ChevronDownIcon
                className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div className="px-4 py-3 border-t">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

### Dropdown Menu

**Use cases**: Action menus, context menus, select alternatives

```tsx
export const DropdownMenu = ({ trigger, items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg py-1 z-50">
          {items.map(item => (
            item.separator ? (
              <div key={item.id} className="my-1 border-t" />
            ) : (
              <button
                key={item.id}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`
                  w-full px-4 py-2 text-left flex items-center gap-2
                  hover:bg-gray-100 transition-colors
                  ${item.destructive ? 'text-red-600' : ''}
                `}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
};

// Usage
<DropdownMenu
  trigger={<Button>Actions</Button>}
  items={[
    { id: '1', label: 'Edit', icon: EditIcon, onClick: handleEdit },
    { id: '2', label: 'Duplicate', icon: CopyIcon, onClick: handleDuplicate },
    { id: '3', separator: true },
    { id: '4', label: 'Delete', icon: TrashIcon, onClick: handleDelete, destructive: true },
  ]}
/>
```

### Toast/Snackbar

**Use cases**: Brief notifications, success/error feedback

```tsx
export const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    info: 'bg-blue-50 text-blue-900 border-blue-200',
    success: 'bg-green-50 text-green-900 border-green-200',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
    error: 'bg-red-50 text-red-900 border-red-200',
  };

  const icons = {
    info: InfoIcon,
    success: CheckCircleIcon,
    warning: AlertTriangleIcon,
    error: XCircleIcon,
  };

  const Icon = icons[type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed bottom-4 right-4 max-w-md
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        ${styles[type]}
        animate-slide-in
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-current opacity-70 hover:opacity-100"
        aria-label="Close"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast manager
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    toasts,
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    info: (message: string) => addToast(message, 'info'),
    warning: (message: string) => addToast(message, 'warning'),
  };
};
```

---

## Navigation Patterns

### Types of Navigation

**1. Global Navigation**: Present on every page (header/top nav)
**2. Local Navigation**: Context-specific (sidebar, tabs)
**3. Utility Navigation**: Secondary actions (user menu, settings)
**4. Contextual Navigation**: Breadcrumbs, related links

### Horizontal Navigation (Desktop)

```tsx
export const HorizontalNav = ({ items, user }) => (
  <nav className="bg-white border-b">
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-bold text-xl">Brand</span>
        </Link>

        {/* Primary nav */}
        <ul className="flex gap-6">
          {items.map(item => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Utility nav */}
        <div className="flex items-center gap-4">
          <SearchBox />
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  </nav>
);
```

### Sidebar Navigation (Desktop)

```tsx
export const SidebarNav = ({ items, activeItem }) => (
  <aside className="w-64 h-screen bg-gray-50 border-r p-4">
    <nav>
      <ul className="space-y-1">
        {items.map(item => {
          const isActive = activeItem === item.id;

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  </aside>
);
```

### Bottom Navigation (Mobile)

```tsx
export const BottomNav = ({ items, activeItem }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
    <ul className="flex justify-around">
      {items.map(item => {
        const isActive = activeItem === item.id;

        return (
          <li key={item.id} className="flex-1">
            <Link
              href={item.href}
              className={`
                flex flex-col items-center gap-1 py-2
                ${isActive ? 'text-blue-600' : 'text-gray-600'}
              `}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);
```

### Breadcrumbs

```tsx
export const Breadcrumbs = ({ items }) => (
  <nav aria-label="Breadcrumb">
    <ol className="flex items-center gap-2 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <li key={item.id} className="flex items-center gap-2">
            {!isLast ? (
              <>
                <Link
                  href={item.href}
                  className="text-gray-600 hover:text-gray-900"
                >
                  {item.label}
                </Link>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </>
            ) : (
              <span className="text-gray-900 font-medium">
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
```

---

## Information Architecture

### Principles

**1. Organization**: Group related content
**2. Labeling**: Clear, descriptive names
**3. Navigation**: Easy to find content
**4. Search**: Findability through search

### Content Organization Schemes

**Alphabetical**: A-Z (glossaries, indexes)
**Chronological**: Time-based (news, events)
**Categorical**: By category (products, topics)
**Task-Based**: By user goal (checkout, profile setup)
**Audience-Based**: By user type (students, teachers, parents)

### Card Sorting

**Open Card Sort**: Users create their own categories
**Closed Card Sort**: Users assign items to predefined categories

**Use for**:
- Menu structure
- Navigation design
- Content categorization

### Site Maps

```
Homepage
├── Products
│   ├── Category 1
│   │   ├── Product A
│   │   └── Product B
│   └── Category 2
│       ├── Product C
│       └── Product D
├── About
│   ├── Team
│   ├── History
│   └── Careers
├── Support
│   ├── FAQ
│   ├── Contact
│   └── Documentation
└── Account
    ├── Profile
    ├── Settings
    └── Billing
```

### User Flows

```
Login Flow:
1. Land on login page
2. Enter credentials
   ├─ Valid → Dashboard
   └─ Invalid → Error message → Back to step 2
3. Optional: Forgot password
   ├─ Enter email
   ├─ Receive reset link
   └─ Set new password → Dashboard

Checkout Flow:
1. Cart review
2. Shipping information
3. Payment method
4. Order review
5. Confirmation
```

---

## Mobile-Specific Patterns

### Pull to Refresh

```tsx
// Shown in interaction-design.md
// Swipe down from top to refresh content
```

### Swipe Actions

```tsx
// Shown in interaction-design.md
// Swipe left/right to reveal actions (delete, archive)
```

### Bottom Sheet

```tsx
export const BottomSheet = ({ isOpen, onClose, children }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30 }}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6"
        >
          {/* Handle */}
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
```

### Floating Action Button (FAB)

```tsx
export const FAB = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="
      fixed bottom-20 right-4
      w-14 h-14 bg-blue-600 text-white rounded-full
      shadow-lg hover:shadow-xl
      flex items-center justify-center
      transition-all hover:scale-110
    "
  >
    <Icon className="w-6 h-6" />
  </button>
);
```

---

## Data Display Patterns

### Tables

```tsx
export const DataTable = ({ columns, data }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b bg-gray-50">
          {columns.map(col => (
            <th
              key={col.id}
              className="px-4 py-3 text-left text-sm font-medium text-gray-700"
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b hover:bg-gray-50">
            {columns.map(col => (
              <td key={col.id} className="px-4 py-3 text-sm">
                {col.render ? col.render(row) : row[col.id]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Responsive table (cards on mobile)
export const ResponsiveTable = ({ columns, data }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((row, i) => (
          <Card key={i}>
            {columns.map(col => (
              <div key={col.id} className="flex justify-between py-2">
                <span className="font-medium">{col.label}:</span>
                <span>{col.render ? col.render(row) : row[col.id]}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    );
  }

  return <DataTable columns={columns} data={data} />;
};
```

### Lists

```tsx
// Simple list
export const List = ({ items, renderItem }) => (
  <ul className="divide-y">
    {items.map(item => (
      <li key={item.id} className="py-4">
        {renderItem(item)}
      </li>
    ))}
  </ul>
);

// Avatar list (users, contacts)
export const AvatarList = ({ users }) => (
  <ul className="space-y-3">
    {users.map(user => (
      <li key={user.id} className="flex items-center gap-3">
        <Avatar src={user.avatar} alt={user.name} />
        <div className="flex-1">
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
      </li>
    ))}
  </ul>
);
```

### Pagination

```tsx
export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </Button>

      {pages.map(page => (
        <Button
          key={page}
          variant={page === currentPage ? 'primary' : 'ghost'}
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}

      <Button
        variant="ghost"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </Button>
    </nav>
  );
};
```

---

## Design Patterns Checklist

- [ ] Using atomic design hierarchy (atoms → organisms)
- [ ] Components are reusable and composable
- [ ] Consistent patterns across the application
- [ ] Mobile patterns for mobile views (bottom nav, bottom sheet)
- [ ] Clear information architecture (categorization, labeling)
- [ ] Navigation is intuitive and consistent
- [ ] Data tables are responsive (cards on mobile)
- [ ] Common patterns (modals, dropdowns, tabs) follow conventions

---

**Sources**:
- Brad Frost: "Atomic Design"
- Nielsen Norman Group: "Information Architecture" and "Navigation Design"
- Material Design: Component patterns
- iOS Human Interface Guidelines: UI patterns
- Refactoring UI: Component design patterns
