use super::client::{CdpClient, CdpEvent};
use super::types::PerformanceMetrics;
use crate::storage::{Database, StoredMetric, StoredNetworkRequest};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::{broadcast, RwLock};
use tokio::time::{interval, Duration};

/// Network request tracking
#[derive(Debug, Clone)]
pub struct TrackedRequest {
    pub request_id: String,
    pub url: String,
    pub method: String,
    pub request_timestamp: f64,
    pub response_timestamp: Option<f64>,
    pub status: Option<i32>,
    pub encoded_data_length: Option<f64>,
    pub finished_timestamp: Option<f64>,
}

/// Metrics event for frontend
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type")]
pub enum MetricsEvent {
    Performance(PerformanceMetrics),
    NetworkRequest {
        request_id: String,
        url: String,
        method: String,
        timestamp: f64,
    },
    NetworkResponse {
        request_id: String,
        status: i32,
        timestamp: f64,
        duration_ms: Option<f64>,
    },
    NetworkComplete {
        request_id: String,
        url: String,
        method: String,
        status: Option<i32>,
        duration_ms: f64,
        size_bytes: f64,
    },
}

pub struct MetricsCollector<R: Runtime> {
    client: Arc<CdpClient>,
    database: Arc<Database>,
    session_id: String,
    app_handle: Option<AppHandle<R>>,
    requests: Arc<RwLock<HashMap<String, TrackedRequest>>>,
    event_tx: broadcast::Sender<MetricsEvent>,
    collecting: Arc<RwLock<bool>>,
}

impl<R: Runtime> MetricsCollector<R> {
    pub fn new(
        client: Arc<CdpClient>,
        database: Arc<Database>,
        session_id: String,
        app_handle: Option<AppHandle<R>>,
    ) -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self {
            client,
            database,
            session_id,
            app_handle,
            requests: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            collecting: Arc::new(RwLock::new(false)),
        }
    }

    /// Start collecting metrics
    pub async fn start(&self, poll_interval_ms: u64) -> Result<(), super::client::CdpError> {
        // Enable domains
        self.client.enable_performance().await?;
        self.client.enable_network().await?;

        {
            let mut collecting = self.collecting.write().await;
            *collecting = true;
        }

        // Start performance polling
        let client = self.client.clone();
        let event_tx = self.event_tx.clone();
        let collecting = self.collecting.clone();
        let database = self.database.clone();
        let session_id = self.session_id.clone();
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_millis(poll_interval_ms));

            loop {
                ticker.tick().await;

                let is_collecting = *collecting.read().await;
                if !is_collecting {
                    break;
                }

                if let Ok(metrics) = client.get_performance_metrics().await {
                    // Store to database
                    if let Ok(stored_metric) = StoredMetric::from_performance(&session_id, &metrics) {
                        let _ = database.store_metric(&stored_metric);
                    }

                    // Emit Tauri event
                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("metrics:performance", &metrics);
                    }

                    // Broadcast internally
                    let _ = event_tx.send(MetricsEvent::Performance(metrics));
                }
            }
        });

        // Start processing CDP events
        let mut cdp_rx = self.client.subscribe();
        let requests = self.requests.clone();
        let event_tx = self.event_tx.clone();
        let collecting = self.collecting.clone();
        let database = self.database.clone();
        let session_id = self.session_id.clone();
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            loop {
                let is_collecting = *collecting.read().await;
                if !is_collecting {
                    break;
                }

                match cdp_rx.recv().await {
                    Ok(event) => {
                        Self::process_cdp_event(
                            event,
                            &requests,
                            &event_tx,
                            &database,
                            &session_id,
                            &app_handle,
                        )
                        .await;
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        });

        Ok(())
    }

    async fn process_cdp_event(
        event: CdpEvent,
        requests: &Arc<RwLock<HashMap<String, TrackedRequest>>>,
        event_tx: &broadcast::Sender<MetricsEvent>,
        database: &Arc<Database>,
        session_id: &str,
        app_handle: &Option<AppHandle<R>>,
    ) {
        match event {
            CdpEvent::NetworkRequest {
                request_id,
                url,
                method,
                timestamp,
            } => {
                let mut reqs = requests.write().await;
                reqs.insert(
                    request_id.clone(),
                    TrackedRequest {
                        request_id: request_id.clone(),
                        url: url.clone(),
                        method: method.clone(),
                        request_timestamp: timestamp,
                        response_timestamp: None,
                        status: None,
                        encoded_data_length: None,
                        finished_timestamp: None,
                    },
                );

                // Store initial network request
                let request_time = (timestamp * 1000.0) as i64;
                let stored_request = StoredNetworkRequest {
                    id: request_id.clone(),
                    session_id: session_id.to_string(),
                    url: url.clone(),
                    method: Some(method.clone()),
                    status_code: None,
                    request_time,
                    response_time: None,
                    duration_ms: None,
                    size_bytes: None,
                    headers: None,
                };
                let _ = database.store_network_request(&stored_request);

                let metrics_event = MetricsEvent::NetworkRequest {
                    request_id: request_id.clone(),
                    url,
                    method,
                    timestamp,
                };

                // Emit Tauri event
                if let Some(ref handle) = app_handle {
                    let _ = handle.emit("metrics:network", &metrics_event);
                }

                let _ = event_tx.send(metrics_event);
            }
            CdpEvent::NetworkResponse {
                request_id,
                status,
                timestamp,
            } => {
                let mut reqs = requests.write().await;
                let duration_ms = if let Some(req) = reqs.get_mut(&request_id) {
                    req.response_timestamp = Some(timestamp);
                    req.status = Some(status);
                    Some((timestamp - req.request_timestamp) * 1000.0)
                } else {
                    None
                };

                let metrics_event = MetricsEvent::NetworkResponse {
                    request_id: request_id.clone(),
                    status,
                    timestamp,
                    duration_ms,
                };

                // Emit Tauri event
                if let Some(ref handle) = app_handle {
                    let _ = handle.emit("metrics:network", &metrics_event);
                }

                let _ = event_tx.send(metrics_event);
            }
            CdpEvent::NetworkFinished {
                request_id,
                encoded_data_length,
                timestamp,
            } => {
                let mut reqs = requests.write().await;
                if let Some(req) = reqs.remove(&request_id) {
                    let duration_ms = (timestamp - req.request_timestamp) * 1000.0;
                    let response_time = (timestamp * 1000.0) as i64;

                    // Update network request in database with complete info
                    let stored_request = StoredNetworkRequest {
                        id: req.request_id.clone(),
                        session_id: session_id.to_string(),
                        url: req.url.clone(),
                        method: Some(req.method.clone()),
                        status_code: req.status,
                        request_time: (req.request_timestamp * 1000.0) as i64,
                        response_time: Some(response_time),
                        duration_ms: Some(duration_ms),
                        size_bytes: Some(encoded_data_length),
                        headers: None,
                    };
                    let _ = database.store_network_request(&stored_request);

                    let metrics_event = MetricsEvent::NetworkComplete {
                        request_id: req.request_id,
                        url: req.url,
                        method: req.method,
                        status: req.status,
                        duration_ms,
                        size_bytes: encoded_data_length,
                    };

                    // Emit Tauri event
                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("metrics:network", &metrics_event);
                    }

                    let _ = event_tx.send(metrics_event);
                }
            }
            _ => {}
        }
    }

    /// Stop collecting metrics
    pub async fn stop(&self) {
        let mut collecting = self.collecting.write().await;
        *collecting = false;
    }

    /// Subscribe to metrics events
    pub fn subscribe(&self) -> broadcast::Receiver<MetricsEvent> {
        self.event_tx.subscribe()
    }

    /// Get tracked requests
    pub async fn get_pending_requests(&self) -> Vec<TrackedRequest> {
        let reqs = self.requests.read().await;
        reqs.values().cloned().collect()
    }
}
