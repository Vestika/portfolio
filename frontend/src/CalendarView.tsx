import React from 'react';
import { Calendar } from './components/ui/calendar';

export interface CalendarViewDataItem {
  symbol: string;
  name: string;
  value: number;
  start_date?: string;
  end_date?: string;
  single_date?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'annually';
  frequency_start?: string;
}

interface CalendarViewProps {
  title: string;
  data: CalendarViewDataItem[];
  baseCurrency: string;
  hideValues?: boolean;
  getSymbolName?: (symbol: string) => string;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  title,
  data,
  baseCurrency,
  hideValues = false,
  getSymbolName
}) => {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  // Format number with comma separators and no decimal
  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(value);

  // Helper to get display name for a symbol
  const getDisplayName = (symbol: string): string => {
    if (getSymbolName) {
      return getSymbolName(symbol);
    }
    return symbol;
  };

  // Helper to check if date matches (ignoring time)
  const isSameDate = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Helper to normalize date to midnight for comparison
  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Generate marked dates from data
  const markedDates: Array<{
    date: Date;
    label: string;
    type: 'single' | 'range-start' | 'range-end' | 'range-middle' | 'frequency';
    symbol?: string;
    value?: number;
  }> = [];

  const today = normalizeDate(new Date());
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  data.forEach(item => {
    const displayName = getDisplayName(item.symbol);
    const valueLabel = hideValues ? '' : ` (${formatNumber(item.value)} ${baseCurrency})`;
    
    // Handle single dates
    if (item.single_date) {
      const markedDate = normalizeDate(new Date(item.single_date));
      markedDates.push({
        date: markedDate,
        label: `${displayName}${valueLabel}`,
        type: 'single',
        symbol: item.symbol,
        value: item.value
      });
    }
    
    // Handle date ranges
    else if (item.start_date && item.end_date) {
      const start = normalizeDate(new Date(item.start_date));
      const end = normalizeDate(new Date(item.end_date));
      
      // Add start date
      markedDates.push({
        date: start,
        label: `${displayName} - Start${valueLabel}`,
        type: 'range-start',
        symbol: item.symbol,
        value: item.value
      });
      
      // Add middle dates
      const current = new Date(start);
      current.setDate(current.getDate() + 1);
      while (current < end) {
        markedDates.push({
          date: new Date(current),
          label: `${displayName} - In Progress${valueLabel}`,
          type: 'range-middle',
          symbol: item.symbol,
          value: item.value
        });
        current.setDate(current.getDate() + 1);
      }
      
      // Add end date
      markedDates.push({
        date: end,
        label: `${displayName} - End${valueLabel}`,
        type: 'range-end',
        symbol: item.symbol,
        value: item.value
      });
    }
    
    // Handle frequency-based dates (show recurring events)
    else if (item.frequency) {
      const start = item.frequency_start ? normalizeDate(new Date(item.frequency_start)) : today;
      
      // For daily frequency, we need to start from the beginning of the visible period
      const visibleStart = new Date(today);
      visibleStart.setDate(1); // Start of current month
      
      // Find the first occurrence on or after the visible start
      const current = new Date(start);
      
      // Move current to the first occurrence in the visible period
      if (current < visibleStart) {
        switch (item.frequency) {
          case 'daily':
            // For daily, just start from visible start
            current.setTime(visibleStart.getTime());
            break;
          case 'weekly':
            // Find next occurrence after visible start
            while (current < visibleStart) {
              current.setDate(current.getDate() + 7);
            }
            break;
          case 'monthly':
            while (current < visibleStart) {
              current.setMonth(current.getMonth() + 1);
            }
            break;
          case 'quarterly':
            while (current < visibleStart) {
              current.setMonth(current.getMonth() + 3);
            }
            break;
          case 'yearly':
          case 'annually':
            while (current < visibleStart) {
              current.setFullYear(current.getFullYear() + 1);
            }
            break;
        }
      }
      
      // Generate occurrences for the visible period
      while (current <= threeMonthsLater) {
        markedDates.push({
          date: normalizeDate(new Date(current)),
          label: `${displayName} - ${item.frequency}${valueLabel}`,
          type: 'frequency',
          symbol: item.symbol,
          value: item.value
        });
        
        // Increment based on frequency
        switch (item.frequency) {
          case 'daily':
            current.setDate(current.getDate() + 1);
            break;
          case 'weekly':
            current.setDate(current.getDate() + 7);
            break;
          case 'monthly':
            current.setMonth(current.getMonth() + 1);
            break;
          case 'quarterly':
            current.setMonth(current.getMonth() + 3);
            break;
          case 'yearly':
          case 'annually':
            current.setFullYear(current.getFullYear() + 1);
            break;
          default:
            current.setDate(current.getDate() + 1);
        }
      }
    }
  });

  return (
    <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg">
      {title && (
        <div className="p-4 border-b border-gray-600/30">
          <h3 className="text-lg font-medium text-white">{title}</h3>
        </div>
      )}
      
      <Calendar
        mode="multiple"
        numberOfMonths={2}
        markedDates={markedDates}
        className="bg-transparent"
        onDateClick={(date) => {
          // Toggle selection - if same date clicked again, deselect
          if (selectedDate && isSameDate(selectedDate, date)) {
            setSelectedDate(null);
          } else {
            setSelectedDate(date);
          }
        }}
      />
      
      {/* Holdings List - Only show when a date is selected */}
      {selectedDate && (() => {
        const holdingsOnDate = markedDates
          .filter(m => isSameDate(m.date, selectedDate))
          .map(m => {
            const item = data.find(d => d.symbol === m.symbol);
            return { markedDate: m, item };
          })
          .filter(({ item }) => item !== undefined);

        if (holdingsOnDate.length === 0) return null;

        return (
          <div className="p-4 border-t border-gray-600/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-300">
                Holdings on {selectedDate.toLocaleDateString()}
              </h4>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {holdingsOnDate.map(({ markedDate, item }, index) => (
                <div key={index} className="flex items-center justify-between text-sm bg-gray-700/20 rounded-lg p-2">
                  <div className="flex-1">
                    <div className="font-medium text-white">{getDisplayName(item!.symbol)}</div>
                    <div className="text-xs text-gray-400">
                      {markedDate.type === 'single' && 'Single Date Event'}
                      {markedDate.type === 'range-start' && 'Range Start'}
                      {markedDate.type === 'range-end' && 'Range End'}
                      {markedDate.type === 'range-middle' && 'In Range'}
                      {markedDate.type === 'frequency' && `Recurring: ${item!.frequency}`}
                    </div>
                  </div>
                  {!hideValues && (
                    <div className="text-blue-400 font-medium ml-4">
                      {formatNumber(item!.value)} {baseCurrency}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CalendarView;

