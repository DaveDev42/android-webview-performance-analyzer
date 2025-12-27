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

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [webviews, setWebviews] = useState<WebView[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPort, setNextPort] = useState(9222);

  const refreshDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Device[]>("get_devices");
      setDevices(result);
      // If selected device is no longer connected, deselect it
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                    {pf && (
                      <div className="mt-2 text-sm text-gray-400">
                        CDP available at{" "}
                        <code className="bg-gray-700 px-1 rounded">
                          http://localhost:{pf.localPort}
                        </code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
                    <th className="text-right p-3">Action</th>
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
                        <button
                          onClick={() => stopPortForward(pf)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Stop
                        </button>
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
