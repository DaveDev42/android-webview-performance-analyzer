use crate::cdp::{CdpClient, MetricsCollector};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub cdp_client: Arc<CdpClient>,
    pub metrics_collector: Arc<RwLock<Option<MetricsCollector>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cdp_client: Arc::new(CdpClient::new()),
            metrics_collector: Arc::new(RwLock::new(None)),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
