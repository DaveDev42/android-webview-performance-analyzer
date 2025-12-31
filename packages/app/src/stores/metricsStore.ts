import { create } from "zustand";
import type { PerformanceMetrics } from "../bindings";
import type { NetworkEvent } from "../types";

const MAX_HISTORY_POINTS = 300; // 5 minutes at 1 second interval
const MAX_NETWORK_REQUESTS = 100;

export type TimeRange = "1m" | "5m" | "15m" | "30m" | "all" | "custom";

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

  // Time range selection
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  customTimeRange: { start: number; end: number } | null;
  setCustomTimeRange: (range: { start: number; end: number } | null) => void;

  // Brush/Zoom selection (for chart interaction)
  brushRange: { startIndex: number; endIndex: number } | null;
  setBrushRange: (range: { startIndex: number; endIndex: number } | null) => void;
  clearBrushRange: () => void;

  // Computed values
  getHeapHistory: () => number[];
  getNodeHistory: () => number[];
  getVisibleHistory: () => PerformanceMetrics[];
  getTimeRangeMs: () => number;

  // Reset all metrics state
  reset: () => void;
}

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  all: Infinity,
  custom: 0,
};

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

  // Time range selection
  timeRange: "all",
  setTimeRange: (timeRange) => set({ timeRange, brushRange: null }),
  customTimeRange: null,
  setCustomTimeRange: (customTimeRange) => set({ customTimeRange }),

  // Brush/Zoom selection
  brushRange: null,
  setBrushRange: (brushRange) => set({ brushRange }),
  clearBrushRange: () => set({ brushRange: null }),

  // Computed values
  getHeapHistory: () => {
    const visible = get().getVisibleHistory();
    return visible.map((m) => m.js_heap_used_size ?? 0);
  },
  getNodeHistory: () => {
    const visible = get().getVisibleHistory();
    return visible.map((m) => m.dom_nodes ?? 0);
  },

  getVisibleHistory: () => {
    const { metricsHistory, timeRange, customTimeRange, brushRange } = get();

    if (metricsHistory.length === 0) return [];

    // Apply brush range first if set
    if (brushRange) {
      return metricsHistory.slice(brushRange.startIndex, brushRange.endIndex + 1);
    }

    // Apply time range filter
    if (timeRange === "all") {
      return metricsHistory;
    }

    if (timeRange === "custom" && customTimeRange) {
      return metricsHistory.filter(
        (m) => m.timestamp >= customTimeRange.start && m.timestamp <= customTimeRange.end
      );
    }

    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[timeRange];
    const cutoff = now - rangeMs;

    return metricsHistory.filter((m) => m.timestamp >= cutoff);
  },

  getTimeRangeMs: () => {
    const { timeRange, customTimeRange } = get();
    if (timeRange === "custom" && customTimeRange) {
      return customTimeRange.end - customTimeRange.start;
    }
    return TIME_RANGE_MS[timeRange];
  },

  // Reset all metrics state
  reset: () =>
    set({
      metrics: null,
      metricsHistory: [],
      networkRequests: [],
      isCollecting: false,
      timeRange: "all",
      customTimeRange: null,
      brushRange: null,
    }),
}));
