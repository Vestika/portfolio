import { AccountInfo, PortfolioMetadata } from '../types';
import { fetchQuotesAndFx } from './price-fetcher';

type RawAccount = {
  account_name?: string;
  name?: string;
  account_properties?: { owners?: string[]; type?: string };
  properties?: { owners?: string[]; type?: string };
  holdings?: { symbol: string; units: number }[];
};

type RawPortfolioDoc = {
  base_currency?: string;
  config?: { base_currency?: string };
  accounts?: RawAccount[];
};

function convertToBase(value: number, fromCurrency: string, baseCurrency: string, fxByPair: Record<string, { rate: number }> | undefined): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const from = (fromCurrency || '').toUpperCase();
  const base = (baseCurrency || '').toUpperCase();
  if (from === base) return value;
  const pair = `${from}${base}`;
  const fx = fxByPair?.[pair];
  if (fx && fx.rate > 0) return value * fx.rate;
  // Fallbacks
  if (from === 'USD' && base === 'ILS') return value * 3.4;
  if (from === 'ILS' && base === 'USD') return value / 3.4;
  return value; // last resort
}

export async function enrichRawPortfolioAccounts(raw: RawPortfolioDoc, baseCurrency: string): Promise<PortfolioMetadata> {
  const accounts = raw.accounts || [];
  const allSymbols = Array.from(new Set(accounts.flatMap(a => (a.holdings || []).map(h => h.symbol))));
  const { quotesBySymbol, fxByPair } = await fetchQuotesAndFx(baseCurrency, allSymbols);

  const enrichedAccounts: AccountInfo[] = accounts.map((acc): AccountInfo => {
    const accountName = acc.account_name || acc.name || '';
    const props = acc.account_properties || acc.properties || {};
    const holdings = acc.holdings || [];

    // Build cash map
    const account_cash: Record<string, number> = {};
    for (const h of holdings) {
      const sym = (h.symbol || '').toUpperCase();
      if (sym === 'USD' || sym === 'ILS') {
        account_cash[sym] = (account_cash[sym] || 0) + (h.units || 0);
      }
    }

    // Sum total value in base
    let account_total = 0;
    for (const h of holdings) {
      const sym = (h.symbol || '').toUpperCase();
      const units = h.units || 0;
      let price = 0;
      let priceCurrency = baseCurrency;

      if (sym === 'USD' || sym === 'ILS') {
        price = 1;
        priceCurrency = sym;
      } else {
        const q = quotesBySymbol[sym] || quotesBySymbol[h.symbol];
        if (q) {
          price = q.price;
          priceCurrency = q.currency || baseCurrency;
        }
      }

      const valuePerUnitInBase = convertToBase(price, priceCurrency, baseCurrency, fxByPair);
      account_total += valuePerUnitInBase * units;
    }

    return {
      account_name: accountName,
      account_total,
      account_type: props.type || 'bank-account',
      owners: props.owners || ['me'],
      holdings: holdings.map(h => ({ symbol: h.symbol, units: h.units })),
      account_cash,
    } as AccountInfo;
  });
  const userName = (raw && typeof raw === 'object' && 'config' in raw && (raw as { config?: { user_name?: string } }).config?.user_name) || 'User';
  return {
    base_currency: baseCurrency,
    user_name: userName,
    accounts: enrichedAccounts,
  } as PortfolioMetadata;
}


