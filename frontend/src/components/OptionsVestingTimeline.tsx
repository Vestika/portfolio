import React from 'react';

interface VestingEvent {
  date: string;
  units: number;
}

interface OptionsVestingPlan {
  id: string;
  symbol: string;
  total_units: number;
  vested_units: number;
  next_vest_date: string | null;
  next_vest_units: number;
  schedule: VestingEvent[];
  grant_date: string;
  cliff_months: number;
  vesting_period_years: number;
  vesting_frequency: string;
  exercise_price: number;
  strike_price: number;
  expiration_date: string;
  option_type: string;
  company_valuation?: number;
  company_valuation_date?: string;
  total_value?: number;
  vested_value?: number;
  unvested_value?: number;
}

interface OptionsVestingTimelineProps {
  plan: OptionsVestingPlan;
  baseCurrency: string;
}

const OptionsVestingTimeline: React.FC<OptionsVestingTimelineProps> = ({ plan, baseCurrency }) => {
  const percentVested = plan.total_units > 0 ? (plan.vested_units / plan.total_units) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 transition-all"
          style={{ width: `${percentVested}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-muted-foreground">Grant: {plan.grant_date}</span>
        <span className="text-muted-foreground">Cliff: {plan.cliff_months}m</span>
        <span className="text-muted-foreground">Period: {plan.vesting_period_years}y</span>
        <span className="text-muted-foreground">Freq: {plan.vesting_frequency}</span>
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-muted-foreground">Exercise: ${plan.exercise_price}</span>
        <span className="text-muted-foreground">Strike: ${plan.strike_price}</span>
        <span className="text-muted-foreground">Type: {plan.option_type.toUpperCase()}</span>
        <span className="text-muted-foreground">Expires: {plan.expiration_date}</span>
      </div>
      {plan.next_vest_date && (
        <div className="text-xs mt-1">
          <span className="font-medium text-purple-700">Next Vest:</span> {plan.next_vest_date} ({plan.next_vest_units} options)
        </div>
      )}
      <div className="mt-2">
        <div className="flex flex-row items-center gap-1 overflow-x-auto">
          {plan.schedule.map((event, idx) => (
            <div key={idx} className="flex flex-col items-center mx-1">
              <div
                className={`w-2 h-6 rounded-full ${new Date(event.date) <= new Date() ? 'bg-purple-500' : 'bg-gray-300'}`}
                title={`${event.date}: ${event.units} options`}
              />
              <span className="text-[10px] mt-1 text-center whitespace-nowrap">{event.date.slice(2)}</span>
            </div>
          ))}
        </div>
        {/* Inline value summary at the bottom of the timeline card */}
        {typeof plan.total_value === 'number' && plan.total_value > 0 && (
          <div className="flex flex-row justify-center items-center gap-4 mt-2 text-xs">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-500">Vested</span>
              <span className="font-mono font-semibold text-purple-700 dark:text-purple-400 text-xs">
                {plan.vested_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrency}
              </span>
            </div>
            {plan.unvested_value !== 0 && (
              <>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500">Unvested</span>
                  <span className="font-mono font-semibold text-yellow-700 dark:text-yellow-400 text-xs">
                    {plan.unvested_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrency}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500">Total</span>
                  <span className="font-mono font-semibold text-blue-700 dark:text-blue-400 text-xs">
                    {plan.total_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrency}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        {/* Company valuation info for private companies */}
        {plan.company_valuation && (
          <div className="mt-2 text-xs text-center">
            <span className="text-gray-500">Company Valuation: </span>
            <span className="font-semibold text-green-600">
              ${plan.company_valuation.toLocaleString()} 
              {plan.company_valuation_date && ` (${plan.company_valuation_date})`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionsVestingTimeline; 