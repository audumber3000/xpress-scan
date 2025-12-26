// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod server;
mod config;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_app_mode,
            commands::set_app_mode,
            commands::get_server_ip,
            commands::set_server_ip,
            commands::start_server_services,
            commands::stop_server_services,
            commands::check_server_status,
            commands::get_local_ip,
            commands::is_first_run,
            commands::complete_setup,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Check if this is server mode and auto-start services
            tauri::async_runtime::spawn(async move {
                if let Ok(mode) = commands::get_app_mode_internal(&app_handle).await {
                    if mode == "server" {
                        let _ = server::start_services(&app_handle).await;
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
