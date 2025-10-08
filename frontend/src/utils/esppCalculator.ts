import { ESPPPlan } from '../types';

export interface ESPPPurchase {
  purchaseDate: Date;
  contributionAmount: number; // Amount contributed in USD
  sharesPurchased: number;
  purchasePrice: number; // Discounted price at purchase
  currentValue: number; // Current value of these shares
  gainLoss: number; // Gain/loss on this purchase
  gainLossPercentage: number;
}

export interface ESPPCalculationResult {
  totalContributions: number; // Total amount contributed in ILS
  totalContributionsUSD: number; // Total amount contributed in USD
  monthlyContribution: number; // Monthly contribution in ILS
  monthlyContributionUSD: number; // Monthly contribution in USD
  discountedStockPrice: number; // Stock price after discount in USD
  totalSharesOwned: number; // Total shares purchased so far
  totalSharesValue: number; // Current value of all shares in USD
  totalSharesValueILS: number; // Current value of all shares in ILS
  totalGainLoss: number; // Total gain/loss in USD
  totalGainLossILS: number; // Total gain/loss in ILS
  totalGainLossPercentage: number; // Total percentage gain/loss
  monthsElapsed: number; // Number of months since plan started
  monthsRemaining: number; // Number of months remaining in current period
  nextPurchaseDate: Date | null; // Next purchase date
  purchases: ESPPPurchase[]; // All purchases made so far
  pendingContribution: number; // Amount pending for next purchase in USD
  pendingContributionILS: number; // Amount pending for next purchase in ILS
  pendingShares: number; // Estimated shares that can be bought with pending money
  monthsSinceLastPurchase: number; // Months since last purchase (0-5)
}

export interface ESPPPeriodData {
  month: number;
  contribution: number;
  cumulativeContribution: number;
  sharesCanBuy: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
}

export class ESPPCalculator {
  static calculateESPP(plan: ESPPPlan, fxRatesByDate?: Record<string, number>, currentStockPrice?: number): ESPPCalculationResult {
    const exchangeRate = plan.exchange_rate || 3.65;

    // Calculate monthly contribution
    const monthlyContribution = (plan.base_salary * plan.income_percentage) / 100; // ILS
    const monthlyContributionUSD = monthlyContribution / exchangeRate;
    
    // Calculate discounted stock price
    const discountedStockPrice = plan.base_stock_price * (1 - plan.stock_discount_percentage / 100);
    
    // Find current buying period
    const currentDate = new Date();
    const currentPeriod = plan.buying_periods.find(period => {
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      return currentDate >= startDate && currentDate <= endDate;
    });
    
    let monthsElapsed = 0;
    let monthsRemaining = 0;
    let nextPurchaseDate: Date | null = null;
    
    if (currentPeriod) {
      const startDate = new Date(currentPeriod.start_date);
      const endDate = new Date(currentPeriod.end_date);
      
      // Calculate months elapsed since start of current period
      monthsElapsed = this.getMonthsDifference(startDate, currentDate);
      
      // Calculate months remaining in current period
      monthsRemaining = this.getMonthsDifference(currentDate, endDate);
      
      // Calculate next purchase date (every 6 months from start)
      const purchaseInterval = 6; // months
      const purchasesElapsed = Math.floor(monthsElapsed / purchaseInterval);
      const nextPurchaseMonths = (purchasesElapsed + 1) * purchaseInterval;
      nextPurchaseDate = new Date(startDate);
      nextPurchaseDate.setMonth(nextPurchaseDate.getMonth() + nextPurchaseMonths);
      
      // If next purchase is beyond the period end, set to null
      if (nextPurchaseDate > endDate) {
        nextPurchaseDate = null;
      }
    }
    
    // Calculate purchases made so far (every 6 months)
    const purchases: ESPPPurchase[] = [];
    let totalSharesOwned = 0;
    let totalSharesValue = 0;
    let totalGainLoss = 0;
    
    if (currentPeriod) {
      const startDate = new Date(currentPeriod.start_date);
      const purchaseInterval = 6; // months
      const purchasesElapsed = Math.floor(monthsElapsed / purchaseInterval);
      
      for (let i = 0; i < purchasesElapsed; i++) {
        const purchaseDate = new Date(startDate);
        purchaseDate.setMonth(purchaseDate.getMonth() + (i + 1) * purchaseInterval);
        const purchaseDateStr = purchaseDate.toISOString().split('T')[0];
        const fxAtPurchase = fxRatesByDate?.[purchaseDateStr] || exchangeRate; // ILS per USD
        
        // Calculate contribution for this 6-month period
        const sixMonthContributionILS = monthlyContribution * purchaseInterval; // ILS
        const contributionAmount = sixMonthContributionILS / fxAtPurchase; // USD
        const sharesPurchased = contributionAmount / discountedStockPrice;
        const currentValue = sharesPurchased * (currentStockPrice || plan.base_stock_price);
        const gainLoss = currentValue - contributionAmount;
        const gainLossPercentage = contributionAmount > 0 ? (gainLoss / contributionAmount) * 100 : 0;
        
        purchases.push({
          purchaseDate,
          contributionAmount,
          sharesPurchased,
          purchasePrice: discountedStockPrice,
          currentValue,
          gainLoss,
          gainLossPercentage
        });
        
        totalSharesOwned += sharesPurchased;
        totalSharesValue += currentValue;
        totalGainLoss += gainLoss;
      }
    }
    
    // Calculate pending contribution for next purchase
    const monthsSinceLastPurchase = monthsElapsed % 6;
    // Use latest available FX (from last purchase) or fallback to plan.exchange_rate
    let latestFx = exchangeRate;
    if (purchases.length > 0) {
      const lastPurchaseDateStr = purchases[purchases.length - 1].purchaseDate.toISOString().split('T')[0];
      latestFx = fxRatesByDate?.[lastPurchaseDateStr] || exchangeRate;
    }
    const pendingContributionILS = monthlyContribution * monthsSinceLastPurchase;
    const pendingContribution = pendingContributionILS / latestFx;
    const pendingShares = pendingContribution / discountedStockPrice;
    
    // Calculate total contributions (including pending)
    const totalContributions = monthlyContribution * monthsElapsed;
    const totalContributionsUSD = totalContributions / exchangeRate;
    
    // Calculate totals
    const totalSharesValueILS = totalSharesValue * exchangeRate;
    const totalGainLossILS = totalGainLoss * exchangeRate;
    const totalGainLossPercentage = totalContributionsUSD > 0 ? (totalGainLoss / totalContributionsUSD) * 100 : 0;
    
    return {
      totalContributions,
      totalContributionsUSD,
      monthlyContribution,
      monthlyContributionUSD,
      discountedStockPrice,
      totalSharesOwned,
      totalSharesValue,
      totalSharesValueILS,
      totalGainLoss,
      totalGainLossILS,
      totalGainLossPercentage,
      monthsElapsed,
      monthsRemaining,
      nextPurchaseDate,
      purchases,
      pendingContribution,
      pendingContributionILS,
      pendingShares,
      monthsSinceLastPurchase
    };
  }
  
  static calculateESPPProjection(plan: ESPPPlan): ESPPPeriodData[] {
    const exchangeRate = plan.exchange_rate || 3.65;
    const currentStockPrice = plan.base_stock_price;
    const monthlyContribution = (plan.base_salary * plan.income_percentage) / 100;
    const monthlyContributionUSD = monthlyContribution / exchangeRate;
    const discountedStockPrice = plan.base_stock_price * (1 - plan.stock_discount_percentage / 100);
    
    const projection: ESPPPeriodData[] = [];
    let cumulativeContribution = 0;
    let totalSharesOwned = 0;
    let totalSharesValue = 0;
    
    // Find the longest buying period for projection
    const longestPeriod = plan.buying_periods.reduce((longest, current) => {
      const currentDuration = new Date(current.end_date).getTime() - new Date(current.start_date).getTime();
      const longestDuration = new Date(longest.end_date).getTime() - new Date(longest.start_date).getTime();
      return currentDuration > longestDuration ? current : longest;
    });
    
    const startDate = new Date(longestPeriod.start_date);
    const endDate = new Date(longestPeriod.end_date);
    const totalMonths = this.getMonthsDifference(startDate, endDate);
    
    for (let month = 1; month <= totalMonths; month++) {
      cumulativeContribution += monthlyContributionUSD;
      
      // Check if this is a purchase month (every 6 months)
      const isPurchaseMonth = month % 6 === 0;
      
      if (isPurchaseMonth) {
        // Calculate shares purchased in this 6-month period
        const sixMonthContribution = monthlyContributionUSD * 6;
        const sharesPurchased = sixMonthContribution / discountedStockPrice;
        totalSharesOwned += sharesPurchased;
      }
      
      // Calculate current value based on shares owned
      totalSharesValue = totalSharesOwned * currentStockPrice;
      const gainLoss = totalSharesValue - (totalSharesOwned * discountedStockPrice);
      const gainLossPercentage = totalSharesOwned > 0 ? (gainLoss / (totalSharesOwned * discountedStockPrice)) * 100 : 0;
      
      projection.push({
        month,
        contribution: monthlyContributionUSD,
        cumulativeContribution,
        sharesCanBuy: totalSharesOwned,
        currentValue: totalSharesValue,
        gainLoss,
        gainLossPercentage
      });
    }
    
    return projection;
  }
  
  private static getMonthsDifference(date1: Date, date2: Date): number {
    const yearDiff = date2.getFullYear() - date1.getFullYear();
    const monthDiff = date2.getMonth() - date1.getMonth();
    return yearDiff * 12 + monthDiff;
  }
}
