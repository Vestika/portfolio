// React is not needed for JSX in modern React
import { Wrench } from 'lucide-react'
import CompoundInterestTool from './CompoundInterestTool'

export function ToolsView() {
  return (
    <div className="min-h-[60vh] px-2 max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">
          <Wrench className="h-16 w-16 mx-auto text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Portfolio Tools</h2>
        <p className="text-gray-300">Advanced tools and calculators to help optimize your investment strategy.</p>
      </div>

      <div className="space-y-6">
        <div className="text-left text-sm text-gray-400 bg-gray-800 p-4 rounded-lg">
          <p className="font-medium text-white mb-2">Available Tools:</p>
          <p>• Compound interest calculator (new)</p>
          <p>• Portfolio rebalancing calculator</p>
          <p>• Asset allocation optimizer</p>
          <p>• Risk assessment tools</p>
          <p>• Tax optimization strategies</p>
          <p>• Retirement planning calculator</p>
        </div>

        <CompoundInterestTool />
      </div>
    </div>
  )
} 