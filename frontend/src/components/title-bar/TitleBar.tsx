import { ReactNode } from 'react';

interface TitleBarProps {
  /** Left side content - can be a title string, PortfolioSelector component, or custom element */
  leftContent: ReactNode;
  /** Subtitle text shown below the main title/selector */
  subtitle?: string;
  /** Right side content - action buttons, indicators, etc. (hidden on mobile) */
  rightContent?: ReactNode;
  /** Mobile right side content - shown on mobile instead of rightContent */
  mobileRightContent?: ReactNode;
  /** Mobile-only content - shown below main content on mobile devices */
  mobileContent?: ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * Reusable title bar component used across Portfolio, Tags, and News views.
 * 
 * Features:
 * - Sticky positioning below the top navigation bar (37px offset)
 * - Consistent styling with dark background and border
 * - Flexible left and right content areas
 * - Optional subtitle text
 */
export function TitleBar({ 
  leftContent, 
  subtitle, 
  rightContent,
  mobileRightContent,
  mobileContent,
  className = ''
}: TitleBarProps) {
  return (
    <div 
      className={`sticky z-30 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700 ${className}`}
      style={{ top: '37px' }}
    >
      <div className="container mx-auto">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            {leftContent}
            {subtitle && (
              <p className="text-sm text-gray-400 mt-0">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Desktop right content */}
          {rightContent && (
            <div className="hidden md:flex items-center space-x-4">
              {rightContent}
            </div>
          )}
          
          {/* Mobile right content */}
          {mobileRightContent && (
            <div className="flex md:hidden items-center">
              {mobileRightContent}
            </div>
          )}
        </div>
        
        {/* Mobile-only content */}
        <div className="md:hidden">
          {mobileContent}
        </div>
      </div>
    </div>
  );
}

