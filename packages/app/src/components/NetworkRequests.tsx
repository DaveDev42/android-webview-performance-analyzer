import type { NetworkEvent } from "../types";
import { formatBytes } from "../utils";

interface NetworkRequestsProps {
  requests: NetworkEvent[];
  maxDisplay?: number;
}

export function NetworkRequests({ requests, maxDisplay = 10 }: NetworkRequestsProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-semibold mb-3 flex items-center justify-between">
        <span>Network Requests</span>
        <span className="text-sm font-normal text-gray-400">
          ({requests.length})
        </span>
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {requests.slice(0, maxDisplay).map((req) => (
          <div
            key={req.request_id}
            className="bg-gray-900 rounded p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-mono ${
                    req.status && req.status >= 400
                      ? "bg-red-900 text-red-300"
                      : req.status && req.status >= 300
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-green-900 text-green-300"
                  }`}
                >
                  {req.status ?? "..."}
                </span>
                <span className="text-gray-500 font-mono text-xs">
                  {req.method || "GET"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-gray-400 text-xs">
                <span>{req.duration_ms?.toFixed(0) ?? "-"} ms</span>
                <span>{formatBytes(req.size_bytes ?? null)}</span>
              </div>
            </div>
            <p className="text-gray-300 truncate mt-1.5 text-xs">
              {req.url}
            </p>
          </div>
        ))}
      </div>
      {requests.length > maxDisplay && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          +{requests.length - maxDisplay} more requests
        </p>
      )}
    </div>
  );
}
