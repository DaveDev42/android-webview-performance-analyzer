import { create } from "zustand";
import type { Session } from "../bindings";

// Tab types
export type TabType = "main" | "session";

export interface TabItem {
  id: string;
  type: TabType;
  sessionId?: string;
}

// Tree selection types
export type TreeItemType = "device" | "webview" | "session" | "imported";

export interface TreeSelection {
  type: TreeItemType;
  id: string;
  deviceId?: string;
  webviewUrl?: string;
}

interface UiState {
  // Error state
  error: string | null;
  setError: (error: string | null) => void;

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

  // === NEW TAB SYSTEM ===
  // Main tab is always present and cannot be closed
  activeTabId: string; // 'main' or session ID
  openSessionTabs: string[]; // Session IDs (excluding 'main')

  setActiveTab: (tabId: string) => void;
  openSessionTab: (sessionId: string) => void;
  closeSessionTab: (sessionId: string) => void;
  closeAllSessionTabs: () => void;

  // === TREE STATE ===
  expandedNodes: Set<string>; // Format: "device:{id}" or "webview:{deviceId}:{url}"
  toggleNodeExpanded: (nodeId: string) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;

  // Tree selection
  selectedTreeItem: TreeSelection | null;
  setSelectedTreeItem: (item: TreeSelection | null) => void;

}

export const useUiStore = create<UiState>((set, get) => ({
  // Error state
  error: null,
  setError: (error) => set({ error }),

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

  // === NEW TAB SYSTEM ===
  activeTabId: "main",
  openSessionTabs: [],

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  openSessionTab: (sessionId) =>
    set((state) => {
      if (state.openSessionTabs.includes(sessionId)) {
        // Tab already open, just activate it
        return { activeTabId: sessionId };
      }
      return {
        openSessionTabs: [...state.openSessionTabs, sessionId],
        activeTabId: sessionId,
      };
    }),

  closeSessionTab: (sessionId) =>
    set((state) => {
      const newTabs = state.openSessionTabs.filter((id) => id !== sessionId);
      let newActiveTab = state.activeTabId;

      // If we're closing the active tab, switch to previous tab or main
      if (state.activeTabId === sessionId) {
        const closedIndex = state.openSessionTabs.indexOf(sessionId);
        if (closedIndex > 0) {
          // Go to previous session tab
          newActiveTab = state.openSessionTabs[closedIndex - 1];
        } else if (newTabs.length > 0) {
          // Go to first remaining session tab
          newActiveTab = newTabs[0];
        } else {
          // No session tabs left, go to main
          newActiveTab = "main";
        }
      }

      return {
        openSessionTabs: newTabs,
        activeTabId: newActiveTab,
      };
    }),

  closeAllSessionTabs: () =>
    set({
      openSessionTabs: [],
      activeTabId: "main",
    }),

  // === TREE STATE ===
  expandedNodes: new Set<string>(),

  toggleNodeExpanded: (nodeId) =>
    set((state) => {
      const newSet = new Set(state.expandedNodes);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return { expandedNodes: newSet };
    }),

  setNodeExpanded: (nodeId, expanded) =>
    set((state) => {
      const newSet = new Set(state.expandedNodes);
      if (expanded) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }
      return { expandedNodes: newSet };
    }),

  expandNode: (nodeId) => get().setNodeExpanded(nodeId, true),
  collapseNode: (nodeId) => get().setNodeExpanded(nodeId, false),

  // Tree selection
  selectedTreeItem: null,
  setSelectedTreeItem: (selectedTreeItem) => set({ selectedTreeItem }),
}));
