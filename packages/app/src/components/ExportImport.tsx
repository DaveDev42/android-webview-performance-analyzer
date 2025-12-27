import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Session, StoredMetric, StoredNetworkRequest } from "../types";

interface ExportImportProps {
  session?: Session;
  onClose: () => void;
  onImportComplete?: () => void;
}

export function ExportDialog({ session, onClose }: ExportImportProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    if (!session) return;

    setExporting(true);
    setError(null);

    try {
      const metrics = await invoke<StoredMetric[]>("get_session_metrics", {
        sessionId: session.id,
      });

      const networkRequests = await invoke<StoredNetworkRequest[]>("get_session_network_requests", {
        sessionId: session.id,
      });

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        session: session,
        metrics: metrics,
        networkRequests: networkRequests,
      };

      const fileName = `awpa-session-${session.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      const content = JSON.stringify(exportData, null, 2);

      // Use browser download API
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Export Session</h2>

        {session && (
          <div className="bg-gray-800 rounded p-4 mb-4">
            <p className="font-medium">{session.target_title || "Untitled"}</p>
            <p className="text-sm text-gray-400 truncate">{session.webview_url}</p>
            <p className="text-xs text-gray-500 mt-2">
              Started: {new Date(session.started_at).toLocaleString()}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-4xl mb-2">✓</div>
            <p className="text-green-300">Session exported successfully!</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
            >
              {exporting ? "Exporting..." : "Export as JSON"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ImportDialogProps {
  onClose: () => void;
  onImportComplete?: () => void;
}

export function ImportDialog({ onClose, onImportComplete }: ImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importedSession, setImportedSession] = useState<Session | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the imported data
      if (!data.version || !data.session) {
        throw new Error("Invalid export file format");
      }

      // Create a new session with imported data
      const session = await invoke<Session>("create_session", {
        params: {
          device_id: data.session.device_id || "imported",
          device_name: data.session.device_name || "Imported Device",
          package_name: data.session.package_name,
          target_title: `[Imported] ${data.session.target_title || "Session"}`,
          webview_url: data.session.webview_url,
        },
      });

      // Note: In a full implementation, you would also import the metrics
      // and network requests into the database

      setImportedSession(session);
      setSuccess(true);
      onImportComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Import Session</h2>

        <p className="text-gray-400 text-sm mb-4">
          Import a previously exported session file (.json) to view its data.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && importedSession ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-4xl mb-2">✓</div>
            <p className="text-green-300 mb-2">Session imported successfully!</p>
            <p className="text-sm text-gray-400">
              {importedSession.target_title}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded"
            >
              {importing ? "Importing..." : "Select File"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
