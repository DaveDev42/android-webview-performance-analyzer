export interface Device {
  id: string;
  name: string;
  status: string;
}

export interface WebView {
  socket_name: string;
  pid: number;
  package_name: string | null;
}

export interface PortForward {
  deviceId: string;
  socketName: string;
  localPort: number;
}

export interface CdpTarget {
  id: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string | null;
}

export interface PerformanceMetrics {
  timestamp: number;
  js_heap_used_size: number | null;
  js_heap_total_size: number | null;
  dom_nodes: number | null;
  layout_count: number | null;
  script_duration: number | null;
  task_duration: number | null;
}

export interface Session {
  id: string;
  device_id: string;
  device_name: string | null;
  webview_url: string | null;
  package_name: string | null;
  target_title: string | null;
  started_at: number;
  ended_at: number | null;
  status: "active" | "completed" | "aborted";
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

export interface StoredMetric {
  id: number;
  session_id: string;
  timestamp: number;
  metric_type: string;
  data: string;
}

export interface StoredNetworkRequest {
  id: string;
  session_id: string;
  url: string;
  method: string | null;
  status_code: number | null;
  request_time: number;
  response_time: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
  headers: string | null;
}

export type ConnectionState = "Disconnected" | "Connecting" | "Connected";
