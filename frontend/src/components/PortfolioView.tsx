// React is not needed for JSX in modern React
import PieChart from '../PieChart'
import HoldingsTable from '../HoldingsTable'
import RSUTimelineChart from './RSUTimelineChart'
import OptionsVestingTimeline from './OptionsVestingTimeline'
import {
  PortfolioMetadata,
  PortfolioFile,
  PortfolioData,
  HoldingsTableData,
} from '../types'

interface PortfolioViewProps {
  portfolioMetadata: PortfolioMetadata | null
  portfolioData: PortfolioData | null
  holdingsData: HoldingsTableData | null
  availablePortfolios: PortfolioFile[]
  isValueVisible: boolean
  mainRSUVesting: Record<string, any>
  mainOptionsVesting: Record<string, any>
}

export function PortfolioView({
  portfolioMetadata,
  portfolioData,
  holdingsData,
  availablePortfolios,
  isValueVisible,
  mainRSUVesting,
  mainOptionsVesting,
}: PortfolioViewProps) {
  const showEmptyState = availablePortfolios.length === 0
  
  // Create mock metadata for empty state to keep UI working
  const mockMetadata: PortfolioMetadata = {
    base_currency: 'USD',
    user_name: 'User',
    accounts: []
  }
  
  const displayMetadata = showEmptyState ? mockMetadata : portfolioMetadata
  const displayData = showEmptyState ? [] : portfolioData
  
  if (!displayMetadata || (!showEmptyState && !displayData)) return null

  return (
    <div className="container mx-auto py-4 px-2 sm:px-4">
      {showEmptyState ? (
        // Empty state content
        <div className="flex items-center justify-center min-h-[60vh] px-2">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-6">📊</div>
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to Your Portfolio Dashboard</h2>
            <p className="text-gray-300 mb-6">
              You don't have any portfolios yet. Create your first portfolio using the dropdown menu above to start tracking your investments.
            </p>
            <div className="text-left space-y-2 text-sm text-gray-400 bg-gray-800 p-4 rounded-lg">
              <p className="font-medium text-white mb-2">Getting Started:</p>
              <p>• Click the dropdown above to create a portfolio</p>
              <p>• Add accounts (bank, brokerage, retirement)</p>
              <p>• Track stocks, bonds, ETFs, and cash holdings</p>
              <p>• View performance analytics and breakdowns</p>
            </div>
          </div>
        </div>
      ) : (
        // Normal portfolio content
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
          {displayData && displayData.map(chart => (
            <PieChart
              key={chart.chart_title}
              title={`<b>${chart.chart_title}</b>${
                isValueVisible
                  ? ` <span class="text-xs text-gray-400 ml-1">
                      ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                        chart.chart_total
                      )}
                      (${displayMetadata.base_currency})
                      </span>`
                  : ''
              }`}
              data={chart.chart_data}
              total={chart.chart_total}
              baseCurrency={displayMetadata.base_currency}
              hideValues={!isValueVisible}
            />
          ))}
          {/* RSU Vesting grouped by symbol */}
          {(() => {
            // 1. Gather all plans with their account names
            const allPlans: Array<{ plan: any; accountName: string }> = [];
            Object.entries(mainRSUVesting).forEach(([accountName, plans]) => {
              (plans as any[]).forEach(plan => {
                allPlans.push({ plan, accountName });
              });
            });
            // 2. Group by symbol
            const grouped: Record<string, Array<{ plan: any; accountName: string }>> = {};
            allPlans.forEach(({ plan, accountName }) => {
              if (!grouped[plan.symbol]) grouped[plan.symbol] = [];
              grouped[plan.symbol].push({ plan, accountName });
            });
            // 3. Render each symbol group with the new chart component
            return Object.entries(grouped).map(([symbol, plans]) => {
              // Extract account name (all plans for the same symbol should come from the same account)
              const accountName = plans[0]?.accountName || 'Account';
              
              // Process plans to handle left company scenario
              const processedPlans = plans.map(({ plan }) => {
                let displayPlan = plan;
                if (plan.left_company && plan.left_company_date) {
                  // Find the last vested event before or on left_company_date
                  const leftDate = new Date(plan.left_company_date);
                  let vested = 0;
                  let trimmedSchedule = [];
                  if (Array.isArray(plan.schedule)) {
                    trimmedSchedule = plan.schedule.filter((event: any) => new Date(event.date) <= leftDate);
                    for (const event of trimmedSchedule as any[]) {
                      vested += event.units;
                    }
                  }
                  displayPlan = {
                    ...plan,
                    total_units: vested,
                    vested_units: vested,
                    schedule: trimmedSchedule,
                    next_vest_date: null,
                    next_vest_units: 0,
                  };
                }
                return displayPlan;
              });

              return (
                <div key={symbol} className="col-span-1 md:col-span-1">
                  <RSUTimelineChart
                    plans={processedPlans}
                    symbol={symbol}
                    accountName={accountName}
                    baseCurrency={displayMetadata.base_currency}
                  />
                </div>
              );
            });
          })()}
          
          {/* Options Vesting grouped by symbol */}
          {(() => {
            // 1. Gather all plans with their account names
            const allPlans: Array<{ plan: any; accountName: string }> = [];
            Object.entries(mainOptionsVesting).forEach(([accountName, plans]) => {
              (plans as any[]).forEach(plan => {
                allPlans.push({ plan, accountName });
              });
            });
            // 2. Group by symbol
            const grouped: Record<string, Array<{ plan: any; accountName: string }>> = {};
            allPlans.forEach(({ plan, accountName }) => {
              if (!grouped[plan.symbol]) grouped[plan.symbol] = [];
              grouped[plan.symbol].push({ plan, accountName });
            });
            // 3. Render
            return Object.entries(grouped).map(([symbol, plans]) => (
              <div key={`options-${symbol}`} className="bg-muted/30 rounded-lg p-4">
                <div className="text-base font-bold mb-2">{symbol} - Options</div>
                <div className="space-y-4">
                  {plans.map(({ plan, accountName }, idx) => {
                    let displayPlan = plan;
                    if (plan.left_company && plan.left_company_date) {
                      // Find the last vested event before or on left_company_date
                      const leftDate = new Date(plan.left_company_date);
                      let vested = 0;
                      let trimmedSchedule = [];
                      if (Array.isArray(plan.schedule)) {
                        trimmedSchedule = plan.schedule.filter((event: any) => new Date(event.date) <= leftDate);
                        for (const event of trimmedSchedule as any[]) {
                          vested += event.units;
                        }
                      }
                      displayPlan = {
                        ...plan,
                        total_units: vested,
                        vested_units: vested,
                        schedule: trimmedSchedule,
                        next_vest_date: null,
                        next_vest_units: 0,
                      };
                    }
                    return (
                      <div key={plan.id} className="border rounded-lg p-3 bg-muted/10">
                        <div className="text-sm font-semibold mb-1">
                          {accountName}
                          {plans.length > 1 && (
                            <span className="ml-2 text-xs text-gray-400">Plan {idx + 1}</span>
                          )}
                        </div>
                        <OptionsVestingTimeline
                          plan={displayPlan}
                          baseCurrency={displayMetadata.base_currency}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
      {holdingsData && !showEmptyState && (
        <div className="mt-8">
          <HoldingsTable
            data={holdingsData}
            isValueVisible={isValueVisible}
          />
        </div>
      )}
    </div>
  )
} 