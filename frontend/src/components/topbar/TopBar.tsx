import {
  PieChart,
  Tags,
  Wrench,
  Bot,
  Menu,
  X,
  Newspaper,
  Library,
  ArrowRightLeft
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AboutModal } from './AboutModal'
import { NotificationBell } from './NotificationBell'
import { FeedbackModal } from './FeedbackModal'
import GoogleProfilePicture from './GoogleProfilePicture'
import { IconButton } from './IconButton'
import { useUserProfile } from '../../contexts/UserProfileContext'
import { useMixpanel } from '../../contexts/MixpanelContext'

export type NavigationView = 'portfolios' | 'cashflow' | 'news' | 'analyst' | 'tags' | 'tools' | 'config-gallery'

// Map view IDs to URL paths
const viewToPath: Record<NavigationView, string> = {
  'portfolios': '/portfolio',
  'cashflow': '/cashflow',
  'news': '/news',
  'analyst': '/analyst',
  'tags': '/tags',
  'tools': '/tools',
  'config-gallery': '/config-gallery',
}

// Map URL paths to view IDs
const pathToView: Record<string, NavigationView> = {
  '/portfolio': 'portfolios',
  '/portfolios': 'portfolios',
  '/cashflow': 'cashflow',
  '/news': 'news',
  '/analyst': 'analyst',
  '/tags': 'tags',
  '/tools': 'tools',
  '/config-gallery': 'config-gallery',
}

interface TopBarProps {
  activeView?: NavigationView // Now optional, derived from URL
  onViewChange?: (view: NavigationView) => void // Now optional
  onProfileClick?: () => void
  onFeedbackClick?: () => void
}

export function TopBar({ activeView: propActiveView, onViewChange, onProfileClick, onFeedbackClick }: TopBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const { googleProfileData } = useUserProfile()
  const { track } = useMixpanel()
  const navigate = useNavigate()
  const location = useLocation()

  // Derive active view from URL, fallback to prop
  const activeView: NavigationView = pathToView[location.pathname] || propActiveView || 'portfolios'
  
  const navigationItems = [
    {
      id: 'portfolios' as NavigationView,
      label: 'My Portfolios',
      icon: <PieChart className="h-4 w-4" />,
    },
    {
      id: 'cashflow' as NavigationView,
      label: 'Cash Flow',
      icon: <ArrowRightLeft className="h-4 w-4" />,
    },
    {
      id: 'news' as NavigationView,
      label: 'News',
      icon: <Newspaper className="h-4 w-4" />,
    },
    {
      id: 'analyst' as NavigationView,
      label: 'AI Financial Analyst',
      icon: <Bot className="h-4 w-4" />,
    },
    {
      id: 'tags' as NavigationView,
      label: 'Manage Tags',
      icon: <Tags className="h-4 w-4" />,
    },
    {
      id: 'tools' as NavigationView,
      label: 'Tools',
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      id: 'config-gallery' as NavigationView,
      label: 'Extension Configs',
      icon: <Library className="h-4 w-4" />,
    },
  ]

  const handleNavClick = (view: NavigationView) => {
    // Mixpanel: Track navigation view change
    track('navigation_view_changed', {
      from_view: activeView,
      to_view: view,
      is_mobile: isMobileMenuOpen,
    })

    navigate(viewToPath[view])
    onViewChange?.(view) // Call callback if provided (for backwards compatibility)
    setIsMobileMenuOpen(false)
  }

  const handleAboutClick = () => {
    setIsAboutModalOpen(true)
  }

  return (
    <div className="w-full bg-black border-b border-gray-800 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 sm:px-6 py-1">
        {/* Left side - Mobile Menu Button (mobile only) + Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button - LEFT SIDE */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-0 text-white hover:text-gray-300 transition-colors focus:outline-none bg-transparent border-0"
            aria-label="Toggle mobile menu"
            style={{ outline: 'none', boxShadow: 'none' }}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" strokeWidth={2.5} />
            ) : (
              <Menu className="h-6 w-6" strokeWidth={2.5} />
            )}
          </button>
          
          {/* Logo and App Name */}
          <div className="flex items-center cursor-pointer" onClick={handleAboutClick}>
            <h1 className="text-lg sm:text-xl text-white hover:text-gray-300 transition-colors" style={{ fontFamily: "'Poiret One', sans-serif", textShadow: '0 0 3px rgb(251, 46, 118), 0 0 5px rgba(251, 46, 118, 0.7), 0 0 6px rgba(251, 46, 118, 0.4)' }}>
              Vestika
            </h1>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 border-none bg-transparent p-0 focus:outline-none focus:ring-0 active:outline-none ${
                activeView === item.id 
                  ? 'text-white border-b-2 border-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
            >
              <span className="flex items-center justify-center w-4 h-4">
                {item.icon}
              </span>
              <span className="hidden lg:inline">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Right side - Profile and Notifications (Desktop only) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Q&A button */}
          <a
            href="https://vestika.io"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/20 backdrop-blur-sm text-blue-200 hover:text-blue-100 hover:bg-blue-500/30 transition-all duration-300 transform hover:scale-105 border border-blue-400/30 hover:border-blue-300/40 no-underline"
          >
            Q&A
          </a>
          {/* Feedback button */}
          <button
            onClick={() => {
              setIsFeedbackOpen(true)
              onFeedbackClick && onFeedbackClick()
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/20 backdrop-blur-sm text-blue-200 hover:text-blue-100 hover:bg-blue-500/30 transition-all duration-300 transform hover:scale-105 border border-blue-400/30 hover:border-blue-300/40"
          >
            Feedback
          </button>
          {/* Notification Bell */}
          <NotificationBell />
          
          {/* Profile Icon */}
          <IconButton onClick={onProfileClick} ariaLabel="Profile">
            <GoogleProfilePicture
              photoURL={googleProfileData?.photoURL}
              displayName={googleProfileData?.displayName}
              size="sm"
            />
          </IconButton>
        </div>

        {/* Right side - Mobile Icons */}
        <div className="md:hidden flex items-center gap-2">
          {/* Q&A button mobile */}
          <a
            href="https://vestika.io"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 backdrop-blur-sm text-blue-200 hover:text-blue-100 hover:bg-blue-500/30 transition-all duration-200 border border-blue-400/30 hover:border-blue-300/40 no-underline"
          >
            Q&A
          </a>
          {/* Feedback button mobile */}
          <button
            onClick={() => {
              setIsFeedbackOpen(true)
              onFeedbackClick && onFeedbackClick()
            }}
            className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 backdrop-blur-sm text-blue-200 hover:text-blue-100 hover:bg-blue-500/30 transition-all duration-200 border border-blue-400/30 hover:border-blue-300/40"
          >
            Feedback
          </button>
          {/* Notification Bell for mobile */}
          <NotificationBell />

          {/* Profile Icon for mobile */}
          <IconButton onClick={onProfileClick} ariaLabel="Profile">
            <GoogleProfilePicture
              photoURL={googleProfileData?.photoURL}
              displayName={googleProfileData?.displayName}
              size="sm"
            />
          </IconButton>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black border-t border-gray-800">
          <nav className="px-4 py-2 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200 border-none bg-transparent focus:outline-none focus:ring-0 active:outline-none ${
                  activeView === item.id 
                    ? 'text-white border-l-2 border-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
                style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              >
                <span className="flex items-center justify-center w-4 h-4">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      
      {/* About Modal */}
      <AboutModal 
        isOpen={isAboutModalOpen} 
        onOpenChange={setIsAboutModalOpen} 
      />
      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={isFeedbackOpen}
        onOpenChange={setIsFeedbackOpen}
      />
    </div>
  )
}
