import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import TaggingInput from './TaggingInput';
import TaggedMessage from './TaggedMessage';
import { 
  chatWithAnalyst, 
  getChatSessions, 
  getChatSessionMessages,
  ChatSession,
  ChatMessage,
  AutocompleteSuggestion
} from '../utils/ai-api';

interface AIChatProps {
  portfolioName?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const AIChat: React.FC<AIChatProps> = ({ 
  portfolioName = 'Portfolio',
  isOpen = true,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [selectedTags, setSelectedTags] = useState<AutocompleteSuggestion[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      loadChatSessions();
    }
  }, [isOpen]);

  const loadChatSessions = async () => {
    try {
      const sessionsData = await getChatSessions();
      setSessions(sessionsData);
    } catch (err: unknown) {
      console.error('Failed to load chat sessions:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const response = await chatWithAnalyst(userMessage, currentSessionId || undefined, selectedTags);
      
      // Update session ID if this is a new session
      if (!currentSessionId) {
        setCurrentSessionId(response.session_id);
      }

      // Add AI response to messages
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp
      };
      setMessages(prev => [...prev, aiMessage]);

      // Clear selected tags after sending
      setSelectedTags([]);

      // Reload sessions to get the new one
      await loadChatSessions();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  const loadSession = async (sessionId: string) => {
    try {
      const sessionData = await getChatSessionMessages(sessionId);
      setMessages(sessionData.messages);
      setCurrentSessionId(sessionId);
      setShowSessions(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
    }
  };

  const startNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowSessions(false);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg h-full flex flex-col border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Financial Analyst</h2>
            <p className="text-sm text-gray-400">Chat about your {portfolioName.toLowerCase()}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="text-gray-400 border-gray-600 hover:bg-gray-700"
            >
              ×
            </Button>
          )}
          <Button
            onClick={() => setShowSessions(!showSessions)}
            variant="outline"
            size="sm"
            className="text-gray-400 border-gray-600 hover:bg-gray-700"
          >
            Sessions
          </Button>
          <Button
            onClick={startNewSession}
            variant="outline"
            size="sm"
            className="text-blue-400 border-blue-600 hover:bg-blue-900"
          >
            New
          </Button>
        </div>
      </div>

      {/* Sessions Panel */}
      {showSessions && (
        <div className="border-b border-gray-700 bg-gray-900 p-4">
          <h3 className="text-sm font-medium text-white mb-3">Chat Sessions</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500">No previous sessions</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session._id}
                  onClick={() => loadSession(session._id)}
                  className={`p-2 rounded cursor-pointer text-sm ${
                    currentSessionId === session._id
                      ? 'bg-blue-900 text-blue-100'
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>Session {formatDate(session.created_at)}</span>
                    <span className="text-xs text-gray-500">
                      {session.messages.length} messages
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-gray-500 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-white">Start a conversation</h3>
            <p className="text-sm text-gray-400 mt-1">
              Ask me anything about your portfolio analysis, diversification, risk assessment, or investment strategies.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              <TaggedMessage content={message.content} />
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-200 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <TaggingInput
            value={inputMessage}
            onChange={setInputMessage}
            onSend={handleSendMessage}
            onTagSelect={(tag) => setSelectedTags(prev => [...prev, tag])}
            disabled={isLoading}
            placeholder="Ask about your portfolio... Use @ for portfolios/accounts, $ for symbols"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Send
          </Button>
        </div>
        
        {/* Disclaimer */}
        <div className="mt-3 text-xs text-gray-500">
          <p>
            This AI assistant provides informational analysis only. It is not financial advice. 
            Always consult with a qualified financial advisor before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIChat; 