// React is not needed for JSX in modern React
import { Search } from 'lucide-react'

export function ExploreView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-2">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">
          <Search className="h-16 w-16 mx-auto text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Explore Markets</h2>
        <p className="text-gray-300 mb-6">
          Discover new investment opportunities, market trends, and financial insights.
        </p>
        <div className="text-left space-y-2 text-sm text-gray-400 bg-gray-800 p-4 rounded-lg">
          <p className="font-medium text-white mb-2">Coming Soon:</p>
          <p>• Market analysis and trends</p>
          <p>• Stock screener and filters</p>
          <p>• Investment recommendations</p>
          <p>• News and market insights</p>
        </div>
      </div>
    </div>
  )
}