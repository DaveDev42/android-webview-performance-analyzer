mod adb;
mod cdp;
mod commands;
mod state;
mod storage;

use state::AppState;
use storage::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            // Session commands
            commands::create_session,
            commands::end_session,
            commands::get_session,
            commands::list_sessions,
            commands::delete_session,
            // Metrics storage commands
            commands::get_session_metrics,
            commands::get_session_network_requests,
        ])
        .setup(|app| {
            // Initialize database
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            let db_path = Database::get_db_path(&app_data_dir);
            let db = Database::new(db_path).expect("Failed to initialize database");

            // Create and manage app state
            let state = AppState::new(db);
            app.manage(Arc::new(state));

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
