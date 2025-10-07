import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Coins } from 'lucide-react';
import {AccountInfo} from "./types.ts";
import api from './utils/api';
import { useRealEstateContext } from './contexts/RealEstateContext';
interface CashHoldings {
  [currency: string]: number;
}


interface PortfolioSummaryProps {
  accounts: AccountInfo[];
  selectedAccountNames: string[];
  baseCurrency: string;
  isValueVisible: boolean;
  globalPrices: Record<string, any>;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  accounts,
  selectedAccountNames,
  baseCurrency,
  isValueVisible,
  globalPrices
}) => {
  const selectedAccounts = accounts.filter(account =>
    selectedAccountNames.includes(account.account_name)
  );

  const totalValue = selectedAccounts.reduce(
    (sum, account) => {
      const accountTotal = (account.holdings || []).reduce((accSum, holding) => {
        const priceData = globalPrices[holding.symbol];
        if (!priceData) return accSum;
        return accSum + (holding.units * priceData.price);
      }, 0);
      return sum + accountTotal;
    },
    0
  );

  // Aggregate cash holdings across all selected accounts
  const totalCash = selectedAccounts.reduce((holdings, account) => {
    if (!account.account_cash) return holdings;

    Object.entries(account.account_cash).forEach(([currency, amount]) => {
      holdings[currency] = (holdings[currency] || 0) + amount;
    });

    return holdings;
  }, {} as CashHoldings);

  // Market status state
  const [usMarketStatus, setUsMarketStatus] = useState<'open' | 'closed' | 'unknown'>('unknown');
  const [taseMarketStatus, setTaseMarketStatus] = useState<'open' | 'closed' | 'unknown'>('unknown');

  // Aggregate total IBIT units across selected accounts
  const totalIbitUnits = useMemo(() => {
    try {
      return selectedAccounts.reduce((sum, account) => {
        if (!account.holdings) return sum;
        const ibitHolding = account.holdings.find(h => h.symbol.toUpperCase() === 'IBIT');
        return sum + (ibitHolding?.units || 0);
      }, 0);
    } catch {
      return 0;
    }
  }, [selectedAccounts]);

  // IBIT → BTC equivalent (static ratio: 1 BTC ≈ 1754.39 IBIT)
  const IBIT_PER_BTC = 1754.39;
  const ibitBtcEquivalent = useMemo(() => {
    const units = totalIbitUnits;
    if (!units || units <= 0) return null;
    return units / IBIT_PER_BTC;
  }, [totalIbitUnits]);

  useEffect(() => {
    api.get('/market-status')
      .then(res => {
        setUsMarketStatus(res.data.us_market_status || 'unknown');
        setTaseMarketStatus(res.data.tase_market_status || 'unknown');
      })
      .catch(() => {
        setUsMarketStatus('unknown');
        setTaseMarketStatus('unknown');
      });
  }, []);

  const realEstate = useRealEstateContext();

  return (
    <div className="sticky top-[77px] z-10 bg-gray-800 border-t border-b border-gray-700">
      <div className="container mx-auto flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 py-1.5 px-2 sm:px-4 overflow-x-auto">
        {/* Total Value Chip */}
        <div className="flex items-center bg-gray-700 rounded-full px-3 py-1">
          <Wallet size={14} className="text-green-400 mr-1.5" />
          <span className="text-xs font-medium mr-1">Total:</span>
          {isValueVisible ? (
            <span className="text-xs text-green-400">
              {new Intl.NumberFormat('en-US', {
                maximumFractionDigits: 0
              }).format(totalValue)}{' '}
              {baseCurrency}
            </span>
          ) : (
            <span className="flex items-center space-x-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
            </span>
          )}
        </div>

        {/* Cash Holdings Chips */}
        {Object.entries(totalCash).map(([currency, amount]: [string, number]) => (
          <div
            key={currency}
            className="flex items-center bg-gray-700 rounded-full px-3 py-1"
          >
            <Coins size={14} className="text-sky-400 mr-1.5" />
            <span className="text-xs font-medium mr-1">{currency}:</span>
            {isValueVisible ? (
              <span className="text-xs text-sky-400">
                {new Intl.NumberFormat('en-US', {
                  maximumFractionDigits: 0
                }).format(amount)}
              </span>
            ) : (
              <span className="flex items-center space-x-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              </span>
            )}
          </div>
        ))}

        {/* IBIT BTC-equivalent Chip */}
        {totalIbitUnits > 0 && (
          <div
            className="flex items-center bg-gray-700 rounded-full px-3 py-1"
            title={`1 BTC ≈ ${IBIT_PER_BTC} IBIT`}
          >
            <Coins size={14} className="text-amber-400 mr-1.5" />
            <span className="text-xs font-medium mr-1">BTC (IBIT):</span>
            {isValueVisible ? (
              <span className="text-xs text-amber-400">
                {ibitBtcEquivalent !== null
                  ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(ibitBtcEquivalent)
                  : 'N/A'}
              </span>
            ) : (
              <span className="flex items-center space-x-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </span>
            )}
          </div>
        )}

        {/* Real Estate Leverage Chip */}
        {realEstate?.leverage && (
          <div
            className="flex items-center bg-gray-700 rounded-full px-3 py-1"
            title="Real Estate Leverage"
          >
            <span className="w-2 h-2 rounded-full mr-2 bg-sky-400"></span>
            <span className="text-xs font-medium">LTV:</span>
            <span className="ml-1 text-xs text-sky-400">{(realEstate.leverage.ltv * 100).toFixed(1)}%</span>
            <span className="ml-2 text-xs font-medium">Lev:</span>
            <span className="ml-1 text-xs text-sky-400">{Number.isFinite(realEstate.leverage.leverageMultiple) ? realEstate.leverage.leverageMultiple.toFixed(2) + '×' : '∞'}</span>
          </div>
        )}
        <div className="flex-1" />
        {/* NYSE Market Status */}
        <div className="flex items-center bg-gray-700 rounded-full px-3 py-1"
             title="NYSE Market Status">
          <span className={`w-2 h-2 rounded-full mr-2 ${usMarketStatus === 'open' ? 'bg-green-400' : usMarketStatus === 'closed' ? 'bg-red-400' : 'bg-gray-400'}`}></span>
          <span className="text-xs font-medium">nyse:</span>
          <span className={`ml-1 text-xs ${usMarketStatus === 'open' ? 'text-green-400' : usMarketStatus === 'closed' ? 'text-red-400' : 'text-gray-400'}`}>{usMarketStatus}</span>
        </div>
        {/* TASE Market Status */}
        <div className="flex items-center bg-gray-700 rounded-full px-3 py-1 ml-2"
             title="TASE Market Status">
          <span className={`w-2 h-2 rounded-full mr-2 ${taseMarketStatus === 'open' ? 'bg-green-400' : taseMarketStatus === 'closed' ? 'bg-red-400' : 'bg-gray-400'}`}></span>
          <span className="text-xs font-medium">tase:</span>
          <span className={`ml-1 text-xs ${taseMarketStatus === 'open' ? 'text-green-400' : taseMarketStatus === 'closed' ? 'text-red-400' : 'text-gray-400'}`}>{taseMarketStatus}</span>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;