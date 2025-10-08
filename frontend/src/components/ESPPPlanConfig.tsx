import React from 'react';
import { ESPPPlan } from '../types';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ESPPPlanConfigProps {
  plan: ESPPPlan;
  onChange: (plan: ESPPPlan) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ESPPPlanConfig: React.FC<ESPPPlanConfigProps> = ({ 
  plan, 
  onChange, 
  isCollapsed = false, 
  onToggleCollapse 
}) => {
  const updatePlan = (updates: Partial<ESPPPlan>) => {
    onChange({ ...plan, ...updates });
  };


  const updateBuyingPeriod = (index: number, field: 'start_date' | 'end_date', value: string) => {
    const updatedPeriods = plan.buying_periods.map((period, i) => 
      i === index ? { ...period, [field]: value } : period
    );
    updatePlan({ buying_periods: updatedPeriods });
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
              {plan.symbol || 'New ESPP Plan'}
            </Label>
          </div>
            <div className="text-xs text-muted-foreground">
              {plan.base_salary > 0 ? `${plan.base_salary.toLocaleString()} ILS` : 'No salary set'}
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
            <Label htmlFor="base-salary">Base Salary (ILS)</Label>
            <Input
              id="base-salary"
              type="number"
              min="0"
              step="1000"
              value={plan.base_salary}
              onChange={(e) => updatePlan({ base_salary: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 35000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="income-percentage">Income Percentage (%)</Label>
            <Input
              id="income-percentage"
              type="number"
              min="1"
              max="100"
              step="0.1"
              value={plan.income_percentage}
              onChange={(e) => updatePlan({ income_percentage: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 15"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="stock-discount">Stock Discount (%)</Label>
            <Input
              id="stock-discount"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={plan.stock_discount_percentage}
              onChange={(e) => updatePlan({ stock_discount_percentage: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 15"
            />
          </div>


          <div className="grid gap-2">
            <Label>Buying Periods</Label>
            
            <div className="space-y-2">
              {plan.buying_periods.map((period, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={period.start_date}
                      onChange={(e) => updateBuyingPeriod(index, 'start_date', e.target.value)}
                      placeholder="Start Date"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={period.end_date}
                      onChange={(e) => updateBuyingPeriod(index, 'end_date', e.target.value)}
                      placeholder="End Date"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ESPPPlanConfig; 