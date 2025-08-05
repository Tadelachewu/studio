import { type SessionData } from '@/lib/types';

// In-memory session store
const sessions = new Map<string, SessionData>();

export const sessionManager = {
  getSession(sessionId: string): SessionData | undefined {
    return sessions.get(sessionId);
  },

  createSession(sessionId: string, phoneNumber: string): SessionData {
    const newSession: SessionData = {
      screen: 'FAYIDA_ID',
      pinAttempts: 0,
      authenticated: false,
      loanStatusPage: 0,
      phoneNumber,
    };
    sessions.set(sessionId, newSession);
    return newSession;
  },

  updateSession(sessionId: string, session: SessionData) {
    sessions.set(sessionId, session);
  },

  deleteSession(sessionId: string) {
    sessions.delete(sessionId);
  },
};
