// Custom React Flow Node Component for Cash Flow Diagram

import { memo } from 'react'
// import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeData } from '../types/cashflow'

// Temporary stubs until reactflow is properly installed
const Position = {
  Top: 'top' as const,
  Right: 'right' as const,
  Bottom: 'bottom' as const,
  Left: 'left' as const,
};
type NodeProps<T = any> = { data: T; id: string };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Handle = (_props: any) => <div />;
import { formatCurrency } from '../utils/cashflow-helpers'
import {
  Wallet,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
} from 'lucide-react'

/**
 * Get icon component for flow type
 */
function getFlowTypeIcon(flowType?: string) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'inflow': ArrowDownCircle,
    'outflow': ArrowUpCircle,
    'transfer': ArrowRightLeft,
  }
  return iconMap[flowType || ''] || Receipt
}

/**
 * Source Node - Left column (accounts + external income)
 */
export const SourceNode = memo(({ data }: NodeProps<FlowNodeData>) => {
  const isExternal = data.label === 'External Income'
  const Icon = isExternal ? getFlowTypeIcon('inflow') : Wallet

  return (
    <div className="relative">
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />

      <div className="bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 min-w-[180px] hover:border-gray-600 transition-colors shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5 text-gray-400" />
          <div className="text-sm font-semibold text-white truncate">{data.label}</div>
        </div>

        {!isExternal && data.balance !== undefined && (
          <div className="text-xs text-gray-400">
            {formatCurrency(data.balance, data.currency || 'USD')}
          </div>
        )}
      </div>
    </div>
  )
})
SourceNode.displayName = 'SourceNode'

/**
 * Category Node - Middle column (income/expense categories)
 */
export const CategoryNode = memo(({ data }: NodeProps<FlowNodeData>) => {
  const Icon = getFlowTypeIcon(data.flowType)

  // Color based on flow type
  const borderColor =
    data.flowType === 'inflow' ? 'border-green-500' :
    data.flowType === 'outflow' ? 'border-red-500' :
    data.flowType === 'transfer' ? 'border-blue-500' :
    'border-gray-700'

  const textColor =
    data.flowType === 'inflow' ? 'text-green-400' :
    data.flowType === 'outflow' ? 'text-red-400' :
    data.flowType === 'transfer' ? 'text-blue-400' :
    'text-gray-300'

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />

      <div className={`bg-gray-800 border-2 ${borderColor} rounded-lg px-4 py-3 min-w-[180px] hover:border-opacity-80 transition-colors shadow-lg`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${textColor}`} />
          <div className={`text-sm font-semibold ${textColor} truncate`}>{data.label}</div>
        </div>
      </div>
    </div>
  )
})
CategoryNode.displayName = 'CategoryNode'

/**
 * Destination Node - Right column (accounts + external expenses)
 */
export const DestinationNode = memo(({ data }: NodeProps<FlowNodeData>) => {
  const isExternal = data.label === 'External Expenses'
  const Icon = isExternal ? getFlowTypeIcon('outflow') : Wallet

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />

      <div className="bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 min-w-[180px] hover:border-gray-600 transition-colors shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5 text-gray-400" />
          <div className="text-sm font-semibold text-white truncate">{data.label}</div>
        </div>

        {!isExternal && data.balance !== undefined && (
          <div className="text-xs text-gray-400">
            {formatCurrency(data.balance, data.currency || 'USD')}
          </div>
        )}
      </div>
    </div>
  )
})
DestinationNode.displayName = 'DestinationNode'

// Export node types object for React Flow
export const nodeTypes = {
  source: SourceNode,
  category: CategoryNode,
  destination: DestinationNode,
}
