import React, { useState, useEffect } from 'react';
import { ESPPPlan } from '../types';
import { ESPPCalculator, ESPPCalculationResult, ESPPPeriodData } from '../utils/esppCalculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, PieChart, Calendar, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ESPPAnalysisProps {
  plan: ESPPPlan;
}

const ESPPAnalysis: React.FC<ESPPAnalysisProps> = ({ plan }) => {
  const [calculation, setCalculation] = useState<ESPPCalculationResult | null>(null);
  const [projection, setProjection] = useState<ESPPPeriodData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (plan && plan.symbol && plan.base_salary > 0) {
      const result = ESPPCalculator.calculateESPP(plan);
      const projectionData = ESPPCalculator.calculateESPPProjection(plan);
      
      setCalculation(result);
      setProjection(projectionData);
      setIsLoading(false);
    }
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

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const isGain = calculation.totalGainLoss >= 0;
  const progressPercentage = calculation.monthsElapsed > 0 ? 
    (calculation.monthsElapsed / (calculation.monthsElapsed + calculation.monthsRemaining)) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            ESPP Analysis - {plan.symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Monthly Contribution */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Monthly Contribution
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(calculation.monthlyContribution, 'ILS')}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCurrency(calculation.monthlyContributionUSD, 'USD')}
              </div>
            </div>

            {/* Total Contributions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Total Contributions
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(calculation.totalContributions, 'ILS')}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCurrency(calculation.totalContributionsUSD, 'USD')}
              </div>
            </div>

            {/* Current Value */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isGain ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                Current Value
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(calculation.totalSharesValue, 'USD')}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCurrency(calculation.totalSharesValueILS, 'ILS')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gain/Loss Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gain/Loss</span>
              <div className="flex items-center gap-2">
                {isGain ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`font-bold ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(calculation.totalGainLoss, 'USD')}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gain/Loss (ILS)</span>
              <span className={`font-bold ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calculation.totalGainLossILS, 'ILS')}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Percentage</span>
              <Badge variant={isGain ? 'default' : 'destructive'}>
                {isGain ? '+' : ''}{formatNumber(calculation.totalGainLossPercentage)}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stock Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stock Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Shares Owned</span>
              <span className="font-bold">{formatNumber(calculation.totalSharesOwned, 4)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending Contribution</span>
              <span className="font-bold">{formatCurrency(calculation.pendingContribution, 'USD')}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Discounted Price</span>
              <span className="font-bold">{formatCurrency(calculation.discountedStockPrice, 'USD')}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Price</span>
              <span className="font-bold">{formatCurrency(plan.current_stock_price || plan.base_stock_price, 'USD')}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Discount</span>
              <Badge variant="secondary">
                {plan.stock_discount_percentage}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Plan Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Months Elapsed: {calculation.monthsElapsed}</span>
              <span>Months Remaining: {calculation.monthsRemaining}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {formatNumber(progressPercentage)}% of current period completed
            </div>
          </div>
          
          {calculation.nextPurchaseDate && (
            <div className="pt-2 border-t">
              <div className="text-sm text-muted-foreground">Next Purchase Date</div>
              <div className="font-semibold">
                {calculation.nextPurchaseDate.toLocaleDateString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {calculation.pendingContribution > 0 && 
                  `Pending: ${formatCurrency(calculation.pendingContribution, 'USD')}`
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase History */}
      {calculation.purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {calculation.purchases.map((purchase, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      Purchase #{index + 1}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {purchase.purchaseDate.toLocaleDateString()}
                    </div>
                    <div className="text-sm">
                      {formatNumber(purchase.sharesPurchased, 4)} shares @ {formatCurrency(purchase.purchasePrice, 'USD')}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-semibold">
                      {formatCurrency(purchase.currentValue, 'USD')}
                    </div>
                    <div className={`text-sm ${purchase.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {purchase.gainLoss >= 0 ? '+' : ''}{formatCurrency(purchase.gainLoss, 'USD')} 
                      ({purchase.gainLossPercentage >= 0 ? '+' : ''}{formatNumber(purchase.gainLossPercentage)}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution vs Value Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shares Owned vs Current Value</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'sharesCanBuy' ? formatNumber(value, 2) : formatCurrency(value, 'USD'),
                    name === 'sharesCanBuy' ? 'Shares Owned' : 'Current Value'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="sharesCanBuy" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Shares Owned"
                />
                <Line 
                  type="monotone" 
                  dataKey="currentValue" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  name="Current Value"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gain/Loss Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Gain/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value, 'USD'), 'Gain/Loss']}
                />
                <Bar 
                  dataKey="gainLoss" 
                  fill="#8884d8"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Month</th>
                  <th className="text-right p-2">Contribution</th>
                  <th className="text-right p-2">Total Contributed</th>
                  <th className="text-right p-2">Shares Owned</th>
                  <th className="text-right p-2">Current Value</th>
                  <th className="text-right p-2">Gain/Loss</th>
                  <th className="text-right p-2">%</th>
                </tr>
              </thead>
              <tbody>
                {projection.slice(0, 24).map((data) => {
                  const isPurchaseMonth = data.month % 6 === 0;
                  return (
                    <tr key={data.month} className={`border-b ${isPurchaseMonth ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                      <td className="p-2">
                        {data.month}
                        {isPurchaseMonth && <span className="ml-2 text-xs text-green-600">📈 Purchase</span>}
                      </td>
                      <td className="text-right p-2">{formatCurrency(data.contribution, 'USD')}</td>
                      <td className="text-right p-2">{formatCurrency(data.cumulativeContribution, 'USD')}</td>
                      <td className="text-right p-2">{formatNumber(data.sharesCanBuy, 4)}</td>
                      <td className="text-right p-2">{formatCurrency(data.currentValue, 'USD')}</td>
                      <td className={`text-right p-2 ${data.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.gainLoss, 'USD')}
                      </td>
                      <td className={`text-right p-2 ${data.gainLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.gainLossPercentage >= 0 ? '+' : ''}{formatNumber(data.gainLossPercentage)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ESPPAnalysis;
