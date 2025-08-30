export function PortfolioHeaderSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 animate-pulse">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="h-10 w-64 bg-gray-800 rounded" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-36 bg-gray-800 rounded" />
            <div className="h-10 w-10 bg-gray-800 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
        </div>
      </div>
    </div>
  )
}

export function PortfolioMainSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="bg-gray-800 rounded-lg p-4">
            <div className="h-5 w-40 bg-gray-700 rounded mb-4" />
            <div className="h-32 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}


