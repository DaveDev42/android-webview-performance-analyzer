import { Play, Square, Wifi, WifiOff, RefreshCw, Zap } from "lucide-react";
import { useUiStore, useDeviceStore, useCdpStore, useMetricsStore, useSessionStore } from "../../stores";
import type { WebView, CdpTarget } from "../../bindings";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { formatBytes } from "../../utils";
import { MiniChart } from "../MetricsChart";

interface DetailPanelProps {
  onConnect: (target: CdpTarget) => void;
  onDisconnect: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onLoadTargets: (port: number) => void;
  onForwardPort: (webview: WebView) => void;
}

// Helper to get connection state display
function getConnectionDisplay(state: string | { Error: string }) {
  if (typeof state === "string") {
    switch (state) {
      case "Connected":
        return { text: "Connected", color: "green" };
      case "Connecting":
        return { text: "Connecting...", color: "yellow" };
      case "Disconnected":
        return { text: "Disconnected", color: "gray" };
      default:
        return { text: state, color: "gray" };
    }
  }
  return { text: `Error: ${state.Error}`, color: "red" };
}

export function DetailPanel({
  onConnect,
  onDisconnect,
  onStartRecording,
  onStopRecording,
  onLoadTargets,
  onForwardPort,
}: DetailPanelProps) {
  const { selectedTreeItem } = useUiStore();
  const { selectedDevice, webviews, getPortForward } = useDeviceStore();
  const { cdpTargets, connectionState, selectedTarget } = useCdpStore();
  const { metrics, isCollecting, getHeapHistory, getNodeHistory } = useMetricsStore();
  const { currentSession } = useSessionStore();

  const isConnected = connectionState === "Connected";
  const connectionDisplay = getConnectionDisplay(connectionState);

  // Render based on selected tree item
  if (!selectedTreeItem) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a device or WebView</p>
          <p className="text-xs mt-1 opacity-75">to see details and controls</p>
        </div>
      </div>
    );
  }

  // Device Detail View
  if (selectedTreeItem.type === "device" && selectedDevice) {
    return (
      <div className="h-full p-4 overflow-y-auto">
        <div className="space-y-4">
          {/* Device Info */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">Device Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-gray-200">{selectedDevice.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ID</span>
                <span className="text-gray-200 font-mono text-xs">{selectedDevice.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <Badge variant={selectedDevice.status === "device" ? "success" : "default"}>
                  {selectedDevice.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* WebViews Summary */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">
              WebViews ({webviews.length})
            </h3>
            {webviews.length === 0 ? (
              <p className="text-sm text-gray-500">No WebViews detected</p>
            ) : (
              <div className="space-y-2">
                {webviews.slice(0, 5).map((wv) => (
                  <div key={wv.socket_name} className="text-xs">
                    <span className="text-gray-300">
                      {wv.package_name || `PID ${wv.pid}`}
                    </span>
                  </div>
                ))}
                {webviews.length > 5 && (
                  <p className="text-xs text-gray-500">
                    +{webviews.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // WebView Detail View
  if (selectedTreeItem.type === "webview") {
    const webview = webviews.find((w) => w.socket_name === selectedTreeItem.id);
    const portForward = webview ? getPortForward(webview.socket_name) : null;

    return (
      <div className="h-full p-4 overflow-y-auto">
        <div className="space-y-4">
          {/* WebView Info */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">WebView Info</h3>
            {webview ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Package</span>
                  <span className="text-gray-200">{webview.package_name || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">PID</span>
                  <span className="text-gray-200">{webview.pid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Socket</span>
                  <span className="text-gray-200 font-mono text-xs truncate max-w-[200px]">
                    {webview.socket_name}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">WebView not found</p>
            )}
          </div>

          {/* Port Forward Control */}
          {webview && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-200 mb-3">Connection</h3>
              <div className="space-y-3">
                {portForward ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Port</span>
                      <Badge variant="secondary">:{portForward.localPort}</Badge>
                    </div>
                    <Button
                      onClick={() => onLoadTargets(portForward.localPort)}
                      size="sm"
                      variant="secondary"
                      className="w-full"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Load Targets
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => onForwardPort(webview)}
                    size="sm"
                    className="w-full"
                  >
                    Forward Port
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* CDP Targets */}
          {cdpTargets.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-200 mb-3">
                Targets ({cdpTargets.length})
              </h3>
              <div className="space-y-2">
                {cdpTargets.map((target) => (
                  <div
                    key={target.id}
                    className={cn(
                      "p-2 rounded border text-sm cursor-pointer",
                      "hover:bg-gray-700 transition-colors",
                      selectedTarget?.id === target.id
                        ? "border-blue-500 bg-gray-700"
                        : "border-gray-600"
                    )}
                    onClick={() => !isConnected && onConnect(target)}
                  >
                    <div className="font-medium text-gray-200 truncate">
                      {target.title || "Untitled"}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-1">
                      {target.url}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connection Status & Controls */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-200">Status</h3>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-gray-500" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    connectionDisplay.color === "green" && "text-green-400",
                    connectionDisplay.color === "yellow" && "text-yellow-400",
                    connectionDisplay.color === "red" && "text-red-400",
                    connectionDisplay.color === "gray" && "text-gray-400"
                  )}
                >
                  {connectionDisplay.text}
                </span>
              </div>
            </div>

            {isConnected && (
              <div className="space-y-2">
                <Button
                  onClick={onDisconnect}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Disconnect
                </Button>

                {isCollecting ? (
                  <Button
                    onClick={onStopRecording}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                ) : (
                  <Button
                    onClick={onStartRecording}
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Live Metrics (when recording) */}
          {isCollecting && metrics && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-200 mb-3">
                Live Metrics
                {currentSession && (
                  <span className="ml-2 text-xs text-green-400">● Recording</span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">JS Heap</div>
                  <div className="text-lg font-medium text-gray-200">
                    {formatBytes(metrics.js_heap_used_size)}
                  </div>
                  <MiniChart
                    data={getHeapHistory()}
                    maxValue={Math.max(...getHeapHistory(), 1)}
                    color="#3b82f6"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">DOM Nodes</div>
                  <div className="text-lg font-medium text-gray-200">
                    {metrics.dom_nodes?.toLocaleString() || 0}
                  </div>
                  <MiniChart
                    data={getNodeHistory()}
                    maxValue={Math.max(...getNodeHistory(), 1)}
                    color="#10b981"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default / Session selected in tree
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <p className="text-sm">Select a device or WebView</p>
    </div>
  );
}
