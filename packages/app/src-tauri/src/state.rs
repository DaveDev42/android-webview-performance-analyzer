use crate::cdp::{CdpClient, MetricsCollector};
use crate::storage::Database;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub cdp_client: Arc<CdpClient>,
    pub metrics_collector: Arc<RwLock<Option<MetricsCollector>>>,
    pub database: Arc<Database>,
    pub current_session_id: Arc<RwLock<Option<String>>>,
}

impl AppState {
    pub fn new(database: Database) -> Self {
        Self {
            cdp_client: Arc::new(CdpClient::new()),
            metrics_collector: Arc::new(RwLock::new(None)),
            database: Arc::new(database),
            current_session_id: Arc::new(RwLock::new(None)),
        }
    }
}
