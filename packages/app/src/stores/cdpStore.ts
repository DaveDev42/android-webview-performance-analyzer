import { create } from "zustand";
import type { CdpTarget, ConnectionState } from "../bindings";

interface CdpState {
  // CDP targets
  cdpTargets: CdpTarget[];
  setCdpTargets: (targets: CdpTarget[]) => void;
  clearTargets: () => void;

  // Connection state
  connectionState: ConnectionState;
  setConnectionState: (state: ConnectionState) => void;

  // Selected target
  selectedTarget: CdpTarget | null;
  setSelectedTarget: (target: CdpTarget | null) => void;

  // Active port
  activePort: number | null;
  setActivePort: (port: number | null) => void;

  // Reset all CDP state
  reset: () => void;
}

export const useCdpStore = create<CdpState>((set) => ({
  // CDP targets
  cdpTargets: [],
  setCdpTargets: (cdpTargets) => set({ cdpTargets }),
  clearTargets: () => set({ cdpTargets: [] }),

  // Connection state
  connectionState: "Disconnected",
  setConnectionState: (connectionState) => set({ connectionState }),

  // Selected target
  selectedTarget: null,
  setSelectedTarget: (selectedTarget) => set({ selectedTarget }),

  // Active port
  activePort: null,
  setActivePort: (activePort) => set({ activePort }),

  // Reset all CDP state
  reset: () =>
    set({
      cdpTargets: [],
      connectionState: "Disconnected",
      selectedTarget: null,
      activePort: null,
    }),
}));

// Helper to get connection state display string
export function getConnectionStateDisplay(state: ConnectionState): string {
  if (typeof state === "string") {
    return state;
  }
  return `Error: ${state.Error}`;
}
