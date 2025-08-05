import { type SessionData } from '@/lib/types';
import { MockDatabase } from '@/lib/mock-data';

// In-memory session store
const sessions = new Map<string, SessionData>();

export const sessionManager = {
  getSession(sessionId: string): SessionData | undefined {
    return sessions.get(sessionId);
  },

  createSession(sessionId: string, phoneNumber: string): SessionData {
    const user = MockDatabase.getUserByPhoneNumber(phoneNumber);
    if (!user || !user.isVerified) {
        // This is a special session that will just return an error message
        // and immediately be deleted.
        const unverifiedSession: SessionData = {
            screen: 'PIN', // Placeholder, won't be used
            pinAttempts: 0,
            authenticated: false,
            loanStatusPage: 0,
            phoneNumber,
        };
        return unverifiedSession;
    }

    const newSession: SessionData = {
      screen: 'PIN',
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
