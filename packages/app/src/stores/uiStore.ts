import { create } from "zustand";
import type { Session } from "../bindings";

interface UiState {
  // Error state
  error: string | null;
  setError: (error: string | null) => void;

  // Session panel visibility
  showSessions: boolean;
  setShowSessions: (show: boolean) => void;
  toggleSessions: () => void;

  // Chart view toggle
  showDetailedCharts: boolean;
  setShowDetailedCharts: (show: boolean) => void;
  toggleDetailedCharts: () => void;

  // Export dialog
  exportSession: Session | null;
  setExportSession: (session: Session | null) => void;

  // Import dialog
  showImport: boolean;
  setShowImport: (show: boolean) => void;

  // Session detail view (legacy - will be replaced by tabs)
  selectedSessionForView: Session | null;
  setSelectedSessionForView: (session: Session | null) => void;

  // Session tabs for multi-session view
  openSessionTabs: string[];
  activeSessionTab: string | null;
  openSessionTab: (sessionId: string) => void;
  closeSessionTab: (sessionId: string) => void;
  setActiveSessionTab: (sessionId: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Error state
  error: null,
  setError: (error) => set({ error }),

  // Session panel visibility
  showSessions: false,
  setShowSessions: (showSessions) => set({ showSessions }),
  toggleSessions: () => set((state) => ({ showSessions: !state.showSessions })),

  // Chart view toggle
  showDetailedCharts: false,
  setShowDetailedCharts: (showDetailedCharts) => set({ showDetailedCharts }),
  toggleDetailedCharts: () =>
    set((state) => ({ showDetailedCharts: !state.showDetailedCharts })),

  // Export dialog
  exportSession: null,
  setExportSession: (exportSession) => set({ exportSession }),

  // Import dialog
  showImport: false,
  setShowImport: (showImport) => set({ showImport }),

  // Session detail view (legacy - will be replaced by tabs)
  selectedSessionForView: null,
  setSelectedSessionForView: (selectedSessionForView) =>
    set({ selectedSessionForView }),

  // Session tabs for multi-session view
  openSessionTabs: [],
  activeSessionTab: null,
  openSessionTab: (sessionId) =>
    set((state) => {
      if (state.openSessionTabs.includes(sessionId)) {
        // Tab already open, just activate it
        return { activeSessionTab: sessionId };
      }
      return {
        openSessionTabs: [...state.openSessionTabs, sessionId],
        activeSessionTab: sessionId,
      };
    }),
  closeSessionTab: (sessionId) =>
    set((state) => {
      const newTabs = state.openSessionTabs.filter((id) => id !== sessionId);
      let newActiveTab = state.activeSessionTab;

      // If we're closing the active tab, switch to another tab
      if (state.activeSessionTab === sessionId) {
        const closedIndex = state.openSessionTabs.indexOf(sessionId);
        if (newTabs.length > 0) {
          // Try to activate the tab to the left, or the first tab
          newActiveTab = newTabs[Math.max(0, closedIndex - 1)] ?? newTabs[0] ?? null;
        } else {
          newActiveTab = null;
        }
      }

      return {
        openSessionTabs: newTabs,
        activeSessionTab: newActiveTab,
      };
    }),
  setActiveSessionTab: (activeSessionTab) => set({ activeSessionTab }),
}));
