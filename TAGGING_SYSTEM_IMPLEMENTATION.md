# Portfolio Holdings Tagging System

## Overview

This implementation provides a comprehensive tagging system for portfolio holdings that supports structured metadata storage and retrieval. The system enables users to categorize, analyze, and filter their investments using various tag types.

## Features Implemented

### ✅ Tag Types Supported

1. **Enum-Value Tags (Categorical)**
   - Investment intent: ["Growth", "Income", "Speculation", "Safety"]
   - Sector category: ["Tech", "Energy", "Healthcare"]
   - Tax treatment: ["Taxable", "Tax-free", "Deferred"]

2. **Map-Value Tags (Weighted Exposure)**
   - Country/geographic exposure: {"US": 0.6, "EU": 0.3, "Asia": 0.1}
   - Currency exposure
   - ESG factors: {"Environment": 0.6, "Social": 0.3, "Governance": 0.1}

3. **Scalar Value Tags (Single Float/Int/Date)**
   - Estimated annual dividend: 3.5%
   - Years held: 2.5
   - Target sale price: $250
   - Risk score: 1-10
   - Conviction level: 1-5

4. **Hierarchical Tags**
   - Investment goals: "Goals > Retirement > Roth"
   - Classification: "Strategy > Options > Covered Calls"

5. **Boolean Tags**
   - "Is ESG compliant": Yes/No
   - "Use in liquidity buffer": Yes/No
   - "Under legal restriction": Yes/No

6. **Time-based Tags**
   - "Hold until": 2026-01-01
   - "Review frequency": quarterly

7. **Relationship Tags**
   - "Hedged by": [PUT Option X]
   - "Underlying of": [Covered Call Y]
   - "Part of strategy": [Options Wheel]

## Architecture

### Backend Components

#### 1. Data Models (`backend/models/tag_models.py`)
- **TagDefinition**: Defines tag structure and constraints
- **TagValue**: Represents actual tag values for holdings
- **HoldingTags**: Collection of tags for a specific holding
- **TagLibrary**: User's complete tag library with custom and template tags

#### 2. Service Layer (`backend/core/tag_service.py`)
- **TagService**: Handles all CRUD operations and business logic
- Validation of tag values against definitions
- Search and aggregation capabilities
- Template tag adoption

#### 3. API Endpoints (`backend/app/main.py`)
- `/tags/library` - Get user's tag library
- `/tags/definitions` - Create/update tag definitions
- `/holdings/{symbol}/tags` - Manage tags for specific holdings
- `/tags/templates` - Get available template tags
- `/holdings/search` - Search holdings by tag criteria

### Frontend Components

#### 1. Core Components
- **TagEditor**: Comprehensive editor supporting all tag types
- **TagDisplay**: Attractive display of structured tags with color coding
- **HoldingTagManager**: Complete tag management interface for holdings

#### 2. API Integration (`frontend/src/utils/tag-api.ts`)
- **TagAPI**: Handles all API communication
- Type-safe operations for all tag-related endpoints

#### 3. Enhanced HoldingsTable
- Integrated tag display and management
- Clickable tags for editing
- Add tag functionality for untagged holdings

## Usage

### 1. Adding Tags to Holdings

1. Navigate to the Holdings Table
2. Click the tag icon or "Add tags" button next to any holding
3. Select from available tag templates or custom definitions
4. Fill in the tag value using the appropriate editor for the tag type
5. Save the tag

### 2. Managing Tag Definitions

Users can create custom tag definitions or adopt template tags:

```typescript
// Example: Creating a custom enum tag
const tagDefinition: TagDefinition = {
  name: "my_strategy",
  display_name: "Investment Strategy",
  description: "My personal investment strategy classification",
  tag_type: TagType.ENUM,
  enum_values: ["Core", "Satellite", "Speculation", "Cash"],
  user_id: "user_id"
};
```

### 3. Searching Holdings by Tags

```typescript
// Search for high-conviction growth investments
const filters = {
  investment_intent: "Growth",
  conviction_level: { gte: 4 }
};

const results = await TagAPI.searchHoldingsByTags(filters);
```

### 4. Aggregating Tag Data

```typescript
// Get sector distribution across portfolio
const sectorAggregation = await TagAPI.getTagAggregation("sector");
```

## Template Tags Available

The system comes with pre-defined template tags that users can quickly adopt:

- **investment_intent**: Growth, Income, Speculation, Safety, Diversification
- **sector**: Technology, Healthcare, Financial, Energy, etc.
- **tax_treatment**: Taxable, Tax-free, Deferred, IRA, 401k, Roth
- **geographic_exposure**: US, EU, Asia, Emerging, Global (map values)
- **esg_score**: Environment, Social, Governance (map values)
- **annual_dividend_yield**: Percentage value
- **years_held**: Float value
- **target_sale_price**: Currency value
- **risk_score**: 1-10 integer scale
- **conviction_level**: 1-5 integer scale
- **investment_goal**: Hierarchical classification
- **is_esg_compliant**: Boolean flag
- **liquidity_buffer**: Boolean flag
- **hold_until**: Date value
- **review_frequency**: Time-based frequency
- **hedged_by**: Relationship to other symbols

## Database Schema

### Collections

1. **tag_libraries**: User's tag definitions and library
2. **holding_tags**: Tag values assigned to specific holdings

### Data Structure

```javascript
// tag_libraries collection
{
  "_id": ObjectId,
  "user_id": "string",
  "tag_definitions": {
    "tag_name": {
      "name": "string",
      "display_name": "string", 
      "tag_type": "enum|map|scalar|hierarchical|boolean|time_based|relationship",
      // ... type-specific fields
    }
  },
  "template_tags": { /* system templates */ },
  "created_at": Date,
  "updated_at": Date
}

// holding_tags collection
{
  "_id": ObjectId,
  "user_id": "string",
  "symbol": "string",
  "portfolio_id": "string", // optional
  "tags": {
    "tag_name": {
      "tag_name": "string",
      "tag_type": "enum",
      "enum_value": "Growth", // or other value types
      "created_at": Date,
      "updated_at": Date
    }
  },
  "created_at": Date,
  "updated_at": Date
}
```

## API Examples

### Create Custom Tag Definition
```http
POST /tags/definitions
Content-Type: application/json

{
  "name": "exit_strategy",
  "display_name": "Exit Strategy",
  "description": "Planned exit strategy for this investment",
  "tag_type": "enum",
  "enum_values": ["Hold Long Term", "Sell on Target", "Options Strategy", "Rebalance"]
}
```

### Set Tag Value for Holding
```http
PUT /holdings/AAPL/tags/investment_intent
Content-Type: application/json

{
  "tag_name": "investment_intent",
  "tag_type": "enum",
  "enum_value": "Growth"
}
```

### Search Holdings by Tags
```http
GET /holdings/search?tag_filters={"investment_intent":"Growth","risk_score":{"gte":7}}
```

## Future Enhancements

1. **Tag-based Analytics Dashboard**: Charts and visualizations based on tag aggregations
2. **Portfolio Rebalancing**: Suggestions based on tag-defined target allocations
3. **Alert System**: Notifications when tag-based criteria are met
4. **Bulk Tag Operations**: Apply tags to multiple holdings at once
5. **Tag Import/Export**: Share tag definitions between users
6. **Advanced Filtering**: Complex boolean logic for tag searches

## Benefits

1. **Powerful Organization**: Structure holdings by any criteria that matters to you
2. **Advanced Analytics**: Create reports and charts based on tag aggregations
3. **Flexible Filtering**: Find investments matching complex criteria
4. **Investment Strategy Tracking**: Monitor how well your strategy allocations are working
5. **Risk Management**: Track and analyze risk across different dimensions
6. **Tax Optimization**: Better understand tax implications across your portfolio

This tagging system provides a solid foundation for advanced portfolio management and analysis capabilities. 