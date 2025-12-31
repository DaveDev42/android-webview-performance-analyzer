use crate::adb::{self, Device, WebView};
use crate::cdp::{CdpClient, CdpTarget, ConnectionState, MetricsCollector, PerformanceMetrics};
use crate::storage::{Database, MetricType, Session, StoredMetric, StoredNetworkRequest};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::{Manager, Runtime, Window};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PortForwardResult {
    pub local_port: u16,
    pub socket_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateSessionParams {
    pub device_id: String,
    pub device_name: Option<String>,
    pub package_name: Option<String>,
    pub target_title: Option<String>,
    pub webview_url: Option<String>,
}

/// Shared application state managed by Tauri
pub struct ManagedState {
    pub cdp_client: Arc<CdpClient>,
    pub database: Arc<Database>,
    pub current_session_id: Arc<RwLock<Option<String>>>,
}

/// Wrapper for metrics collector that is runtime-generic
pub struct MetricsCollectorHolder<R: Runtime> {
    pub collector: RwLock<Option<MetricsCollector<R>>>,
}

impl<R: Runtime> MetricsCollectorHolder<R> {
    pub fn new() -> Self {
        Self {
            collector: RwLock::new(None),
        }
    }
}

#[taurpc::procedures(path = "api", export_to = "../src/bindings.ts")]
pub trait Api {
    // ============ ADB Commands ============

    async fn get_devices<R: Runtime>(window: Window<R>) -> Result<Vec<Device>, String>;

    async fn get_webviews<R: Runtime>(
        window: Window<R>,
        device_id: String,
    ) -> Result<Vec<WebView>, String>;

    async fn start_port_forward<R: Runtime>(
        window: Window<R>,
        device_id: String,
        socket_name: String,
        local_port: u16,
    ) -> Result<PortForwardResult, String>;

    async fn stop_port_forward<R: Runtime>(
        window: Window<R>,
        device_id: String,
        local_port: u16,
    ) -> Result<(), String>;

    async fn stop_all_port_forwards<R: Runtime>(
        window: Window<R>,
        device_id: String,
    ) -> Result<(), String>;

    // ============ CDP Commands ============

    async fn get_cdp_targets(port: u16) -> Result<Vec<CdpTarget>, String>;

    async fn connect_cdp<R: Runtime>(window: Window<R>, ws_url: String) -> Result<(), String>;

    async fn disconnect_cdp<R: Runtime>(window: Window<R>) -> Result<(), String>;

    async fn get_cdp_state<R: Runtime>(window: Window<R>) -> Result<ConnectionState, String>;

    async fn start_metrics_collection<R: Runtime>(
        window: Window<R>,
        poll_interval_ms: Option<u64>,
    ) -> Result<(), String>;

    async fn stop_metrics_collection<R: Runtime>(window: Window<R>) -> Result<(), String>;

    async fn get_performance_metrics<R: Runtime>(
        window: Window<R>,
    ) -> Result<PerformanceMetrics, String>;

    // ============ Session Commands ============

    async fn create_session<R: Runtime>(
        window: Window<R>,
        params: CreateSessionParams,
    ) -> Result<Session, String>;

    async fn end_session<R: Runtime>(
        window: Window<R>,
        session_id: Option<String>,
    ) -> Result<(), String>;

    async fn get_session<R: Runtime>(
        window: Window<R>,
        session_id: String,
    ) -> Result<Option<Session>, String>;

    async fn list_sessions<R: Runtime>(
        window: Window<R>,
        limit: Option<u32>,
    ) -> Result<Vec<Session>, String>;

    async fn delete_session<R: Runtime>(
        window: Window<R>,
        session_id: String,
    ) -> Result<(), String>;

    async fn update_session_name<R: Runtime>(
        window: Window<R>,
        session_id: String,
        display_name: Option<String>,
    ) -> Result<(), String>;

    async fn update_session_tags<R: Runtime>(
        window: Window<R>,
        session_id: String,
        tags: Option<Vec<String>>,
    ) -> Result<(), String>;

    async fn search_sessions<R: Runtime>(
        window: Window<R>,
        query: Option<String>,
        device_id: Option<String>,
        status: Option<String>,
        tags: Option<Vec<String>>,
        limit: Option<u32>,
    ) -> Result<Vec<Session>, String>;

    // ============ Metrics Storage Commands ============

    async fn get_session_metrics<R: Runtime>(
        window: Window<R>,
        session_id: String,
        metric_type: Option<String>,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<StoredMetric>, String>;

    async fn get_session_network_requests<R: Runtime>(
        window: Window<R>,
        session_id: String,
        limit: Option<u32>,
    ) -> Result<Vec<StoredNetworkRequest>, String>;
}

#[derive(Clone)]
pub struct ApiImpl;

#[taurpc::resolvers]
impl Api for ApiImpl {
    // ============ ADB Commands ============

    async fn get_devices<R: Runtime>(self, window: Window<R>) -> Result<Vec<Device>, String> {
        adb::list_devices(window.app_handle())
            .await
            .map_err(|e| e.to_string())
    }

    async fn get_webviews<R: Runtime>(
        self,
        window: Window<R>,
        device_id: String,
    ) -> Result<Vec<WebView>, String> {
        adb::list_webviews(window.app_handle(), &device_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn start_port_forward<R: Runtime>(
        self,
        window: Window<R>,
        device_id: String,
        socket_name: String,
        local_port: u16,
    ) -> Result<PortForwardResult, String> {
        adb::forward_port(window.app_handle(), &device_id, local_port, &socket_name)
            .await
            .map_err(|e| e.to_string())?;

        Ok(PortForwardResult {
            local_port,
            socket_name,
        })
    }

    async fn stop_port_forward<R: Runtime>(
        self,
        window: Window<R>,
        device_id: String,
        local_port: u16,
    ) -> Result<(), String> {
        adb::remove_forward(window.app_handle(), &device_id, local_port)
            .await
            .map_err(|e| e.to_string())
    }

    async fn stop_all_port_forwards<R: Runtime>(
        self,
        window: Window<R>,
        device_id: String,
    ) -> Result<(), String> {
        adb::remove_all_forwards(window.app_handle(), &device_id)
            .await
            .map_err(|e| e.to_string())
    }

    // ============ CDP Commands ============

    async fn get_cdp_targets(self, port: u16) -> Result<Vec<CdpTarget>, String> {
        CdpClient::get_targets(port)
            .await
            .map_err(|e| e.to_string())
    }

    async fn connect_cdp<R: Runtime>(
        self,
        window: Window<R>,
        ws_url: String,
    ) -> Result<(), String> {
        let state = window.state::<ManagedState>();
        state
            .cdp_client
            .connect(&ws_url)
            .await
            .map_err(|e| e.to_string())
    }

    async fn disconnect_cdp<R: Runtime>(self, window: Window<R>) -> Result<(), String> {
        let state = window.state::<ManagedState>();
        let holder = window.state::<MetricsCollectorHolder<R>>();

        // Stop metrics collection first
        {
            let mut collector = holder.collector.write().await;
            if let Some(c) = collector.as_ref() {
                c.stop().await;
            }
            *collector = None;
        }

        state
            .cdp_client
            .disconnect()
            .await
            .map_err(|e| e.to_string())
    }

    async fn get_cdp_state<R: Runtime>(self, window: Window<R>) -> Result<ConnectionState, String> {
        let state = window.state::<ManagedState>();
        Ok(state.cdp_client.get_state().await)
    }

    async fn start_metrics_collection<R: Runtime>(
        self,
        window: Window<R>,
        poll_interval_ms: Option<u64>,
    ) -> Result<(), String> {
        let state = window.state::<ManagedState>();
        let holder = window.state::<MetricsCollectorHolder<R>>();
        let interval = poll_interval_ms.unwrap_or(1000);

        // Get current session ID
        let session_id = {
            let current = state.current_session_id.read().await;
            current
                .clone()
                .ok_or("No active session. Create a session first.")?
        };

        let collector = MetricsCollector::new(
            state.cdp_client.clone(),
            state.database.clone(),
            session_id,
            Some(window.app_handle().clone()),
        );
        collector.start(interval).await.map_err(|e| e.to_string())?;

        let mut collector_lock = holder.collector.write().await;
        *collector_lock = Some(collector);

        Ok(())
    }

    async fn stop_metrics_collection<R: Runtime>(self, window: Window<R>) -> Result<(), String> {
        let holder = window.state::<MetricsCollectorHolder<R>>();
        let mut collector = holder.collector.write().await;
        if let Some(c) = collector.as_ref() {
            c.stop().await;
        }
        *collector = None;
        Ok(())
    }

    async fn get_performance_metrics<R: Runtime>(
        self,
        window: Window<R>,
    ) -> Result<PerformanceMetrics, String> {
        let state = window.state::<ManagedState>();
        state
            .cdp_client
            .get_performance_metrics()
            .await
            .map_err(|e| e.to_string())
    }

    // ============ Session Commands ============

    async fn create_session<R: Runtime>(
        self,
        window: Window<R>,
        params: CreateSessionParams,
    ) -> Result<Session, String> {
        let state = window.state::<ManagedState>();
        let session = Session::new(
            params.device_id,
            params.device_name,
            params.package_name,
            params.target_title,
            params.webview_url,
        );

        state
            .database
            .create_session(&session)
            .map_err(|e| e.to_string())?;

        // Set as current session
        {
            let mut current = state.current_session_id.write().await;
            *current = Some(session.id.clone());
        }

        Ok(session)
    }

    async fn end_session<R: Runtime>(
        self,
        window: Window<R>,
        session_id: Option<String>,
    ) -> Result<(), String> {
        let state = window.state::<ManagedState>();
        let id = if let Some(id) = session_id {
            id
        } else {
            let current = state.current_session_id.read().await;
            current.clone().ok_or("No active session")?
        };

        let ended_at = chrono::Utc::now().timestamp_millis();
        state
            .database
            .end_session(&id, ended_at)
            .map_err(|e| e.to_string())?;

        // Clear current session if it matches
        {
            let mut current = state.current_session_id.write().await;
            if current.as_ref() == Some(&id) {
                *current = None;
            }
        }

        Ok(())
    }

    async fn get_session<R: Runtime>(
        self,
        window: Window<R>,
        session_id: String,
    ) -> Result<Option<Session>, String> {
        let state = window.state::<ManagedState>();
        state
            .database
            .get_session(&session_id)
            .map_err(|e| e.to_string())
    }

    async fn list_sessions<R: Runtime>(
        self,
        window: Window<R>,
        limit: Option<u32>,
    ) -> Result<Vec<Session>, String> {
        let state = window.state::<ManagedState>();
        state
            .database
            .list_sessions(limit)
            .map_err(|e| e.to_string())
    }

    async fn delete_session<R: Runtime>(
        self,
        window: Window<R>,
        session_id: String,
    ) -> Result<(), String> {
        let state = window.state::<ManagedState>();

        // Clear current session if it matches the deleted one
        {
            let mut current = state.current_session_id.write().await;
            if current.as_ref() == Some(&session_id) {
                *current = None;
            }
        }

        state
            .database
            .delete_session(&session_id)
            .map_err(|e| e.to_string())
    }

    async fn update_session_name<R: Runtime>(
        self,
        window: Window<R>,
        session_id: String,
        display_name: Option<String>,
    ) -> Result<(), String> {
        let state = window.state::<ManagedState>();
        state
            .database
            .update_session_name(&session_id, display_name.as_deref())
            .map_err(|e| e.to_string())
    }

    async fn update_session_tags<R: Runtime>(
        self,
        window: Window<R>,
        session_id: String,
        tags: Option<Vec<String>>,
    ) -> Result<(), String> {
        let state = window.state::<ManagedState>();
        state
            .database
            .update_session_tags(&session_id, tags.as_deref())
            .map_err(|e| e.to_string())
    }

    async fn search_sessions<R: Runtime>(
        self,
        window: Window<R>,
        query: Option<String>,
        device_id: Option<String>,
        status: Option<String>,
        tags: Option<Vec<String>>,
        limit: Option<u32>,
    ) -> Result<Vec<Session>, String> {
        let state = window.state::<ManagedState>();
        state
            .database
            .search_sessions(
                query.as_deref(),
                device_id.as_deref(),
                status.as_deref(),
                tags.as_deref(),
                limit,
            )
            .map_err(|e| e.to_string())
    }

    // ============ Metrics Storage Commands ============

    async fn get_session_metrics<R: Runtime>(
        self,
        window: Window<R>,
        session_id: String,
        metric_type: Option<String>,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<StoredMetric>, String> {
        let state = window.state::<ManagedState>();
        let mt = metric_type.map(|s| MetricType::from_str(&s));
        state
            .database
            .get_metrics(&session_id, mt, start_time, end_time, limit)
            .map_err(|e| e.to_string())
    }

    async fn get_session_network_requests<R: Runtime>(
        self,
        window: Window<R>,
        session_id: String,
        limit: Option<u32>,
    ) -> Result<Vec<StoredNetworkRequest>, String> {
        let state = window.state::<ManagedState>();
        state
            .database
            .get_network_requests(&session_id, limit)
            .map_err(|e| e.to_string())
    }
}
