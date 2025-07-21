// React is not needed for JSX in modern React
import { Wrench } from 'lucide-react'

export function ToolsView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-2">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">
          <Wrench className="h-16 w-16 mx-auto text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Portfolio Tools</h2>
        <p className="text-gray-300 mb-6">
          Advanced tools and calculators to help optimize your investment strategy.
        </p>
        <div className="text-left space-y-2 text-sm text-gray-400 bg-gray-800 p-4 rounded-lg">
          <p className="font-medium text-white mb-2">Available Tools:</p>
          <p>• Portfolio rebalancing calculator</p>
          <p>• Asset allocation optimizer</p>
          <p>• Risk assessment tools</p>
          <p>• Tax optimization strategies</p>
          <p>• Retirement planning calculator</p>
        </div>
      </div>
    </div>
  )
} 