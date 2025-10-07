import React, { useEffect, useState } from 'react'
import api from '../utils/api'

interface FeedbackModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackModal({ isOpen, onOpenChange }: FeedbackModalProps) {
  const [message, setMessage] = useState('')
  const [nps, setNps] = useState<number | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onOpenChange])

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onOpenChange(false)
  }

  const canSend = message.trim().length > 0 && !isSending

  const submit = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      await api.post('/feedback', {
        message: message.trim(),
        nps_score: nps,
        page_url: window.location.pathname,
      })
      setSent(true)
      setMessage('')
      setNps(null)
      setTimeout(() => onOpenChange(false), 900)
    } catch (e) {
      // keep open, allow retry
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      onClick={handleBackgroundClick}
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl shadow-2xl"
           onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Share Feedback</h2>
          <button 
            className="text-gray-400 hover:text-gray-200"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind..."
            className="w-full h-28 bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            maxLength={4000}
          />

          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1">How likely to recommend? (0–10)</label>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  onClick={() => setNps(prev => (prev === i ? null : i))}
                  className={`text-xs rounded flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 ${nps === i ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <div className="text-sm h-5">
            {sent && <span className="text-green-400">Sent!</span>}
          </div>
          <button
            onClick={submit}
            disabled={!canSend}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${canSend ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}


