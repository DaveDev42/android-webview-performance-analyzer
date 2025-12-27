use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AdbError {
    #[error("Failed to execute ADB command: {0}")]
    ExecutionFailed(String),
    #[error("ADB command failed with output: {0}")]
    CommandFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebView {
    pub socket_name: String,
    pub pid: u32,
    pub package_name: Option<String>,
}

pub async fn list_devices(app: &AppHandle) -> Result<Vec<Device>, AdbError> {
    let output = app
        .shell()
        .sidecar("adb")
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?
        .args(["devices", "-l"])
        .output()
        .await
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(AdbError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let id = parts[0].to_string();
            let status = parts[1].to_string();

            // Extract device name from "model:" field if present
            let name = parts
                .iter()
                .find(|p| p.starts_with("model:"))
                .map(|p| p.trim_start_matches("model:").to_string())
                .unwrap_or_else(|| id.clone());

            devices.push(Device { id, name, status });
        }
    }

    Ok(devices)
}

pub async fn list_webviews(app: &AppHandle, device_id: &str) -> Result<Vec<WebView>, AdbError> {
    let output = app
        .shell()
        .sidecar("adb")
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?
        .args(["-s", device_id, "shell", "cat", "/proc/net/unix"])
        .output()
        .await
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(AdbError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut webviews = Vec::new();
    let mut seen_pids = std::collections::HashSet::new();

    for line in stdout.lines() {
        if line.contains("webview_devtools_remote_") || line.contains("chrome_devtools_remote") {
            // Extract socket name
            if let Some(socket_name) = line.split_whitespace().last() {
                let socket_name = socket_name.trim_start_matches('@');

                // Extract PID from socket name
                if let Some(pid_str) = socket_name.split('_').last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        // Avoid duplicates
                        if seen_pids.insert(pid) {
                            webviews.push(WebView {
                                socket_name: socket_name.to_string(),
                                pid,
                                package_name: None,
                            });
                        }
                    }
                }
            }
        }
    }

    // Try to get package names for each PID
    for webview in &mut webviews {
        if let Ok(pkg) = get_package_name(app, device_id, webview.pid).await {
            webview.package_name = Some(pkg);
        }
    }

    Ok(webviews)
}

async fn get_package_name(app: &AppHandle, device_id: &str, pid: u32) -> Result<String, AdbError> {
    let output = app
        .shell()
        .sidecar("adb")
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?
        .args([
            "-s",
            device_id,
            "shell",
            &format!("cat /proc/{}/cmdline", pid),
        ])
        .output()
        .await
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // cmdline contains null-terminated strings, get the first one
        let pkg = stdout.split('\0').next().unwrap_or("").trim().to_string();
        if !pkg.is_empty() {
            return Ok(pkg);
        }
    }

    Err(AdbError::CommandFailed("Could not get package name".into()))
}

pub async fn forward_port(
    app: &AppHandle,
    device_id: &str,
    local_port: u16,
    socket_name: &str,
) -> Result<(), AdbError> {
    let output = app
        .shell()
        .sidecar("adb")
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?
        .args([
            "-s",
            device_id,
            "forward",
            &format!("tcp:{}", local_port),
            &format!("localabstract:{}", socket_name),
        ])
        .output()
        .await
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(AdbError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    Ok(())
}

pub async fn remove_forward(
    app: &AppHandle,
    device_id: &str,
    local_port: u16,
) -> Result<(), AdbError> {
    let output = app
        .shell()
        .sidecar("adb")
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?
        .args([
            "-s",
            device_id,
            "forward",
            "--remove",
            &format!("tcp:{}", local_port),
        ])
        .output()
        .await
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(AdbError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    Ok(())
}

pub async fn remove_all_forwards(app: &AppHandle, device_id: &str) -> Result<(), AdbError> {
    let output = app
        .shell()
        .sidecar("adb")
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?
        .args(["-s", device_id, "forward", "--remove-all"])
        .output()
        .await
        .map_err(|e| AdbError::ExecutionFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(AdbError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    Ok(())
}
