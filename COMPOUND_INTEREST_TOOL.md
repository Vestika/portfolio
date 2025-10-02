# Compound Interest Tool Implementation

Tool to project portfolio/account compound growth with monthly deposits and a yearly interest rate, shown as a chart and a yearly table.

## Completed Tasks

- [x] Create React component with inputs and projection logic
- [x] Render Highcharts line chart for yearly totals, contributions, interest
- [x] Summary tiles for final total, contributions, interest
- [x] Year-by-year table with numbers
- [x] Integrate into `frontend/src/components/ToolsView.tsx`

## In Progress Tasks

- [ ] Add documentation and usage notes in the UI

## Future Tasks

- [ ] Add CSV export of yearly data
- [ ] Add ability to vary annual rate by year
- [ ] Add inflation adjustment toggle
- [ ] Persist last-used inputs per user

## Implementation Plan

Inputs: portfolio selection, scope (whole portfolio or selected accounts), years (1–50), monthly deposit, expected yearly interest (%). Compute initial principal from current portfolio holdings using global prices in base currency. Project monthly compounding with monthly contributions; display yearly endpoints for clarity.

### Relevant Files

- frontend/src/components/CompoundInterestTool.tsx - Calculator UI, projection logic, chart, table ✅
- frontend/src/components/ToolsView.tsx - Integrates the tool in the Tools section ✅






