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
  isOpen?: boolean;
  onClose?: () => void;
}

const AIChat: React.FC<AIChatProps> = ({ 
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

  // Example questions to show when chat is empty
  const exampleQuestions = [
    "How is my portfolio performing?",
    "What's my current asset allocation?",
    "Which stocks are my biggest winners?",
    "Show me my portfolio diversification",
    "What's my risk exposure?",
    "How much did I gain/lose this month?"
  ];

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

  const handleExampleQuestion = (question: string) => {
    setInputMessage(question);
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
    <div className="h-full flex flex-col relative max-w-4xl mx-auto">
      {/* Minimal Header */}
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-300">AI Assistant</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            >
              ×
            </Button>
          )}
          <Button
            onClick={() => setShowSessions(!showSessions)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-white/10 text-xs"
          >
            History
          </Button>
          <Button
            onClick={startNewSession}
            variant="ghost"
            size="sm"
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs"
          >
            New
          </Button>
        </div>
      </div>

      {/* Sessions Panel */}
      {showSessions && (
        <div className="absolute top-12 left-0 right-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 p-4">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No chat history</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session._id}
                  onClick={() => loadSession(session._id)}
                  className={`p-3 rounded-lg cursor-pointer text-sm transition-all ${
                    currentSessionId === session._id
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{formatDate(session.created_at)}</span>
                    <span className="text-xs text-gray-500">
                      {session.messages.length} msg
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-end h-full pb-4">
            <div className="text-center max-w-md mb-6">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">AI Financial Assistant</h3>
              <p className="text-gray-400 mb-6">
                Ask about portfolio analysis, diversification, risk assessment, or investment strategies.
              </p>
            </div>
            
            {/* Example Questions */}
            <div className="w-full max-w-2xl">
              <p className="text-sm text-gray-400 text-center mb-4">Try asking:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleQuestion(question)}
                    className="p-3 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-200 text-sm text-gray-300 hover:text-white"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 mr-3 mt-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[75%] lg:max-w-2xl px-4 py-3 rounded-2xl shadow-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white/10 backdrop-blur-sm text-gray-100 rounded-bl-md border border-white/20'
              }`}
            >
              <TaggedMessage content={message.content} />
              <div
                className={`text-xs mt-2 opacity-70 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-300'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 ml-3 mt-1 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 mr-3 mt-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="bg-white/10 backdrop-blur-sm text-gray-100 max-w-xs px-4 py-3 rounded-2xl rounded-bl-md border border-white/20">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                </div>
                <span className="text-sm text-gray-300">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className={`${messages.length === 0 ? 'px-6 py-4 border-t border-white/10 bg-white/5 backdrop-blur-sm' : 'px-6 py-4 border-t border-white/10 bg-white/5 backdrop-blur-sm'}`}>
        <div className="flex space-x-3 max-w-4xl mx-auto">
          <TaggingInput
            value={inputMessage}
            onChange={setInputMessage}
            onSend={handleSendMessage}
            onTagSelect={(tag) => setSelectedTags(prev => [...prev, tag])}
            disabled={isLoading}
            placeholder={messages.length === 0 ? "Ask me about your portfolio..." : "Ask about your portfolio... Use @ for portfolios/accounts, $ for symbols"}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </Button>
        </div>
        
        {/* Disclaimer - only show when there are messages */}
        {messages.length > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-center max-w-4xl mx-auto">
            <p>
              AI provides informational analysis only, not financial advice. Consult a qualified advisor for investment decisions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChat; 