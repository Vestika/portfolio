import React, { useState, useEffect, useRef } from 'react';
import TaggingInput from './TaggingInput';
import TaggedMessage from './TaggedMessage';
import MessageActions from './MessageActions';
import { ChatSidebar } from './chat/ChatSidebar';
import {
  chatWithAnalyst,
  getChatSessions,
  getChatSessionMessages,
  closeChatSession,
  ChatSession,
  ChatMessage,
  AutocompleteSuggestion
} from '../utils/ai-api';
import { useMixpanel } from '../contexts/MixpanelContext';
import { Bot, Menu, X, Target, TrendingUp, Lightbulb, MessageCircle, AlertTriangle, Send } from 'lucide-react';

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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<AutocompleteSuggestion[]>([]);
  const { track } = useMixpanel();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Example questions to show when chat is empty
  const exampleQuestions = [
    "How is my portfolio performing?",
    "What's my current asset allocation?",
    "Which stocks are my biggest winners?",
    "Show me my portfolio diversification"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      // Mixpanel: Track AI chat opened
      track('feature_ai_chat_opened');
      loadChatSessions();
    }
  }, [isOpen, track]);

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
    const hasTaggedEntities = selectedTags.length > 0;

    // Mixpanel: Track AI chat message sent
    track('feature_ai_chat_message_sent', {
      message_length_chars: userMessage.length,
      has_tagged_entities: hasTaggedEntities,
      tagged_entities_count: selectedTags.length,
      conversation_length: messages.length,
    });

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
      setIsMobileSidebarOpen(false); // Close mobile sidebar after selection
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
    }
  };

  const startNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('Delete this chat session? This action cannot be undone.')) {
      return;
    }

    try {
      await closeChatSession(sessionId);

      // If we deleted the current session, start a new one
      if (sessionId === currentSessionId) {
        startNewSession();
      }

      // Reload sessions
      await loadChatSessions();
    } catch (err: unknown) {
      console.error('Failed to delete session:', err);
      setError('Failed to delete session');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Desktop Sidebar - Always visible on desktop */}
      <div className="hidden lg:block w-[260px] flex-shrink-0 bg-gray-950 border-r border-white/10">
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={loadSession}
          onNewChat={startNewSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Mobile Sidebar - Overlay */}
      {isMobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden="true"
          />

          {/* Sliding Sidebar */}
          <div className="fixed inset-y-0 left-0 w-full sm:w-[320px] bg-gray-950 border-r border-white/10 z-50 lg:hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Chat History</h2>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-[calc(100%-60px)]">
              <ChatSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={loadSession}
                onNewChat={startNewSession}
                onDeleteSession={handleDeleteSession}
              />
            </div>
          </div>
        </>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Header */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile menu button - only visible on mobile */}
            <button
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Bot className="h-5 w-5 text-blue-400" />
            <h1 className="text-base font-semibold text-white">AI Financial Analyst</h1>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full pb-8">
              {/* Hero Section */}
              <div className="w-20 h-20 mb-6 text-blue-400 relative">
                <Bot className="h-20 w-20 animate-pulse" aria-hidden="true" />
                <div
                  className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping"
                  style={{ animationDuration: '2s' }}
                  aria-hidden="true"
                />
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">AI-Powered Portfolio Analysis</h3>
              <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-md text-center px-4">
                Chat with your AI analyst to get insights about your holdings, risk exposure, and investment strategy.
              </p>

              {/* Feature Preview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-3xl w-full px-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                  <Target className="h-8 w-8 text-blue-400 mx-auto mb-2" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-white mb-1">Risk Assessment</h4>
                  <p className="text-xs text-gray-400">Analyze portfolio risk and volatility</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                  <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-2" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-white mb-1">Performance Tracking</h4>
                  <p className="text-xs text-gray-400">Monitor returns and growth trends</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                  <Lightbulb className="h-8 w-8 text-yellow-400 mx-auto mb-2" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-white mb-1">Investment Insights</h4>
                  <p className="text-xs text-gray-400">Discover opportunities and patterns</p>
                </div>
              </div>

              {/* Example Questions */}
              <div className="w-full max-w-3xl px-4">
                <p className="text-sm text-gray-400 mb-3 font-medium">Try asking:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleQuestion(question)}
                      className="h-12 p-4 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30 rounded-xl transition-all text-sm text-gray-300 hover:text-white flex items-center min-h-[48px]"
                      aria-label={`Ask: ${question}`}
                    >
                      <MessageCircle className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" aria-hidden="true" />
                      <span className="flex-1">{question}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyboard Hints */}
              <div className="mt-6 text-xs text-gray-500">
                <kbd className="bg-gray-800 px-2 py-1 rounded">Enter</kbd> to send •{' '}
                <kbd className="bg-gray-800 px-2 py-1 rounded">@</kbd> for portfolios •{' '}
                <kbd className="bg-gray-800 px-2 py-1 rounded">$</kbd> for symbols
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className="flex justify-center mb-4">
              <div className="w-full max-w-3xl">
                <div
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 mr-3 mt-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                  )}
                  <div
                    className={`max-w-[90%] sm:max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white/10 backdrop-blur-sm text-gray-100 rounded-bl-md border border-white/20'
                    }`}
                  >
                    <TaggedMessage content={message.content} />
                    <MessageActions
                      content={message.content}
                      messageRole={message.role}
                      onFeedback={(isPositive) => {
                        // TODO: Send feedback to backend
                        console.log('Feedback:', isPositive ? 'positive' : 'negative');
                      }}
                    />
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
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-center mb-4">
              <div className="w-full max-w-3xl">
                <div className="flex justify-start" role="status" aria-live="polite" aria-label="AI is typing">
                  <div className="w-8 h-8 mr-3 mt-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white animate-pulse" aria-hidden="true" />
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm text-gray-100 max-w-xs px-4 py-3 rounded-2xl rounded-bl-md border border-white/20">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1" aria-hidden="true">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-300">Analyzing your portfolio...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center max-w-3xl mx-auto">
              <svg className="h-4 w-4 text-red-400 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Persistent Disclaimer */}
        <div className="border-t border-white/10 bg-yellow-900/10 px-6 py-3">
          <div className="flex items-start gap-2 max-w-3xl mx-auto">
            <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-yellow-300/90 leading-relaxed">
              <strong className="font-semibold">Important:</strong> AI provides informational analysis only, not financial advice. Always consult a qualified financial advisor before making investment decisions.
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/50 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex gap-3">
            <TaggingInput
              value={inputMessage}
              onChange={setInputMessage}
              onSend={handleSendMessage}
              onTagSelect={(tag) => setSelectedTags(prev => [...prev, tag])}
              disabled={isLoading}
              placeholder={messages.length === 0 ? "Ask me about your portfolio..." : "Type @ for portfolios, $ for symbols"}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="min-w-[56px] min-h-[56px] w-14 h-14 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send message"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
