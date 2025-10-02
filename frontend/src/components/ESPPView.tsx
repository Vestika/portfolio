import React from 'react';
import { ESPPPlan } from '../types';
import ESPPAnalysis from './ESPPAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, PieChart, Settings } from 'lucide-react';

interface ESPPViewProps {
  esppPlans: ESPPPlan[];
  onEditPlan?: (plan: ESPPPlan) => void;
}

const ESPPView: React.FC<ESPPViewProps> = ({ esppPlans, onEditPlan }) => {

  if (esppPlans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            ESPP Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No ESPP plans found. Add an ESPP plan to your account to see analysis and projections.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Since we only support one ESPP plan per portfolio, we'll show the first one
  const plan = esppPlans[0];

  return (
    <div className="space-y-6">
      {/* Plan Selection Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              ESPP Analysis - {plan.symbol}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {plan.income_percentage}% of {plan.base_salary.toLocaleString()} ILS
              </Badge>
              {onEditPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditPlan(plan)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Plan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Stock Symbol</div>
              <div className="font-semibold">{plan.symbol}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Base Salary</div>
              <div className="font-semibold">{plan.base_salary.toLocaleString()} ILS</div>
            </div>
            <div>
              <div className="text-muted-foreground">Contribution Rate</div>
              <div className="font-semibold">{plan.income_percentage}%</div>
            </div>
            <div>
              <div className="text-muted-foreground">Stock Discount</div>
              <div className="font-semibold">{plan.stock_discount_percentage}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESPP Analysis */}
      <ESPPAnalysis plan={plan} />
    </div>
  );
};

export default ESPPView;
