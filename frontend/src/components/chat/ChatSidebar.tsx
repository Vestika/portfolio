import React from 'react';
import { Plus } from 'lucide-react';
import { ChatSession } from '../../utils/ai-api';
import { SessionGroup } from './SessionGroup';
import { groupSessionsByDate, getPeriodTitle } from '../../utils/session-utils';

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, event: React.MouseEvent) => void;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession
}: ChatSidebarProps) {
  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="w-full h-full flex flex-col bg-gray-950">
      {/* New Chat Button */}
      <div className="p-3 border-b border-white/10">
        <button
          onClick={onNewChat}
          className="w-full h-12 px-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all flex items-center justify-center gap-2 text-white font-medium"
          aria-label="Start new chat"
        >
          <Plus className="h-5 w-5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No chat history</p>
        ) : (
          <>
            {(Object.entries(groupedSessions) as [keyof typeof groupedSessions, ChatSession[]][]).map(
              ([period, periodSessions]) => (
                <SessionGroup
                  key={period}
                  title={getPeriodTitle(period)}
                  sessions={periodSessions}
                  currentSessionId={currentSessionId}
                  onSelect={onSelectSession}
                  onDelete={onDeleteSession}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
