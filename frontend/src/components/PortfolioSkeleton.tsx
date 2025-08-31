export function PortfolioHeaderSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 animate-pulse">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-48 bg-gray-800 rounded" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-gray-800 rounded" />
            <div className="h-8 w-8 bg-gray-800 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-16 bg-gray-800 rounded" />
          <div className="h-16 bg-gray-800 rounded" />
          <div className="h-16 bg-gray-800 rounded" />
          <div className="h-16 bg-gray-800 rounded" />
        </div>
      </div>
    </div>
  )
}

// Pie Chart Skeleton - mimics the actual pie chart size and layout
export function PieChartSkeleton() {
  return (
    <div className="bg-gray-800/30 rounded-lg p-4 animate-pulse">
      {/* Title */}
      <div className="h-6 w-48 bg-gray-700 rounded mb-4" />
      
      {/* Chart Container - matches Highcharts container */}
      <div className="relative h-80 w-full flex items-center justify-center">
        {/* Pie Chart Area - centered like actual chart */}
        <div className="w-64 h-64 bg-gray-700 rounded-full" />
        
        {/* Legend Area - positioned on the right like Highcharts */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-32 space-y-3">
          <div className="h-4 bg-gray-700 rounded w-24" />
          <div className="h-4 bg-gray-700 rounded w-20" />
          <div className="h-4 bg-gray-700 rounded w-28" />
          <div className="h-4 bg-gray-700 rounded w-16" />
          <div className="h-4 bg-gray-700 rounded w-22" />
        </div>
      </div>
    </div>
  )
}

// RSU Timeline Chart Skeleton - mimics the actual timeline chart structure
export function RSUTimelineChartSkeleton() {
  return (
    <div className="bg-gray-800/30 rounded-lg p-4 animate-pulse">
      {/* Title - positioned top left */}
      <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
      
      {/* Chart Container */}
      <div className="h-80 w-full flex items-center justify-center">
        {/* Solid Gauge - centered like actual component */}
        <div className="w-64 h-64 bg-gray-700 rounded-full relative">
          <div className="absolute inset-12 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// Options Vesting Chart Skeleton
export function OptionsVestingChartSkeleton() {
  return (
    <div className="bg-gray-800/30 rounded-lg p-4 animate-pulse">
      {/* Title */}
      <div className="h-6 w-40 bg-gray-700 rounded mb-4" />
      
      {/* Options Plans */}
      <div className="space-y-4">
        <div className="border rounded-lg p-4 bg-gray-700/20">
          <div className="h-5 w-32 bg-gray-700 rounded mb-3" />
          <div className="h-4 bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-3" />
          <div className="h-20 bg-gray-700 rounded" />
        </div>
        <div className="border rounded-lg p-4 bg-gray-700/20">
          <div className="h-5 w-28 bg-gray-700 rounded mb-3" />
          <div className="h-4 bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-700 rounded w-5/6 mb-3" />
          <div className="h-20 bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  )
}

// Holdings Table Skeleton - matches actual table structure
export function HoldingsTableSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      {/* Header with title and view toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-40 bg-gray-800 rounded" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-gray-800 rounded" />
          <div className="h-9 w-20 bg-gray-800 rounded" />
        </div>
      </div>
      
      {/* Table Container */}
      <div className="border border-blue-400/30 rounded-md overflow-hidden">
        {/* Table Header */}
        <div className="h-14 bg-blue-500/10 backdrop-blur-sm border-b border-blue-400/30 px-4">
          <div className="grid grid-cols-7 gap-4 h-full items-center">
            <div className="h-4 bg-gray-700 rounded w-8" />
            <div className="h-4 bg-gray-700 rounded w-16" />
            <div className="h-4 bg-gray-700 rounded w-20" />
            <div className="h-4 bg-gray-700 rounded w-16 hidden md:block" />
            <div className="h-4 bg-gray-700 rounded w-16 hidden md:block" />
            <div className="h-4 bg-gray-700 rounded w-20" />
            <div className="h-4 bg-gray-700 rounded w-16 hidden md:block" />
          </div>
        </div>
        
        {/* Table Rows */}
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="h-16 border-b border-blue-400/30 px-4">
            <div className="grid grid-cols-7 gap-4 h-full items-center">
              <div className="h-4 bg-gray-700 rounded w-8" />
              <div className="h-4 bg-gray-700 rounded w-16" />
              <div className="h-4 bg-gray-700 rounded w-24" />
              <div className="h-4 bg-gray-700 rounded w-32 hidden md:block" />
              <div className="h-4 bg-gray-700 rounded w-20 hidden md:block" />
              <div className="h-4 bg-gray-700 rounded w-20" />
              <div className="h-4 bg-gray-700 rounded w-16 hidden md:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Holdings Heatmap Skeleton - matches actual heatmap size
export function HoldingsHeatmapSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-40 bg-gray-800 rounded" />
        <div className="h-9 w-20 bg-gray-800 rounded" />
      </div>
      
      {/* Heatmap Container - matches actual size */}
      <div className="w-full border border-blue-400/30 rounded-md overflow-hidden">
        <div className="h-96 bg-gray-800/50 flex items-center justify-center">
          {/* Grid-like pattern to mimic treemap */}
          <div className="grid grid-cols-4 grid-rows-4 gap-1 w-full h-full p-4">
            {[...Array(16)].map((_, idx) => (
              <div key={idx} className="bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Portfolio Skeleton - combines all chart types
export function PortfolioMainSkeleton() {
  return (
    <div className="container mx-auto py-4 px-2 sm:px-4 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
        {/* Pie Charts - typically 4 charts (Asset Allocation, Account Distribution, etc.) */}
        {[...Array(4)].map((_, idx) => (
          <PieChartSkeleton key={`pie-${idx}`} />
        ))}
        
        {/* RSU Timeline Charts - typically 1-2 RSU plans */}
        {[...Array(2)].map((_, idx) => (
          <RSUTimelineChartSkeleton key={`rsu-${idx}`} />
        ))}
      </div>
      
      {/* Holdings Table Skeleton - only one table */}
      <HoldingsTableSkeleton />
    </div>
  )
}

// Individual chart type skeletons for specific use cases
export function ChartGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
      {[...Array(6)].map((_, idx) => (
        <div key={idx} className="bg-gray-800/30 rounded-lg p-4 animate-pulse">
          <div className="h-6 w-40 bg-gray-700 rounded mb-4" />
          <div className="h-80 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  )
}

// Loading state for when switching between views
export function ViewTransitionSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[400px] animate-pulse">
      <div className="text-center">
        <div className="w-12 h-12 bg-gray-700 rounded-full mx-auto mb-4" />
        <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-700 rounded w-24" />
      </div>
    </div>
  )
}

// ManageTagsView Skeleton
export function ManageTagsViewSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-700 rounded" />
            <div className="h-8 w-48 bg-gray-700 rounded" />
          </div>
          <div className="h-10 w-32 bg-gray-700 rounded" />
        </div>
        <div className="h-4 w-96 bg-gray-700 rounded" />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, idx) => (
          <div key={idx} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
            <div className="h-6 w-24 bg-gray-700 rounded mb-2" />
            <div className="h-8 w-16 bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Tag Definitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-32 bg-gray-700 rounded" />
              <div className="flex gap-2">
                <div className="w-6 h-6 bg-gray-700 rounded" />
                <div className="w-6 h-6 bg-gray-700 rounded" />
              </div>
            </div>
            <div className="h-4 w-full bg-gray-700 rounded mb-2" />
            <div className="h-4 w-3/4 bg-gray-700 rounded mb-3" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-700 rounded" />
              <div className="h-6 w-20 bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// AIChatView Skeleton
export function AIChatViewSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-165px)] px-2 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-700 rounded" />
          <div className="h-8 w-48 bg-gray-700 rounded" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 bg-gray-800/30 rounded-lg border border-gray-700 p-4">
        <div className="h-full flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 space-y-4 mb-4">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className={`flex ${idx % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-xs lg:max-w-md ${idx % 2 === 0 ? 'bg-gray-700' : 'bg-blue-600'} rounded-lg p-3`}>
                  <div className="h-4 w-full bg-gray-600 rounded mb-1" />
                  <div className="h-4 w-3/4 bg-gray-600 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <div className="flex-1 h-12 bg-gray-700 rounded-lg" />
            <div className="w-12 h-12 bg-gray-700 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

// NewsView Skeleton
export function NewsViewSkeleton() {
  return (
    <div className="flex gap-6 p-4 animate-pulse">
      {/* Sidebar */}
      <aside className="w-80 shrink-0">
        <div className="sticky top-20">
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
            <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="h-4 bg-gray-700 rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <div className="h-8 w-48 bg-gray-700 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
              <div className="w-full h-40 bg-gray-700 rounded mb-3" />
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-700 rounded w-full mb-1" />
              <div className="h-3 bg-gray-700 rounded w-5/6" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}


