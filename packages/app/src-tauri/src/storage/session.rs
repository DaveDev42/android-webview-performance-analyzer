use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Session {
    pub id: String,
    pub device_id: String,
    pub device_name: Option<String>,
    pub webview_url: Option<String>,
    pub package_name: Option<String>,
    pub target_title: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: SessionStatus,
    /// User-defined display name for the session
    pub display_name: Option<String>,
    /// Tags for categorizing sessions (stored as JSON array)
    pub tags: Option<Vec<String>>,
    #[serde(skip)]
    #[specta(skip)]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Completed,
    Aborted,
}

impl SessionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SessionStatus::Active => "active",
            SessionStatus::Completed => "completed",
            SessionStatus::Aborted => "aborted",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "active" => SessionStatus::Active,
            "completed" => SessionStatus::Completed,
            "aborted" => SessionStatus::Aborted,
            _ => SessionStatus::Active,
        }
    }
}

impl Session {
    pub fn new(
        device_id: String,
        device_name: Option<String>,
        package_name: Option<String>,
        target_title: Option<String>,
        webview_url: Option<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            device_id,
            device_name,
            webview_url,
            package_name,
            target_title,
            started_at: chrono::Utc::now().timestamp_millis(),
            ended_at: None,
            status: SessionStatus::Active,
            display_name: None,
            tags: None,
            metadata: None,
        }
    }

    pub fn duration_ms(&self) -> Option<i64> {
        self.ended_at.map(|end| end - self.started_at)
    }
}
