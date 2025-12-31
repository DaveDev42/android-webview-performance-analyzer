import { ChevronRight, Plus, RefreshCw, Smartphone, Globe, FileText, Download, Upload } from "lucide-react";
import { useUiStore, useSessionStore, useDeviceStore, useCdpStore, getUrlOrigin } from "../../stores";
import type { Device, WebView, Session, CdpTarget } from "../../bindings";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

interface TreePanelProps {
  onRefreshDevices: () => void;
  onSelectDevice: (device: Device) => void;
  onSelectWebView: (webview: WebView) => void;
  onNewSession: (webview: WebView, target: CdpTarget | null) => void;
  onSessionClick: (session: Session) => void;
  onShowImport: () => void;
  loading?: boolean;
}

export function TreePanel({
  onRefreshDevices,
  onSelectDevice,
  onSelectWebView,
  onNewSession,
  onSessionClick,
  onShowImport,
  loading,
}: TreePanelProps) {
  const { devices, selectedDevice, webviews } = useDeviceStore();
  const { cdpTargets, selectedTarget } = useCdpStore();
  const { sessions, currentSession, getImportedSessions, isImportedSession } = useSessionStore();
  const {
    expandedNodes,
    toggleNodeExpanded,
    setSelectedTreeItem,
  } = useUiStore();

  // Filter to non-imported sessions for tree display
  const regularSessions = sessions.filter((s) => !isImportedSession(s));
  const importedSessions = getImportedSessions();

  // Get sessions for a specific device and webview URL
  const getSessionsForWebView = (deviceId: string, webviewUrl: string) => {
    const targetOrigin = getUrlOrigin(webviewUrl);
    return regularSessions.filter(
      (s) => s.device_id === deviceId && getUrlOrigin(s.webview_url) === targetOrigin
    );
  };

  // Get unique webview URLs from sessions for a device
  const getSessionWebViewUrls = (deviceId: string) => {
    const urls = new Set<string>();
    regularSessions
      .filter((s) => s.device_id === deviceId)
      .forEach((s) => {
        if (s.webview_url) {
          urls.add(getUrlOrigin(s.webview_url));
        }
      });
    return Array.from(urls);
  };

  // Check if a node is expanded
  const isExpanded = (nodeId: string) => expandedNodes.has(nodeId);

  // Get status indicator color
  const getStatusColor = (session: Session) => {
    const isRecording = currentSession?.id === session.id;
    if (isRecording) return "bg-green-500 animate-pulse";
    switch (session.status) {
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "aborted":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">Devices</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowImport}
            className="h-7 w-7 p-0"
            title="Import Session"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshDevices}
            disabled={loading}
            className="h-7 w-7 p-0"
            title="Refresh Devices"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {devices.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No devices connected
          </div>
        ) : (
          <div className="space-y-1">
            {devices.map((device) => {
              const deviceNodeId = `device:${device.id}`;
              const isDeviceExpanded = isExpanded(deviceNodeId);
              const isDeviceSelected = selectedDevice?.id === device.id;

              // Get webviews for this device (if selected)
              const deviceWebviews = isDeviceSelected ? webviews : [];

              // Get session URLs for this device (for showing sessions without active webview)
              const sessionUrls = getSessionWebViewUrls(device.id);

              return (
                <div key={device.id}>
                  {/* Device Node */}
                  <button
                    onClick={() => {
                      toggleNodeExpanded(deviceNodeId);
                      onSelectDevice(device);
                      setSelectedTreeItem({ type: "device", id: device.id });
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded text-left",
                      "hover:bg-gray-800 transition-colors",
                      isDeviceSelected && "bg-gray-800"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-gray-500 transition-transform shrink-0",
                        isDeviceExpanded && "rotate-90"
                      )}
                    />
                    <Smartphone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-200 truncate flex-1">
                      {device.name || device.id}
                    </span>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        device.status === "device" ? "bg-green-500" : "bg-yellow-500"
                      )}
                    />
                  </button>

                  {/* WebViews (expanded) */}
                  {isDeviceExpanded && isDeviceSelected && (
                    <div className="ml-4 mt-1 space-y-1">
                      {deviceWebviews.length === 0 && sessionUrls.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 pl-6">
                          No WebViews
                        </div>
                      ) : (
                        <>
                          {/* Active WebViews from ADB */}
                          {deviceWebviews.map((webview) => {
                            const webviewNodeId = `webview:${device.id}:${webview.socket_name}`;
                            const isWebViewExpanded = isExpanded(webviewNodeId);

                            // Find matching CDP target for URL
                            const matchingTarget = cdpTargets.find(
                              (t) => t.url && selectedTarget?.id === t.id
                            );
                            const webviewUrl = matchingTarget?.url || "";
                            const webviewSessions = getSessionsForWebView(device.id, webviewUrl);

                            return (
                              <div key={webview.socket_name}>
                                {/* WebView Node */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      toggleNodeExpanded(webviewNodeId);
                                      onSelectWebView(webview);
                                      setSelectedTreeItem({
                                        type: "webview",
                                        id: webview.socket_name,
                                        deviceId: device.id,
                                      });
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 flex-1 px-2 py-1 rounded text-left",
                                      "hover:bg-gray-800 transition-colors"
                                    )}
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "w-3 h-3 text-gray-500 transition-transform shrink-0",
                                        isWebViewExpanded && "rotate-90"
                                      )}
                                    />
                                    <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    <span className="text-xs text-gray-300 truncate">
                                      {webview.package_name || `PID ${webview.pid}`}
                                    </span>
                                  </button>

                                  {/* New Session Button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onNewSession(webview, matchingTarget ?? null)}
                                    className="h-6 w-6 p-0 shrink-0"
                                    title="New Session"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>

                                {/* Sessions under this WebView */}
                                {isWebViewExpanded && webviewSessions.length > 0 && (
                                  <div className="ml-5 mt-1 space-y-0.5">
                                    {webviewSessions.map((session) => (
                                      <SessionNode
                                        key={session.id}
                                        session={session}
                                        isRecording={currentSession?.id === session.id}
                                        onClick={() => onSessionClick(session)}
                                        statusColor={getStatusColor(session)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Sessions from past (no active webview) */}
                          {sessionUrls
                            .filter(
                              (url) =>
                                !deviceWebviews.some(() => {
                                  const target = cdpTargets.find((t) => t.id === selectedTarget?.id);
                                  return target?.url && getUrlOrigin(target.url) === url;
                                })
                            )
                            .map((urlOrigin) => {
                              const urlSessions = getSessionsForWebView(device.id, urlOrigin);
                              if (urlSessions.length === 0) return null;

                              const urlNodeId = `url:${device.id}:${urlOrigin}`;
                              const isUrlExpanded = isExpanded(urlNodeId);

                              return (
                                <div key={urlOrigin}>
                                  <button
                                    onClick={() => toggleNodeExpanded(urlNodeId)}
                                    className="flex items-center gap-2 w-full px-2 py-1 rounded text-left hover:bg-gray-800"
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "w-3 h-3 text-gray-500 transition-transform",
                                        isUrlExpanded && "rotate-90"
                                      )}
                                    />
                                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="text-xs text-gray-400 truncate">
                                      {urlOrigin}
                                    </span>
                                  </button>

                                  {isUrlExpanded && (
                                    <div className="ml-5 mt-1 space-y-0.5">
                                      {urlSessions.map((session) => (
                                        <SessionNode
                                          key={session.id}
                                          session={session}
                                          isRecording={currentSession?.id === session.id}
                                          onClick={() => onSessionClick(session)}
                                          statusColor={getStatusColor(session)}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Imported Sessions Section */}
        {importedSessions.length > 0 && (
          <>
            <div className="border-t border-gray-700 my-3" />
            <div>
              <button
                onClick={() => toggleNodeExpanded("imported")}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-gray-800"
              >
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-gray-500 transition-transform",
                    isExpanded("imported") && "rotate-90"
                  )}
                />
                <Download className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Imported Sessions</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {importedSessions.length}
                </span>
              </button>

              {isExpanded("imported") && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {importedSessions.map((session) => (
                    <SessionNode
                      key={session.id}
                      session={session}
                      isRecording={false}
                      onClick={() => onSessionClick(session)}
                      statusColor="bg-gray-500"
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Session Node Component
interface SessionNodeProps {
  session: Session;
  isRecording: boolean;
  onClick: () => void;
  statusColor: string;
}

function SessionNode({ session, isRecording, onClick, statusColor }: SessionNodeProps) {
  const title = session.display_name || session.target_title || "Session";

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1 rounded text-left hover:bg-gray-800 transition-colors"
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", statusColor)} />
      <FileText className="w-3 h-3 text-gray-500 shrink-0" />
      <span className="text-xs text-gray-300 truncate">{title}</span>
      {isRecording && (
        <span className="text-[10px] text-green-400 ml-auto shrink-0">REC</span>
      )}
    </button>
  );
}
