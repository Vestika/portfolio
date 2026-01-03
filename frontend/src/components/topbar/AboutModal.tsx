import { Github, X } from 'lucide-react'
import { useEffect } from 'react'
import benSterensonImage from '../../assets/v-ben.png'
import danSterensonImage from '../../assets/v-dan.png'
import michaelPalaryaImage from '../../assets/v-michael.png'


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
  // Ensure body scroll is always enabled when modal is closed or component mounts
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
    }
  }, [isOpen])

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
      title: "VP R&D @ Demostack",
      linkedinUrl: "https://www.linkedin.com/in/bensterenson/",
      imageUrl: benSterensonImage
    },
    {
      name: "Dan",
      title: "Backend Software Engineer @ Zscaler", 
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
      <div 
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-lg p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header Section */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-1" style={{ fontFamily: "'Poiret One', sans-serif" }}>
                Vestika
              </h1>
            </div>
          </div>
        </div>

        {/* Application Description */}
        <div className="text-gray-300 leading-relaxed mb-6 md:mb-8 max-w-3xl">
          <p className="mb-4 text-base md:text-lg">
            A portfolio management system. Available on{' '}
            <a
              href="https://github.com/Vestika/portfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1"
              aria-label="View project on GitHub"
            >
              GitHub
              <Github className="w-4 h-4" />
            </a>
          </p>
        </div>

        {/* Creators Section */}
        <div className="mb-6 md:mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {creators.map((creator, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all duration-200"
                onClick={() => window.open(creator.linkedinUrl, '_blank')}
              >
                <div className="w-36 h-48 md:w-48 md:h-64 mb-3 md:mb-4 overflow-hidden rounded-lg bg-gray-700">
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
                      <span className="text-3xl md:text-4xl font-medium text-gray-300">
                        {creator.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white text-lg md:text-xl mb-1 md:mb-2">{creator.name}</div>
                  <div className="text-xs md:text-sm text-gray-400 leading-relaxed px-2">{creator.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Early Adopters Section */}
        <div className="border-t border-gray-700 pt-6 md:pt-8">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 md:mb-4">Special Thanks</h2>
          <p className="text-gray-300 mb-3 md:mb-4 text-sm md:text-base">
            We're grateful to our early adopters who helped shape this product:
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="px-3 md:px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
              <span className="text-white font-medium text-sm md:text-base">Yoav Y.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
