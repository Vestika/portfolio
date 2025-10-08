import React from 'react';
import { ESPPPlan } from '../types';
import ESPPAnalysis from './ESPPAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, PieChart } from 'lucide-react';

interface ESPPViewProps {
  esppPlans: ESPPPlan[];
  isValueVisible?: boolean;
}

const ESPPView: React.FC<ESPPViewProps> = ({ esppPlans, isValueVisible = true }) => {

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
    <ESPPAnalysis plan={plan} isValueVisible={isValueVisible} />
  );
};

export default ESPPView;

