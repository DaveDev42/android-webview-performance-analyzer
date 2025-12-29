import { create } from "zustand";
import type { Device, WebView } from "../bindings";
import type { PortForward } from "../types";

interface DeviceState {
  // Device list
  devices: Device[];
  setDevices: (devices: Device[]) => void;

  // Selected device
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;

  // WebViews for selected device
  webviews: WebView[];
  setWebviews: (webviews: WebView[]) => void;

  // Port forwards
  portForwards: PortForward[];
  addPortForward: (pf: PortForward) => void;
  removePortForward: (localPort: number) => void;
  getPortForward: (socketName: string) => PortForward | undefined;

  // Port counter
  nextPort: number;
  incrementPort: () => void;

  // Loading state
  loading: boolean;
  setLoading: (loading: boolean) => void;

  // Reset state when device disconnects
  resetWebviews: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  // Device list
  devices: [],
  setDevices: (devices) => set({ devices }),

  // Selected device
  selectedDevice: null,
  setSelectedDevice: (selectedDevice) =>
    set({ selectedDevice, webviews: [] }),

  // WebViews for selected device
  webviews: [],
  setWebviews: (webviews) => set({ webviews }),

  // Port forwards
  portForwards: [],
  addPortForward: (pf) =>
    set((state) => ({ portForwards: [...state.portForwards, pf] })),
  removePortForward: (localPort) =>
    set((state) => ({
      portForwards: state.portForwards.filter((p) => p.localPort !== localPort),
    })),
  getPortForward: (socketName) =>
    get().portForwards.find((pf) => pf.socketName === socketName),

  // Port counter
  nextPort: 9222,
  incrementPort: () => set((state) => ({ nextPort: state.nextPort + 1 })),

  // Loading state
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Reset state when device disconnects
  resetWebviews: () => set({ webviews: [] }),
}));
