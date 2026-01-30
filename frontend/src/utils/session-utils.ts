import { ChatSession } from './ai-api';

export interface GroupedSessions {
  today: ChatSession[];
  yesterday: ChatSession[];
  previous7Days: ChatSession[];
  previous30Days: ChatSession[];
  older: ChatSession[];
}

export function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: GroupedSessions = {
    today: [],
    yesterday: [],
    previous7Days: [],
    previous30Days: [],
    older: []
  };

  sessions.forEach(session => {
    const sessionDate = new Date(session.created_at);
    const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

    if (sessionDay.getTime() === today.getTime()) {
      groups.today.push(session);
    } else if (sessionDay.getTime() === yesterday.getTime()) {
      groups.yesterday.push(session);
    } else if (sessionDay >= sevenDaysAgo) {
      groups.previous7Days.push(session);
    } else if (sessionDay >= thirtyDaysAgo) {
      groups.previous30Days.push(session);
    } else {
      groups.older.push(session);
    }
  });

  return groups;
}

export function generateSessionTitle(session: ChatSession): string {
  // Use first user message as title, fallback to "New Chat"
  const firstUserMessage = session.messages.find(msg => msg.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content;
    // Truncate to ~60 chars
    return content.length > 60 ? content.substring(0, 60) + '...' : content;
  }
  return 'New Chat';
}

export function getPeriodTitle(period: keyof GroupedSessions): string {
  const titles: Record<keyof GroupedSessions, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    previous7Days: 'Previous 7 Days',
    previous30Days: 'Previous 30 Days',
    older: 'Older'
  };
  return titles[period];
}

export function formatSessionDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (sessionDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (sessionDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
