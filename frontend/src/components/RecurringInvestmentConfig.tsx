import React from 'react';
import { RecurringInvestment, RecurringFrequency, RecurringTargetType } from '../types';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight } from 'lucide-react';

interface RecurringInvestmentConfigProps {
  investment: RecurringInvestment;
  onChange: (investment: RecurringInvestment) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const RecurringInvestmentConfig: React.FC<RecurringInvestmentConfigProps> = ({
  investment,
  onChange,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const updateInvestment = (updates: Partial<RecurringInvestment>) => {
    onChange({ ...investment, ...updates });
  };

  const getFrequencyLabel = (frequency: RecurringFrequency) => {
    switch (frequency) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return 'Not set';
    }
  };

  const getSummary = () => {
    const freq = getFrequencyLabel(investment.frequency);
    if (investment.target_type === 'cash') {
      return `${investment.amount} ${investment.currency} - ${freq}`;
    }
    return `${investment.amount} ${investment.currency} to ${investment.symbol || '?'} - ${freq}`;
  };

  const showDayOfWeek = investment.frequency === 'weekly' || investment.frequency === 'biweekly';
  const showDayOfMonth = investment.frequency === 'monthly' || investment.frequency === 'quarterly' || investment.frequency === 'yearly';

  return (
    <div className="space-y-4">
      {/* Collapsible Header */}
      {onToggleCollapse && (
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-2 rounded-md -m-2"
          onClick={onToggleCollapse}
        >
          <div className="flex items-center space-x-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Label className="text-sm font-medium cursor-pointer">
              {investment.target_type === 'cash'
                ? 'Cash Deposit'
                : (investment.symbol || 'New Investment')}
            </Label>
          </div>
          <div className="text-xs text-muted-foreground">
            {getSummary()}
          </div>
        </div>
      )}

      {/* Collapsible Content */}
      {(!isCollapsed || !onToggleCollapse) && (
        <div className="space-y-4">
          {/* Target Type */}
          <div className="grid gap-2">
            <Label>Investment Type</Label>
            <Select
              value={investment.target_type}
              onValueChange={(value) => updateInvestment({
                target_type: value as RecurringTargetType,
                symbol: value === 'cash' ? undefined : investment.symbol
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="holding">Invest in Symbol</SelectItem>
                <SelectItem value="cash">Deposit to Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Symbol (only for holding type) */}
          {investment.target_type === 'holding' && (
            <div className="grid gap-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={investment.symbol || ''}
                onChange={(e) => updateInvestment({ symbol: e.target.value.toUpperCase() })}
                placeholder="e.g., AAPL"
              />
            </div>
          )}

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="any"
                value={investment.amount === 0 ? '' : investment.amount}
                onChange={(e) => updateInvestment({ amount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={investment.currency}
                onValueChange={(value) => updateInvestment({ currency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="ILS">ILS</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Frequency */}
          <div className="grid gap-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={investment.frequency}
              onValueChange={(value) => {
                const updates: Partial<RecurringInvestment> = { frequency: value as RecurringFrequency };
                // Reset day fields based on new frequency
                if (value === 'weekly' || value === 'biweekly') {
                  updates.day_of_month = null;
                  updates.day_of_week = investment.day_of_week ?? 0;
                } else {
                  updates.day_of_week = null;
                  updates.day_of_month = investment.day_of_month ?? 1;
                }
                updateInvestment(updates);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week (for weekly/biweekly) */}
          {showDayOfWeek && (
            <div className="grid gap-2">
              <Label htmlFor="day-of-week">Day of Week</Label>
              <Select
                value={(investment.day_of_week ?? 0).toString()}
                onValueChange={(value) => updateInvestment({ day_of_week: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Monday</SelectItem>
                  <SelectItem value="1">Tuesday</SelectItem>
                  <SelectItem value="2">Wednesday</SelectItem>
                  <SelectItem value="3">Thursday</SelectItem>
                  <SelectItem value="4">Friday</SelectItem>
                  <SelectItem value="5">Saturday</SelectItem>
                  <SelectItem value="6">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Month (for monthly/quarterly/yearly) */}
          {showDayOfMonth && (
            <div className="grid gap-2">
              <Label htmlFor="day-of-month">Day of Month</Label>
              <Input
                id="day-of-month"
                type="number"
                min="1"
                max="31"
                value={investment.day_of_month ?? ''}
                onChange={(e) => updateInvestment({ day_of_month: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="1-31"
              />
            </div>
          )}

          {/* Start Date */}
          <div className="grid gap-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={investment.start_date}
              onChange={(e) => updateInvestment({ start_date: e.target.value })}
            />
          </div>

          {/* End Date (optional) */}
          <div className="grid gap-2">
            <Label htmlFor="end-date">End Date (optional)</Label>
            <Input
              id="end-date"
              type="date"
              value={investment.end_date || ''}
              onChange={(e) => updateInvestment({ end_date: e.target.value || null })}
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is-active"
              checked={investment.is_active}
              onChange={(e) => updateInvestment({ is_active: e.target.checked })}
              className="rounded border-border bg-background"
            />
            <Label htmlFor="is-active">Active</Label>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={investment.description || ''}
              onChange={(e) => updateInvestment({ description: e.target.value })}
              placeholder="e.g., Monthly salary deposit"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringInvestmentConfig;
