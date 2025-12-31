use super::types::{CdpTarget, ConnectionState, PerformanceMetrics};
use chromiumoxide::cdp::browser_protocol::network::EnableParams as NetworkEnableParams;
use chromiumoxide::cdp::browser_protocol::network::{
    EventLoadingFinished, EventRequestWillBeSent, EventResponseReceived,
};
use chromiumoxide::cdp::browser_protocol::performance::{
    EnableParams as PerfEnableParams, GetMetricsParams,
};
use chromiumoxide::page::Page;
use chromiumoxide::Browser;
use futures_util::StreamExt;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::{broadcast, RwLock};
use tokio::time::timeout;

#[derive(Error, Debug)]
pub enum CdpError {
    #[error("Failed to fetch targets: {0}")]
    FetchTargetsFailed(String),
    #[error("Failed to connect: {0}")]
    ConnectionFailed(String),
    #[error("Not connected")]
    NotConnected,
    #[error("Browser error: {0}")]
    BrowserError(String),
}

pub struct CdpClient {
    state: Arc<RwLock<ConnectionState>>,
    browser: Arc<RwLock<Option<Browser>>>,
    page: Arc<RwLock<Option<Page>>>,
    event_tx: broadcast::Sender<CdpEvent>,
}

#[derive(Debug, Clone)]
pub enum CdpEvent {
    Connected,
    Disconnected,
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
    },
    NetworkFinished {
        request_id: String,
        encoded_data_length: f64,
        timestamp: f64,
    },
}

impl CdpClient {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self {
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            browser: Arc::new(RwLock::new(None)),
            page: Arc::new(RwLock::new(None)),
            event_tx,
        }
    }

    /// Get targets from CDP endpoint
    pub async fn get_targets(port: u16) -> Result<Vec<CdpTarget>, CdpError> {
        let url = format!("http://localhost:{}/json/list", port);
        let response = reqwest::get(&url)
            .await
            .map_err(|e| CdpError::FetchTargetsFailed(e.to_string()))?;

        let targets: Vec<CdpTarget> = response
            .json()
            .await
            .map_err(|e| CdpError::FetchTargetsFailed(e.to_string()))?;

        Ok(targets)
    }

    /// Connect to a CDP target via WebSocket
    /// For Android Chrome/WebView, we connect directly to the page's WebSocket URL
    pub async fn connect(&self, ws_url: &str) -> Result<(), CdpError> {
        {
            let mut state = self.state.write().await;
            *state = ConnectionState::Connecting;
        }

        // For Android Chrome/WebView, connect directly to the page URL
        // chromiumoxide can connect to individual page targets
        // Add timeout to prevent hanging connections
        let connect_result = timeout(Duration::from_secs(10), Browser::connect(ws_url)).await;

        let (browser, mut handler) = match connect_result {
            Ok(Ok(result)) => result,
            Ok(Err(e)) => {
                let mut state = self.state.write().await;
                *state = ConnectionState::Disconnected;
                return Err(CdpError::ConnectionFailed(e.to_string()));
            }
            Err(_) => {
                let mut state = self.state.write().await;
                *state = ConnectionState::Disconnected;
                return Err(CdpError::ConnectionFailed("Connection timeout".into()));
            }
        };

        // Spawn handler task
        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                if let Err(e) = event {
                    tracing::warn!("CDP handler error: {}", e);
                }
            }
        });

        // For page-level connections, create a Page wrapper directly
        // Since we connected to a page URL, the browser IS the page essentially
        let pages = browser
            .pages()
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        // Get the page - for direct page connections, there should be one
        let page = if let Some(p) = pages.into_iter().next() {
            Some(p)
        } else {
            // If no pages found, try to create a new page context
            // This is a fallback for some CDP implementations
            browser.new_page("about:blank").await.ok()
        };

        {
            let mut browser_lock = self.browser.write().await;
            *browser_lock = Some(browser);
        }

        if let Some(p) = page {
            let mut page_lock = self.page.write().await;
            *page_lock = Some(p);
        } else {
            // Reset state if no page available
            let mut state = self.state.write().await;
            *state = ConnectionState::Disconnected;
            return Err(CdpError::ConnectionFailed(
                "No page available to connect".into(),
            ));
        }

        {
            let mut state = self.state.write().await;
            *state = ConnectionState::Connected;
        }

        let _ = self.event_tx.send(CdpEvent::Connected);

        Ok(())
    }

    /// Enable Performance domain and start collecting metrics
    pub async fn enable_performance(&self) -> Result<(), CdpError> {
        let page_lock = self.page.read().await;
        let page = page_lock.as_ref().ok_or(CdpError::NotConnected)?;

        page.execute(PerfEnableParams::default())
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        Ok(())
    }

    /// Enable Network domain and start listening for events
    pub async fn enable_network(&self) -> Result<(), CdpError> {
        let page_lock = self.page.read().await;
        let page = page_lock.as_ref().ok_or(CdpError::NotConnected)?;

        page.execute(NetworkEnableParams::default())
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        // Subscribe to network events
        let event_tx = self.event_tx.clone();

        // Request will be sent
        let mut request_events = page
            .event_listener::<EventRequestWillBeSent>()
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        let tx1 = event_tx.clone();
        tokio::spawn(async move {
            while let Some(event) = request_events.next().await {
                let _ = tx1.send(CdpEvent::NetworkRequest {
                    request_id: event.request_id.inner().clone(),
                    url: event.request.url.clone(),
                    method: event.request.method.clone(),
                    timestamp: *event.timestamp.inner(),
                });
            }
        });

        // Response received
        let mut response_events = page
            .event_listener::<EventResponseReceived>()
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        let tx2 = event_tx.clone();
        tokio::spawn(async move {
            while let Some(event) = response_events.next().await {
                let _ = tx2.send(CdpEvent::NetworkResponse {
                    request_id: event.request_id.inner().clone(),
                    status: event.response.status as i32,
                    timestamp: *event.timestamp.inner(),
                });
            }
        });

        // Loading finished
        let mut finished_events = page
            .event_listener::<EventLoadingFinished>()
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        let tx3 = event_tx.clone();
        tokio::spawn(async move {
            while let Some(event) = finished_events.next().await {
                let _ = tx3.send(CdpEvent::NetworkFinished {
                    request_id: event.request_id.inner().clone(),
                    encoded_data_length: event.encoded_data_length,
                    timestamp: *event.timestamp.inner(),
                });
            }
        });

        Ok(())
    }

    /// Get current performance metrics
    pub async fn get_performance_metrics(&self) -> Result<PerformanceMetrics, CdpError> {
        let page_lock = self.page.read().await;
        let page = page_lock.as_ref().ok_or(CdpError::NotConnected)?;

        let result = page
            .execute(GetMetricsParams::default())
            .await
            .map_err(|e| CdpError::BrowserError(e.to_string()))?;

        let mut metrics = PerformanceMetrics {
            timestamp: chrono::Utc::now().timestamp_millis(),
            js_heap_used_size: None,
            js_heap_total_size: None,
            dom_nodes: None,
            layout_count: None,
            script_duration: None,
            task_duration: None,
        };

        for metric in &result.metrics {
            match metric.name.as_str() {
                "JSHeapUsedSize" => metrics.js_heap_used_size = Some(metric.value),
                "JSHeapTotalSize" => metrics.js_heap_total_size = Some(metric.value),
                "Nodes" => metrics.dom_nodes = Some(metric.value),
                "LayoutCount" => metrics.layout_count = Some(metric.value),
                "ScriptDuration" => metrics.script_duration = Some(metric.value),
                "TaskDuration" => metrics.task_duration = Some(metric.value),
                _ => {}
            }
        }

        Ok(metrics)
    }

    /// Subscribe to CDP events
    pub fn subscribe(&self) -> broadcast::Receiver<CdpEvent> {
        self.event_tx.subscribe()
    }

    /// Get current connection state
    pub async fn get_state(&self) -> ConnectionState {
        self.state.read().await.clone()
    }

    /// Disconnect from CDP
    pub async fn disconnect(&self) -> Result<(), CdpError> {
        {
            let mut page_lock = self.page.write().await;
            *page_lock = None;
        }

        {
            let mut browser_lock = self.browser.write().await;
            *browser_lock = None;
        }

        {
            let mut state = self.state.write().await;
            *state = ConnectionState::Disconnected;
        }

        let _ = self.event_tx.send(CdpEvent::Disconnected);

        Ok(())
    }
}

impl Default for CdpClient {
    fn default() -> Self {
        Self::new()
    }
}
