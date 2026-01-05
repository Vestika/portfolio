import React from 'react'

interface IconButtonProps {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({
  onClick,
  disabled,
  children,
  className = '',
  ariaLabel
}, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`p-0 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200 hover:scale-105 w-8 h-8 flex items-center justify-center focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
    >
      {children}
    </button>
  )
})

IconButton.displayName = 'IconButton'

