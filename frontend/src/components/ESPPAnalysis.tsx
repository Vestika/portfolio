import React, { useState, useEffect } from 'react';
import { ESPPPlan } from '../types';
import { ESPPCalculator, ESPPCalculationResult } from '../utils/esppCalculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, ChevronDown } from 'lucide-react';
import api from '../utils/api';

interface ESPPAnalysisProps {
  plan: ESPPPlan;
  isValueVisible?: boolean;
}

const ESPPAnalysis: React.FC<ESPPAnalysisProps> = ({ plan, isValueVisible = true }) => {
  const [calculation, setCalculation] = useState<ESPPCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!(plan && plan.symbol && plan.base_salary > 0)) return;

      // Derive purchase dates (every 6 months within the current/longest period)
      const longestPeriod = plan.buying_periods.reduce((longest, current) => {
        const currentDuration = new Date(current.end_date).getTime() - new Date(current.start_date).getTime();
        const longestDuration = new Date(longest.end_date).getTime() - new Date(longest.start_date).getTime();
        return currentDuration > longestDuration ? current : longest;
      });

      const startDate = new Date(longestPeriod.start_date);
      const endDate = new Date(longestPeriod.end_date);
      const today = new Date();
      // Cap end date to today - we can't fetch prices for future dates
      const effectiveEndDate = endDate > today ? today : endDate;
      
      const totalMonths = (effectiveEndDate.getFullYear() - startDate.getFullYear()) * 12 + (effectiveEndDate.getMonth() - startDate.getMonth());
      const purchaseDates: string[] = [];
      for (let m = 6; m <= totalMonths; m += 6) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + m);
        // Only add dates that are not in the future
        if (d <= today) {
          purchaseDates.push(d.toISOString().split('T')[0]);
        }
      }

      let fxByDate: Record<string, number> | undefined = undefined;
      try {
        if (purchaseDates.length > 0) {
          const resp = await api.post('/prices/by-dates', { 
            symbol: 'ILS=X', 
            dates: purchaseDates 
          });
          fxByDate = resp.data?.prices || undefined;
        }
      } catch (e) {
        fxByDate = undefined; // fall back silently
      }

      // Fetch current stock price
      let currentStockPrice: number | undefined = undefined;
      try {
        const today = new Date().toISOString().split('T')[0];
        const resp = await api.post('/prices/by-dates', {
          symbol: plan.symbol,
          dates: [today]
        });
        currentStockPrice = resp.data?.prices?.[today] || undefined;
      } catch (e) {
        currentStockPrice = undefined; // fall back silently
      }

      const result = ESPPCalculator.calculateESPP(plan, fxByDate, currentStockPrice);
      setCalculation(result);
      setIsLoading(false);
    };
    run();
  }, [plan]);

  if (isLoading || !calculation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            ESPP Analysis - {plan.symbol || 'Loading...'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading ESPP analysis...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number, currency: 'USD' | 'ILS' = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCurrencyWithVisibility = (amount: number, currency: 'USD' | 'ILS' = 'USD') => {
    if (!isValueVisible) {
      return '••••••';
    }
    return formatCurrency(amount, currency);
  };

  const formatNumberWithVisibility = (num: number, decimals: number = 2) => {
    if (!isValueVisible) {
      return '••••';
    }
    return formatNumber(num, decimals);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const isGain = calculation.totalGainLoss >= 0;

  return (
    <div className="space-y-4">
      {/* Comprehensive ESPP Data Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              ESPP Performance - {plan.symbol}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0 hover:bg-transparent transition-all duration-200 rounded-full"
            >
              <ChevronDown 
                className={`h-4 w-4 transition-all duration-300 ease-in-out ${
                  isCollapsed ? 'rotate-180 text-muted-foreground' : 'text-primary'
                }`} 
              />
            </Button>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <div className="space-y-6">
            {/* Plan Summary - Compact */}
            <div className="bg-muted/20 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Monthly Contribution</div>
                  <div className="font-semibold text-sm">{formatCurrencyWithVisibility(calculation.monthlyContribution, 'ILS')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Stock Discount</div>
                  <div className="font-semibold text-sm text-green-600">{plan.stock_discount_percentage}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Purchase Price</div>
                  <div className="font-semibold text-sm">{formatCurrencyWithVisibility(calculation.discountedStockPrice, 'USD')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Plan Progress</div>
                  <div className="font-semibold text-sm">{calculation.monthsElapsed}/{calculation.monthsElapsed + calculation.monthsRemaining}</div>
                </div>
              </div>
            </div>

            {/* Key Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">
                  {formatCurrencyWithVisibility(calculation.totalSharesValueILS, 'ILS')}
                </div>
                <div className="text-sm text-muted-foreground">Current Value</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrencyWithVisibility(calculation.totalSharesValue, 'USD')}
                </div>
              </div>
              
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className={`text-2xl font-bold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                  {isGain ? '+' : ''}{formatCurrencyWithVisibility(calculation.totalGainLossILS, 'ILS')}
                </div>
                <div className="text-sm text-muted-foreground">Total Gain/Loss</div>
                <div className={`text-xs ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                  {isGain ? '+' : ''}{formatNumber(calculation.totalGainLossPercentage)}%
                </div>
              </div>
              
              <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                <div className="text-2xl font-bold text-pink-400">
                  {formatNumberWithVisibility(calculation.purchases.reduce((total, purchase) => total + Math.floor(purchase.sharesPurchased), 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Shares Owned</div>
                <div className="text-xs text-muted-foreground">
                  {calculation.purchases.length} purchases
                </div>
              </div>
            </div>

            {/* ESPP Progress Chart */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Plan Progress</h4>
              <Card>
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold">{plan.symbol} ESPP Timeline</h3>
                      <p className="text-sm text-muted-foreground">
                        {calculation.monthsElapsed} of {calculation.monthsElapsed + calculation.monthsRemaining} months completed
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-400">
                        {Math.round((calculation.monthsElapsed / (calculation.monthsElapsed + calculation.monthsRemaining)) * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                  </div>
                  
                  {/* Clean Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
                      <span>Plan Start</span>
                      <span>Plan End</span>
                    </div>
                    <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(calculation.monthsElapsed / (calculation.monthsElapsed + calculation.monthsRemaining)) * 100}%` 
                        }}
                      ></div>
                      
                      {/* Clean Purchase Markers with Tooltips */}
                      {calculation.purchases.map((purchase, index) => {
                        const totalMonths = calculation.monthsElapsed + calculation.monthsRemaining;
                        const purchaseMonth = Math.min(calculation.monthsElapsed, (index + 1) * 6);
                        const position = (purchaseMonth / totalMonths) * 100;
                        const contributionAmountILS = purchase.contributionAmount * (plan.exchange_rate || 3.65);
                        const currentValueILS = purchase.currentValue * (plan.exchange_rate || 3.65);
                        const gainLossILS = purchase.gainLoss * (plan.exchange_rate || 3.65);
                        
                        return (
                          <div
                            key={index}
                            className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-pink-400 rounded-full border-2 border-white dark:border-gray-800 shadow-sm cursor-pointer group"
                            style={{ left: `${position}%`, marginLeft: '-6px' }}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-slate-100 dark:text-slate-100 text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 dark:border-slate-600 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-10 pointer-events-none backdrop-blur-sm">
                              <div className="font-semibold mb-2 text-pink-400 dark:text-pink-300">Purchase {index + 1}</div>
                              <div className="space-y-1">
                                <div className="text-slate-300 dark:text-slate-200">
                                  {purchase.purchaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="text-slate-300 dark:text-slate-200">
                                  {formatNumberWithVisibility(Math.floor(purchase.sharesPurchased), 0)} shares @ {formatCurrencyWithVisibility(purchase.purchasePrice, 'USD')}
                                </div>
                                <div className="text-slate-300 dark:text-slate-200">
                                  Invested: {formatCurrencyWithVisibility(contributionAmountILS, 'ILS')}
                                </div>
                                <div className="text-slate-300 dark:text-slate-200">
                                  Current: {formatCurrencyWithVisibility(currentValueILS, 'ILS')}
                                </div>
                                <div className={`text-xs font-semibold ${purchase.gainLoss >= 0 ? 'text-emerald-400 dark:text-emerald-300' : 'text-red-400 dark:text-red-300'}`}>
                                  {purchase.gainLoss >= 0 ? '+' : ''}{formatCurrencyWithVisibility(gainLossILS, 'ILS')} ({purchase.gainLossPercentage.toFixed(1)}%)
                                </div>
                              </div>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Next Purchase Marker with Tooltip */}
                      {calculation.pendingContribution > 0 && calculation.nextPurchaseDate && (
                        <div
                          className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-orange-400 rounded-full border-2 border-white dark:border-gray-800 shadow-sm cursor-pointer group"
                          style={{ 
                            left: `${((calculation.monthsElapsed + (6 - calculation.monthsSinceLastPurchase)) / (calculation.monthsElapsed + calculation.monthsRemaining)) * 100}%`, 
                            marginLeft: '-6px' 
                          }}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-slate-100 dark:text-slate-100 text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 dark:border-slate-600 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-10 pointer-events-none backdrop-blur-sm">
                            <div className="font-semibold mb-2 text-orange-400 dark:text-orange-300">Next Purchase</div>
                            <div className="space-y-1">
                              <div className="text-slate-300 dark:text-slate-200">
                                {calculation.nextPurchaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="text-slate-300 dark:text-slate-200">
                                Money waiting: {formatCurrencyWithVisibility(calculation.pendingContributionILS, 'ILS')}
                              </div>
                              <div className="text-slate-300 dark:text-slate-200">
                                Estimated shares: {formatNumberWithVisibility(Math.floor(calculation.pendingShares), 0)}
                              </div>
                              <div className="text-slate-300 dark:text-slate-200">
                                Price: {formatCurrencyWithVisibility(calculation.discountedStockPrice, 'USD')} per share
                              </div>
                              <div className="text-slate-300 dark:text-slate-200">
                                {calculation.monthsSinceLastPurchase} months accumulated
                              </div>
                            </div>
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Clean Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-xl font-bold text-blue-400">{calculation.monthsElapsed}</div>
                      <div className="text-sm text-muted-foreground">Months Elapsed</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                      <div className="text-xl font-bold text-gray-400">{calculation.monthsRemaining}</div>
                      <div className="text-sm text-muted-foreground">Months Remaining</div>
                    </div>
                    <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                      <div className="text-xl font-bold text-pink-400">{calculation.purchases.length}</div>
                      <div className="text-sm text-muted-foreground">Purchases Made</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-xl font-bold text-green-400">
                        {calculation.pendingContribution > 0 ? 'Active' : 'Complete'}
                      </div>
                      <div className="text-sm text-muted-foreground">Status</div>
                    </div>
                  </div>
                  
                </CardContent>
              </Card>
            </div>

            {/* Purchase History */}
            {calculation.purchases.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Purchase History</h4>
                <div className="space-y-2">
                  {calculation.purchases.map((purchase, index) => {
                    const currentValueILS = purchase.currentValue * (plan.exchange_rate || 3.65);
                    const gainLossILS = purchase.gainLoss * (plan.exchange_rate || 3.65);
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">
                              {purchase.purchaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatNumberWithVisibility(Math.floor(purchase.sharesPurchased), 0)} shares @ {formatCurrencyWithVisibility(purchase.purchasePrice, 'USD')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-medium">
                              {formatCurrencyWithVisibility(currentValueILS, 'ILS')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrencyWithVisibility(purchase.currentValue, 'USD')}
                            </div>
                            <div className={`text-sm font-semibold ${purchase.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {purchase.gainLoss >= 0 ? '+' : ''}{formatCurrencyWithVisibility(gainLossILS, 'ILS')}
                            </div>
                            <div className={`text-xs ${purchase.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {purchase.gainLoss >= 0 ? '+' : ''}{purchase.gainLossPercentage.toFixed(1)}%
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              // TODO: Implement add stocks to account functionality
                              console.log(`Adding ${Math.floor(purchase.sharesPurchased)} shares of ${plan.symbol} to account`);
                            }}
                            className="text-xs px-3 py-1.5 h-auto bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 rounded-lg transition-all duration-200 hover:scale-105"
                          >
                            + Add to Portfolio
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </CardContent>
        )}
      </Card>



    </div>
  );
};

export default ESPPAnalysis;
