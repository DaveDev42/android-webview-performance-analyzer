import { create } from "zustand";
import { persist } from "zustand/middleware";

// Auto-connect workflow steps
export type AutoConnectStep =
  | "idle"
  | "forwarding_port"
  | "loading_targets"
  | "connecting_cdp"
  | "connected"
  | "error";

// A saved connection preset (favorite)
export interface ConnectionPreset {
  id: string;
  name: string;
  deviceId: string;
  deviceName: string;
  socketName: string;
  packageName: string | null;
  createdAt: number;
  lastUsedAt: number;
}

// A recent connection for quick reconnect
export interface RecentConnection {
  id: string;
  deviceId: string;
  deviceName: string;
  socketName: string;
  packageName: string | null;
  targetTitle: string | null;
  targetUrl: string | null;
  targetId: string | null;
  lastConnectedAt: number;
}

const MAX_RECENT_CONNECTIONS = 10;

interface ConnectionState {
  // Auto-connect state (ephemeral)
  autoConnectStep: AutoConnectStep;
  autoConnectError: string | null;
  isAutoConnecting: boolean;
  setAutoConnectStep: (step: AutoConnectStep, error?: string) => void;
  resetAutoConnect: () => void;

  // Connection presets (persisted)
  presets: ConnectionPreset[];
  addPreset: (preset: Omit<ConnectionPreset, "id" | "createdAt" | "lastUsedAt">) => void;
  removePreset: (id: string) => void;
  updatePresetLastUsed: (id: string) => void;
  renamePreset: (id: string, name: string) => void;

  // Recent connections (persisted)
  recentConnections: RecentConnection[];
  addRecentConnection: (connection: Omit<RecentConnection, "id" | "lastConnectedAt">) => void;
  clearRecentConnections: () => void;

  // Advanced mode toggle (persisted)
  advancedMode: boolean;
  setAdvancedMode: (advanced: boolean) => void;

  // Quick connect panel visibility
  showQuickConnect: boolean;
  setShowQuickConnect: (show: boolean) => void;

  // Find matching preset/recent for current selection
  getMatchingPreset: (deviceId: string, socketName: string) => ConnectionPreset | undefined;
  getMatchingRecent: (deviceId: string, socketName: string) => RecentConnection | undefined;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      // Auto-connect state
      autoConnectStep: "idle",
      autoConnectError: null,
      isAutoConnecting: false,
      setAutoConnectStep: (step, error) =>
        set({
          autoConnectStep: step,
          autoConnectError: error ?? null,
          isAutoConnecting: step !== "idle" && step !== "connected" && step !== "error",
        }),
      resetAutoConnect: () =>
        set({
          autoConnectStep: "idle",
          autoConnectError: null,
          isAutoConnecting: false,
        }),

      // Presets
      presets: [],
      addPreset: (preset) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((state) => ({
          presets: [
            ...state.presets,
            { ...preset, id, createdAt: now, lastUsedAt: now },
          ],
        }));
      },
      removePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
        })),
      updatePresetLastUsed: (id) =>
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === id ? { ...p, lastUsedAt: Date.now() } : p
          ),
        })),
      renamePreset: (id, name) =>
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === id ? { ...p, name } : p
          ),
        })),

      // Recent connections
      recentConnections: [],
      addRecentConnection: (connection) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((state) => {
          // Remove existing connection with same device+socket
          const filtered = state.recentConnections.filter(
            (c) => !(c.deviceId === connection.deviceId && c.socketName === connection.socketName)
          );
          // Add new connection at the beginning
          const updated = [{ ...connection, id, lastConnectedAt: now }, ...filtered];
          // Keep only the most recent ones
          return { recentConnections: updated.slice(0, MAX_RECENT_CONNECTIONS) };
        });
      },
      clearRecentConnections: () => set({ recentConnections: [] }),

      // Advanced mode
      advancedMode: false,
      setAdvancedMode: (advancedMode) => set({ advancedMode }),

      // Quick connect panel
      showQuickConnect: false,
      setShowQuickConnect: (showQuickConnect) => set({ showQuickConnect }),

      // Helpers
      getMatchingPreset: (deviceId, socketName) =>
        get().presets.find(
          (p) => p.deviceId === deviceId && p.socketName === socketName
        ),
      getMatchingRecent: (deviceId, socketName) =>
        get().recentConnections.find(
          (c) => c.deviceId === deviceId && c.socketName === socketName
        ),
    }),
    {
      name: "awpa-connections",
      version: 1,
      partialize: (state) => ({
        presets: state.presets,
        recentConnections: state.recentConnections,
        advancedMode: state.advancedMode,
      }),
    }
  )
);
