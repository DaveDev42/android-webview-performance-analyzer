import { create } from "zustand";
import type { Session } from "../bindings";

// Utility to extract origin from URL
export const getUrlOrigin = (url: string | null | undefined): string => {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url;
  }
};

export interface SessionFilters {
  searchQuery: string;
  deviceId: string | null;
  status: "active" | "completed" | "aborted" | null;
  tags: string[];
}

const defaultFilters: SessionFilters = {
  searchQuery: "",
  deviceId: null,
  status: null,
  tags: [],
};

interface SessionState {
  // Current active session
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;

  // All sessions
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;

  // Reset current session
  clearCurrentSession: () => void;

  // Filters
  filters: SessionFilters;
  setFilters: (filters: Partial<SessionFilters>) => void;
  clearFilters: () => void;

  // Filtered sessions (computed)
  getFilteredSessions: () => Session[];

  // Comparison
  comparisonSessionIds: string[];
  addToComparison: (sessionId: string) => void;
  removeFromComparison: (sessionId: string) => void;
  clearComparison: () => void;

  // Available tags (extracted from all sessions)
  getAllTags: () => string[];

  // Available devices (extracted from all sessions)
  getAllDevices: () => { id: string; name: string | null }[];

  // === NEW: Session organization for tree view ===
  // Get sessions for a specific WebView (by device + URL origin)
  getSessionsByWebView: (deviceId: string, webviewUrl: string | null) => Session[];

  // Get all sessions for a device
  getSessionsByDevice: (deviceId: string) => Session[];

  // Get all unique URL origins for a device
  getWebViewUrlsForDevice: (deviceId: string) => string[];

  // Check if a session is imported (device_id starts with "imported")
  isImportedSession: (session: Session) => boolean;

  // Get only imported sessions
  getImportedSessions: () => Session[];

  // Get non-imported sessions
  getRegularSessions: () => Session[];
}

export const useSessionStore = create<SessionState>((set, get) => ({
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
  updateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...updates } : s
      ),
    })),

  // Reset current session
  clearCurrentSession: () => set({ currentSession: null }),

  // Filters
  filters: defaultFilters,
  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  clearFilters: () => set({ filters: defaultFilters }),

  // Filtered sessions
  getFilteredSessions: () => {
    const { sessions, filters } = get();
    return sessions.filter((session) => {
      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesSearch =
          session.display_name?.toLowerCase().includes(query) ||
          session.target_title?.toLowerCase().includes(query) ||
          session.package_name?.toLowerCase().includes(query) ||
          session.device_name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Device filter
      if (filters.deviceId && session.device_id !== filters.deviceId) {
        return false;
      }

      // Status filter
      if (filters.status && session.status !== filters.status) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const sessionTags = session.tags || [];
        const hasMatchingTag = filters.tags.some((tag) =>
          sessionTags.includes(tag)
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  },

  // Comparison
  comparisonSessionIds: [],
  addToComparison: (sessionId) =>
    set((state) => {
      if (state.comparisonSessionIds.length >= 4) return state;
      if (state.comparisonSessionIds.includes(sessionId)) return state;
      return {
        comparisonSessionIds: [...state.comparisonSessionIds, sessionId],
      };
    }),
  removeFromComparison: (sessionId) =>
    set((state) => ({
      comparisonSessionIds: state.comparisonSessionIds.filter(
        (id) => id !== sessionId
      ),
    })),
  clearComparison: () => set({ comparisonSessionIds: [] }),

  // Get all unique tags from sessions
  getAllTags: () => {
    const { sessions } = get();
    const tagSet = new Set<string>();
    sessions.forEach((session) => {
      session.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  },

  // Get all unique devices from sessions
  getAllDevices: () => {
    const { sessions } = get();
    const deviceMap = new Map<string, string | null>();
    sessions.forEach((session) => {
      if (!deviceMap.has(session.device_id)) {
        deviceMap.set(session.device_id, session.device_name ?? null);
      }
    });
    return Array.from(deviceMap.entries()).map(([id, name]) => ({ id, name }));
  },

  // === NEW: Session organization for tree view ===

  // Get sessions for a specific WebView (by device + URL origin)
  getSessionsByWebView: (deviceId, webviewUrl) => {
    const { sessions } = get();
    const targetOrigin = getUrlOrigin(webviewUrl);
    return sessions.filter(
      (s) =>
        s.device_id === deviceId &&
        getUrlOrigin(s.webview_url) === targetOrigin &&
        !s.device_id.startsWith("imported")
    );
  },

  // Get all sessions for a device
  getSessionsByDevice: (deviceId) => {
    const { sessions } = get();
    return sessions.filter(
      (s) => s.device_id === deviceId && !s.device_id.startsWith("imported")
    );
  },

  // Get all unique URL origins for a device
  getWebViewUrlsForDevice: (deviceId) => {
    const { sessions } = get();
    const origins = new Set<string>();
    sessions
      .filter((s) => s.device_id === deviceId && !s.device_id.startsWith("imported"))
      .forEach((s) => {
        origins.add(getUrlOrigin(s.webview_url));
      });
    return Array.from(origins);
  },

  // Check if a session is imported
  isImportedSession: (session) => {
    return session.device_id.startsWith("imported");
  },

  // Get only imported sessions
  getImportedSessions: () => {
    const { sessions } = get();
    return sessions.filter((s) => s.device_id.startsWith("imported"));
  },

  // Get non-imported sessions
  getRegularSessions: () => {
    const { sessions } = get();
    return sessions.filter((s) => !s.device_id.startsWith("imported"));
  },
}));
