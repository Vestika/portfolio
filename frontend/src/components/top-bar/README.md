# TopBar Components

This directory contains all components related to the top navigation bar and its associated functionality.

## Components

### Core Navigation

- **TopBar.tsx** - Main navigation bar component
  - Handles navigation between different views (Portfolios, Cash Flow, News, AI Analyst, Tags, Tools)
  - Responsive design with mobile menu
  - Integrates all other topbar components

### Modals & Overlays

- **AboutModal.tsx** - About/info modal
  - Opened by clicking the Vestika logo
  - Shows app information, creators, and credits
  
- **FeedbackModal.tsx** - Feedback submission modal
  - Opened by clicking the "Feedback" button
  - Allows users to submit feedback with NPS score
  
- **FeedbackWidget.tsx** - Alternative floating feedback widget
  - Standalone feedback widget (not currently used in main app)

### User Interface Elements

- **ProfileSidebar.tsx** - User account sidebar
  - Opened by clicking the profile picture
  - User profile settings (display name, timezone)
  - Account preferences (visibility toggles)
  - Sign out functionality

- **NotificationBell.tsx** - Notification center
  - Displays user notifications
  - Unread count badge
  - Mark as read functionality

- **GoogleProfilePicture.tsx** - Profile picture component
  - Displays user's Google profile picture
  - Fallback to default avatar icon
  - Multiple size variants (sm, md, lg, xl)

## Usage

Import components from the index:

```typescript
import { TopBar, ProfileSidebar, NavigationView } from '@/components/top-bar'
```

Or import individual components:

```typescript
import { TopBar } from '@/components/top-bar/TopBar'
import { AboutModal } from '@/components/top-bar/AboutModal'
```

## Dependencies

### Contexts Used
- `UserProfileContext` - User profile data
- `NotificationContext` - Notification management
- `AuthContext` - Authentication state
- `MixpanelContext` - Analytics tracking

### External Libraries
- `lucide-react` - Icons
- `react-router-dom` - Navigation

## Navigation Flow

1. User clicks on navigation item in TopBar
2. TopBar updates URL via react-router
3. URL change triggers view change in App.tsx
4. Active view is derived from URL pathname

## Related Files

- `/frontend/src/App.tsx` - Main app component that uses TopBar
- `/frontend/src/contexts/UserProfileContext.tsx` - User profile management
- `/frontend/src/contexts/NotificationContext.tsx` - Notification management

