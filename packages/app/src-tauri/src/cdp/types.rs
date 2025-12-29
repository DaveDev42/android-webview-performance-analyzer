use serde::{Deserialize, Serialize};
use specta::Type;

/// CDP target information from /json/list endpoint
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CdpTarget {
    pub id: String,
    pub title: String,
    pub url: String,
    #[serde(rename = "type")]
    pub target_type: String,
    pub web_socket_debugger_url: Option<String>,
    pub devtools_frontend_url: Option<String>,
    pub favicon_url: Option<String>,
}

/// Performance metrics from CDP
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PerformanceMetrics {
    pub timestamp: i64,
    pub js_heap_used_size: Option<f64>,
    pub js_heap_total_size: Option<f64>,
    pub dom_nodes: Option<f64>,
    pub layout_count: Option<f64>,
    pub script_duration: Option<f64>,
    pub task_duration: Option<f64>,
}

/// Network request info
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NetworkRequestInfo {
    pub request_id: String,
    pub url: String,
    pub method: String,
    pub timestamp: f64,
    pub resource_type: Option<String>,
}

/// Network response info
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NetworkResponseInfo {
    pub request_id: String,
    pub status: i32,
    pub status_text: String,
    pub timestamp: f64,
    pub encoded_data_length: Option<f64>,
}

/// CDP connection state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

/// Collected metrics snapshot
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MetricsSnapshot {
    pub timestamp: i64,
    pub performance: Option<PerformanceMetrics>,
    pub network_requests: Vec<NetworkRequestInfo>,
    pub network_responses: Vec<NetworkResponseInfo>,
}
