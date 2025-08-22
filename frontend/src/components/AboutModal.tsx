import { Github } from 'lucide-react'
import { useEffect } from 'react'
import benSterensonImage from '../assets/ben-sterenson.jpg'
import danSterensonImage from '../assets/v-dan.png'
import michaelPalaryaImage from '../assets/v-michael.png'

interface AboutModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface Creator {
  name: string
  title: string
  linkedinUrl: string
  imageUrl?: string
}

export function AboutModal({ isOpen, onOpenChange }: AboutModalProps) {
  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onOpenChange])

  // Handle background click
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const creators: Creator[] = [
    {
      name: "Ben", 
      title: "Backend Team Leader @ Demostack",
      linkedinUrl: "https://www.linkedin.com/in/bensterenson/",
      imageUrl: benSterensonImage
    },
    {
      name: "Dan",
      title: "Backend Software Engineer @ Avalor", 
      linkedinUrl: "https://www.linkedin.com/in/dansterenson/",
      imageUrl: danSterensonImage
    },
    {
      name: "Michael",
      title: "Senior Software Engineer @ Nvidia",
      linkedinUrl: "https://www.linkedin.com/in/palarya/",
      imageUrl: michaelPalaryaImage
    }
  ]

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={handleBackgroundClick}
    >
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}
      >

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "'Poiret One', sans-serif" }}>
                Vestika
              </h1>
            </div>
          </div>
        </div>

        {/* Application Description */}
        <div className="text-gray-300 leading-relaxed mb-8 max-w-3xl">
          <p className="mb-4 text-lg flex items-center gap-2">
            A portfolio management system. Available on GitHub
            <a
              href="https://github.com/Vestika/portfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors inline-flex"
              aria-label="View project on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          </p>
        </div>

        {/* Creators Section */}
        <div className="mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {creators.map((creator, index) => (
                <div 
                  key={index} 
                  className="flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all duration-200"
                  onClick={() => window.open(creator.linkedinUrl, '_blank')}
                >
                  <div className="w-48 h-64 mb-4 overflow-hidden rounded-lg bg-gray-700">
                    {creator.imageUrl ? (
                      <img 
                        src={creator.imageUrl} 
                        alt={`${creator.name} profile picture`}
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          const sibling = target.nextElementSibling as HTMLElement;
                          target.style.display = 'none';
                          if (sibling) sibling.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl font-medium text-gray-300">
                          {creator.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-xl mb-2">{creator.name}</div>
                    <div className="text-sm text-gray-400 leading-relaxed">{creator.title}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  )
}
