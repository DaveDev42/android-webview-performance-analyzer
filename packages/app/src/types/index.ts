// Frontend-only types (not from TauRPC bindings)

export interface PortForward {
  deviceId: string;
  socketName: string;
  localPort: number;
}

export interface NetworkEvent {
  type: "NetworkRequest" | "NetworkResponse" | "NetworkComplete";
  request_id: string;
  url?: string;
  method?: string;
  status?: number;
  duration_ms?: number;
  size_bytes?: number;
  timestamp?: number;
}

// Re-export types from bindings for convenience
export type {
  Device,
  WebView,
  CdpTarget,
  PerformanceMetrics,
  Session,
  SessionStatus,
  StoredMetric,
  StoredNetworkRequest,
  MetricType,
  ConnectionState,
  PortForwardResult,
  CreateSessionParams,
} from "../bindings";
