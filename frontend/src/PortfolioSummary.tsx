import React, { useEffect, useState } from 'react';
import { Wallet, Coins } from 'lucide-react';
import {AccountInfo} from "./types.ts";
interface CashHoldings {
  [currency: string]: number;
}

const apiUrl = import.meta.env.VITE_API_URL;


interface PortfolioSummaryProps {
  accounts: AccountInfo[];
  selectedAccountNames: string[];
  baseCurrency: string;
  isValueVisible: boolean;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  accounts,
  selectedAccountNames,
  baseCurrency,
  isValueVisible
}) => {
  const selectedAccounts = accounts.filter(account =>
    selectedAccountNames.includes(account.account_name)
  );

  const totalValue = selectedAccounts.reduce(
    (sum, account) => sum + account.account_total,
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
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed' | 'unknown'>('unknown');

  useEffect(() => {
    fetch(`${apiUrl}/market-status`)
      .then(res => res.json())
      .then(data => setMarketStatus(data.us_market_status || 'unknown'))
      .catch(() => setMarketStatus('unknown'));
  }, []);

  return (
    <div className="sticky top-[77px] z-10 bg-gray-800 border-t border-b border-gray-700">
      <div className="container mx-auto flex items-center space-x-4 py-1.5 px-4">
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
        {Object.entries(totalCash).map(([currency, amount]) => (
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
        <div className="flex-1" />
        {/* US Market Status */}
        <div className={`flex items-center rounded-full px-3 py-1 ml-auto ${marketStatus === 'open' ? 'bg-green-700' : marketStatus === 'closed' ? 'bg-gray-700' : 'bg-gray-700'}`}
             title="US Market Status">
          <span className={`w-2 h-2 rounded-full mr-2 ${marketStatus === 'open' ? 'bg-green-400' : marketStatus === 'closed' ? 'bg-red-400' : 'bg-gray-400'}`}></span>
          <span className="text-xs font-medium">us-market-status:</span>
          <span className={`ml-1 text-xs ${marketStatus === 'open' ? 'text-green-400' : marketStatus === 'closed' ? 'text-red-400' : 'text-gray-400'}`}>{marketStatus}</span>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;