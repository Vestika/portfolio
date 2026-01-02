import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Coins } from 'lucide-react';
import {AccountInfo} from "./types.ts";
import api from './utils/api';
import { SubtitleBar, MetricChip, SubtitleBarSpacer } from './components/common/SubtitleBar';
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

  // No network calls needed for IBIT→BTC; purely derived from static ratio

  const hiddenValue = (
    <span className="flex items-center space-x-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current"></span>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current"></span>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current"></span>
    </span>
  );

  return (
    <SubtitleBar topOffset="77px" zIndex={10}>
      {/* Total Value Chip */}
      <MetricChip
        icon={<Wallet size={14} />}
        iconColor="text-green-400"
        label="Total:"
        value={
          isValueVisible ? (
            <>
              {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(totalValue)}{' '}
              {baseCurrency}
            </>
          ) : (
            hiddenValue
          )
        }
        valueColor={isValueVisible ? "text-green-400" : ""}
      />

      {/* Cash Holdings Chips */}
      {Object.entries(totalCash).map(([currency, amount]: [string, number]) => (
        <MetricChip
          key={currency}
          icon={<Coins size={14} />}
          iconColor="text-sky-400"
          label={`${currency}:`}
          value={
            isValueVisible ? (
              new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
            ) : (
              hiddenValue
            )
          }
          valueColor={isValueVisible ? "text-sky-400" : ""}
        />
      ))}

      {/* IBIT BTC-equivalent Chip */}
      {totalIbitUnits > 0 && (
        <MetricChip
          icon={<Coins size={14} />}
          iconColor="text-amber-400"
          label="BTC (IBIT):"
          value={
            isValueVisible ? (
              ibitBtcEquivalent !== null
                ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(ibitBtcEquivalent)
                : 'N/A'
            ) : (
              hiddenValue
            )
          }
          valueColor={isValueVisible ? "text-amber-400" : ""}
          title={`1 BTC ≈ ${IBIT_PER_BTC} IBIT`}
        />
      )}

      <SubtitleBarSpacer />

      {/* NYSE Market Status */}
      <MetricChip
        icon={
          <span
            className={`w-2 h-2 rounded-full ${
              usMarketStatus === 'open'
                ? 'bg-green-400'
                : usMarketStatus === 'closed'
                ? 'bg-red-400'
                : 'bg-gray-400'
            }`}
          />
        }
        label="nyse:"
        value={usMarketStatus}
        valueColor={
          usMarketStatus === 'open'
            ? 'text-green-400'
            : usMarketStatus === 'closed'
            ? 'text-red-400'
            : 'text-gray-400'
        }
        title="NYSE Market Status"
      />

      {/* TASE Market Status */}
      <MetricChip
        icon={
          <span
            className={`w-2 h-2 rounded-full ${
              taseMarketStatus === 'open'
                ? 'bg-green-400'
                : taseMarketStatus === 'closed'
                ? 'bg-red-400'
                : 'bg-gray-400'
            }`}
          />
        }
        label="tase:"
        value={taseMarketStatus}
        valueColor={
          taseMarketStatus === 'open'
            ? 'text-green-400'
            : taseMarketStatus === 'closed'
            ? 'text-red-400'
            : 'text-gray-400'
        }
        title="TASE Market Status"
      />
    </SubtitleBar>
  );
};

export default PortfolioSummary;