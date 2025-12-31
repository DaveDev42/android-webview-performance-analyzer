mod adb;
mod cdp;
mod procedures;
mod storage;

use cdp::CdpClient;
use procedures::{Api, ApiImpl, ManagedState, MetricsCollectorHolder};
use std::sync::Arc;
use storage::Database;
use tauri::Manager;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create a Tokio runtime for TauRPC router setup
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    // Create TauRPC router with BigInt configuration within Tokio context
    let router = rt.block_on(async {
        taurpc::Router::new()
            .export_config(
                specta_typescript::Typescript::default()
                    .bigint(specta_typescript::BigIntExportBehavior::Number),
            )
            .merge(ApiImpl.into_handler())
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_mcp::init())
        .setup(|app| {
            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let db_path = Database::get_db_path(&app_data_dir);
            let db = Database::new(db_path).expect("Failed to initialize database");

            // Create managed state
            let managed_state = ManagedState {
                cdp_client: Arc::new(CdpClient::new()),
                database: Arc::new(db),
                current_session_id: Arc::new(RwLock::new(None)),
            };
            app.manage(managed_state);

            // Create metrics collector holder (runtime-specific)
            app.manage(MetricsCollectorHolder::<tauri::Wry>::new());

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(router.into_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
