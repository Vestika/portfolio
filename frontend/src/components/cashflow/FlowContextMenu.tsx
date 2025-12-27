// Context menu for right-clicking on Sankey flow links

import { useEffect, useRef } from 'react'
import { Edit3, GitBranch, Trash2 } from 'lucide-react'
import type { SankeyLinkInfo } from '../../types/cashflow'

interface FlowContextMenuProps {
  position: { x: number; y: number } | null
  linkInfo: SankeyLinkInfo | null
  onClose: () => void
  onEdit: (linkInfo: SankeyLinkInfo) => void
  onSplit: (linkInfo: SankeyLinkInfo) => void
  onDelete: (linkInfo: SankeyLinkInfo) => void
}

export function FlowContextMenu({
  position,
  linkInfo,
  onClose,
  onEdit,
  onSplit,
  onDelete,
}: FlowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!position) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [position, onClose])

  if (!position || !linkInfo) return null

  // Adjust position to keep menu in viewport
  const menuWidth = 180
  const menuHeight = 140
  const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - 10)
  const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - 10)

  const handleEdit = () => {
    onEdit(linkInfo)
    onClose()
  }

  const handleSplit = () => {
    onSplit(linkInfo)
    onClose()
  }

  const handleDelete = () => {
    onDelete(linkInfo)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="text-xs text-gray-400 truncate">
          {linkInfo.from} → {linkInfo.to}
        </div>
        <div className="text-sm text-white font-medium">
          {linkInfo.flowItems.length} flow{linkInfo.flowItems.length !== 1 ? 's' : ''}
        </div>
      </div>

      <button
        onClick={handleEdit}
        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2 transition-colors"
      >
        <Edit3 className="w-4 h-4 text-blue-400" />
        Edit Flow
      </button>

      <button
        onClick={handleSplit}
        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2 transition-colors"
      >
        <GitBranch className="w-4 h-4 text-green-400" />
        Split Flow
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button
        onClick={handleDelete}
        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete Flow
      </button>
    </div>
  )
}
