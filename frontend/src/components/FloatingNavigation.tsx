// React is not needed for JSX in modern React
import { 
  PieChart, 
  Search, 
  Tags, 
  Wrench
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import logoImage from '../assets/logo.png'

export type NavigationView = 'portfolios' | 'explore' | 'tags' | 'tools'

interface FloatingNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function FloatingNavigation({ activeView, onViewChange }: FloatingNavigationProps) {
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

  return (
    <div className="fixed top-3 left-6 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-14 h-14 rounded-full bg-background border-2 border-border hover:border-primary shadow-lg transition-all duration-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background overflow-hidden p-1"
            aria-label="Navigation menu"
          >
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="App Logo" 
                className="w-10 h-10 object-contain rounded-full"
              />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          side="bottom" 
          className="w-48 mt-2"
          sideOffset={8}
        >
          {navigationItems.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${
                activeView === item.id 
                  ? 'bg-primary text-primary-foreground font-medium' 
                  : ''
              }`}
            >
              {item.icon}
              <span className="text-sm">
                {item.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 