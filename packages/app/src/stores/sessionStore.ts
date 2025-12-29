import { create } from "zustand";
import type { Session } from "../bindings";

interface SessionState {
  // Current active session
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;

  // All sessions
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;

  // Reset current session
  clearCurrentSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Current active session
  currentSession: null,
  setCurrentSession: (currentSession) => set({ currentSession }),

  // All sessions
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    })),

  // Reset current session
  clearCurrentSession: () => set({ currentSession: null }),
}));
