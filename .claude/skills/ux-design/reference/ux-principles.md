# UX Principles - Comprehensive Guide

This file provides in-depth coverage of core UX principles that form the foundation of all user experience design decisions.

## Table of Contents

1. [Nielsen's 10 Usability Heuristics](#nielsens-10-usability-heuristics)
2. [Cognitive Load Theory](#cognitive-load-theory)
3. [Mental Models](#mental-models)
4. [7 Fundamental UX Principles for 2026](#7-fundamental-ux-principles-for-2026)
5. [User-Centered Design Process](#user-centered-design-process)
6. [UX Laws and Principles](#ux-laws-and-principles)

---

## Nielsen's 10 Usability Heuristics

Jakob Nielsen's usability heuristics (1994) remain the gold standard for interface design evaluation. These are broad rules of thumb, not specific usability guidelines.

### 1. Visibility of System Status

**Core Principle**: The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time.

**Why It Matters**: Users feel in control when they understand the system's state. Uncertainty causes anxiety and mistrust.

**Timing Guidelines**:
- **0.1 seconds**: Perceived as instantaneous (no feedback needed)
- **1.0 second**: User's flow of thought stays uninterrupted (subtle feedback)
- **10 seconds**: Maximum before user loses attention (show progress indicator)

**Implementation Examples**:

**Loading States**:
```typescript
// Bad: No feedback
const handleSubmit = async () => {
  await api.submitForm(data);
};

// Good: Clear loading state
const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await api.submitForm(data);
    setSuccess(true);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};

// In UI:
{isLoading && <Spinner />}
{success && <SuccessMessage />}
{error && <ErrorMessage>{error}</ErrorMessage>}
```

**Progress Indicators**:
- **Determinate**: Show specific progress (e.g., "Uploading: 45%")
- **Indeterminate**: Show activity without specific progress (spinner for unknown duration)
- **Skeleton screens**: Show content structure while loading

**Upload Example**:
```typescript
<ProgressBar
  value={uploadProgress}
  label={`Uploading: ${uploadProgress}%`}
/>
```

**System Status Examples**:
- "Saving..." indicator with auto-save
- "Last saved: 2 minutes ago"
- "Sending..." on message submit
- "3 items in cart"
- "Connected" / "Offline" indicators
- Download progress bars
- Form validation states

**Mobile-Specific Considerations**:
- Pull-to-refresh animation
- Infinite scroll loading indicator
- Network status banner
- Location permission status

### 2. Match Between System and Real World

**Core Principle**: The design should speak the users' language. Use words, phrases, and concepts familiar to the user, rather than internal jargon. Follow real-world conventions.

**Why It Matters**: Users shouldn't have to translate system-oriented terminology. Familiar concepts reduce cognitive load.

**Implementation Guidelines**:

**Language**:
```typescript
// Bad: Technical jargon
"Authenticate credentials"
"Instantiate user session"
"Deallocate resource"

// Good: Plain language
"Log in"
"Start session"
"Delete"
```

**Metaphors**:
- 🗑️ Trash/Bin for delete
- 📁 Folder for organization
- 🔖 Bookmark for saving
- ⭐ Star for favorites
- 📄 Document icons for files

**Date/Time Formatting**:
```typescript
// Bad: System format
"2026-01-27T14:23:45Z"

// Good: Human format
"Today at 2:23 PM"
"January 27, 2026"
"2 hours ago"
```

**Natural Ordering**:
- Chronological: Most recent first (feeds, messages)
- Alphabetical: A-Z for lists, directories
- Magnitude: Small to large (sizes), low to high (prices)
- Geographic: Left-to-right, top-to-bottom in LTR languages

**Cultural Considerations**:
- Date formats (MM/DD vs DD/MM)
- Currency symbols ($, €, £)
- Measurement units (metric vs imperial)
- Reading direction (LTR vs RTL)
- Color meanings (red = danger in West, luck in China)

**Age-Appropriate Language**:
For PikaPlay (parenting app):
- "Activities" not "Interventions"
- "Track growth" not "Monitor metrics"
- "Your baby" not "The subject"

### 3. User Control and Freedom

**Core Principle**: Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave unwanted actions without going through an extended process.

**Why It Matters**: Mistakes are inevitable. Making recovery difficult frustrates users and erodes trust.

**Implementation Patterns**:

**Undo/Redo**:
```typescript
// Implement undo stack
const [history, setHistory] = useState<State[]>([initialState]);
const [currentIndex, setCurrentIndex] = useState(0);

const undo = () => {
  if (currentIndex > 0) {
    setCurrentIndex(currentIndex - 1);
  }
};

const redo = () => {
  if (currentIndex < history.length - 1) {
    setCurrentIndex(currentIndex + 1);
  }
};

// Keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.metaKey && e.key === 'z') {
      e.shiftKey ? redo() : undo();
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

**Cancel Actions**:
```tsx
// Every modal/dialog should have clear cancel option
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogHeader>
    <DialogTitle>Confirm Delete</DialogTitle>
    <DialogClose />  {/* X button */}
  </DialogHeader>
  <DialogContent>
    Are you sure you want to delete this item?
  </DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="destructive" onClick={handleDelete}>
      Delete
    </Button>
  </DialogFooter>
</Dialog>

// Also: ESC key should close modals
```

**Breadcrumbs**:
```tsx
<Breadcrumb>
  <BreadcrumbItem><Link to="/">Home</Link></BreadcrumbItem>
  <BreadcrumbItem><Link to="/products">Products</Link></BreadcrumbItem>
  <BreadcrumbItem>Widget Pro</BreadcrumbItem>
</Breadcrumb>
```

**Back Button Support**:
- Always support browser back button
- Don't break back button with single-page app routing
- Provide in-app back button when browser controls are hidden (mobile apps)

**Draft/Auto-Save**:
```typescript
// Auto-save drafts so users can abandon and return
useEffect(() => {
  const timer = setTimeout(() => {
    if (content !== savedContent) {
      saveDraft(content);
      setSavedContent(content);
    }
  }, 2000); // Debounce 2 seconds

  return () => clearTimeout(timer);
}, [content]);
```

**Confirmations for Destructive Actions**:
```typescript
// Always confirm before permanent deletion
const handleDelete = () => {
  if (confirm('Are you sure? This cannot be undone.')) {
    deleteItem(id);
  }
};

// Better: Use modal dialog instead of browser confirm
```

### 4. Consistency and Standards

**Core Principle**: Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform and industry conventions.

**Why It Matters**: Consistency reduces cognitive load. Users transfer knowledge from one part of your product to another, and from other products to yours.

**Types of Consistency**:

**Visual Consistency**:
- Same colors for same actions (blue for primary, red for destructive)
- Same icons for same functions (trash for delete, pencil for edit)
- Same button styles (primary, secondary, ghost)
- Consistent spacing (8px grid system)

**Functional Consistency**:
- Same actions produce same results
- Same gestures across app (swipe to delete, pull to refresh)
- Same keyboard shortcuts (Cmd+S to save, Cmd+Z to undo)

**External Consistency** (Platform Conventions):
```typescript
// iOS conventions
- Bottom tab bar for primary navigation
- Swipe from left edge to go back
- Pull down from top for refresh

// Android conventions
- Bottom navigation or hamburger menu
- FAB (Floating Action Button) for primary action
- Swipe from left edge for navigation drawer

// Web conventions
- Logo in top-left returns to home
- Shopping cart in top-right
- Links are blue and underlined
- Search in top-right or center
```

**Internal Consistency** (Design System):
```typescript
// Define consistent button hierarchy
<Button variant="primary">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="ghost">Tertiary Action</Button>
<Button variant="destructive">Delete</Button>

// Not: Different styles for same action type
<Button className="bg-blue-500">Save</Button> // In one place
<Button className="bg-green-600">Save</Button> // In another place
```

**Terminology Consistency**:
```typescript
// Bad: Using different words for same thing
"Log in" / "Sign in" / "Authenticate"
"Delete" / "Remove" / "Discard"

// Good: Pick one term and stick with it
"Log in" everywhere
"Delete" everywhere
```

**Layout Consistency**:
- Header always at top
- Navigation always in same place
- Primary action always in same position (bottom-right, top-right)
- Forms always follow same pattern (label above/beside input)

### 5. Error Prevention

**Core Principle**: Good error messages are important, but preventing errors is even better. Eliminate error-prone conditions or check for them and present confirmation options.

**Why It Matters**: Prevention > Recovery. Users should never encounter errors that can be prevented.

**Prevention Strategies**:

**Constrain Inputs**:
```tsx
// Bad: Free text for dates
<input type="text" placeholder="Enter date" />

// Good: Date picker constrains to valid dates
<DatePicker
  minDate={new Date()}
  maxDate={addYears(new Date(), 1)}
  disabledDays={[0, 6]} // Disable weekends
/>

// Bad: Free text for numbers
<input type="text" />

// Good: Number input with constraints
<input
  type="number"
  min="0"
  max="100"
  step="1"
/>
```

**Disable Invalid Options**:
```tsx
// Disable submit button until form is valid
<Button
  disabled={!isValid || isSubmitting}
  onClick={handleSubmit}
>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</Button>

// Disable past dates in booking calendar
<Calendar
  disabledDates={date => date < new Date()}
/>
```

**Provide Defaults**:
```typescript
// Set sensible defaults to reduce user input
const [formData, setFormData] = useState({
  country: userGeoLocation.country, // Detect from IP
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
  dateFormat: getDefaultDateFormat(userLocale),
});
```

**Confirmation for Destructive Actions**:
```tsx
// Always confirm before permanent deletion
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Account</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete your
        account and remove your data from our servers.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>
        Yes, delete my account
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Soft Delete / Trash**:
```typescript
// Instead of immediate permanent deletion, move to trash
const handleDelete = async (id: string) => {
  await api.moveToTrash(id);
  toast({
    title: "Item moved to trash",
    description: "You can restore it within 30 days",
    action: <Button onClick={() => handleRestore(id)}>Undo</Button>
  });
};
```

**Validation Before Submit**:
```typescript
// Validate all fields before allowing submission
const validateForm = () => {
  const errors = {};
  if (!email.includes('@')) errors.email = 'Invalid email';
  if (password.length < 8) errors.password = 'Password too short';
  return errors;
};

const handleSubmit = (e) => {
  e.preventDefault();
  const errors = validateForm();
  if (Object.keys(errors).length > 0) {
    setErrors(errors);
    return; // Prevent submission
  }
  submitForm();
};
```

**Autocomplete & Suggestions**:
```tsx
// Prevent typos with autocomplete
<AutocompleteInput
  suggestions={cities}
  placeholder="Enter city"
  onSelect={handleCitySelect}
/>
```

### 6. Recognition Rather Than Recall

**Core Principle**: Minimize memory load by making elements, actions, and options visible. Users should not have to remember information from one part of the interface to another.

**Why It Matters**: Recognition is easier than recall. Humans are better at recognizing things they've seen before than recalling from memory.

**Implementation Strategies**:

**Show Recent/Frequently Used**:
```tsx
// Show recently used items
<SearchInput>
  <SearchResults>
    {recentSearches.length > 0 && (
      <SearchSection>
        <SearchSectionTitle>Recent Searches</SearchSectionTitle>
        {recentSearches.map(term => (
          <SearchItem key={term} onClick={() => search(term)}>
            {term}
          </SearchItem>
        ))}
      </SearchSection>
    )}
  </SearchResults>
</SearchInput>
```

**Visible Navigation**:
```typescript
// Bad: Mega menu that hides all options until hover
// Good: Visible primary navigation with clear labels

<Navigation>
  <NavItem href="/dashboard">Dashboard</NavItem>
  <NavItem href="/projects">Projects</NavItem>
  <NavItem href="/team">Team</NavItem>
  <NavItem href="/settings">Settings</NavItem>
</Navigation>
```

**Contextual Help**:
```tsx
// Tooltips for icons without labels
<Tooltip content="Add new item">
  <IconButton icon={<PlusIcon />} />
</Tooltip>

// Helper text for complex fields
<FormField>
  <Label>API Key</Label>
  <Input type="text" />
  <HelperText>
    You can find your API key in Settings → Developer → API Keys
  </HelperText>
</FormField>
```

**Visual Cues for State**:
```tsx
// Show current state visually
<Tabs>
  <TabsList>
    <TabsTrigger value="all">All Items</TabsTrigger>
    <TabsTrigger value="active">Active</TabsTrigger>
    <TabsTrigger value="completed">Completed</TabsTrigger>
  </TabsList>
</Tabs>

// Selected tab is visually distinct (underline, background, bold)
```

**Autocomplete for Complex Data**:
```tsx
// Don't make users remember exact syntax
<CommandPalette>
  <CommandInput placeholder="Type a command..." />
  <CommandList>
    <CommandGroup heading="Actions">
      <CommandItem>New Document</CommandItem>
      <CommandItem>Upload File</CommandItem>
      <CommandItem>Share</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandPalette>
```

**Inline Editing**:
```tsx
// Show current value, allow editing in place
<EditableText
  value={title}
  onChange={setTitle}
  placeholder="Enter title"
/>
// vs. requiring navigation to edit page
```

### 7. Flexibility and Efficiency of Use

**Core Principle**: Provide accelerators for expert users while remaining accessible to novices. Allow users to tailor frequent actions.

**Why It Matters**: As users become more experienced, they want faster ways to accomplish tasks.

**Implementation Strategies**:

**Keyboard Shortcuts**:
```typescript
// Provide keyboard shortcuts for power users
const shortcuts = {
  'cmd+k': () => openCommandPalette(),
  'cmd+n': () => createNew(),
  'cmd+s': () => save(),
  'cmd+/': () => toggleHelp(),
  'esc': () => closeModal(),
};

// Display shortcuts in UI
<MenuItem>
  New Document
  <MenuItemShortcut>⌘N</MenuItemShortcut>
</MenuItem>
```

**Bulk Actions**:
```tsx
// Allow selecting multiple items
<DataTable>
  <DataTableHeader>
    <Checkbox
      checked={allSelected}
      onChange={toggleSelectAll}
    />
  </DataTableHeader>
  <DataTableBody>
    {items.map(item => (
      <DataTableRow key={item.id}>
        <Checkbox
          checked={selected.includes(item.id)}
          onChange={() => toggleSelect(item.id)}
        />
        <DataTableCell>{item.name}</DataTableCell>
      </DataTableRow>
    ))}
  </DataTableBody>
</DataTable>

{selected.length > 0 && (
  <BulkActions>
    <Button onClick={bulkDelete}>Delete {selected.length} items</Button>
    <Button onClick={bulkExport}>Export {selected.length} items</Button>
  </BulkActions>
)}
```

**Customization**:
```typescript
// Allow users to customize their workflow
const [preferences, setPreferences] = useState({
  defaultView: 'list', // vs 'grid'
  itemsPerPage: 25,
  sortBy: 'date',
  filters: [],
});

// Save preferences per user
await api.savePreferences(userId, preferences);
```

**Quick Actions**:
```tsx
// Context menus for quick access
<ContextMenu>
  <ContextMenuTrigger>
    <ItemCard />
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={edit}>Edit</ContextMenuItem>
    <ContextMenuItem onClick={duplicate}>Duplicate</ContextMenuItem>
    <ContextMenuItem onClick={share}>Share</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={deleteItem} destructive>
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**Templates & Presets**:
```tsx
// Provide templates for common scenarios
<TemplateSelector>
  <Template name="Blank" />
  <Template name="Marketing Email" />
  <Template name="Newsletter" />
  <Template name="Announcement" />
</TemplateSelector>
```

**Search & Filtering**:
```tsx
// Advanced search for power users
<SearchFilters>
  <SearchInput placeholder="Search..." />
  <FilterGroup>
    <FilterLabel>Status</FilterLabel>
    <FilterOptions>
      <FilterOption>All</FilterOption>
      <FilterOption>Active</FilterOption>
      <FilterOption>Completed</FilterOption>
    </FilterOptions>
  </FilterGroup>
  <FilterGroup>
    <FilterLabel>Date Range</FilterLabel>
    <DateRangePicker />
  </FilterGroup>
</SearchFilters>
```

### 8. Aesthetic and Minimalist Design

**Core Principle**: Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information competes with relevant units and diminishes their visibility.

**Why It Matters**: Visual clutter increases cognitive load. Users scan interfaces for relevant information—irrelevant content makes this harder.

**Implementation Guidelines**:

**Progressive Disclosure**:
```tsx
// Show essentials first, reveal details on demand
<Card>
  <CardHeader>
    <CardTitle>{item.name}</CardTitle>
    <CardDescription>{item.summary}</CardDescription>
  </CardHeader>
  <CardFooter>
    <Button variant="ghost" onClick={toggleExpanded}>
      {expanded ? 'Show Less' : 'Show More'}
    </Button>
  </CardFooter>
  {expanded && (
    <CardContent>
      <DetailedInformation>{item.details}</DetailedInformation>
    </CardContent>
  )}
</Card>
```

**Remove Unnecessary Elements**:
```typescript
// Bad: Too much chrome
<Panel>
  <PanelHeader>
    <Icon /> <Title>Tasks</Title> <Badge>12</Badge> <Icon /> <Icon />
  </PanelHeader>
  <PanelSubheader>
    Manage your tasks | Last updated: Today
  </PanelSubheader>
  <Divider />
  <PanelContent>
    {/* Content */}
  </PanelContent>
  <Divider />
  <PanelFooter>
    Footer text here | Copyright 2026
  </PanelFooter>
</Panel>

// Good: Clean, focused
<Panel>
  <PanelHeader>
    <Title>Tasks</Title>
    <Badge>12</Badge>
  </PanelHeader>
  <PanelContent>
    {/* Content */}
  </PanelContent>
</Panel>
```

**Use Whitespace**:
```css
/* Bad: Cramped */
.card {
  padding: 4px;
  margin: 2px;
}

/* Good: Breathing room */
.card {
  padding: 24px;
  margin: 16px 0;
}
```

**Clear Visual Hierarchy**:
```tsx
// One clear primary action
<DialogFooter>
  <Button variant="outline" onClick={cancel}>
    Cancel
  </Button>
  <Button variant="primary" onClick={confirm}>
    Confirm
  </Button>
</DialogFooter>

// Not: Multiple competing primary actions
<DialogFooter>
  <Button variant="primary">Save</Button>
  <Button variant="primary">Save and Continue</Button>
  <Button variant="primary">Save Draft</Button>
</DialogFooter>
```

**Remove Redundancy**:
```typescript
// Bad: Redundant labeling
<Button>
  <Icon name="delete" />
  Delete Button
</Button>

// Good: Icon or text, not both (unless needed for clarity)
<Button>
  Delete
</Button>
```

### 9. Help Users Recognize, Diagnose, and Recover from Errors

**Core Principle**: Error messages should be expressed in plain language, precisely indicate the problem, and constructively suggest a solution.

**Why It Matters**: Errors cause frustration. Good error messages reduce frustration and help users fix issues quickly.

**Error Message Formula**:
1. **What happened**: Clearly state the error
2. **Why it happened**: Explain the cause (if helpful)
3. **How to fix it**: Provide actionable next steps

**Implementation Examples**:

**Good Error Messages**:
```tsx
// Bad error message
<ErrorMessage>Error 422: Unprocessable Entity</ErrorMessage>

// Good error message
<ErrorMessage>
  <ErrorIcon />
  <ErrorTitle>Email address is required</ErrorTitle>
  <ErrorDescription>
    Please enter your email address to continue.
  </ErrorDescription>
</ErrorMessage>

// Even better: Inline with field
<FormField error={errors.email}>
  <Label>Email</Label>
  <Input type="email" value={email} onChange={setEmail} />
  {errors.email && (
    <ErrorText>
      Please enter a valid email address (e.g., user@example.com)
    </ErrorText>
  )}
</FormField>
```

**Validation Errors**:
```typescript
// Specific, actionable errors
const validatePassword = (password: string) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  return null; // Valid
};
```

**Network Errors**:
```tsx
// Explain network issues clearly
<ErrorState>
  {error.type === 'network' && (
    <>
      <ErrorIcon name="wifi-off" />
      <ErrorTitle>No internet connection</ErrorTitle>
      <ErrorDescription>
        Please check your connection and try again.
      </ErrorDescription>
      <Button onClick={retry}>Retry</Button>
    </>
  )}
  {error.type === 'timeout' && (
    <>
      <ErrorIcon name="clock" />
      <ErrorTitle>Request timed out</ErrorTitle>
      <ErrorDescription>
        The server is taking too long to respond. Please try again.
      </ErrorDescription>
      <Button onClick={retry}>Retry</Button>
    </>
  )}
  {error.type === 'server' && (
    <>
      <ErrorIcon name="alert-circle" />
      <ErrorTitle>Something went wrong</ErrorTitle>
      <ErrorDescription>
        We encountered an error. Please try again or contact support.
      </ErrorDescription>
      <Button onClick={retry}>Retry</Button>
      <Button variant="outline" onClick={contactSupport}>
        Contact Support
      </Button>
    </>
  )}
</ErrorState>
```

### 10. Help and Documentation

**Core Principle**: It's best if the system doesn't need explanation. However, provide help and documentation that's easy to search and focused on user tasks.

**Why It Matters**: While self-explanatory design is ideal, some complexity requires documentation. Make it accessible and useful.

**Implementation Strategies**:

**Contextual Help**:
```tsx
// Inline help where users need it
<FormField>
  <Label>
    API Key
    <Tooltip content="Find your API key in Settings → Developer">
      <HelpIcon />
    </Tooltip>
  </Label>
  <Input type="text" />
</FormField>
```

**Onboarding Tours**:
```tsx
// Guide new users through key features
<Tour
  steps={[
    {
      target: '[data-tour="dashboard"]',
      content: 'This is your dashboard where you can see all your projects.',
    },
    {
      target: '[data-tour="new-project"]',
      content: 'Click here to create a new project.',
    },
  ]}
  isOpen={isFirstVisit}
/>
```

**Empty States**:
```tsx
// Turn empty states into help
<EmptyState>
  <EmptyStateIcon name="folder" />
  <EmptyStateTitle>No projects yet</EmptyStateTitle>
  <EmptyStateDescription>
    Get started by creating your first project
  </EmptyStateDescription>
  <Button onClick={createProject}>
    Create Project
  </Button>
</EmptyState>
```

**Searchable Help Center**:
```tsx
// Make help easily accessible
<HelpButton onClick={openHelp}>
  <HelpIcon />
</HelpButton>

<HelpModal>
  <HelpSearch placeholder="Search for help..." />
  <HelpCategories>
    <HelpCategory>Getting Started</HelpCategory>
    <HelpCategory>Billing</HelpCategory>
    <HelpCategory>Account Settings</HelpCategory>
  </HelpCategories>
</HelpModal>
```

---

## Cognitive Load Theory

**Definition**: Cognitive load refers to the amount of mental effort required to use an interface.

**Three Types of Cognitive Load**:

### 1. Intrinsic Load
The inherent difficulty of the task itself. Cannot be reduced without simplifying the task.

**Example**: Tax filing is inherently complex.

**Design Strategy**: Accept intrinsic complexity, but don't add more.

### 2. Extraneous Load
Mental effort caused by poor design. This SHOULD be minimized.

**Causes**:
- Unclear labels
- Inconsistent patterns
- Hidden navigation
- Unnecessary steps
- Visual clutter
- Poor information architecture

**Example**:
```typescript
// High extraneous load
<Button className="btn-23a">Submit</Button> // Cryptic class
<Button style={{backgroundColor: '#3b82f6'}}>Cancel</Button> // Inline style
<input type="text" /> // No label

// Low extraneous load
<Button variant="primary">Submit</Button>
<Button variant="secondary">Cancel</Button>
<FormField>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</FormField>
```

### 3. Germane Load
Mental effort that helps learning and pattern recognition. This SHOULD be optimized.

**Examples**:
- Consistent design patterns (learn once, apply everywhere)
- Clear visual hierarchy (helps scanning)
- Helpful error messages (teaches correct usage)

### Minimizing Cognitive Load

**Chunking**:
```tsx
// Bad: Wall of information
<Form>
  <Input label="Name" />
  <Input label="Email" />
  <Input label="Phone" />
  <Input label="Address" />
  <Input label="City" />
  <Input label="State" />
  <Input label="ZIP" />
  <Input label="Country" />
</Form>

// Good: Grouped into chunks
<Form>
  <FormSection title="Personal Information">
    <Input label="Name" />
    <Input label="Email" />
    <Input label="Phone" />
  </FormSection>
  <FormSection title="Address">
    <Input label="Street Address" />
    <Input label="City" />
    <Input label="State" />
    <Input label="ZIP Code" />
  </FormSection>
</Form>
```

**Progressive Disclosure**:
Show only what's needed now. Reveal complexity gradually.

```tsx
// Basic form for most users
<Form>
  <Input label="Name" />
  <Input label="Email" />
  <Button>Continue</Button>

  <AdvancedOptionsToggle onClick={toggleAdvanced}>
    Advanced Options
  </AdvancedOptionsToggle>

  {showAdvanced && (
    <AdvancedSection>
      <Input label="Custom Domain" />
      <Input label="Webhook URL" />
      <Input label="API Key" />
    </AdvancedSection>
  )}
</Form>
```

**Defaults**:
Reduce decisions by providing smart defaults.

```typescript
// Reduce cognitive load with defaults
const [settings, setSettings] = useState({
  notifications: true, // Most users want this
  theme: 'system', // Match system preference
  language: navigator.language,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});
```

---

## Mental Models

**Definition**: A mental model is a user's understanding of how something works, based on past experiences and expectations.

**Why It Matters**: When your interface matches users' mental models, it feels intuitive. Mismatches cause confusion.

### Common Mental Models

**File System**:
- Folders contain files
- Files can be moved, copied, deleted
- Trash can be emptied

**Shopping**:
- Add items to cart
- View cart
- Checkout
- Receive confirmation

**Social Media**:
- Follow/unfollow
- Like/unlike
- Comment/reply
- Share/repost

### Matching Mental Models

**Use Familiar Patterns**:
```tsx
// Users expect this pattern for settings
<SettingsPage>
  <Sidebar>
    <SidebarItem>Profile</SidebarItem>
    <SidebarItem>Account</SidebarItem>
    <SidebarItem>Privacy</SidebarItem>
    <SidebarItem>Notifications</SidebarItem>
  </Sidebar>
  <SettingsContent>
    {/* Content based on selected item */}
  </SettingsContent>
</SettingsPage>
```

**Violating Mental Models**:
```typescript
// Bad: Unexpected behavior
<Link onClick={deleteAccount}>View Profile</Link>
// Users expect "View Profile" to be safe, not destructive

// Good: Match expectations
<Link to="/profile">View Profile</Link>
<Button variant="destructive" onClick={confirmDelete}>
  Delete Account
</Button>
```

---

## 7 Fundamental UX Principles for 2026

Updated principles that incorporate modern design considerations:

### 1. User-Centered Design
Design for real user needs, validated through research, not assumptions.

### 2. Accessibility First
WCAG 2.1 Level AA is the baseline. Design for all users from the start.

### 3. Consistency & Standards
Follow platform conventions (iOS, Android, Web) and maintain internal consistency.

### 4. Clarity & Simplicity
One primary action per screen. Minimize cognitive load through clear hierarchy.

### 5. Feedback & Communication
Provide immediate, clear feedback for all user actions within 100ms.

### 6. Error Prevention & Recovery
Prevent errors through constraints. Make recovery easy with undo and clear error messages.

### 7. Mobile-First & Responsive
Design for the smallest screen first, enhance progressively for larger screens.

---

## User-Centered Design Process

### 1. Research
- User interviews
- Surveys
- Analytics review
- Competitive analysis
- Contextual inquiry

### 2. Define
- Personas
- User stories
- Jobs to be done
- Use cases
- Requirements

### 3. Ideate
- Sketching
- Wireframing
- User flows
- Information architecture
- Brainstorming

### 4. Prototype
- Low-fidelity (paper, wireframes)
- Medium-fidelity (clickable prototypes)
- High-fidelity (realistic mockups)

### 5. Test
- Usability testing
- A/B testing
- Accessibility audits
- Performance testing
- User feedback

### 6. Iterate
- Analyze results
- Refine design
- Re-test
- Deploy
- Monitor

---

## UX Laws and Principles

### Fitts's Law
**Principle**: Time to acquire a target is a function of distance and size.

**Application**:
- Make important buttons larger
- Place frequent actions closer to starting point
- Increase touch target size on mobile (44px minimum)

### Hick's Law
**Principle**: Time to make a decision increases with number and complexity of choices.

**Application**:
- Reduce options (3-5 is ideal for primary navigation)
- Use progressive disclosure
- Provide defaults
- Group related options

### Jakob's Law
**Principle**: Users spend most of their time on other sites, so they prefer your site to work the same way.

**Application**:
- Follow design conventions
- Place navigation where users expect it
- Use familiar icons and patterns

### Miller's Law
**Principle**: Average person can keep 7 ± 2 items in working memory.

**Application**:
- Chunk information into groups of 5-9
- Use progressive disclosure
- Break long forms into steps

### Aesthetic-Usability Effect
**Principle**: Users perceive attractive designs as more usable.

**Application**:
- Invest in visual polish
- Use consistent styling
- Apply good typography
- Create visual hierarchy

---

**Sources**:
- Nielsen Norman Group: "10 Usability Heuristics for User Interface Design"
- Don Norman: "The Design of Everyday Things"
- Steve Krug: "Don't Make Me Think"
- UX Design Institute: "7 Fundamental UX Design Principles (2026)"
- Interaction Design Foundation: Cognitive Load Theory, Mental Models
