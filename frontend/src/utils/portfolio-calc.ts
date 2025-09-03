import { AccountInfo, ChartBreakdown, ChartDataItem, HoldingsTableData, PortfolioData, SecurityHolding, HistoricalPrice } from '../types';
import { roundTo, safeDivide } from '../lib/utils';

export interface PriceQuote {
  symbol?: string;
  price: number; // in quote currency
  currency: string; // currency of the quote price
}

export interface FxRate {
  pair: string; // e.g., USDILS
  rate: number; // quote: 1 unit of fromCurrency equals rate units of toCurrency
  fromCurrency: string;
  toCurrency: string;
}

export interface PortfolioCalcInputs {
  baseCurrency: string;
  accounts: AccountInfo[];
  // Optional enrichments if available
  quotesBySymbol?: Record<string, { price: number; currency: string }>; // minimal shape required
  fxByPair?: Record<string, FxRate>;
  // Optional historical series (7d) per symbol if available
  historyBySymbol?: Record<string, HistoricalPrice[]>;
}

// Normalize a value from holding currency to baseCurrency using provided FX rates
function convertToBase(value: number, fromCurrency: string, baseCurrency: string, fxByPair?: Record<string, FxRate>): number {
  if (fromCurrency === baseCurrency) return value;
  const pair = `${fromCurrency}${baseCurrency}`;
  const fx = fxByPair?.[pair];
  if (fx && fx.rate > 0) {
    return value * fx.rate;
  }
  // Fallbacks for common pairs to avoid zero totals if FX missing
  const uFrom = (fromCurrency || '').toUpperCase();
  const uBase = (baseCurrency || '').toUpperCase();
  if (uFrom === 'USD' && uBase === 'ILS') {
    const DEFAULT_USD_ILS = 3.4;
    return value * DEFAULT_USD_ILS;
  }
  if (uFrom === 'ILS' && uBase === 'USD') {
    const DEFAULT_ILS_USD = 1 / 3.4;
    return value * DEFAULT_ILS_USD;
  }
  // Final fallback: assume already in base (prevents NaN but may understate value)
  return value;
}

// Build HoldingsTableData from accounts; requires at least unit value estimates per symbol
export function computeHoldingsTable(inputs: PortfolioCalcInputs): HoldingsTableData {
  const { baseCurrency, accounts } = inputs;

  const aggregation: Record<string, SecurityHolding> = {};

  const generateFlatHistory = (price: number): HistoricalPrice[] => {
    const arr: HistoricalPrice[] = [];
    const today = new Date();
    for (let i = 7; i > 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push({ date: d.toISOString().slice(0, 10), price });
    }
    return arr;
  };

  for (const account of accounts) {
    for (const pos of account.holdings || []) {
      const symbol = pos.symbol;
      const existing = aggregation[symbol];

      // We don't have security metadata here; set reasonable defaults the UI expects
      const securityType = 'stock';
      const name = symbol;
      // Defaults; will be overwritten when quotes are present
      let originalCurrency = 'USD';
      let unitOriginalPrice = 0; // unknown unless quotes provided; for cash it's 1

      const isCash = symbol.toUpperCase() === 'USD' || symbol.toUpperCase() === 'ILS';
      if (isCash) {
        originalCurrency = symbol.toUpperCase();
        unitOriginalPrice = 1;
      }

      if (!existing) {
        aggregation[symbol] = {
          symbol,
          security_type: securityType,
          name,
          tags: {},
          total_units: 0,
          original_price: unitOriginalPrice,
          original_currency: originalCurrency,
          value_per_unit: 0,
          total_value: 0,
          currency: baseCurrency,
          historical_prices: inputs.historyBySymbol?.[symbol] || [],
          account_breakdown: [],
        };
      }

      // Estimate value for this account position if we have quotes; else use 0 and let UI still render
      const quote = inputs.quotesBySymbol?.[symbol];
      const quoteCurrency = quote?.currency || originalCurrency;
      const valuePerUnitInQuote = isCash ? 1 : (quote?.price ?? unitOriginalPrice);
      const valuePerUnitInBase = convertToBase(valuePerUnitInQuote, quoteCurrency, baseCurrency, inputs.fxByPair);
      const positionValue = valuePerUnitInBase * pos.units;

      aggregation[symbol].total_units += pos.units;
      aggregation[symbol].value_per_unit = valuePerUnitInBase || aggregation[symbol].value_per_unit;
      aggregation[symbol].original_currency = quoteCurrency;
      aggregation[symbol].original_price = valuePerUnitInQuote;
      if (!aggregation[symbol].historical_prices || aggregation[symbol].historical_prices.length === 0) {
        // Provide a flat 7-day series so mini-chart renders; improves UX even without backend history
        const baseForHistory = isCash ? 1 : (valuePerUnitInQuote || 0);
        if (baseForHistory > 0) {
          aggregation[symbol].historical_prices = generateFlatHistory(baseForHistory);
        }
      }
      aggregation[symbol].total_value += positionValue;
      aggregation[symbol].account_breakdown!.push({
        account_name: account.account_name,
        account_type: account.account_type,
        units: pos.units,
        value: positionValue,
        owners: account.owners || [],
      });
    }
  }

  const holdings = Object.values(aggregation)
    .map(h => ({
      ...h,
      total_value: roundTo(h.total_value, 2),
    }))
    .sort((a, b) => b.total_value - a.total_value);

  return { base_currency: baseCurrency, holdings };
}

// Generic aggregator to compute chart breakdowns
function toChart(title: string, labelToValue: Record<string, number>): ChartBreakdown {
  const total = Object.values(labelToValue).reduce((s, v) => s + v, 0);
  const data: ChartDataItem[] = Object.entries(labelToValue)
    .map(([label, value]) => ({
      label,
      value: roundTo(value, 2),
      percentage: roundTo(safeDivide(value, total) * 100, 2),
    }))
    .sort((a, b) => b.value - a.value);
  return { chart_title: title, chart_total: roundTo(total, 2), chart_data: data };
}

export interface BreakdownOptions {
  // placeholder for future filters like security type, etc.
}

export function computeBreakdowns(inputs: PortfolioCalcInputs, options?: BreakdownOptions): PortfolioData {
  const { baseCurrency } = inputs;
  const holdings = computeHoldingsTable(inputs).holdings;

  // Account Size Overview
  const byAccount: Record<string, number> = {};
  for (const h of holdings) {
    for (const ab of h.account_breakdown || []) {
      byAccount[ab.account_name] = (byAccount[ab.account_name] || 0) + ab.value;
    }
  }

  // Holdings Aggregation By Symbol
  const bySymbol: Record<string, number> = {};
  for (const h of holdings) {
    bySymbol[h.symbol] = (bySymbol[h.symbol] || 0) + h.total_value;
  }

  // Geographical Distribution of Stocks (from tags.geographical if present)
  const byGeo: Record<string, number> = {};
  for (const h of holdings) {
    const geo = (h as any).tags?.geographical as Record<string, number> | undefined;
    if (geo && typeof geo === 'object') {
      const total = h.total_value;
      for (const [region, weight] of Object.entries(geo)) {
        const w = typeof weight === 'number' ? weight : 0;
        byGeo[region] = (byGeo[region] || 0) + total * w;
      }
    } else {
      byGeo['_Unknown'] = (byGeo['_Unknown'] || 0) + h.total_value;
    }
  }

  // Breakdown By Asset Type
  const byType: Record<string, number> = {};
  for (const h of holdings) {
    const t = (h.security_type || '_Unknown').toLowerCase();
    byType[t] = (byType[t] || 0) + h.total_value;
  }

  return [
    toChart('Account Size Overview', byAccount),
    toChart('Holdings Aggregation By Symbol', bySymbol),
    toChart('Geographical Distribution of Stocks', byGeo),
    toChart('Breakdown By Asset Type', byType),
  ];
}


export function computeBreakdownsFromHoldings(baseCurrency: string, holdings: SecurityHolding[]): PortfolioData {
  // Account Size Overview
  const byAccount: Record<string, number> = {};
  for (const h of holdings) {
    for (const ab of h.account_breakdown || []) {
      byAccount[ab.account_name] = (byAccount[ab.account_name] || 0) + ab.value;
    }
  }

  // Holdings Aggregation By Symbol
  const bySymbol: Record<string, number> = {};
  for (const h of holdings) {
    bySymbol[h.symbol] = (bySymbol[h.symbol] || 0) + h.total_value;
  }

  // Geographical Distribution of Stocks (from tags.geographical if present)
  const byGeo: Record<string, number> = {};
  for (const h of holdings) {
    const geo = (h as any).tags?.geographical as Record<string, number> | undefined;
    if (geo && typeof geo === 'object') {
      const total = h.total_value;
      for (const [region, weight] of Object.entries(geo)) {
        const w = typeof weight === 'number' ? weight : 0;
        byGeo[region] = (byGeo[region] || 0) + total * w;
      }
    } else {
      byGeo['_Unknown'] = (byGeo['_Unknown'] || 0) + h.total_value;
    }
  }

  // Breakdown By Asset Type
  const byType: Record<string, number> = {};
  for (const h of holdings) {
    const t = (h.security_type || '_Unknown').toLowerCase();
    byType[t] = (byType[t] || 0) + h.total_value;
  }

  return [
    toChart('Account Size Overview', byAccount),
    toChart('Holdings Aggregation By Symbol', bySymbol),
    toChart('Geographical Distribution of Stocks', byGeo),
    toChart('Breakdown By Asset Type', byType),
  ];
}

export function rescaleChartToTotal(chart: ChartBreakdown, newTotal: number): ChartBreakdown {
  const currentTotal = chart.chart_total || chart.chart_data.reduce((s, d) => s + d.value, 0);
  if (!currentTotal || currentTotal <= 0 || !Number.isFinite(newTotal) || newTotal <= 0) {
    return chart;
  }
  const scale = newTotal / currentTotal;
  const scaledData = chart.chart_data.map(d => ({
    label: d.label,
    value: roundTo(d.value * scale, 2),
    percentage: roundTo((d.value * scale) / newTotal * 100, 2),
  })).sort((a, b) => b.value - a.value);
  return { ...chart, chart_total: roundTo(newTotal, 2), chart_data: scaledData };
}


