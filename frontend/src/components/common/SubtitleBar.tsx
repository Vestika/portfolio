import React, { ReactNode } from 'react';

interface SubtitleBarProps {
  /** Offset from top in pixels for sticky positioning (e.g., "77px", "114px") */
  topOffset?: string;
  /** Child components to render inside the bar (typically MetricChip components) */
  children: ReactNode;
  /** Optional z-index for the sticky bar */
  zIndex?: number;
}

/**
 * A sticky subtitle/metrics bar that appears below the header.
 * Used across multiple views to display contextual metrics and information.
 */
export function SubtitleBar({ 
  topOffset = '77px', 
  children,
  zIndex = 20 
}: SubtitleBarProps) {
  return (
    <div 
      className="sticky bg-gray-800 border-t border-b border-gray-700" 
      style={{ top: topOffset, zIndex }}
    >
      <div className="container mx-auto flex flex-nowrap items-center gap-2 sm:gap-4 py-1.5 px-2 sm:px-4 overflow-x-auto scroll-smooth scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

interface MetricChipProps {
  /** Icon element to display (e.g., <Wallet size={14} />) */
  icon?: ReactNode;
  /** Label text for the metric */
  label?: string;
  /** Value to display (can be string, number, or ReactNode for complex content) */
  value?: ReactNode;
  /** Color variant for the value text */
  valueColor?: string;
  /** Color variant for the icon */
  iconColor?: string;
  /** Optional action buttons or additional content */
  action?: ReactNode;
  /** Optional title for hover tooltip */
  title?: string;
  /** Optional onClick handler */
  onClick?: () => void;
  /** Optional custom className for the chip */
  className?: string;
}

/**
 * Individual metric chip component for use within SubtitleBar.
 * Displays an icon, label, and value in a consistent style.
 */
export function MetricChip({
  icon,
  label,
  value,
  valueColor = 'text-blue-400',
  iconColor = 'text-blue-400',
  action,
  title,
  onClick,
  className = '',
}: MetricChipProps) {
  return (
    <div
      className={`flex items-center bg-gray-700 rounded-full px-3 py-1 flex-shrink-0 whitespace-nowrap ${onClick ? 'cursor-pointer hover:bg-gray-600' : ''} ${className}`}
      title={title}
      onClick={onClick}
    >
      {icon && <span className={`${iconColor} ${(label || value) ? 'mr-1.5' : ''}`}>{icon}</span>}
      {label && <span className="text-xs font-medium mr-1">{label}</span>}
      {value !== undefined && value !== null && <span className={`text-xs ${valueColor}`}>{value}</span>}
      {action}
    </div>
  );
}

/**
 * Spacer component to push content to the right side of the subtitle bar
 */
export function SubtitleBarSpacer() {
  return <div className="flex-1" />;
}

