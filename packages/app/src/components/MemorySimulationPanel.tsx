import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import {
  DEVICE_PROFILES,
  formatMemory,
  type DeviceProfile,
  type TrimMemoryLevel,
} from "@/types/deviceProfiles";

interface MemoryInfo {
  total_kb: number;
  available_kb: number;
  free_kb: number;
  buffers_kb: number;
  cached_kb: number;
}

interface MemorySimulationPanelProps {
  deviceId: string;
  packageName: string;
  onSendTrimMemory: (
    deviceId: string,
    packageName: string,
    level: TrimMemoryLevel
  ) => Promise<void>;
  onGetMeminfo: (deviceId: string) => Promise<MemoryInfo>;
}

export function MemorySimulationPanel({
  deviceId,
  packageName,
  onSendTrimMemory,
  onGetMeminfo,
}: MemorySimulationPanelProps) {
  const [selectedProfile, setSelectedProfile] = useState<DeviceProfile>(
    DEVICE_PROFILES[2] // Default to "Mid (2GB)"
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [pressureCount, setPressureCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);

  // Fetch memory info
  const fetchMemoryInfo = useCallback(async () => {
    try {
      const info = await onGetMeminfo(deviceId);
      setMemoryInfo(info);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [deviceId, onGetMeminfo]);

  // Send memory pressure
  const sendPressure = useCallback(async () => {
    try {
      await onSendTrimMemory(deviceId, packageName, selectedProfile.trimLevel);
      setPressureCount((c) => c + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [deviceId, packageName, selectedProfile.trimLevel, onSendTrimMemory]);

  // Start simulation
  const startSimulation = useCallback(() => {
    setIsSimulating(true);
    setPressureCount(0);
    sendPressure(); // Send immediately

    intervalRef.current = window.setInterval(() => {
      sendPressure();
      fetchMemoryInfo();
    }, intervalSeconds * 1000);
  }, [sendPressure, fetchMemoryInfo, intervalSeconds]);

  // Stop simulation
  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Fetch memory info on mount
  useEffect(() => {
    fetchMemoryInfo();
  }, [fetchMemoryInfo]);

  const deviceRamMb = memoryInfo ? memoryInfo.total_kb / 1024 : 0;
  const usedPercent = memoryInfo
    ? ((memoryInfo.total_kb - memoryInfo.available_kb) / memoryInfo.total_kb) *
      100
    : 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          Memory Simulation
        </h3>
        {isSimulating && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Running ({pressureCount} sent)
          </span>
        )}
      </div>

      {/* Target Package */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">Target</label>
        <div className="text-sm font-mono bg-gray-900 px-2 py-1 rounded">
          {packageName}
        </div>
      </div>

      {/* Device Profiles */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">
          Simulate Device
        </label>
        <div className="space-y-1">
          {DEVICE_PROFILES.map((profile) => (
            <label
              key={profile.id}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                selectedProfile.id === profile.id
                  ? "bg-purple-500/20 border border-purple-500/50"
                  : "bg-gray-700/50 hover:bg-gray-700 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="profile"
                checked={selectedProfile.id === profile.id}
                onChange={() => setSelectedProfile(profile)}
                disabled={isSimulating}
                className="w-4 h-4 text-purple-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">{profile.name}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {profile.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Interval Setting */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">
          Pressure Interval
        </label>
        <select
          value={intervalSeconds}
          onChange={(e) => setIntervalSeconds(Number(e.target.value))}
          disabled={isSimulating}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
        >
          <option value={1}>Every 1 second</option>
          <option value={3}>Every 3 seconds</option>
          <option value={5}>Every 5 seconds</option>
          <option value={10}>Every 10 seconds</option>
          <option value={30}>Every 30 seconds</option>
        </select>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2 mb-4">
        {!isSimulating ? (
          <Button
            onClick={startSimulation}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            Start Simulation
          </Button>
        ) : (
          <Button
            onClick={stopSimulation}
            variant="destructive"
            className="flex-1"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                clipRule="evenodd"
              />
            </svg>
            Stop
          </Button>
        )}
        <Button
          onClick={sendPressure}
          variant="secondary"
          disabled={isSimulating}
        >
          Send Once
        </Button>
      </div>

      {/* Device Memory Info */}
      {memoryInfo && (
        <div className="bg-gray-900 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Device Memory</span>
            <button
              onClick={fetchMemoryInfo}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Total:</span>{" "}
              <span className="font-mono">
                {formatMemory(memoryInfo.total_kb)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Available:</span>{" "}
              <span className="font-mono">
                {formatMemory(memoryInfo.available_kb)}
              </span>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Memory Usage</span>
              <span>{usedPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className={`h-full transition-all ${
                  usedPercent > 80
                    ? "bg-red-500"
                    : usedPercent > 60
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
          {deviceRamMb > 0 && selectedProfile.ramMb < deviceRamMb && (
            <div className="mt-2 text-xs text-purple-400">
              Simulating {selectedProfile.name} on{" "}
              {formatMemory(memoryInfo.total_kb)} device (
              {((selectedProfile.ramMb / deviceRamMb) * 100).toFixed(0)}%
              capacity)
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
