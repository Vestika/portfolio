import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  chatWithAnalyst, 
  getChatSessions, 
  getChatSessionMessages,
  ChatSession,
  ChatMessage
} from '../utils/ai-api';

interface AIChatProps {
  portfolioId: string;
  portfolioName?: string;
}

const AIChat: React.FC<AIChatProps> = ({ portfolioId, portfolioName = 'Portfolio' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChatSessions();
  }, [portfolioId]);

  const loadChatSessions = async () => {
    try {
      const sessionsData = await getChatSessions(portfolioId);
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
      const response = await chatWithAnalyst(portfolioId, userMessage, currentSessionId || undefined);
      
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

      // Reload sessions to get the new one
      await loadChatSessions();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const sessionData = await getChatSessionMessages(portfolioId, sessionId);
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

  // Function to close current session (available for future use)
  // const closeCurrentSession = async () => {
  //   if (currentSessionId) {
  //     try {
  //       await closeChatSession(portfolioId, currentSessionId);
  //       setCurrentSessionId(null);
  //       setMessages([]);
  //       await loadChatSessions();
  //     } catch (err: unknown) {
  //       const errorMessage = err instanceof Error ? err.message : 'Failed to close session';
  //       setError(errorMessage);
  //     }
  //   }
  // };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Financial Analyst</h2>
            <p className="text-sm text-gray-600">Chat about your {portfolioName.toLowerCase()}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowSessions(!showSessions)}
            variant="outline"
            size="sm"
            className="text-gray-600"
          >
            Sessions
          </Button>
          <Button
            onClick={startNewSession}
            variant="outline"
            size="sm"
            className="text-blue-600"
          >
            New Chat
          </Button>
        </div>
      </div>

      {/* Sessions Panel */}
      {showSessions && (
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Chat Sessions</h3>
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
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100 text-gray-700'
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
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Start a conversation</h3>
            <p className="text-sm text-gray-500 mt-1">
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
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your portfolio..."
            disabled={isLoading}
            className="flex-1"
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