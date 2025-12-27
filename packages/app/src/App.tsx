import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Device {
  id: string;
  name: string;
  status: string;
}

interface WebView {
  socket_name: string;
  pid: number;
  package_name: string | null;
}

interface PortForward {
  deviceId: string;
  socketName: string;
  localPort: number;
}

interface CdpTarget {
  id: string;
  title: string;
  url: string;
  websocket_debugger_url: string | null;
}

interface PerformanceMetrics {
  timestamp: number;
  js_heap_used_size: number | null;
  js_heap_total_size: number | null;
  dom_nodes: number | null;
  layout_count: number | null;
  script_duration: number | null;
  task_duration: number | null;
}

type ConnectionState = "Disconnected" | "Connecting" | "Connected";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [webviews, setWebviews] = useState<WebView[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPort, setNextPort] = useState(9222);

  // CDP State
  const [cdpTargets, setCdpTargets] = useState<CdpTarget[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("Disconnected");
  const [selectedTarget, setSelectedTarget] = useState<CdpTarget | null>(null);
  const [activePort, setActivePort] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  const refreshDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Device[]>("get_devices");
      setDevices(result);
      if (selectedDevice && !result.find((d) => d.id === selectedDevice.id)) {
        setSelectedDevice(null);
        setWebviews([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  const loadWebviews = useCallback(async (deviceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WebView[]>("get_webviews", {
        deviceId,
      });
      setWebviews(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const startPortForward = async (webview: WebView) => {
    if (!selectedDevice) return;

    try {
      const port = nextPort;
      await invoke("start_port_forward", {
        deviceId: selectedDevice.id,
        socketName: webview.socket_name,
        localPort: port,
      });
      setPortForwards((prev) => [
        ...prev,
        {
          deviceId: selectedDevice.id,
          socketName: webview.socket_name,
          localPort: port,
        },
      ]);
      setNextPort((p) => p + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopPortForward = async (pf: PortForward) => {
    try {
      await invoke("stop_port_forward", {
        deviceId: pf.deviceId,
        localPort: pf.localPort,
      });
      setPortForwards((prev) =>
        prev.filter((p) => p.localPort !== pf.localPort)
      );
      // Clear CDP state if this was the active port
      if (pf.localPort === activePort) {
        await disconnectCdp();
        setActivePort(null);
        setCdpTargets([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadCdpTargets = async (port: number) => {
    try {
      const targets = await invoke<CdpTarget[]>("get_cdp_targets", { port });
      setCdpTargets(targets);
      setActivePort(port);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const connectCdp = async (target: CdpTarget) => {
    if (!target.websocket_debugger_url) {
      setError("No WebSocket URL available for this target");
      return;
    }

    try {
      setConnectionState("Connecting");
      await invoke("connect_cdp", { wsUrl: target.websocket_debugger_url });
      setConnectionState("Connected");
      setSelectedTarget(target);
    } catch (e) {
      setConnectionState("Disconnected");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const disconnectCdp = async () => {
    try {
      await invoke("disconnect_cdp");
      setConnectionState("Disconnected");
      setSelectedTarget(null);
      setMetrics(null);
      setIsCollecting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startMetricsCollection = async () => {
    try {
      await invoke("start_metrics_collection", { pollIntervalMs: 1000 });
      setIsCollecting(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopMetricsCollection = async () => {
    try {
      await invoke("stop_metrics_collection");
      setIsCollecting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const fetchMetrics = async () => {
    if (connectionState !== "Connected") return;
    try {
      const result = await invoke<PerformanceMetrics>("get_performance_metrics");
      setMetrics(result);
    } catch (e) {
      console.error("Failed to fetch metrics:", e);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadWebviews(selectedDevice.id);
    }
  }, [selectedDevice, loadWebviews]);

  // Poll metrics when collecting
  useEffect(() => {
    if (!isCollecting) return;
    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, [isCollecting, connectionState]);

  const getPortForward = (socketName: string) => {
    return portForwards.find((pf) => pf.socketName === socketName);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-bold">AWPA</h1>
        <p className="text-sm text-gray-400">
          Android WebView Performance Analyzer
        </p>
      </header>

      <main className="p-6">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-4 mb-4">
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-400 hover:text-red-300 mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Devices Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Devices</h2>
              <button
                onClick={refreshDevices}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
              >
                {loading ? "..." : "Refresh"}
              </button>
            </div>

            {devices.length === 0 && !loading && (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">No devices connected</p>
                <p className="text-sm text-gray-500 mt-2">
                  Connect an Android device with USB debugging enabled
                </p>
              </div>
            )}

            <div className="space-y-2">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device)}
                  className={`w-full text-left bg-gray-800 rounded p-4 flex items-center justify-between transition-colors ${
                    selectedDevice?.id === device.id
                      ? "ring-2 ring-blue-500"
                      : "hover:bg-gray-750"
                  }`}
                >
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-400">{device.id}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      device.status === "device"
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}
                  >
                    {device.status}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* WebViews Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                WebViews
                {selectedDevice && (
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    on {selectedDevice.name}
                  </span>
                )}
              </h2>
              {selectedDevice && (
                <button
                  onClick={() => loadWebviews(selectedDevice.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                >
                  Refresh
                </button>
              )}
            </div>

            {!selectedDevice && (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">Select a device to view WebViews</p>
              </div>
            )}

            {selectedDevice && webviews.length === 0 && !loading && (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">No debuggable WebViews found</p>
                <p className="text-sm text-gray-500 mt-2">
                  Make sure the app has WebView debugging enabled
                </p>
              </div>
            )}

            <div className="space-y-2">
              {webviews.map((webview) => {
                const pf = getPortForward(webview.socket_name);
                return (
                  <div
                    key={webview.socket_name}
                    className="bg-gray-800 rounded p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {webview.package_name || `PID ${webview.pid}`}
                        </p>
                        <p className="text-sm text-gray-400 truncate">
                          {webview.socket_name}
                        </p>
                      </div>
                      <div className="ml-4">
                        {pf ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-green-400">
                              :{pf.localPort}
                            </span>
                            <button
                              onClick={() => stopPortForward(pf)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                            >
                              Stop
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startPortForward(webview)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                          >
                            Forward
                          </button>
                        )}
                      </div>
                    </div>
                    {pf && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => loadCdpTargets(pf.localPort)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                        >
                          Load Targets
                        </button>
                        {activePort === pf.localPort && (
                          <span className="text-xs text-purple-400">
                            {cdpTargets.length} target(s)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* CDP & Metrics Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">CDP Connection</h2>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  connectionState === "Connected"
                    ? "bg-green-900 text-green-300"
                    : connectionState === "Connecting"
                    ? "bg-yellow-900 text-yellow-300"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {connectionState}
              </span>
            </div>

            {cdpTargets.length === 0 && (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">No CDP targets loaded</p>
                <p className="text-sm text-gray-500 mt-2">
                  Forward a port and click "Load Targets"
                </p>
              </div>
            )}

            {cdpTargets.length > 0 && connectionState === "Disconnected" && (
              <div className="space-y-2 mb-4">
                {cdpTargets.map((target) => (
                  <div
                    key={target.id}
                    className="bg-gray-800 rounded p-4"
                  >
                    <p className="font-medium truncate">{target.title || "Untitled"}</p>
                    <p className="text-sm text-gray-400 truncate">{target.url}</p>
                    <button
                      onClick={() => connectCdp(target)}
                      disabled={!target.websocket_debugger_url}
                      className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}

            {connectionState === "Connected" && selectedTarget && (
              <div className="space-y-4">
                <div className="bg-gray-800 rounded p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {selectedTarget.title || "Untitled"}
                      </p>
                      <p className="text-sm text-gray-400 truncate">
                        {selectedTarget.url}
                      </p>
                    </div>
                    <button
                      onClick={disconnectCdp}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!isCollecting ? (
                    <button
                      onClick={startMetricsCollection}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Start Collecting
                    </button>
                  ) : (
                    <button
                      onClick={stopMetricsCollection}
                      className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
                    >
                      Stop Collecting
                    </button>
                  )}
                  <button
                    onClick={fetchMetrics}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    Fetch Now
                  </button>
                </div>

                {/* Performance Metrics Display */}
                {metrics && (
                  <div className="bg-gray-800 rounded p-4">
                    <h3 className="font-semibold mb-3">Performance Metrics</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">JS Heap Used</p>
                        <p className="text-lg font-mono">
                          {formatBytes(metrics.js_heap_used_size)}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">JS Heap Total</p>
                        <p className="text-lg font-mono">
                          {formatBytes(metrics.js_heap_total_size)}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">DOM Nodes</p>
                        <p className="text-lg font-mono">
                          {metrics.dom_nodes?.toLocaleString() ?? "-"}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">Layout Count</p>
                        <p className="text-lg font-mono">
                          {metrics.layout_count?.toLocaleString() ?? "-"}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">Script Duration</p>
                        <p className="text-lg font-mono">
                          {metrics.script_duration !== null
                            ? `${(metrics.script_duration * 1000).toFixed(1)} ms`
                            : "-"}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">Task Duration</p>
                        <p className="text-lg font-mono">
                          {metrics.task_duration !== null
                            ? `${(metrics.task_duration * 1000).toFixed(1)} ms`
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Last updated:{" "}
                      {new Date(metrics.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Active Port Forwards */}
        {portForwards.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Active Port Forwards</h2>
            <div className="bg-gray-800 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="text-left p-3">Local Port</th>
                    <th className="text-left p-3">Socket</th>
                    <th className="text-left p-3">Device</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portForwards.map((pf) => (
                    <tr key={pf.localPort} className="border-t border-gray-700">
                      <td className="p-3 font-mono">{pf.localPort}</td>
                      <td className="p-3 text-gray-400 truncate max-w-xs">
                        {pf.socketName}
                      </td>
                      <td className="p-3 text-gray-400">{pf.deviceId}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => loadCdpTargets(pf.localPort)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                          >
                            Targets
                          </button>
                          <button
                            onClick={() => stopPortForward(pf)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                          >
                            Stop
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
