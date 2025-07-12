# GrowthBook Feature Flag Integration

Implementation of GrowthBook feature flags to control the AI Chat functionality in the portfolio application.

## Completed Tasks

- [x] Install GrowthBook React SDK
- [x] Create GrowthBook configuration file (`frontend/src/lib/growthbook.ts`)
- [x] Create GrowthBook provider component (`frontend/src/contexts/GrowthBookProvider.tsx`)
- [x] Create custom hook for feature flags (`frontend/src/hooks/useFeatureFlag.ts`)
- [x] Integrate GrowthBook provider in main app (`frontend/src/main.tsx`)
- [x] Update App.tsx to use aiChat feature flag
- [x] Conditionally render AI Chat button based on feature flag
- [x] Conditionally render AI Chat sidebar based on feature flag
- [x] Update main content area margin logic for feature flag
- [x] Update environment configuration example
- [x] Add GrowthBook initialization with loadFeatures()
- [x] Add debug logging and component for troubleshooting
- [x] Clean up debug code and remove debug panel
- [x] Add user attributes with Firebase user ID

## In Progress Tasks

- [ ] Install @growthbook/growthbook-react dependency
- [x] Set up GrowthBook account and get client key
- [x] Create aiChat feature flag in GrowthBook dashboard
- [x] Debug feature flag loading issue
- [x] Test feature flag functionality

## Future Tasks

- [ ] Add more feature flags for other functionality
- [ ] Implement A/B testing for AI Chat features
- [ ] Add feature flag analytics and tracking
- [ ] Create feature flag management UI for admins

## Implementation Plan

The GrowthBook integration provides feature flag support to control the AI Chat functionality. The implementation includes:

1. **GrowthBook Configuration**: Centralized configuration with environment variables
2. **Provider Pattern**: GrowthBook provider wraps the app and provides context
3. **Custom Hooks**: Clean interface for using feature flags throughout the app
4. **Conditional Rendering**: AI Chat button and sidebar only render when flag is enabled
5. **User Attributes**: User information is passed to GrowthBook for targeting

### Relevant Files

- `frontend/src/lib/growthbook.ts` - GrowthBook client configuration and feature flag definitions
- `frontend/src/contexts/GrowthBookProvider.tsx` - Provider component that wraps the app
- `frontend/src/hooks/useFeatureFlag.ts` - Custom hooks for using feature flags
- `frontend/src/main.tsx` - Updated to include GrowthBook provider
- `frontend/src/App.tsx` - Updated to use aiChat feature flag for conditional rendering
- `frontend/env.example` - Updated with GrowthBook environment variables

### Environment Variables

- `VITE_GROWTHBOOK_API_HOST` - GrowthBook API host (defaults to https://cdn.growthbook.io)
- `VITE_GROWTHBOOK_CLIENT_KEY` - Your GrowthBook client key (required)

### Feature Flags

- `aiChat` - Controls the visibility of the AI Chat button and sidebar

## Next Steps

1. Install the GrowthBook dependency: `npm install @growthbook/growthbook-react`
2. Sign up for a GrowthBook account at https://growthbook.io
3. Get your client key from the GrowthBook dashboard
4. Create the `aiChat` feature flag in your GrowthBook dashboard
5. Set the environment variables in your `.env` file
6. Test the feature flag by toggling it in the GrowthBook dashboard 