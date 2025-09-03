import api from './api';

export interface QuoteResult {
  quotesBySymbol: Record<string, { symbol: string; price: number; currency: string }>;
  fxByPair: Record<string, { pair: string; rate: number; fromCurrency: string; toCurrency: string }>;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function isNumericSymbol(symbol: string): boolean {
  return /^\d+$/.test(symbol);
}

// Heuristic for symbol currency when API doesn't provide it
function inferCurrency(symbol: string): string {
  if (symbol.toUpperCase() === 'USD') return 'USD';
  if (symbol.toUpperCase() === 'ILS') return 'ILS';
  if (isNumericSymbol(symbol)) return 'ILS'; // TASE ids
  return 'USD';
}

export async function fetchQuotesAndFx(baseCurrency: string, symbols: string[]): Promise<QuoteResult> {
  const cleanSymbols = unique(symbols.filter(Boolean).map(s => s.trim()));

  // Prepare FX pairs needed to convert from USD/ILS to baseCurrency
  const fxPairs: string[] = [];
  const upperBase = baseCurrency.toUpperCase();
  if (upperBase !== 'USD') {
    fxPairs.push(`USD${upperBase}=X`);
  }
  if (upperBase !== 'ILS') {
    fxPairs.push(`ILS${upperBase}=X`);
  }

  const toQuery = unique([...cleanSymbols, ...fxPairs]).join(',');
  let responseData: Record<string, { current_price?: number }>; // backend returns map-like? we'll normalize below

  try {
    const res = await api.get(`/quotes?symbols=${encodeURIComponent(toQuery)}`);
    responseData = res.data;
  } catch (e) {
    return { quotesBySymbol: {}, fxByPair: {} };
  }

  const quotesBySymbol: Record<string, { symbol: string; price: number; currency: string }> = {};
  const fxByPair: Record<string, { pair: string; rate: number; fromCurrency: string; toCurrency: string }> = {};

  // Response may be an object keyed by symbol or an array; handle both
  const entries: Array<[string, any]> = Array.isArray(responseData)
    ? (responseData as any[]).map((q: any) => [q.symbol ?? q.ticker ?? q.name ?? '', q])
    : Object.entries(responseData);

  for (const [key, val] of entries) {
    const symbol = (val?.symbol as string) || key;
    const price = Number(val?.current_price ?? val?.price ?? val?.last ?? 0);
    if (!symbol) continue;

    // Detect FX pair pattern like USDILS=X
    const fxMatch = symbol.match(/^(USD|ILS|EUR|GBP|CAD|JPY|CHF|AUD)(USD|ILS|EUR|GBP|CAD|JPY|CHF|AUD)=X$/i);
    if (fxMatch) {
      const fromCurrency = fxMatch[1].toUpperCase();
      const toCurrency = fxMatch[2].toUpperCase();
      const pair = `${fromCurrency}${toCurrency}`;
      if (Number.isFinite(price) && price > 0) {
        fxByPair[pair] = { pair, rate: price, fromCurrency, toCurrency };
      }
      continue;
    }

    quotesBySymbol[symbol] = {
      symbol,
      price: Number.isFinite(price) ? price : 0,
      currency: inferCurrency(symbol),
    };
  }

  return { quotesBySymbol, fxByPair };
}


