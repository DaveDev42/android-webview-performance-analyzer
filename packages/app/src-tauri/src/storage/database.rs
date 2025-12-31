use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;
use thiserror::Error;

use super::metrics::{MetricType, StoredMetric, StoredNetworkRequest};
use super::session::{Session, SessionStatus};

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Create a new database connection at the specified path
    pub fn new(db_path: PathBuf) -> Result<Self, StorageError> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    /// Create an in-memory database (for testing)
    #[allow(dead_code)]
    pub fn in_memory() -> Result<Self, StorageError> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    /// Initialize database schema
    fn initialize(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Create sessions table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                device_name TEXT,
                webview_url TEXT,
                package_name TEXT,
                target_title TEXT,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                status TEXT NOT NULL DEFAULT 'active',
                display_name TEXT,
                tags TEXT,
                metadata TEXT
            )",
            [],
        )?;

        // Migration: Add display_name and tags columns if they don't exist
        let _ = conn.execute("ALTER TABLE sessions ADD COLUMN display_name TEXT", []);
        let _ = conn.execute("ALTER TABLE sessions ADD COLUMN tags TEXT", []);

        // Create metrics table (time-series data)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                timestamp INTEGER NOT NULL,
                metric_type TEXT NOT NULL,
                data TEXT NOT NULL
            )",
            [],
        )?;

        // Create index for metrics query performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_metrics_session_time
             ON metrics(session_id, timestamp)",
            [],
        )?;

        // Create network_requests table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS network_requests (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                method TEXT,
                status_code INTEGER,
                request_time INTEGER NOT NULL,
                response_time INTEGER,
                duration_ms REAL,
                size_bytes REAL,
                headers TEXT
            )",
            [],
        )?;

        // Create index for network requests
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_network_session_time
             ON network_requests(session_id, request_time)",
            [],
        )?;

        Ok(())
    }

    // ==================== Session Operations ====================

    /// Create a new session
    pub fn create_session(&self, session: &Session) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let metadata_json = session
            .metadata
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let tags_json = session
            .tags
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        conn.execute(
            "INSERT INTO sessions (id, device_id, device_name, webview_url, package_name,
                                   target_title, started_at, ended_at, status, display_name, tags, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                session.id,
                session.device_id,
                session.device_name,
                session.webview_url,
                session.package_name,
                session.target_title,
                session.started_at,
                session.ended_at,
                session.status.as_str(),
                session.display_name,
                tags_json,
                metadata_json,
            ],
        )?;

        Ok(())
    }

    /// End a session
    pub fn end_session(&self, session_id: &str, ended_at: i64) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute(
            "UPDATE sessions SET ended_at = ?1, status = 'completed' WHERE id = ?2",
            params![ended_at, session_id],
        )?;

        if rows == 0 {
            return Err(StorageError::SessionNotFound(session_id.to_string()));
        }

        Ok(())
    }

    /// Get a session by ID
    pub fn get_session(&self, session_id: &str) -> Result<Option<Session>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, device_id, device_name, webview_url, package_name,
                    target_title, started_at, ended_at, status, display_name, tags, metadata
             FROM sessions WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![session_id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Self::row_to_session(row)?))
        } else {
            Ok(None)
        }
    }

    /// List all sessions
    pub fn list_sessions(&self, limit: Option<u32>) -> Result<Vec<Session>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
        let query = format!(
            "SELECT id, device_id, device_name, webview_url, package_name,
                    target_title, started_at, ended_at, status, display_name, tags, metadata
             FROM sessions ORDER BY started_at DESC{}",
            limit_clause
        );

        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map([], |row| Ok(Self::row_to_session(row).unwrap()))?;

        let sessions: Result<Vec<_>, _> = rows.collect();
        Ok(sessions?)
    }

    /// Delete a session and all related data
    pub fn delete_session(&self, session_id: &str) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])?;

        if rows == 0 {
            return Err(StorageError::SessionNotFound(session_id.to_string()));
        }

        Ok(())
    }

    /// Update session display name
    pub fn update_session_name(
        &self,
        session_id: &str,
        display_name: Option<&str>,
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute(
            "UPDATE sessions SET display_name = ?1 WHERE id = ?2",
            params![display_name, session_id],
        )?;

        if rows == 0 {
            return Err(StorageError::SessionNotFound(session_id.to_string()));
        }

        Ok(())
    }

    /// Update session tags
    pub fn update_session_tags(
        &self,
        session_id: &str,
        tags: Option<&[String]>,
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let tags_json = tags.map(serde_json::to_string).transpose()?;

        let rows = conn.execute(
            "UPDATE sessions SET tags = ?1 WHERE id = ?2",
            params![tags_json, session_id],
        )?;

        if rows == 0 {
            return Err(StorageError::SessionNotFound(session_id.to_string()));
        }

        Ok(())
    }

    /// Search sessions with filters
    pub fn search_sessions(
        &self,
        query: Option<&str>,
        device_id: Option<&str>,
        status: Option<&str>,
        tags: Option<&[String]>,
        limit: Option<u32>,
    ) -> Result<Vec<Session>, StorageError> {
        let conn = self.conn.lock().unwrap();

        let mut conditions = Vec::new();
        let mut param_idx = 1;

        if query.is_some() {
            conditions.push(format!(
                "(display_name LIKE ?{} OR target_title LIKE ?{} OR package_name LIKE ?{})",
                param_idx, param_idx, param_idx
            ));
            param_idx += 1;
        }
        if device_id.is_some() {
            conditions.push(format!("device_id = ?{}", param_idx));
            param_idx += 1;
        }
        if status.is_some() {
            conditions.push(format!("status = ?{}", param_idx));
            param_idx += 1;
        }
        if let Some(tag_list) = tags {
            // Check if any of the tags match (JSON array contains)
            let tag_conditions: Vec<String> = tag_list
                .iter()
                .enumerate()
                .map(|(i, _)| format!("tags LIKE ?{}", param_idx + i))
                .collect();
            if !tag_conditions.is_empty() {
                conditions.push(format!("({})", tag_conditions.join(" OR ")));
            }
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        };

        let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
        let sql = format!(
            "SELECT id, device_id, device_name, webview_url, package_name,
                    target_title, started_at, ended_at, status, display_name, tags, metadata
             FROM sessions{}
             ORDER BY started_at DESC{}",
            where_clause, limit_clause
        );

        let mut stmt = conn.prepare(&sql)?;

        // Build dynamic params
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        if let Some(q) = query {
            params_vec.push(Box::new(format!("%{}%", q)));
        }
        if let Some(d) = device_id {
            params_vec.push(Box::new(d.to_string()));
        }
        if let Some(s) = status {
            params_vec.push(Box::new(s.to_string()));
        }
        if let Some(tag_list) = tags {
            for tag in tag_list {
                params_vec.push(Box::new(format!("%\"{}\"", tag)));
            }
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(Self::row_to_session(row).unwrap())
        })?;

        let sessions: Result<Vec<_>, _> = rows.collect();
        Ok(sessions?)
    }

    fn row_to_session(row: &rusqlite::Row) -> Result<Session, StorageError> {
        let status_str: String = row.get(8)?;
        let display_name: Option<String> = row.get(9)?;
        let tags_json: Option<String> = row.get(10)?;
        let metadata_json: Option<String> = row.get(11)?;

        Ok(Session {
            id: row.get(0)?,
            device_id: row.get(1)?,
            device_name: row.get(2)?,
            webview_url: row.get(3)?,
            package_name: row.get(4)?,
            target_title: row.get(5)?,
            started_at: row.get(6)?,
            ended_at: row.get(7)?,
            status: SessionStatus::from_str(&status_str),
            display_name,
            tags: tags_json.map(|s| serde_json::from_str(&s)).transpose()?,
            metadata: metadata_json
                .map(|s| serde_json::from_str(&s))
                .transpose()?,
        })
    }

    // ==================== Metrics Operations ====================

    /// Store a performance metric
    pub fn store_metric(&self, metric: &StoredMetric) -> Result<i64, StorageError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO metrics (session_id, timestamp, metric_type, data)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                metric.session_id,
                metric.timestamp,
                metric.metric_type.as_str(),
                metric.data,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get metrics for a session
    pub fn get_metrics(
        &self,
        session_id: &str,
        metric_type: Option<MetricType>,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<StoredMetric>, StorageError> {
        let conn = self.conn.lock().unwrap();

        let mut conditions = vec!["session_id = ?1".to_string()];
        let mut param_idx = 2;

        if metric_type.is_some() {
            conditions.push(format!("metric_type = ?{}", param_idx));
            param_idx += 1;
        }
        if start_time.is_some() {
            conditions.push(format!("timestamp >= ?{}", param_idx));
            param_idx += 1;
        }
        if end_time.is_some() {
            conditions.push(format!("timestamp <= ?{}", param_idx));
        }

        let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
        let query = format!(
            "SELECT id, session_id, timestamp, metric_type, data
             FROM metrics WHERE {} ORDER BY timestamp ASC{}",
            conditions.join(" AND "),
            limit_clause
        );

        let mut stmt = conn.prepare(&query)?;

        // Build dynamic params
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(session_id.to_string())];
        if let Some(ref mt) = metric_type {
            params_vec.push(Box::new(mt.as_str().to_string()));
        }
        if let Some(st) = start_time {
            params_vec.push(Box::new(st));
        }
        if let Some(et) = end_time {
            params_vec.push(Box::new(et));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            let type_str: String = row.get(3)?;
            Ok(StoredMetric {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                metric_type: MetricType::from_str(&type_str),
                data: row.get(4)?,
            })
        })?;

        let metrics: Result<Vec<_>, _> = rows.collect();
        Ok(metrics?)
    }

    // ==================== Network Request Operations ====================

    /// Store a network request
    pub fn store_network_request(
        &self,
        request: &StoredNetworkRequest,
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let headers_json = request
            .headers
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        conn.execute(
            "INSERT OR REPLACE INTO network_requests
             (id, session_id, url, method, status_code, request_time, response_time,
              duration_ms, size_bytes, headers)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                request.id,
                request.session_id,
                request.url,
                request.method,
                request.status_code,
                request.request_time,
                request.response_time,
                request.duration_ms,
                request.size_bytes,
                headers_json,
            ],
        )?;

        Ok(())
    }

    /// Get network requests for a session
    pub fn get_network_requests(
        &self,
        session_id: &str,
        limit: Option<u32>,
    ) -> Result<Vec<StoredNetworkRequest>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
        let query = format!(
            "SELECT id, session_id, url, method, status_code, request_time,
                    response_time, duration_ms, size_bytes, headers
             FROM network_requests
             WHERE session_id = ?1
             ORDER BY request_time ASC{}",
            limit_clause
        );

        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(params![session_id], |row| {
            let headers_json: Option<String> = row.get(9)?;
            Ok(StoredNetworkRequest {
                id: row.get(0)?,
                session_id: row.get(1)?,
                url: row.get(2)?,
                method: row.get(3)?,
                status_code: row.get(4)?,
                request_time: row.get(5)?,
                response_time: row.get(6)?,
                duration_ms: row.get(7)?,
                size_bytes: row.get(8)?,
                headers: headers_json.map(|s| serde_json::from_str(&s).unwrap_or_default()),
            })
        })?;

        let requests: Result<Vec<_>, _> = rows.collect();
        Ok(requests?)
    }

    /// Get database file path
    pub fn get_db_path(app_data_dir: &std::path::Path) -> PathBuf {
        app_data_dir.join("awpa.db")
    }
}
