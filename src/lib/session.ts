import { type SessionData } from '@/lib/types';

// In-memory session store
const sessions = new Map<string, SessionData>();

export const sessionManager = {
  getSession(sessionId: string): SessionData | undefined {
    console.log(`[Session] Getting session for ID: ${sessionId}`);
    const session = sessions.get(sessionId);
    if (session) {
      console.log('[Session] Found existing session:', session);
    } else {
      console.log('[Session] No session found.');
    }
    return session;
  },

  createSession(sessionId: string, phoneNumber: string): SessionData {
    const newSession: SessionData = {
      screen: 'PIN',
      pinAttempts: 0,
      authenticated: false,
      loanStatusPage: 0,
      phoneNumber,
    };
    sessions.set(sessionId, newSession);
    console.log(`[Session] Created new session for ID ${sessionId}:`, newSession);
    return newSession;
  },

  updateSession(sessionId: string, session: SessionData) {
    console.log(`[Session] Updating session for ID ${sessionId}:`, session);
    sessions.set(sessionId, session);
  },

  deleteSession(sessionId: string) {
    console.log(`[Session] Deleting session for ID ${sessionId}`);
    sessions.delete(sessionId);
  },
};
