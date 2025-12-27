export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_name TEXT,
  webview_url TEXT,
  package_name TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  metadata TEXT
);

-- Metrics table (time-series data)
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_session_time
  ON metrics(session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_metrics_type
  ON metrics(metric_type);

-- Network requests table
CREATE TABLE IF NOT EXISTS network_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  method TEXT,
  status_code INTEGER,
  request_time INTEGER,
  response_time INTEGER,
  size INTEGER,
  headers TEXT
);

CREATE INDEX IF NOT EXISTS idx_network_session
  ON network_requests(session_id);

-- Schema version table
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;

export const DROP_TABLES_SQL = `
DROP TABLE IF EXISTS network_requests;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS schema_version;
`;
