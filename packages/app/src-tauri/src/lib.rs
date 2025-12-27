mod adb;
mod cdp;
mod commands;
mod state;

use state::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(AppState::new()))
        .invoke_handler(tauri::generate_handler![
            // ADB commands
            commands::get_devices,
            commands::get_webviews,
            commands::start_port_forward,
            commands::stop_port_forward,
            commands::stop_all_port_forwards,
            // CDP commands
            commands::get_cdp_targets,
            commands::connect_cdp,
            commands::disconnect_cdp,
            commands::get_cdp_state,
            commands::start_metrics_collection,
            commands::stop_metrics_collection,
            commands::get_performance_metrics,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
