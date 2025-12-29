import { create } from "zustand";
import type { PerformanceMetrics } from "../bindings";
import type { NetworkEvent } from "../types";

const MAX_HISTORY_POINTS = 60;
const MAX_NETWORK_REQUESTS = 50;

interface MetricsState {
  // Current metrics
  metrics: PerformanceMetrics | null;
  setMetrics: (metrics: PerformanceMetrics | null) => void;

  // Metrics history
  metricsHistory: PerformanceMetrics[];
  addMetricsToHistory: (metrics: PerformanceMetrics) => void;
  clearHistory: () => void;

  // Network requests
  networkRequests: NetworkEvent[];
  addNetworkRequest: (request: NetworkEvent) => void;
  clearNetworkRequests: () => void;

  // Collection state
  isCollecting: boolean;
  setIsCollecting: (isCollecting: boolean) => void;

  // Computed values
  getHeapHistory: () => number[];
  getNodeHistory: () => number[];

  // Reset all metrics state
  reset: () => void;
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  // Current metrics
  metrics: null,
  setMetrics: (metrics) => set({ metrics }),

  // Metrics history
  metricsHistory: [],
  addMetricsToHistory: (metrics) =>
    set((state) => ({
      metricsHistory: [...state.metricsHistory, metrics].slice(-MAX_HISTORY_POINTS),
    })),
  clearHistory: () => set({ metricsHistory: [] }),

  // Network requests
  networkRequests: [],
  addNetworkRequest: (request) =>
    set((state) => ({
      networkRequests: [request, ...state.networkRequests].slice(0, MAX_NETWORK_REQUESTS),
    })),
  clearNetworkRequests: () => set({ networkRequests: [] }),

  // Collection state
  isCollecting: false,
  setIsCollecting: (isCollecting) => set({ isCollecting }),

  // Computed values
  getHeapHistory: () => get().metricsHistory.map((m) => m.js_heap_used_size ?? 0),
  getNodeHistory: () => get().metricsHistory.map((m) => m.dom_nodes ?? 0),

  // Reset all metrics state
  reset: () =>
    set({
      metrics: null,
      metricsHistory: [],
      networkRequests: [],
      isCollecting: false,
    }),
}));
