import { useConnectionStore, type ConnectionPreset, type RecentConnection } from "@/stores";
import { Button } from "./ui/button";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface QuickConnectPanelProps {
  onConnect: (item: ConnectionPreset | RecentConnection) => void;
  onClose: () => void;
  availableDeviceIds: string[];
}

export function QuickConnectPanel({ onConnect, onClose, availableDeviceIds }: QuickConnectPanelProps) {
  const { presets, recentConnections, removePreset, clearRecentConnections } = useConnectionStore();

  const isDeviceAvailable = (deviceId: string) => availableDeviceIds.includes(deviceId);

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-medium">Quick Connect</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {/* Favorites */}
        {presets.length > 0 && (
          <div className="p-3">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Favorites</h4>
            <div className="space-y-2">
              {presets.map((preset) => {
                const available = isDeviceAvailable(preset.deviceId);
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      available ? "bg-gray-700/50 hover:bg-gray-700" : "bg-gray-800 opacity-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="font-medium truncate">{preset.name}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{preset.deviceName}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="sm"
                        variant={available ? "default" : "secondary"}
                        disabled={!available}
                        onClick={() => onConnect(preset)}
                      >
                        {available ? "Connect" : "Offline"}
                      </Button>
                      <button
                        onClick={() => removePreset(preset.id)}
                        className="p-1 text-gray-400 hover:text-red-400"
                        title="Remove from favorites"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Connections */}
        {recentConnections.length > 0 && (
          <div className="p-3 border-t border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Recent</h4>
              <button
                onClick={clearRecentConnections}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {recentConnections.slice(0, 5).map((recent) => {
                const available = isDeviceAvailable(recent.deviceId);
                return (
                  <div
                    key={recent.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      available ? "bg-gray-700/50 hover:bg-gray-700" : "bg-gray-800 opacity-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {recent.targetTitle || recent.packageName || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {recent.deviceName} • {formatTimeAgo(recent.lastConnectedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={available ? "secondary" : "ghost"}
                      disabled={!available}
                      onClick={() => onConnect(recent)}
                      className="ml-2"
                    >
                      {available ? "Connect" : "Offline"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {presets.length === 0 && recentConnections.length === 0 && (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-gray-400 text-sm">No recent connections</p>
            <p className="text-gray-500 text-xs mt-1">Connect to a WebView to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
}
