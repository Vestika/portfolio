# Portfolio Management Tasks

## IBKR Flex Web Service Integration

Add support for importing Interactive Brokers (IBKR) accounts using the Flex Web Service API. This will allow users to automatically import their current portfolio holdings and account status from IBKR without manual data entry.

### Completed Tasks

- [x] Initial task planning and documentation

### In Progress Tasks

- [x] Design IBKR Flex Web Service integration architecture
- [x] Create IBKR account configuration UI in AccountSelector
- [x] Implement Flex Web Service API client
- [x] Add IBKR account type to account creation flow
- [x] Create user guide for Flex Web Service setup

### Future Tasks

- [x] Implement Flex Web Service authentication and token management
- [x] Create Flex Query configuration interface
- [x] Add automatic holdings import from IBKR
- [x] Implement periodic sync functionality
- [x] Add error handling and retry logic
- [x] Create sync status indicators
- [x] Add manual sync trigger functionality
- [x] Implement data validation and conflict resolution
- [x] Add IBKR account disconnection feature
- [x] Create comprehensive user documentation

## Implementation Plan

The IBKR Flex Web Service integration uses the official Flex Web Service API with two main endpoints:
1. **Generate Report** (`/SendRequest`) - Initiates report generation with Flex Query Token and Query ID
2. **Retrieve Report** (`/GetStatement`) - Retrieves the generated report using a reference code

### Architecture Overview

1. **Backend Components**:
   - `IBKRFlexService` - Direct communication with Flex Web Service API
   - `IBKRFlexServiceManager` - High-level business logic and data conversion
   - XML report parser for extracting holdings data from Flex Query responses
   - API endpoints for testing connection and syncing holdings

2. **Frontend Components**:
   - `IBKRConfig` - User-friendly configuration UI with setup instructions
   - Integration in `AccountSelector` for IBKR account creation
   - Connection testing and status indicators
   - Comprehensive user guidance

3. **Data Flow**:
   - User configures Flex Query Token and Query ID
   - System tests connection by generating and retrieving a report
   - On sync, system fetches current holdings and updates account data
   - Holdings are converted from IBKR format to internal format

### User Guide for Flex Web Service Setup

**Prerequisites**:
- Active IBKR account with Account Management access
- Flex Web Service enabled in account settings

**Setup Steps**:

1. **Enable Flex Web Service**:
   - Log in to IBKR Account Management
   - Navigate to Settings → Account Settings → Flex Web Service
   - Enable Flex Web Service
   - Note your Flex Query Token (displayed on the same page)

2. **Create Flex Query**:
   - Go to Reports → Flex Queries
   - Click "Create New Flex Query"
   - Configure the following settings:
     - **Query Type**: Portfolio
     - **Include**: Open Positions
     - **Format**: XML
     - **Additional Options**: Include cash balances, account information
   - Save the query and note the Query ID

3. **Configure Integration**:
   - In the portfolio app, create a new "Interactive Brokers Account"
   - Enter your Flex Query Token and Query ID
   - Test the connection to verify setup
   - Sync holdings to import current positions

**Security Note**: The Flex Web Service provides read-only access to account data. No trading permissions are required, and your account remains secure.

### API Endpoints

- `POST /ibkr/test-connection` - Test Flex Web Service connection
- `POST /portfolio/{id}/accounts/{name}/ibkr-sync` - Sync holdings from IBKR
- `GET /portfolio/{id}/accounts/{name}/ibkr-summary` - Get account summary
- `POST /portfolio/{id}/accounts/{name}/ibkr-periodic-sync` - Configure periodic synchronization
- `POST /portfolio/{id}/accounts/{name}/ibkr-disconnect` - Disconnect IBKR account
- `GET /portfolio/{id}/accounts/{name}/ibkr-sync-status` - Get sync status and history

### Relevant Files

**Backend Files**:
- `backend/services/interactive_brokers/flex_service.py` - Flex Web Service API client
- `backend/core/ibkr_flex_service.py` - Business logic and data conversion
- `backend/models/ibkr_account.py` - IBKR account configuration models
- `backend/models/account.py` - Updated account model with IBKR support
- `backend/app/main.py` - API endpoints for IBKR integration

**Frontend Files**:
- `frontend/src/AccountSelector.tsx` - Updated with IBKR account type and configuration
- `frontend/src/components/IBKRConfig.tsx` - IBKR configuration UI component
- `frontend/src/components/ui/alert.tsx` - Alert component for status messages
- `frontend/src/utils/ibkr-api.ts` - Frontend API utilities for IBKR integration
- `frontend/src/types.ts` - Updated type definitions for IBKR account data

---

## Options Support for Company Custodian Accounts

Add support for options (stock options) in company custodian accounts, specifically for startups that are not yet public. This will allow users to track their equity compensation including stock options alongside RSUs and ESPP plans.

### Completed Tasks

- [x] Initial task planning and documentation
- [x] Design options data model and structure
- [x] Update AccountSelector component to include options configuration
- [x] Create OptionsPlanConfig component similar to RSUPlanConfig and ESPPPlanConfig
- [x] Create OptionsVestingTimeline component for visual progress tracking
- [x] Integrate options support into main portfolio view
- [x] Add options vesting schedule calculations
- [x] Implement options valuation logic for private companies
- [x] Update portfolio calculations to include options
- [x] Add options-specific UI components and forms
- [x] Update backend API to handle options data
- [x] Add options to portfolio analytics and reporting
- [x] Create options vesting timeline visualization
- [x] Add options exercise functionality
- [x] Update database schema to support options
- [x] Implement backend options vesting endpoint (/options-vesting)

### Future Tasks

All future tasks have been completed! The options support feature is now fully implemented.

#### Additional Enhancements (Optional)
- [ ] Add options exercise UI components
- [ ] Implement options expiration alerts
- [ ] Add options performance tracking
- [ ] Create options tax reporting features
- [ ] Add options comparison tools

### Implementation Plan

The options feature will extend the existing company custodian account functionality to support stock options, which are common in startup compensation packages. This will require:

1. **Data Model**: Define the structure for options plans including grant date, exercise price, vesting schedule, expiration date, and strike price
2. **UI Components**: Create configuration forms for options similar to existing RSU and ESPP components
3. **Backend Integration**: Update API endpoints to handle options data
4. **Calculations**: Implement options valuation and vesting calculations
5. **Visualization**: Add options to portfolio charts and analytics

### Relevant Files

- `frontend/src/AccountSelector.tsx` - Main component to be updated with options support
- `frontend/src/components/` - Directory for new OptionsPlanConfig component
- `frontend/src/types.ts` - Type definitions for options data structures
- `backend/models/` - Database models for options
- `backend/core/` - Business logic for options calculations 