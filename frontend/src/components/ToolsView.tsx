// React is not needed for JSX in modern React
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wrench, Calculator, BarChart3, Receipt, Target, Home, Building2, Wallet, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import CompoundInterestTool from './CompoundInterestTool'
import ScenarioComparisonTool from './ScenarioComparisonTool'
import TaxPlannerTool from './TaxPlannerTool'
import FIRECalculator from './FIRECalculator'
import { MortgageVsInvestCalculator } from './MortgageVsInvestCalculator'
import { BuyOrRentCalculator } from './BuyOrRentCalculator'
import { CashFlowCalculator } from './CashFlowCalculator'

export type ToolKey = 'tax-planner' | 'compound' | 'scenario' | 'fire' | 'mortgage-invest' | 'buy-or-rent' | 'cash-flow'

interface ToolsViewProps {
  activeTool?: ToolKey
}

const tools: Array<{ key: ToolKey; name: string; description: string; icon: LucideIcon; path: string }> = [
  { key: 'tax-planner', name: 'Tax Planner', description: 'Plan sells and estimate gains/losses', icon: Receipt, path: '/tools/tax-planner' },
  { key: 'compound', name: 'Compound Interest', description: 'Project growth with deposits and rate', icon: Calculator, path: '/tools/compound' },
  { key: 'scenario', name: 'Scenario Comparison', description: 'Compare mortgage vs investing cases', icon: BarChart3, path: '/tools/scenario' },
  { key: 'fire', name: 'FIRE Calculator', description: 'Calculate time to financial independence', icon: Target, path: '/tools/fire' },
  { key: 'mortgage-invest', name: 'Mortgage vs Invest', description: 'Pay off mortgage or invest in market?', icon: Home, path: '/tools/mortgage-invest' },
  { key: 'buy-or-rent', name: 'Buy or Rent', description: 'Buy apartment or rent and invest?', icon: Building2, path: '/tools/buy-or-rent' },
  { key: 'cash-flow', name: 'Cash Flow Calculator', description: 'Track monthly income and expenses', icon: Wallet, path: '/tools/cash-flow' }
]

export function ToolsView({ activeTool: propActiveTool }: ToolsViewProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(true)

  // Derive active tool from URL or prop
  const getActiveToolFromPath = (): ToolKey => {
    const pathMap: Record<string, ToolKey> = {
      '/tools/tax-planner': 'tax-planner',
      '/tools/compound': 'compound',
      '/tools/scenario': 'scenario',
      '/tools/fire': 'fire',
      '/tools/mortgage-invest': 'mortgage-invest',
      '/tools/buy-or-rent': 'buy-or-rent',
      '/tools/cash-flow': 'cash-flow',
    }
    return pathMap[location.pathname] || propActiveTool || 'tax-planner'
  }

  const activeTool = getActiveToolFromPath()

  const handleToolClick = (tool: typeof tools[0]) => {
    navigate(tool.path)
  }

  return (
    <div className="min-h-[60vh] px-2 max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">
          <Wrench className="h-16 w-16 mx-auto text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Portfolio Tools</h2>
        <p className="text-gray-300">Advanced tools and calculators to help optimize your investment strategy.</p>
      </div>

      <div className="flex gap-4">
        <aside className={`${collapsed ? 'w-14' : 'w-64'} shrink-0 transition-all duration-200`}>
          <div className="bg-gray-800 rounded-lg p-2 h-full">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} mb-2`}>
              {!collapsed && <div className="text-sm font-medium text-white">Tools</div>}
              <button
                className="rounded-md p-1 bg-transparent border border-transparent text-[#d1d5db] hover:text-[#ffffff]"
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>
            </div>
            <nav className="space-y-2">
              {tools.map((t) => {
                const isActive = activeTool === t.key
                const Icon = t.icon
                return (
                  <button
                    key={t.key}
                    className={`w-full rounded-md border transition-colors flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'} ${
                      isActive
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800'
                    }`}
                    onClick={() => handleToolClick(t)}
                    title={t.name}
                    aria-label={t.name}
                  >
                    <Icon className="h-5 w-5" />
                    {!collapsed && (
                      <div className="ml-3 text-left">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-gray-400">{t.description}</div>
                      </div>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          {activeTool === 'tax-planner' && <TaxPlannerTool />}
          {activeTool === 'compound' && <CompoundInterestTool />}
          {activeTool === 'scenario' && <ScenarioComparisonTool />}
          {activeTool === 'fire' && <FIRECalculator />}
          {activeTool === 'mortgage-invest' && <MortgageVsInvestCalculator />}
          {activeTool === 'buy-or-rent' && <BuyOrRentCalculator />}
          {activeTool === 'cash-flow' && <CashFlowCalculator />}
        </main>
      </div>
    </div>
  )
} 