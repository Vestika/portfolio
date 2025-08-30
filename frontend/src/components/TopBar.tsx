import { 
  PieChart, 
  Search, 
  Tags, 
  Wrench,
  Bot,
  Menu,
  X,
  Newspaper
} from 'lucide-react'
import { useState } from 'react'
import { AboutModal } from './AboutModal'

export type NavigationView = 'portfolios' | 'explore' | 'news' | 'analyst' | 'tags' | 'tools'

interface TopBarProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  
  const navigationItems = [
    {
      id: 'portfolios' as NavigationView,
      label: 'My Portfolios',
      icon: <PieChart className="h-4 w-4" />,
    },
    {
      id: 'explore' as NavigationView,
      label: 'Explore',
      icon: <Search className="h-4 w-4" />,
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
  ]

  const handleNavClick = (view: NavigationView) => {
    onViewChange(view)
    setIsMobileMenuOpen(false)
  }

  const handleAboutClick = () => {
    setIsAboutModalOpen(true)
  }

  return (
    <div className="w-full bg-black border-b border-gray-800 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 sm:px-6 py-1">
        {/* Left side - Logo and App Name */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleAboutClick}>
          <h1 className="text-lg sm:text-xl text-white hover:text-gray-300 transition-colors" style={{ fontFamily: "'Poiret One', sans-serif", textShadow: '0 0 3px rgb(251, 46, 118), 0 0 5px rgba(251, 46, 118, 0.7), 0 0 6px rgba(251, 46, 118, 0.4)' }}>
            Vestika
          </h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
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

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-1 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-0 active:outline-none"
          aria-label="Toggle mobile menu"
          style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>
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
    </div>
  )
}
