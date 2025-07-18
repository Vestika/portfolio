import React from 'react';
import { RSUPlan } from '../types';
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

interface RSUPlanConfigProps {
  plan: RSUPlan;
  onChange: (plan: RSUPlan) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const RSUPlanConfig: React.FC<RSUPlanConfigProps> = ({ 
  plan, 
  onChange, 
  isCollapsed = false, 
  onToggleCollapse 
}) => {
  const updatePlan = (updates: Partial<RSUPlan>) => {
    onChange({ ...plan, ...updates });
  };

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
              {plan.symbol || 'New RSU Plan'}
            </Label>
          </div>
          <div className="text-xs text-muted-foreground">
            {plan.units > 0 ? `${plan.units} units` : 'No units'}
          </div>
        </div>
      )}

      {/* Collapsible Content */}
      {(!isCollapsed || !onToggleCollapse) && (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="symbol">Stock Symbol</Label>
            <Input
              id="symbol"
              value={plan.symbol}
              onChange={(e) => updatePlan({ symbol: e.target.value.toUpperCase() })}
              placeholder="e.g., AAPL"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="units">Number of Shares</Label>
            <Input
              id="units"
              type="number"
              min="0"
              step="1"
              value={plan.units}
              onChange={(e) => updatePlan({ units: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 1000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="grant-date">Grant Date</Label>
            <Input
              id="grant-date"
              type="date"
              value={plan.grant_date}
              onChange={(e) => updatePlan({ grant_date: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="has-cliff"
              checked={plan.has_cliff}
              onChange={(e) => updatePlan({ has_cliff: e.target.checked })}
              className="rounded border-border bg-background"
            />
            <Label htmlFor="has-cliff">Has Cliff Period</Label>
          </div>

          {plan.has_cliff && (
            <div className="grid gap-2">
              <Label htmlFor="cliff-duration">Cliff Duration (months)</Label>
              <Input
                id="cliff-duration"
                type="number"
                min="1"
                max="24"
                value={plan.cliff_duration_months || ''}
                onChange={(e) => updatePlan({ 
                  cliff_duration_months: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder="e.g., 12"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="vesting-period">Vesting Period</Label>
            <Select 
              value={plan.vesting_period_years.toString()} 
              onValueChange={(value) => updatePlan({ vesting_period_years: parseInt(value) as 3 | 4 })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vesting period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Years</SelectItem>
                <SelectItem value="4">4 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vesting-frequency">Vesting Frequency</Label>
            <Select 
              value={plan.vesting_frequency} 
              onValueChange={(value) => updatePlan({ vesting_frequency: value as 'monthly' | 'quarterly' | 'annually' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vesting frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="left-company"
              checked={!!plan.left_company}
              onChange={e => updatePlan({ left_company: e.target.checked, left_company_date: e.target.checked ? (plan.left_company_date || new Date().toISOString().split('T')[0]) : null })}
              className="rounded border-border bg-background"
            />
            <Label htmlFor="left-company">Left the company</Label>
          </div>
          {plan.left_company && (
            <div className="grid gap-2">
              <Label htmlFor="left-company-date">Date left</Label>
              <Input
                id="left-company-date"
                type="date"
                value={plan.left_company_date || ''}
                onChange={e => updatePlan({ left_company_date: e.target.value })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RSUPlanConfig; 