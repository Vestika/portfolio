import {
  PieChart,
  ArrowRightLeft,
  Newspaper,
  Bot,
  Tags,
  Wrench,
  Library,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NavigationView, viewToPath, pathToView } from './TopBar'
import { useMixpanel } from '../../contexts/MixpanelContext'

interface FooterProps {
  activeView?: NavigationView
  onViewChange?: (view: NavigationView) => void
}

// All navigation items for footer (mobile only)
// Arranged in 2 rows: 3 items per row for better mobile UX
const footerNavItems = [
  // First row - most commonly used
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
  // Second row
  {
    id: 'analyst' as NavigationView,
    label: 'Analyst',
    icon: <Bot className="h-5 w-5" />,
  },
  {
    id: 'tags' as NavigationView,
    label: 'Tags',
    icon: <Tags className="h-5 w-5" />,
  },
  {
    id: 'tools' as NavigationView,
    label: 'Tools',
    icon: <Wrench className="h-5 w-5" />,
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

  return (
    <footer className="md:hidden fixed bottom-0 left-0 right-0 w-full max-w-full bg-black border-t border-gray-800 z-50 safe-area-inset-bottom overflow-x-hidden">
      <nav className="flex flex-col px-2 py-2 w-full max-w-full">
        {/* First row - 3 items */}
        <div className="flex items-center justify-around w-full">
          {footerNavItems.slice(0, 3).map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 px-2 py-2 flex-1 max-w-[33.33%] min-w-0 transition-all duration-200 border-none bg-transparent focus:outline-none focus:ring-0 active:outline-none ${
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
        </div>
        {/* Second row - 3 items */}
        <div className="flex items-center justify-around w-full">
          {footerNavItems.slice(3, 6).map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 px-2 py-2 flex-1 max-w-[33.33%] min-w-0 transition-all duration-200 border-none bg-transparent focus:outline-none focus:ring-0 active:outline-none ${
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
        </div>
      </nav>
    </footer>
  )
}

// Export desktop-only items for use in TopBar
export { desktopOnlyNavItems }

