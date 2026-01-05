import {
  PieChart,
  ArrowRightLeft,
  Newspaper,
  Bot,
  Tags,
  Wrench,
  Library,
  MoreHorizontal,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NavigationView, viewToPath, pathToView } from './TopBar'
import { useMixpanel } from '../../contexts/MixpanelContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

interface FooterProps {
  activeView?: NavigationView
  onViewChange?: (view: NavigationView) => void
}

// Primary navigation items (shown directly in footer)
const primaryNavItems = [
  {
    id: 'portfolios' as NavigationView,
    label: 'Portfolio',
    icon: <PieChart className="h-5 w-5" />,
  },
  {
    id: 'cashflow' as NavigationView,
    label: 'Cash Flow',
    icon: <ArrowRightLeft className="h-5 w-5" />,
  },
  {
    id: 'news' as NavigationView,
    label: 'News',
    icon: <Newspaper className="h-5 w-5" />,
  },
  {
    id: 'analyst' as NavigationView,
    label: 'Analyst',
    icon: <Bot className="h-5 w-5" />,
  },
]

// Secondary navigation items (shown in "More" menu)
const moreNavItems = [
  {
    id: 'tags' as NavigationView,
    label: 'Tags',
    icon: <Tags className="h-4 w-4" />,
  },
  {
    id: 'tools' as NavigationView,
    label: 'Tools',
    icon: <Wrench className="h-4 w-4" />,
  },
]

// Config is desktop-only (hidden on mobile)
const desktopOnlyNavItems = [
  {
    id: 'config-gallery' as NavigationView,
    label: 'Extension Configs',
    icon: <Library className="h-4 w-4" />,
  },
]

export function Footer({ activeView: propActiveView, onViewChange }: FooterProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { track } = useMixpanel()

  // Derive active view from URL, fallback to prop
  const activeView: NavigationView = pathToView[location.pathname] || propActiveView || 'portfolios'

  const handleNavClick = (view: NavigationView) => {
    // Mixpanel: Track navigation view change
    track('navigation_view_changed', {
      from_view: activeView,
      to_view: view,
      is_mobile: true,
      source: 'footer',
    })

    navigate(viewToPath[view])
    onViewChange?.(view)
  }

  // Check if any item in "More" menu is active
  const isMoreMenuActive = moreNavItems.some(item => activeView === item.id)

  return (
    <footer className="md:hidden fixed bottom-0 left-0 right-0 w-full max-w-full bg-black border-t border-gray-800 z-50 safe-area-inset-bottom overflow-x-hidden">
      <nav className="flex items-center justify-around px-1 py-2 w-full max-w-full">
        {/* Primary navigation items */}
        {primaryNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`relative flex flex-col items-center justify-center gap-1 px-1 py-1 flex-1 min-w-0 transition-all duration-200 border-none bg-transparent focus:outline-none focus:ring-0 active:outline-none ${
              activeView === item.id
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
            aria-label={item.label}
          >
            <span className={`flex items-center justify-center transition-transform ${
              activeView === item.id ? 'scale-110' : ''
            }`}>
              {item.icon}
            </span>
            <span className="text-xs font-medium">{item.label}</span>
            {activeView === item.id && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
            )}
          </button>
        ))}

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`relative flex flex-col items-center justify-center gap-1 px-1 py-1 flex-1 min-w-0 transition-all duration-200 border-none bg-transparent focus:outline-none focus:ring-0 active:outline-none ${
                isMoreMenuActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              aria-label="More"
            >
              <span className={`flex items-center justify-center transition-transform ${
                isMoreMenuActive ? 'scale-110' : ''
              }`}>
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium">More</span>
              {isMoreMenuActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="bg-gray-900 border-gray-700 min-w-[160px]"
          >
            {moreNavItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-2 cursor-pointer ${
                  activeView === item.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </footer>
  )
}

// Export desktop-only items for use in TopBar
export { desktopOnlyNavItems }

