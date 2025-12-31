import { useEffect, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  SessionDetail,
  ExportDialog,
  ImportDialog,
  TabContainer,
  MainTab,
} from "./components";
import { toast } from "./components/ui/toaster";
import {
  createTauRPCProxy,
  type PerformanceMetrics,
  type Device,
  type WebView,
  type CdpTarget,
  type Session,
} from "./bindings";
import type { NetworkEvent } from "./types";
import {
  useUiStore,
  useDeviceStore,
  useCdpStore,
  useMetricsStore,
  useSessionStore,
  useConnectionStore,
} from "./stores";

function App() {
  // Create TauRPC proxy
  const taurpc = useMemo(() => createTauRPCProxy(), []);

  // UI Store
  const {
    error,
    setError,
    exportSession,
    setExportSession,
    showImport,
    setShowImport,
    openSessionTab,
    closeSessionTab,
  } = useUiStore();

  // Device Store
  const {
    setDevices,
    selectedDevice,
    setSelectedDevice,
    setWebviews,
    addPortForward,
    getPortForward,
    nextPort,
    incrementPort,
    loading,
    setLoading,
  } = useDeviceStore();

  // CDP Store
  const {
    setCdpTargets,
    connectionState,
    setConnectionState,
    selectedTarget,
    setSelectedTarget,
    setActivePort,
  } = useCdpStore();

  // Metrics Store
  const {
    setMetrics,
    addMetricsToHistory,
    clearHistory,
    addNetworkRequest,
    clearNetworkRequests,
    isCollecting,
    setIsCollecting,
  } = useMetricsStore();

  // Session Store
  const {
    currentSession,
    setCurrentSession,
    sessions,
    setSessions,
    removeSession,
  } = useSessionStore();

  // Connection Store
  const { setAutoConnectStep, addRecentConnection } = useConnectionStore();

  // ============ API Handlers ============

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

  const startPortForward = async (webview: WebView) => {
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

  const loadCdpTargets = async (port: number) => {
    try {
      const targets = await taurpc.api.get_cdp_targets(port);
      setCdpTargets(targets);
      setActivePort(port);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const connectCdp = async (target: CdpTarget) => {
    if (!target.webSocketDebuggerUrl) {
      setError("No WebSocket URL available for this target");
      return;
    }
    try {
      setConnectionState("Connecting");
      await taurpc.api.connect_cdp(target.webSocketDebuggerUrl);
      setConnectionState("Connected");
      setSelectedTarget(target);
    } catch (e) {
      setConnectionState("Disconnected");
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
      if (currentSession?.id === sessionId && isCollecting) {
        toast.error("Cannot delete active session", {
          description: "Stop recording first before deleting",
        });
        return;
      }

      if (currentSession?.id === sessionId) {
        await taurpc.api.stop_metrics_collection();
        setIsCollecting(false);
        setCurrentSession(null);
      }

      closeSessionTab(sessionId);
      await taurpc.api.delete_session(sessionId);
      removeSession(sessionId);
      toast.success("Session deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error("Failed to delete session", { description: msg });
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

  // ============ Event Handlers for MainTab ============

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleSelectWebView = (_webview: WebView) => {
    // WebView selected - handled by tree selection in DetailPanel
  };

  const handleNewSession = async (webview: WebView, _target: CdpTarget | null) => {
    if (!selectedDevice) return;

    // If not connected, auto-connect first
    if (connectionState !== "Connected") {
      await autoConnect(selectedDevice, webview);
    }

    // Then start session
    if (connectionState === "Connected" || selectedTarget) {
      await startSession();
    }
  };

  const handleSessionClick = (session: Session) => {
    openSessionTab(session.id);
  };

  // ============ Effects ============

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

  // ============ Render ============

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Error Display (floats above content when present) */}
      {error && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-red-900/95 border border-red-700 px-4 py-2 rounded-lg flex items-center gap-3 shadow-lg">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-sm text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* Main Content - Tab Container (takes full height) */}
      <div className="flex-1 overflow-hidden">
        <TabContainer
          mainTabContent={
            <MainTab
              onRefreshDevices={refreshDevices}
              onSelectDevice={handleSelectDevice}
              loading={loading}
              onSelectWebView={handleSelectWebView}
              onForwardPort={startPortForward}
              onLoadTargets={loadCdpTargets}
              onConnect={connectCdp}
              onDisconnect={disconnectCdp}
              onNewSession={handleNewSession}
              onSessionClick={handleSessionClick}
              onStartRecording={startSession}
              onStopRecording={endSession}
              onShowImport={() => setShowImport(true)}
            />
          }
          renderSessionTab={(sessionId) => {
            const session = sessions.find((s) => s.id === sessionId);
            if (!session) {
              return (
                <div className="h-full flex items-center justify-center text-gray-500">
                  Session not found
                </div>
              );
            }
            return (
              <SessionDetail
                session={session}
                isInTab={true}
                onClose={() => closeSessionTab(sessionId)}
                onDelete={deleteSession}
                onExport={(s) => setExportSession(s)}
              />
            );
          }}
        >
          {null}
        </TabContainer>
      </div>

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
    </div>
  );
}

export default App;
