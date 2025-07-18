import React from 'react';
import { OptionsPlan } from '../types';
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

interface OptionsPlanConfigProps {
  plan: OptionsPlan;
  onChange: (plan: OptionsPlan) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const OptionsPlanConfig: React.FC<OptionsPlanConfigProps> = ({ 
  plan, 
  onChange, 
  isCollapsed = false, 
  onToggleCollapse 
}) => {
  const updatePlan = (updates: Partial<OptionsPlan>) => {
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
              {plan.symbol || 'New Options Plan'}
            </Label>
          </div>
          <div className="text-xs text-muted-foreground">
            {plan.units > 0 ? `${plan.units} options` : 'No options'}
          </div>
        </div>
      )}

      {/* Collapsible Content */}
      {(!isCollapsed || !onToggleCollapse) && (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="symbol">Company Symbol</Label>
            <Input
              id="symbol"
              value={plan.symbol}
              onChange={(e) => updatePlan({ symbol: e.target.value.toUpperCase() })}
              placeholder="e.g., STARTUP"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="units">Number of Options</Label>
            <Input
              id="units"
              type="number"
              min="0"
              step="1"
              value={plan.units}
              onChange={(e) => updatePlan({ units: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 10000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="option-type">Option Type</Label>
            <Select 
              value={plan.option_type} 
              onValueChange={(value) => updatePlan({ option_type: value as 'iso' | 'nso' | 'eso' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select option type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">Incentive Stock Options (ISO)</SelectItem>
                <SelectItem value="nso">Non-Qualified Stock Options (NSO)</SelectItem>
                <SelectItem value="eso">Employee Stock Options (ESO)</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="grid gap-2">
            <Label htmlFor="exercise-price">Exercise Price (per share)</Label>
            <Input
              id="exercise-price"
              type="number"
              min="0"
              step="0.01"
              value={plan.exercise_price}
              onChange={(e) => updatePlan({ exercise_price: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 0.10"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="strike-price">Strike Price (per share)</Label>
            <Input
              id="strike-price"
              type="number"
              min="0"
              step="0.01"
              value={plan.strike_price}
              onChange={(e) => updatePlan({ strike_price: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 0.10"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expiration-date">Expiration Date</Label>
            <Input
              id="expiration-date"
              type="date"
              value={plan.expiration_date}
              onChange={(e) => updatePlan({ expiration_date: e.target.value })}
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

          <div className="grid gap-2">
            <Label htmlFor="company-valuation">Company Valuation (optional)</Label>
            <Input
              id="company-valuation"
              type="number"
              min="0"
              step="0.01"
              value={plan.company_valuation || ''}
              onChange={(e) => updatePlan({ 
                company_valuation: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="e.g., 1000000"
            />
          </div>

          {plan.company_valuation && (
            <div className="grid gap-2">
              <Label htmlFor="company-valuation-date">Valuation Date</Label>
              <Input
                id="company-valuation-date"
                type="date"
                value={plan.company_valuation_date || ''}
                onChange={(e) => updatePlan({ company_valuation_date: e.target.value })}
              />
            </div>
          )}

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

export default OptionsPlanConfig; 