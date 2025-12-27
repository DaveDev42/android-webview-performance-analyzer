export type SessionStatus = "active" | "completed" | "error";

export interface Session {
  id: string;
  deviceId: string;
  deviceName: string | null;
  webviewUrl: string | null;
  packageName: string | null;
  targetTitle: string | null;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  metadata: Record<string, unknown> | null;
}

export interface Metric {
  id: number;
  sessionId: string;
  timestamp: number;
  metricType: MetricType;
  data: MetricData;
}

export type MetricType = "cwv" | "memory" | "cpu" | "network";

export interface CoreWebVitalsData {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

export interface MemoryData {
  jsHeapUsedSize: number;
  jsHeapTotalSize: number;
  domNodes?: number;
}

export interface CpuData {
  usage: number;
}

export interface NetworkSummaryData {
  requestCount: number;
  totalSize: number;
  avgResponseTime: number;
}

export type MetricData =
  | CoreWebVitalsData
  | MemoryData
  | CpuData
  | NetworkSummaryData;

export interface NetworkRequest {
  id: string;
  sessionId: string;
  url: string;
  method: string | null;
  statusCode: number | null;
  requestTime: number;
  responseTime: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  headers: Record<string, string> | null;
}

export interface QueryOptions {
  startTime?: number;
  endTime?: number;
  metricTypes?: MetricType[];
  limit?: number;
  offset?: number;
}
