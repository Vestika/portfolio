import React from 'react';

interface VestingEvent {
  date: string;
  units: number;
}

interface RSUVestingPlan {
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
  price?: number;
  price_currency?: string;
  total_value?: number;
  vested_value?: number;
  unvested_value?: number;
}

interface RSUVestingTimelineProps {
  plan: RSUVestingPlan;
}

const RSUVestingTimeline: React.FC<RSUVestingTimelineProps> = ({ plan }) => {
  const percentVested = plan.total_units > 0 ? (plan.vested_units / plan.total_units) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Vested</span>
        <span className="text-xs font-medium">
          {plan.vested_units} / {plan.total_units} units
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${percentVested}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-muted-foreground">Grant: {plan.grant_date}</span>
        <span className="text-muted-foreground">Cliff: {plan.cliff_months}m</span>
        <span className="text-muted-foreground">Period: {plan.vesting_period_years}y</span>
        <span className="text-muted-foreground">Freq: {plan.vesting_frequency}</span>
      </div>
      {plan.next_vest_date && (
        <div className="text-xs mt-1">
          <span className="font-medium text-green-700">Next Vest:</span> {plan.next_vest_date} ({plan.next_vest_units} units)
        </div>
      )}
      {/* Value summary */}
      {typeof plan.price === 'number' && plan.price > 0 && (
        <div className="mt-2 text-xs space-y-1">
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-200">Vested Value:</span>{' '}
            <span className="font-mono">{plan.vested_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {plan.price_currency}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-200">Unvested Value:</span>{' '}
            <span className="font-mono">{plan.unvested_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {plan.price_currency}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-200">Total Potential:</span>{' '}
            <span className="font-mono">{plan.total_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {plan.price_currency}</span>
          </div>
          <div className="text-gray-400">@ {plan.price} {plan.price_currency} per share</div>
        </div>
      )}
      <div className="mt-2">
        <div className="flex flex-row items-center gap-1 overflow-x-auto">
          {plan.schedule.map((event, idx) => (
            <div key={idx} className="flex flex-col items-center mx-1">
              <div
                className={`w-2 h-6 rounded-full ${new Date(event.date) <= new Date() ? 'bg-green-500' : 'bg-gray-300'}`}
                title={`${event.date}: ${event.units} units`}
              />
              <span className="text-[10px] mt-1 text-center whitespace-nowrap">{event.date.slice(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RSUVestingTimeline; 