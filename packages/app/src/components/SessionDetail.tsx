import { useState, useEffect, useMemo, useCallback } from "react";
import { MetricsChart, DomNodesChart } from "./MetricsChart";
import {
  createTauRPCProxy,
  type Session,
  type StoredMetric,
  type StoredNetworkRequest,
  type PerformanceMetrics,
} from "../bindings";
import { formatBytes, formatDuration, formatDateTime } from "../utils";

interface SessionDetailProps {
  session: Session;
  onClose: () => void;
  onDelete: (sessionId: string) => void;
  onExport: (session: Session) => void;
  isInTab?: boolean;
}

export function SessionDetail({
  session,
  onClose,
  onDelete,
  onExport,
  isInTab = false,
}: SessionDetailProps) {
  const taurpc = useMemo(() => createTauRPCProxy(), []);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [networkRequests, setNetworkRequests] = useState<StoredNetworkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "network">("overview");

  const loadSessionData = useCallback(async () => {
    setLoading(true);
    try {
      // Load metrics
      const storedMetrics = await taurpc.api.get_session_metrics(
        session.id,
        "performance",
        null,
        null,
        null
      );

      // Parse metrics data
      const parsedMetrics: PerformanceMetrics[] = storedMetrics.map((m: StoredMetric) => {
        const data = JSON.parse(m.data);
        return {
          timestamp: m.timestamp,
          js_heap_used_size: data.js_heap_used_size ?? null,
          js_heap_total_size: data.js_heap_total_size ?? null,
          dom_nodes: data.dom_nodes ?? null,
          layout_count: data.layout_count ?? null,
          script_duration: data.script_duration ?? null,
          task_duration: data.task_duration ?? null,
        };
      });
      setMetrics(parsedMetrics);

      // Load network requests
      const requests = await taurpc.api.get_session_network_requests(session.id, null);
      setNetworkRequests(requests);
    } catch (e) {
      console.error("Failed to load session data:", e);
    } finally {
      setLoading(false);
    }
  }, [session.id, taurpc]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  const duration = session.ended_at
    ? session.ended_at - session.started_at
    : Date.now() - session.started_at;

  // Calculate summary stats
  const avgHeapUsed =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.js_heap_used_size || 0), 0) / metrics.length
      : 0;
  const maxHeapUsed = Math.max(...metrics.map((m) => m.js_heap_used_size || 0));
  const avgDomNodes =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.dom_nodes || 0), 0) / metrics.length
      : 0;
  const totalRequests = networkRequests.length;
  const failedRequests = networkRequests.filter(
    (r) => r.status_code && r.status_code >= 400
  ).length;
  const avgResponseTime =
    networkRequests.length > 0
      ? networkRequests.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / networkRequests.length
      : 0;

  // When in tab mode, render without the modal wrapper
  if (isInTab) {
    return (
      <div className="flex flex-col h-full bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">
              {session.target_title || "Untitled Session"}
            </h2>
            <p className="text-sm text-gray-400 truncate max-w-md">{session.webview_url}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport(session)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Export
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this session?")) {
                  onDelete(session.id);
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Session Info */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Device</p>
              <p className="font-medium">{session.device_name || session.device_id}</p>
            </div>
            <div>
              <p className="text-gray-400">Started</p>
              <p className="font-medium">{formatDateTime(session.started_at)}</p>
            </div>
            <div>
              <p className="text-gray-400">Duration</p>
              <p className="font-medium">{formatDuration(duration)}</p>
            </div>
            <div>
              <p className="text-gray-400">Data Points</p>
              <p className="font-medium">{metrics.length}</p>
            </div>
            <div>
              <p className="text-gray-400">Status</p>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  session.status === "active"
                    ? "bg-green-900 text-green-300"
                    : session.status === "completed"
                    ? "bg-blue-900 text-blue-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {session.status}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "overview"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("network")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "network"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Network ({totalRequests})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading session data...</div>
            </div>
          ) : activeTab === "overview" ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg Heap Used</p>
                  <p className="text-2xl font-mono">{formatBytes(avgHeapUsed)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Max Heap Used</p>
                  <p className="text-2xl font-mono">{formatBytes(maxHeapUsed)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg DOM Nodes</p>
                  <p className="text-2xl font-mono">{Math.round(avgDomNodes).toLocaleString()}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg Response Time</p>
                  <p className="text-2xl font-mono">{avgResponseTime.toFixed(0)} ms</p>
                </div>
              </div>

              {/* Charts */}
              {metrics.length > 1 ? (
                <>
                  <MetricsChart data={metrics} height={250} />
                  <DomNodesChart data={metrics} height={200} />
                </>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                  <p className="text-gray-400">No metrics data available</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Network Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total Requests</p>
                  <p className="text-2xl font-mono">{totalRequests}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Failed</p>
                  <p className="text-2xl font-mono text-red-400">{failedRequests}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg Duration</p>
                  <p className="text-2xl font-mono">{avgResponseTime.toFixed(0)} ms</p>
                </div>
              </div>

              {/* Network Requests Table */}
              {networkRequests.length > 0 ? (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Method</th>
                        <th className="text-left p-3">URL</th>
                        <th className="text-right p-3">Duration</th>
                        <th className="text-right p-3">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkRequests.map((req) => (
                        <tr key={req.id} className="border-t border-gray-700">
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                req.status_code && req.status_code >= 400
                                  ? "bg-red-900 text-red-300"
                                  : req.status_code && req.status_code >= 300
                                  ? "bg-yellow-900 text-yellow-300"
                                  : "bg-green-900 text-green-300"
                              }`}
                            >
                              {req.status_code || "..."}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-gray-400">{req.method || "GET"}</td>
                          <td className="p-3 text-gray-300 truncate max-w-md">{req.url}</td>
                          <td className="p-3 text-right font-mono">
                            {req.duration_ms?.toFixed(0) || "-"} ms
                          </td>
                          <td className="p-3 text-right font-mono">{formatBytes(req.size_bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                  <p className="text-gray-400">No network requests recorded</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modal mode (default)
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">
              {session.target_title || "Untitled Session"}
            </h2>
            <p className="text-sm text-gray-400 truncate max-w-md">{session.webview_url}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport(session)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Export
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this session?")) {
                  onDelete(session.id);
                  onClose();
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Session Info */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Device</p>
              <p className="font-medium">{session.device_name || session.device_id}</p>
            </div>
            <div>
              <p className="text-gray-400">Started</p>
              <p className="font-medium">{formatDateTime(session.started_at)}</p>
            </div>
            <div>
              <p className="text-gray-400">Duration</p>
              <p className="font-medium">{formatDuration(duration)}</p>
            </div>
            <div>
              <p className="text-gray-400">Data Points</p>
              <p className="font-medium">{metrics.length}</p>
            </div>
            <div>
              <p className="text-gray-400">Status</p>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  session.status === "active"
                    ? "bg-green-900 text-green-300"
                    : session.status === "completed"
                    ? "bg-blue-900 text-blue-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {session.status}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "overview"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("network")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "network"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Network ({totalRequests})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading session data...</div>
            </div>
          ) : activeTab === "overview" ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg Heap Used</p>
                  <p className="text-2xl font-mono">{formatBytes(avgHeapUsed)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Max Heap Used</p>
                  <p className="text-2xl font-mono">{formatBytes(maxHeapUsed)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg DOM Nodes</p>
                  <p className="text-2xl font-mono">{Math.round(avgDomNodes).toLocaleString()}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg Response Time</p>
                  <p className="text-2xl font-mono">{avgResponseTime.toFixed(0)} ms</p>
                </div>
              </div>

              {/* Charts */}
              {metrics.length > 1 ? (
                <>
                  <MetricsChart data={metrics} height={250} />
                  <DomNodesChart data={metrics} height={200} />
                </>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                  <p className="text-gray-400">No metrics data available</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Network Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total Requests</p>
                  <p className="text-2xl font-mono">{totalRequests}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Failed</p>
                  <p className="text-2xl font-mono text-red-400">{failedRequests}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg Duration</p>
                  <p className="text-2xl font-mono">{avgResponseTime.toFixed(0)} ms</p>
                </div>
              </div>

              {/* Network Requests Table */}
              {networkRequests.length > 0 ? (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Method</th>
                        <th className="text-left p-3">URL</th>
                        <th className="text-right p-3">Duration</th>
                        <th className="text-right p-3">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkRequests.map((req) => (
                        <tr key={req.id} className="border-t border-gray-700">
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                req.status_code && req.status_code >= 400
                                  ? "bg-red-900 text-red-300"
                                  : req.status_code && req.status_code >= 300
                                  ? "bg-yellow-900 text-yellow-300"
                                  : "bg-green-900 text-green-300"
                              }`}
                            >
                              {req.status_code || "..."}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-gray-400">{req.method || "GET"}</td>
                          <td className="p-3 text-gray-300 truncate max-w-md">{req.url}</td>
                          <td className="p-3 text-right font-mono">
                            {req.duration_ms?.toFixed(0) || "-"} ms
                          </td>
                          <td className="p-3 text-right font-mono">{formatBytes(req.size_bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                  <p className="text-gray-400">No network requests recorded</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
