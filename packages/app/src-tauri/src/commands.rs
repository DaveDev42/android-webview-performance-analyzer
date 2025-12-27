use crate::adb::{self, Device, WebView};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct PortForwardResult {
    pub local_port: u16,
    pub socket_name: String,
}

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
