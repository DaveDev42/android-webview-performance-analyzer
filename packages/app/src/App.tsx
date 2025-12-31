import { useEffect, useCallback, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  MetricsChart,
  DomNodesChart,
  MiniChart,
  NetworkRequests,
  SessionDetail,
  SessionTabs,
  ExportDialog,
  ImportDialog,
  QuickConnectPanel,
  SessionFilters,
} from "./components";
import { toast } from "./components/ui/toaster";
import { formatBytes, formatDuration } from "./utils";
import {
  createTauRPCProxy,
  type PerformanceMetrics,
  type Device,
  type WebView,
} from "./bindings";
import type { NetworkEvent } from "./types";
import {
  useUiStore,
  useDeviceStore,
  useCdpStore,
  useMetricsStore,
  useSessionStore,
  useConnectionStore,
  getConnectionStateDisplay,
  type ConnectionPreset,
  type RecentConnection,
} from "./stores";

function App() {
  // Create TauRPC proxy
  const taurpc = useMemo(() => createTauRPCProxy(), []);

  // UI Store
  const {
    error,
    setError,
    showSessions,
    setShowSessions,
    toggleSessions,
    showDetailedCharts,
    toggleDetailedCharts,
    exportSession,
    setExportSession,
    showImport,
    setShowImport,
    selectedSessionForView,
    setSelectedSessionForView,
    openSessionTabs,
    openSessionTab,
  } = useUiStore();

  // Device Store
  const {
    devices,
    setDevices,
    selectedDevice,
    setSelectedDevice,
    webviews,
    setWebviews,
    portForwards,
    addPortForward,
    removePortForward,
    getPortForward,
    nextPort,
    incrementPort,
    loading,
    setLoading,
  } = useDeviceStore();

  // CDP Store
  const {
    cdpTargets,
    setCdpTargets,
    clearTargets,
    connectionState,
    setConnectionState,
    selectedTarget,
    setSelectedTarget,
    activePort,
    setActivePort,
  } = useCdpStore();

  // Metrics Store
  const {
    metrics,
    setMetrics,
    metricsHistory,
    addMetricsToHistory,
    clearHistory,
    networkRequests,
    addNetworkRequest,
    clearNetworkRequests,
    isCollecting,
    setIsCollecting,
    getHeapHistory,
    getNodeHistory,
  } = useMetricsStore();

  // Session Store
  const {
    currentSession,
    setCurrentSession,
    sessions,
    setSessions,
    removeSession,
    getFilteredSessions,
  } = useSessionStore();

  // Connection Store
  const { setAutoConnectStep, addRecentConnection } = useConnectionStore();

  // Local state for Quick Connect panel
  const [quickConnectOpen, setQuickConnectOpen] = useState(false);

  const refreshDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taurpc.api.get_devices();
      setDevices(result);
      if (selectedDevice && !result.find((d) => d.id === selectedDevice.id)) {
        setSelectedDevice(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, taurpc, setLoading, setError, setDevices, setSelectedDevice]);

  const loadWebviews = useCallback(
    async (deviceId: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await taurpc.api.get_webviews(deviceId);
        setWebviews(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [taurpc, setLoading, setError, setWebviews]
  );

  const loadSessions = useCallback(async () => {
    try {
      const result = await taurpc.api.list_sessions(50);
      setSessions(result);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }, [taurpc, setSessions]);

  const startPortForward = async (webview: { socket_name: string }) => {
    if (!selectedDevice) return;
    try {
      const port = nextPort;
      await taurpc.api.start_port_forward(selectedDevice.id, webview.socket_name, port);
      addPortForward({
        deviceId: selectedDevice.id,
        socketName: webview.socket_name,
        localPort: port,
      });
      incrementPort();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopPortForward = async (pf: { deviceId: string; localPort: number }) => {
    try {
      await taurpc.api.stop_port_forward(pf.deviceId, pf.localPort);
      removePortForward(pf.localPort);
      if (pf.localPort === activePort) {
        await disconnectCdp();
        setActivePort(null);
        clearTargets();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Auto-connect: Forward port -> Load targets -> Connect to first target
  const autoConnect = async (device: Device, webview: WebView) => {
    try {
      // Step 1: Forward port (or reuse existing)
      setAutoConnectStep("forwarding_port");
      const existingPf = getPortForward(webview.socket_name);
      let port: number;

      if (existingPf) {
        port = existingPf.localPort;
      } else {
        port = nextPort;
        await taurpc.api.start_port_forward(device.id, webview.socket_name, port);
        addPortForward({
          deviceId: device.id,
          socketName: webview.socket_name,
          localPort: port,
        });
        incrementPort();
      }

      // Step 2: Load CDP targets
      setAutoConnectStep("loading_targets");
      const targets = await taurpc.api.get_cdp_targets(port);
      setCdpTargets(targets);
      setActivePort(port);

      if (targets.length === 0) {
        throw new Error("No CDP targets available");
      }

      // Step 3: Connect to first target
      setAutoConnectStep("connecting_cdp");
      const target = targets[0];
      if (!target.webSocketDebuggerUrl) {
        throw new Error("No WebSocket URL available");
      }

      setConnectionState("Connecting");
      await taurpc.api.connect_cdp(target.webSocketDebuggerUrl);
      setConnectionState("Connected");
      setSelectedTarget(target);

      // Save to recent connections
      addRecentConnection({
        deviceId: device.id,
        deviceName: device.name,
        socketName: webview.socket_name,
        packageName: webview.package_name,
        targetTitle: target.title,
        targetUrl: target.url,
        targetId: target.id,
      });

      setAutoConnectStep("connected");
      toast.success("Connected", { description: target.title || webview.package_name || "WebView" });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setAutoConnectStep("error", errorMsg);
      toast.error("Connection failed", { description: errorMsg });
    }
  };

  // Handle Quick Connect selection
  const handleQuickConnect = async (item: ConnectionPreset | RecentConnection) => {
    setQuickConnectOpen(false);

    // Find the device
    const device = devices.find((d) => d.id === item.deviceId);
    if (!device) {
      toast.error("Device not found", { description: "The device is not connected" });
      return;
    }

    // Create a minimal WebView object
    const webview: WebView = {
      socket_name: item.socketName,
      package_name: item.packageName,
      pid: 0,
    };

    await autoConnect(device, webview);
  };

  const loadCdpTargets = async (port: number) => {
    try {
      const targets = await taurpc.api.get_cdp_targets(port);
      setCdpTargets(targets);
      setActivePort(port);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const connectCdp = async (target: { webSocketDebuggerUrl: string | null; title: string; url: string; id: string }) => {
    if (!target.webSocketDebuggerUrl) {
      setError("No WebSocket URL available for this target");
      return;
    }
    try {
      setConnectionState("Connecting");
      await taurpc.api.connect_cdp(target.webSocketDebuggerUrl);
      setConnectionState("Connected");
      setSelectedTarget(target as typeof selectedTarget);
    } catch (e) {
      setConnectionState("Disconnected");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const disconnectCdp = async () => {
    try {
      if (currentSession) {
        await endSession();
      }
      await taurpc.api.disconnect_cdp();
      setConnectionState("Disconnected");
      setSelectedTarget(null);
      setMetrics(null);
      setIsCollecting(false);
      clearHistory();
      clearNetworkRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startSession = async () => {
    if (!selectedDevice || !selectedTarget) return;
    try {
      const session = await taurpc.api.create_session({
        device_id: selectedDevice.id,
        device_name: selectedDevice.name,
        package_name: null,
        target_title: selectedTarget.title,
        webview_url: selectedTarget.url,
      });
      setCurrentSession(session);
      clearHistory();
      clearNetworkRequests();
      await taurpc.api.start_metrics_collection(1000);
      setIsCollecting(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const endSession = async () => {
    try {
      if (currentSession) {
        await taurpc.api.end_session(currentSession.id);
      }
      await taurpc.api.stop_metrics_collection();
      setIsCollecting(false);
      setCurrentSession(null);
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await taurpc.api.delete_session(sessionId);
      removeSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const fetchMetrics = useCallback(async () => {
    if (connectionState !== "Connected") return;
    try {
      const result = await taurpc.api.get_performance_metrics();
      setMetrics(result);
    } catch (e) {
      console.error("Failed to fetch metrics:", e);
    }
  }, [connectionState, taurpc, setMetrics]);

  // Setup Tauri event listeners
  useEffect(() => {
    let unlistenPerf: (() => void) | undefined;
    let unlistenNetwork: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenPerf = await listen<PerformanceMetrics>("metrics:performance", (event) => {
        setMetrics(event.payload);
        addMetricsToHistory(event.payload);
      });

      unlistenNetwork = await listen<NetworkEvent>("metrics:network", (event) => {
        if (event.payload.type === "NetworkComplete") {
          addNetworkRequest(event.payload);
        }
      });
    };

    setupListeners();
    return () => {
      unlistenPerf?.();
      unlistenNetwork?.();
    };
  }, [setMetrics, addMetricsToHistory, addNetworkRequest]);

  useEffect(() => {
    refreshDevices();
    loadSessions();
  }, [refreshDevices, loadSessions]);

  useEffect(() => {
    if (selectedDevice) {
      loadWebviews(selectedDevice.id);
    }
  }, [selectedDevice, loadWebviews]);

  useEffect(() => {
    if (!isCollecting) return;
    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, [isCollecting, fetchMetrics]);

  // Calculate chart data
  const heapHistory = getHeapHistory();
  const maxHeap = Math.max(...heapHistory, 1);
  const nodeHistory = getNodeHistory();
  const maxNodes = Math.max(...nodeHistory, 1);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header - integrated with macOS titlebar */}
      <header className="border-b border-gray-700 pl-20 pr-6 pt-4 pb-3 flex items-center justify-between titlebar-drag-region">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" title="Android WebView Performance Analyzer">AWPA</h1>
          {currentSession && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-300">Rec</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 titlebar-no-drag">
          {/* Quick Connect dropdown */}
          <div className="relative">
            <button
              onClick={() => setQuickConnectOpen(!quickConnectOpen)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {quickConnectOpen && (
              <QuickConnectPanel
                onConnect={handleQuickConnect}
                onClose={() => setQuickConnectOpen(false)}
                availableDeviceIds={devices.map((d) => d.id)}
              />
            )}
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Import
          </button>
          <button
            onClick={() => {
              toggleSessions();
              if (!showSessions) loadSessions();
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Sessions ({sessions.length})
          </button>
        </div>
      </header>

      <main className="p-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-4 mb-4">
            <p className="text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-sm text-red-400 hover:text-red-300 mt-2">
              Dismiss
            </button>
          </div>
        )}

        {/* Sessions Panel */}
        {showSessions && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Saved Sessions</h2>
              <button onClick={() => setShowSessions(false)} className="text-gray-400 hover:text-white">
                Close
              </button>
            </div>

            {/* Session Filters */}
            {sessions.length > 0 && (
              <div className="mb-4">
                <SessionFilters />
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">No saved sessions</p>
                <p className="text-sm text-gray-500 mt-2">Start a recording session to capture metrics</p>
              </div>
            ) : getFilteredSessions().length === 0 ? (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">No sessions match the filters</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filter criteria</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="text-left p-3">Target</th>
                      <th className="text-left p-3">Device</th>
                      <th className="text-left p-3">Started</th>
                      <th className="text-left p-3">Duration</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-right p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredSessions().map((session) => (
                      <tr key={session.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                        <td className="p-3">
                          <button
                            onClick={() => openSessionTab(session.id)}
                            className="text-left hover:text-blue-400"
                          >
                            <p className="font-medium truncate max-w-xs">
                              {session.display_name || session.target_title || "Untitled"}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-xs">
                              {session.webview_url}
                            </p>
                            {session.tags && session.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {session.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {session.tags.length > 3 && (
                                  <span className="text-xs text-gray-500">+{session.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-gray-400">
                          {session.device_name || session.device_id}
                        </td>
                        <td className="p-3 text-gray-400">
                          {new Date(session.started_at).toLocaleString()}
                        </td>
                        <td className="p-3 text-gray-400">
                          {session.ended_at ? formatDuration(session.ended_at - session.started_at) : "-"}
                        </td>
                        <td className="p-3">
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
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openSessionTab(session.id)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => setExportSession(session)}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                            >
                              Export
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Delete this session?")) deleteSession(session.id);
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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
                    selectedDevice?.id === device.id ? "ring-2 ring-blue-500" : "hover:bg-gray-750"
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
                  <span className="text-sm font-normal text-gray-400 ml-2">on {selectedDevice.name}</span>
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
                  <div key={webview.socket_name} className="bg-gray-800 rounded p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {webview.package_name || `PID ${webview.pid}`}
                        </p>
                        <p className="text-sm text-gray-400 truncate">{webview.socket_name}</p>
                      </div>
                      <div className="ml-4">
                        {pf ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-green-400">:{pf.localPort}</span>
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
                          <span className="text-xs text-purple-400">{cdpTargets.length} target(s)</span>
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
                {getConnectionStateDisplay(connectionState)}
              </span>
            </div>

            {cdpTargets.length === 0 && (
              <div className="bg-gray-800 rounded p-8 text-center">
                <p className="text-gray-400">No CDP targets loaded</p>
                <p className="text-sm text-gray-500 mt-2">Forward a port and click "Load Targets"</p>
              </div>
            )}

            {cdpTargets.length > 0 && connectionState === "Disconnected" && (
              <div className="space-y-2 mb-4">
                {cdpTargets.map((target) => (
                  <div key={target.id} className="bg-gray-800 rounded p-4">
                    <p className="font-medium truncate">{target.title || "Untitled"}</p>
                    <p className="text-sm text-gray-400 truncate">{target.url}</p>
                    <button
                      onClick={() => connectCdp(target)}
                      disabled={!target.webSocketDebuggerUrl}
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
                      <p className="font-medium truncate">{selectedTarget.title || "Untitled"}</p>
                      <p className="text-sm text-gray-400 truncate">{selectedTarget.url}</p>
                    </div>
                    <button
                      onClick={disconnectCdp}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Session Controls */}
                <div className="flex gap-2">
                  {!currentSession ? (
                    <button
                      onClick={startSession}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center justify-center gap-2"
                    >
                      <span className="w-2 h-2 bg-white rounded-full" />
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={endSession}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm flex items-center justify-center gap-2"
                    >
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Stop Recording
                    </button>
                  )}
                  <button
                    onClick={fetchMetrics}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    Fetch Now
                  </button>
                </div>

                {/* Current Session Info */}
                {currentSession && (
                  <div className="bg-gray-800 rounded p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Session ID:</span>
                      <span className="font-mono text-xs">{currentSession.id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400">Started:</span>
                      <span>{new Date(currentSession.started_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400">Data Points:</span>
                      <span>{metricsHistory.length}</span>
                    </div>
                  </div>
                )}

                {/* Performance Metrics Display */}
                {metrics && (
                  <div className="bg-gray-800 rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Performance Metrics</h3>
                      <button
                        onClick={toggleDetailedCharts}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {showDetailedCharts ? "Hide Charts" : "Show Charts"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">JS Heap Used</p>
                        <p className="text-lg font-mono">{formatBytes(metrics.js_heap_used_size)}</p>
                        {heapHistory.length > 1 && (
                          <MiniChart data={heapHistory} maxValue={maxHeap} color="#3b82f6" />
                        )}
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">DOM Nodes</p>
                        <p className="text-lg font-mono">
                          {metrics.dom_nodes?.toLocaleString() ?? "-"}
                        </p>
                        {nodeHistory.length > 1 && (
                          <MiniChart data={nodeHistory} maxValue={maxNodes} color="#22c55e" />
                        )}
                      </div>
                      <div className="bg-gray-900 rounded p-3">
                        <p className="text-gray-400">JS Heap Total</p>
                        <p className="text-lg font-mono">{formatBytes(metrics.js_heap_total_size)}</p>
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
                      Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}

                {/* Detailed Charts */}
                {showDetailedCharts && metricsHistory.length > 1 && (
                  <div className="space-y-4">
                    <MetricsChart data={metricsHistory} height={200} syncId="metrics" />
                    <DomNodesChart data={metricsHistory} height={150} syncId="metrics" />
                  </div>
                )}

                {/* Network Requests */}
                <NetworkRequests requests={networkRequests} maxDisplay={10} />
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
                      <td className="p-3 text-gray-400 truncate max-w-xs">{pf.socketName}</td>
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

      {/* Session Detail Modal */}
      {selectedSessionForView && (
        <SessionDetail
          session={selectedSessionForView}
          onClose={() => setSelectedSessionForView(null)}
          onDelete={deleteSession}
          onExport={(s) => {
            setSelectedSessionForView(null);
            setExportSession(s);
          }}
        />
      )}

      {/* Export Dialog */}
      {exportSession && (
        <ExportDialog
          session={exportSession}
          onClose={() => setExportSession(null)}
        />
      )}

      {/* Import Dialog */}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImportComplete={loadSessions}
        />
      )}

      {/* Session Tabs View */}
      {openSessionTabs.length > 0 && (
        <SessionTabs onDeleteSession={deleteSession} />
      )}
    </div>
  );
}

export default App;
