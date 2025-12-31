import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<"div"> & {
  mode?: "single" | "multiple" | "range"
  selected?: Date | Date[]
  onSelect?: (date: Date | Date[] | undefined) => void
  onDateClick?: (date: Date) => void
  disabled?: (date: Date) => boolean
  month?: Date
  onMonthChange?: (month: Date) => void
  numberOfMonths?: number
  markedDates?: Array<{
    date: Date
    label: string
    type: 'single' | 'range-start' | 'range-end' | 'range-middle' | 'frequency'
    symbol?: string
    value?: number
  }>
}

function Calendar({
  className,
  mode = "single",
  selected,
  onSelect,
  onDateClick,
  disabled,
  month: controlledMonth,
  onMonthChange,
  numberOfMonths = 2,
  markedDates = [],
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(controlledMonth || new Date())

  const month = controlledMonth || currentMonth
  const setMonth = onMonthChange || setCurrentMonth

  const previousMonth = () => {
    const newMonth = new Date(month)
    newMonth.setMonth(newMonth.getMonth() - 1)
    setMonth(newMonth)
  }

  const nextMonth = () => {
    const newMonth = new Date(month)
    newMonth.setMonth(newMonth.getMonth() + 1)
    setMonth(newMonth)
  }

  const renderMonth = (monthOffset: number) => {
    const displayMonth = new Date(month)
    displayMonth.setMonth(displayMonth.getMonth() + monthOffset)
    
    const year = displayMonth.getFullYear()
    const monthIndex = displayMonth.getMonth()
    
    const firstDay = new Date(year, monthIndex, 1).getDay()
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    
    const days: (number | null)[] = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }
    
    // Add all days in month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    
    const isMarkedDate = (day: number) => {
      const date = new Date(year, monthIndex, day);
      date.setHours(0, 0, 0, 0); // Normalize to midnight for comparison
      
      return markedDates.find(m => {
        const markedDate = new Date(m.date);
        markedDate.setHours(0, 0, 0, 0); // Normalize marked date too
        
        return markedDate.getFullYear() === date.getFullYear() &&
               markedDate.getMonth() === date.getMonth() &&
               markedDate.getDate() === date.getDate();
      });
    }
    
    return (
      <div key={monthOffset} className="flex-1">
        <div className="text-sm font-medium text-white mb-2 text-center">
          {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-xs text-gray-400 font-medium h-8 flex items-center justify-center">
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-8" />
            }
            
            const markedDate = isMarkedDate(day)
            const isToday = new Date().toDateString() === new Date(year, monthIndex, day).toDateString()
            
            const dateObj = new Date(year, monthIndex, day);
            
            return (
              <button
                key={day}
                onClick={() => onDateClick?.(dateObj)}
                className={cn(
                  "h-8 flex items-center justify-center text-sm rounded-sm relative hover:bg-gray-700/50 transition-colors cursor-pointer",
                  isToday && "bg-blue-500/20 text-blue-200 font-semibold",
                  !isToday && "text-gray-300",
                  markedDate && "ring-2 ring-offset-1 ring-offset-gray-800",
                  markedDate?.type === 'single' && "ring-green-400 bg-green-500/20",
                  markedDate?.type === 'range-start' && "ring-purple-400 bg-purple-500/20",
                  markedDate?.type === 'range-end' && "ring-purple-400 bg-purple-500/20",
                  markedDate?.type === 'range-middle' && "ring-purple-400/50 bg-purple-500/10",
                  markedDate?.type === 'frequency' && "ring-yellow-400 bg-yellow-500/20"
                )}
                title={markedDate?.label}
              >
                {day}
                {markedDate && (
                  <div className={cn(
                    "absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full",
                    markedDate.type === 'single' && "bg-green-400",
                    markedDate.type === 'frequency' && "bg-yellow-400",
                    (markedDate.type === 'range-start' || markedDate.type === 'range-end' || markedDate.type === 'range-middle') && "bg-purple-400"
                  )} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("p-4", className)} {...props}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={previousMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>
        <button
          onClick={nextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>
      
      <div className="flex gap-4">
        {Array.from({ length: numberOfMonths }, (_, i) => renderMonth(i))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/20 ring-2 ring-green-400" />
          <span className="text-gray-300">Single Date</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-purple-500/20 ring-2 ring-purple-400" />
          <span className="text-gray-300">Date Range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-500/20 ring-2 ring-yellow-400" />
          <span className="text-gray-300">Recurring Event</span>
        </div>
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }

