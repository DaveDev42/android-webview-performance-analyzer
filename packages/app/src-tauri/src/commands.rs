use crate::adb::{self, Device, WebView};
use crate::cdp::{CdpClient, CdpTarget, ConnectionState, MetricsCollector, PerformanceMetrics};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct PortForwardResult {
    pub local_port: u16,
    pub socket_name: String,
}

// ============ ADB Commands ============

#[tauri::command]
pub async fn get_devices(app: AppHandle) -> Result<Vec<Device>, String> {
    adb::list_devices(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_webviews(app: AppHandle, device_id: String) -> Result<Vec<WebView>, String> {
    adb::list_webviews(&app, &device_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_port_forward(
    app: AppHandle,
    device_id: String,
    socket_name: String,
    local_port: u16,
) -> Result<PortForwardResult, String> {
    adb::forward_port(&app, &device_id, local_port, &socket_name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(PortForwardResult {
        local_port,
        socket_name,
    })
}

#[tauri::command]
pub async fn stop_port_forward(
    app: AppHandle,
    device_id: String,
    local_port: u16,
) -> Result<(), String> {
    adb::remove_forward(&app, &device_id, local_port)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_all_port_forwards(app: AppHandle, device_id: String) -> Result<(), String> {
    adb::remove_all_forwards(&app, &device_id)
        .await
        .map_err(|e| e.to_string())
}

// ============ CDP Commands ============

#[tauri::command]
pub async fn get_cdp_targets(port: u16) -> Result<Vec<CdpTarget>, String> {
    CdpClient::get_targets(port)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connect_cdp(
    state: State<'_, Arc<AppState>>,
    ws_url: String,
) -> Result<(), String> {
    state
        .cdp_client
        .connect(&ws_url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn disconnect_cdp(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    // Stop metrics collection first
    {
        let mut collector = state.metrics_collector.write().await;
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

#[tauri::command]
pub async fn get_cdp_state(state: State<'_, Arc<AppState>>) -> Result<ConnectionState, String> {
    Ok(state.cdp_client.get_state().await)
}

#[tauri::command]
pub async fn start_metrics_collection(
    state: State<'_, Arc<AppState>>,
    poll_interval_ms: Option<u64>,
) -> Result<(), String> {
    let interval = poll_interval_ms.unwrap_or(1000);

    let collector = MetricsCollector::new(state.cdp_client.clone());
    collector.start(interval).await.map_err(|e| e.to_string())?;

    let mut collector_lock = state.metrics_collector.write().await;
    *collector_lock = Some(collector);

    Ok(())
}

#[tauri::command]
pub async fn stop_metrics_collection(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut collector = state.metrics_collector.write().await;
    if let Some(c) = collector.as_ref() {
        c.stop().await;
    }
    *collector = None;
    Ok(())
}

#[tauri::command]
pub async fn get_performance_metrics(
    state: State<'_, Arc<AppState>>,
) -> Result<PerformanceMetrics, String> {
    state
        .cdp_client
        .get_performance_metrics()
        .await
        .map_err(|e| e.to_string())
}
