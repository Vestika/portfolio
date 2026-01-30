import React, { useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react';

interface MessageActionsProps {
  content: string;
  messageRole: 'user' | 'assistant';
  onFeedback?: (isPositive: boolean) => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({
  content,
  messageRole,
  onFeedback,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleFeedback = (isPositive: boolean) => {
    const newFeedback = isPositive ? 'up' : 'down';
    setFeedback(feedback === newFeedback ? null : newFeedback);
    onFeedback?.(isPositive);
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      <button
        onClick={handleCopy}
        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
        aria-label="Copy message"
        title="Copy message"
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>

      {messageRole === 'assistant' && (
        <>
          <button
            onClick={() => handleFeedback(true)}
            className={`p-2 rounded transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center ${
              feedback === 'up'
                ? 'text-green-400 bg-green-400/10'
                : 'text-gray-400 hover:text-green-400 hover:bg-green-400/10'
            }`}
            aria-label="This was helpful"
            aria-pressed={feedback === 'up'}
            title="This was helpful"
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleFeedback(false)}
            className={`p-2 rounded transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center ${
              feedback === 'down'
                ? 'text-red-400 bg-red-400/10'
                : 'text-gray-400 hover:text-red-400 hover:bg-red-400/10'
            }`}
            aria-label="This wasn't helpful"
            aria-pressed={feedback === 'down'}
            title="This wasn't helpful"
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
};

export default MessageActions;
