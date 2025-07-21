import React from 'react'
import { Tags } from 'lucide-react'

export function ManageTagsView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-2">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">
          <Tags className="h-16 w-16 mx-auto text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Manage Tags</h2>
        <p className="text-gray-300 mb-6">
          Create and manage custom tags to organize and categorize your investments.
        </p>
        <div className="text-left space-y-2 text-sm text-gray-400 bg-gray-800 p-4 rounded-lg">
          <p className="font-medium text-white mb-2">Features:</p>
          <p>• Create custom investment tags</p>
          <p>• Tag your holdings and portfolios</p>
          <p>• Filter and search by tags</p>
          <p>• Tag-based performance analysis</p>
        </div>
      </div>
    </div>
  )
} 