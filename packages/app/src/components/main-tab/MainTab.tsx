import { TreePanel } from "./TreePanel";
import { DetailPanel } from "./DetailPanel";
import type { Device, WebView, CdpTarget, Session } from "../../bindings";
import type { TrimMemoryLevel } from "@/types/deviceProfiles";

interface MemoryInfo {
  total_kb: number;
  available_kb: number;
  free_kb: number;
  buffers_kb: number;
  cached_kb: number;
}

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

  // Memory Simulation
  onSendTrimMemory?: (deviceId: string, packageName: string, level: TrimMemoryLevel) => Promise<void>;
  onGetMeminfo?: (deviceId: string) => Promise<MemoryInfo>;
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
  onSendTrimMemory,
  onGetMeminfo,
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
          onSendTrimMemory={onSendTrimMemory}
          onGetMeminfo={onGetMeminfo}
        />
      </div>
    </div>
  );
}
