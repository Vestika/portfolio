import React, { useState } from 'react';
import api from '../../utils/api';

interface FeedbackWidgetProps {
  defaultOpen?: boolean;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [message, setMessage] = useState('');
  const [nps, setNps] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);

  const canSend = message.trim().length > 0 && !isSending;

  const submit = async () => {
    if (!canSend) return;
    setIsSending(true);
    setSuccess(null);
    try {
      await api.post('/feedback', {
        message: message.trim(),
        nps_score: nps,
        page_url: window.location.pathname,
      });
      setSuccess(true);
      setMessage('');
      setNps(null);
      setTimeout(() => setIsOpen(false), 1200);
    } catch (e) {
      setSuccess(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg px-4 py-3 flex items-center gap-2"
          aria-label="Give feedback"
        >
          <span>Feedback</span>
        </button>
      )}

      {/* Popup */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-gray-800 text-white rounded-xl shadow-2xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Share Feedback</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-200"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind..."
            className="w-full h-28 bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            maxLength={4000}
          />

          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1">How likely to recommend? (0–10)</label>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  onClick={() => setNps(i)}
                  className={`text-xs py-1 rounded ${nps === i ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm h-5">
              {success === true && <span className="text-green-400">Sent!</span>}
              {success === false && <span className="text-red-400">Failed. Try again.</span>}
            </div>
            <button
              onClick={submit}
              disabled={!canSend}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${canSend ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackWidget;


