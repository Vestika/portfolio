// React is not needed for JSX in modern React
import { Bot } from 'lucide-react'
import AIChat from './AIChat'

export function AIChatView() {
  return (
    <div className="flex flex-col h-[calc(100vh-165px)] px-2">{/* adjust subtraction to match header heights */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-3">
          <Bot className="h-8 w-8 text-gray-400" />
          <h2 className="text-2xl font-bold text-white">AI Financial Analyst</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="h-full">
          <AIChat portfolioName="Portfolio" isOpen={true} />
        </div>
      </div>
    </div>
  )
}

export default AIChatView

