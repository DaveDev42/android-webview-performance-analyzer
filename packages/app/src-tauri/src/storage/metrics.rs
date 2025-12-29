use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct StoredMetric {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub session_id: String,
    pub timestamp: i64,
    pub metric_type: MetricType,
    pub data: String, // JSON serialized metric data
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "lowercase")]
pub enum MetricType {
    Performance,
    Memory,
    Network,
    WebVitals,
}

impl MetricType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MetricType::Performance => "performance",
            MetricType::Memory => "memory",
            MetricType::Network => "network",
            MetricType::WebVitals => "webvitals",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "performance" => MetricType::Performance,
            "memory" => MetricType::Memory,
            "network" => MetricType::Network,
            "webvitals" => MetricType::WebVitals,
            _ => MetricType::Performance,
        }
    }
}

impl StoredMetric {
    pub fn new(session_id: String, metric_type: MetricType, data: String) -> Self {
        Self {
            id: None,
            session_id,
            timestamp: chrono::Utc::now().timestamp_millis(),
            metric_type,
            data,
        }
    }

    pub fn from_performance(session_id: &str, metrics: &crate::cdp::PerformanceMetrics) -> Result<Self, serde_json::Error> {
        Ok(Self {
            id: None,
            session_id: session_id.to_string(),
            timestamp: metrics.timestamp,
            metric_type: MetricType::Performance,
            data: serde_json::to_string(metrics)?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct StoredNetworkRequest {
    pub id: String,
    pub session_id: String,
    pub url: String,
    pub method: Option<String>,
    pub status_code: Option<i32>,
    pub request_time: i64,
    pub response_time: Option<i64>,
    pub duration_ms: Option<f64>,
    pub size_bytes: Option<f64>,
    pub headers: Option<HashMap<String, String>>,
}

impl StoredNetworkRequest {
    pub fn new(
        session_id: &str,
        request_id: &str,
        url: String,
        method: String,
        request_time: i64,
    ) -> Self {
        Self {
            id: request_id.to_string(),
            session_id: session_id.to_string(),
            url,
            method: Some(method),
            status_code: None,
            request_time,
            response_time: None,
            duration_ms: None,
            size_bytes: None,
            headers: None,
        }
    }
}
