import React from 'react';
import { EarningsData } from '../types';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Clock, Target } from 'lucide-react';

interface EarningsCalendarProps {
  earningsData: EarningsData[];
  symbol: string;
  compact?: boolean;
}

const EarningsCalendar: React.FC<EarningsCalendarProps> = ({ 
  earningsData, 
  symbol, 
  compact = false 
}) => {
  if (!earningsData || earningsData.length === 0) {
    return null;
  }

  // Sort by date (most recent first)
  const sortedEarnings = [...earningsData].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Get the most recent earnings for compact view
  const latestEarnings = sortedEarnings[0];
  const isUpcoming = new Date(latestEarnings.date) > new Date();

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEpsBeat = (actual?: number, estimate?: number) => {
    if (!actual || !estimate) return null;
    const beat = actual - estimate;
    const beatPercent = (beat / estimate) * 100;
    return { beat, beatPercent };
  };

  const getRevenueBeat = (actual?: number, estimate?: number) => {
    if (!actual || !estimate) return null;
    const beat = actual - estimate;
    const beatPercent = (beat / estimate) * 100;
    return { beat, beatPercent };
  };

  if (compact) {
    const epsBeat = getEpsBeat(latestEarnings.epsActual, latestEarnings.epsEstimate);
    const revenueBeat = getRevenueBeat(latestEarnings.revenueActual, latestEarnings.revenueEstimate);

    return (
      <div className="flex items-center gap-2 text-xs">
        <Calendar size={12} className="text-blue-400" />
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-gray-300">
              Q{latestEarnings.quarter} {latestEarnings.year}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              isUpcoming 
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30' 
                : 'bg-green-500/20 text-green-300 border border-green-400/30'
            }`}>
              {isUpcoming ? 'Upcoming' : 'Reported'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            {latestEarnings.epsActual && latestEarnings.epsEstimate && epsBeat && (
              <div className="flex items-center gap-1">
                <span>EPS:</span>
                <span className="font-medium text-gray-300">
                  ${latestEarnings.epsActual.toFixed(2)}
                </span>
                {epsBeat.beatPercent > 0 ? (
                  <TrendingUp size={10} className="text-green-400" />
                ) : (
                  <TrendingDown size={10} className="text-red-400" />
                )}
                <span className={`text-xs ${
                  epsBeat.beatPercent > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {epsBeat.beatPercent > 0 ? '+' : ''}{epsBeat.beatPercent.toFixed(1)}%
                </span>
              </div>
            )}
            {latestEarnings.revenueActual && latestEarnings.revenueEstimate && revenueBeat && (
              <div className="flex items-center gap-1">
                <span>Rev:</span>
                <span className="font-medium text-gray-300">
                  {formatCurrency(latestEarnings.revenueActual)}
                </span>
                {revenueBeat.beatPercent > 0 ? (
                  <TrendingUp size={10} className="text-green-400" />
                ) : (
                  <TrendingDown size={10} className="text-red-400" />
                )}
                <span className={`text-xs ${
                  revenueBeat.beatPercent > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {revenueBeat.beatPercent > 0 ? '+' : ''}{revenueBeat.beatPercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/40 border-t border-blue-400/20 p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" />
          Earnings Calendar
          <span className="text-xs text-gray-400 font-normal ml-2">
            ({earningsData.length} report{earningsData.length > 1 ? 's' : ''})
          </span>
        </h4>
      </div>
      <div className="space-y-3">
        {sortedEarnings.map((earning, index) => {
          const epsBeat = getEpsBeat(earning.epsActual, earning.epsEstimate);
          const revenueBeat = getRevenueBeat(earning.revenueActual, earning.revenueEstimate);
          const isUpcomingEarning = new Date(earning.date) > new Date();

          return (
            <div 
              key={`${earning.date}-${earning.quarter}`} 
              className="p-3 bg-gray-700/40 rounded-lg border border-gray-600/30 hover:border-blue-400/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-300">
                      Q{earning.quarter} {earning.year}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      isUpcomingEarning 
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30' 
                        : 'bg-green-500/20 text-green-300 border border-green-400/30'
                    }`}>
                      {isUpcomingEarning ? 'Upcoming' : 'Reported'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{formatDate(earning.date)}</span>
                    <span className="px-1.5 py-0.5 bg-gray-600/40 rounded text-xs">
                      {earning.hour.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EPS Section */}
                {earning.epsActual !== undefined && earning.epsEstimate !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Target size={14} />
                      <span>Earnings Per Share (EPS)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {isUpcomingEarning ? (
                        // For upcoming earnings, only show estimate
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Estimate</span>
                          <span className="font-medium text-gray-200">
                            ${earning.epsEstimate.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        // For past earnings, show actual vs estimate with beat
                        <>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Actual</span>
                            <span className="font-medium text-gray-200">
                              ${earning.epsActual.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Estimate</span>
                            <span className="text-gray-400">
                              ${earning.epsEstimate.toFixed(2)}
                            </span>
                          </div>
                          {epsBeat && (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">Beat</span>
                              <div className="flex items-center gap-1">
                                {epsBeat.beatPercent > 0 ? (
                                  <TrendingUp size={14} className="text-green-400" />
                                ) : (
                                  <TrendingDown size={14} className="text-red-400" />
                                )}
                                <span className={`font-medium ${
                                  epsBeat.beatPercent > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {epsBeat.beatPercent > 0 ? '+' : ''}{epsBeat.beatPercent.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Revenue Section */}
                {earning.revenueActual !== undefined && earning.revenueEstimate !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <DollarSign size={14} />
                      <span>Revenue</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {isUpcomingEarning ? (
                        // For upcoming earnings, only show estimate
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Estimate</span>
                          <span className="font-medium text-gray-200">
                            {formatCurrency(earning.revenueEstimate)}
                          </span>
                        </div>
                      ) : (
                        // For past earnings, show actual vs estimate with beat
                        <>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Actual</span>
                            <span className="font-medium text-gray-200">
                              {formatCurrency(earning.revenueActual)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Estimate</span>
                            <span className="text-gray-400">
                              {formatCurrency(earning.revenueEstimate)}
                            </span>
                          </div>
                          {revenueBeat && (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">Beat</span>
                              <div className="flex items-center gap-1">
                                {revenueBeat.beatPercent > 0 ? (
                                  <TrendingUp size={14} className="text-green-400" />
                                ) : (
                                  <TrendingDown size={14} className="text-red-400" />
                                )}
                                <span className={`font-medium ${
                                  revenueBeat.beatPercent > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {revenueBeat.beatPercent > 0 ? '+' : ''}{revenueBeat.beatPercent.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EarningsCalendar;
