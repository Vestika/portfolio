import React from 'react';
import { ChatSession } from '../../utils/ai-api';
import { SessionItem } from './SessionItem';

interface SessionGroupProps {
  title: string;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string, event: React.MouseEvent) => void;
}

export function SessionGroup({ title, sessions, currentSessionId, onSelect, onDelete }: SessionGroupProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1">{title}</h3>
      <div className="space-y-1">
        {sessions.map(session => (
          <SessionItem
            key={session._id}
            session={session}
            active={session._id === currentSessionId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
