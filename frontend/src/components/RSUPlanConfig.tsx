import React, { useRef, useEffect } from 'react';
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
import { SymbolAutocomplete } from './ui/autocomplete';
import { SymbolSuggestion } from '../hooks/useSymbolAutocomplete';

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
  const symbolInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus symbol field when plan is new (empty symbol) and not collapsed
  useEffect(() => {
    if (!plan.symbol && !isCollapsed && symbolInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        symbolInputRef.current?.focus();
      }, 100);
    }
  }, [plan.symbol, isCollapsed]);

  const updatePlan = (updates: Partial<RSUPlan>) => {
    onChange({ ...plan, ...updates });
  };

  const handleSymbolSelect = (suggestion: SymbolSuggestion) => {
    // Extract the clean symbol (without exchange prefix)
    let symbol = suggestion.symbol;
    
    // Remove exchange prefixes for display/storage
    if (symbol.toUpperCase().startsWith('NYSE:')) {
      symbol = symbol.substring(5);
    } else if (symbol.toUpperCase().startsWith('NASDAQ:')) {
      symbol = symbol.substring(7);
    } else if (symbol.toUpperCase().startsWith('TASE:')) {
      symbol = symbol.substring(5);
    } else if (symbol.toUpperCase().startsWith('FX:')) {
      symbol = symbol.substring(3);
    }
    
    // Remove -USD suffix for crypto if present
    if (suggestion.symbol_type === 'crypto' && symbol.endsWith('-USD')) {
      symbol = symbol.replace('-USD', '');
    }
    
    updatePlan({ symbol: symbol.toUpperCase() });
  };

  const handleAddCustomSymbol = (searchTerm: string) => {
    updatePlan({ symbol: searchTerm.toUpperCase() });
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
            <SymbolAutocomplete
              ref={symbolInputRef}
              placeholder="e.g., AAPL"
              value={plan.symbol}
              onSelect={handleSymbolSelect}
              onClose={() => {}}
              onAddCustom={handleAddCustomSymbol}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="units">Number of Shares</Label>
            <Input
              id="units"
              type="number"
              min="0"
              step="1"
              value={plan.units === 0 ? '' : plan.units}
              onChange={(e) => updatePlan({ units: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
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