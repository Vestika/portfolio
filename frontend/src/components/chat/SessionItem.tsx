import React from 'react';
import { Trash2 } from 'lucide-react';
import { ChatSession } from '../../utils/ai-api';
import { generateSessionTitle, formatSessionDate } from '../../utils/session-utils';

interface SessionItemProps {
  session: ChatSession;
  active: boolean;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string, event: React.MouseEvent) => void;
}

export function SessionItem({ session, active, onSelect, onDelete }: SessionItemProps) {
  const title = generateSessionTitle(session);
  const date = formatSessionDate(session.created_at);

  return (
    <button
      onClick={() => onSelect(session._id)}
      className={`
        w-full min-h-[48px] px-3 py-2 rounded-lg text-left transition-all group
        ${active ? 'bg-blue-600/20 text-white' : 'text-gray-300 hover:bg-white/5'}
      `}
      aria-label={`Load chat: ${title}`}
      aria-current={active ? 'page' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{title}</p>
          <p className="text-xs text-gray-500">{date}</p>
        </div>
        <button
          onClick={(e) => onDelete(session._id, e)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
          aria-label="Delete chat"
          tabIndex={-1}
        >
          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
        </button>
      </div>
    </button>
  );
}
