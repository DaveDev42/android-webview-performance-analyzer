import { TreePanel } from "./TreePanel";
import { DetailPanel } from "./DetailPanel";
import type { Device, WebView, CdpTarget, Session } from "../../bindings";

interface MainTabProps {
  // Device actions
  onRefreshDevices: () => void;
  onSelectDevice: (device: Device) => void;
  loading?: boolean;

  // WebView actions
  onSelectWebView: (webview: WebView) => void;
  onForwardPort: (webview: WebView) => void;
  onLoadTargets: (port: number) => void;

  // CDP actions
  onConnect: (target: CdpTarget) => void;
  onDisconnect: () => void;

  // Session actions
  onNewSession: (webview: WebView, target: CdpTarget | null) => void;
  onSessionClick: (session: Session) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;

  // Import
  onShowImport: () => void;
}

export function MainTab({
  onRefreshDevices,
  onSelectDevice,
  loading,
  onSelectWebView,
  onForwardPort,
  onLoadTargets,
  onConnect,
  onDisconnect,
  onNewSession,
  onSessionClick,
  onStartRecording,
  onStopRecording,
  onShowImport,
}: MainTabProps) {
  return (
    <div className="flex h-full">
      {/* Left: Tree Panel */}
      <div className="w-72 shrink-0">
        <TreePanel
          onRefreshDevices={onRefreshDevices}
          onSelectDevice={onSelectDevice}
          onSelectWebView={onSelectWebView}
          onNewSession={onNewSession}
          onSessionClick={onSessionClick}
          onShowImport={onShowImport}
          loading={loading}
        />
      </div>

      {/* Right: Detail Panel */}
      <div className="flex-1 bg-gray-850">
        <DetailPanel
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          onLoadTargets={onLoadTargets}
          onForwardPort={onForwardPort}
        />
      </div>
    </div>
  );
}
