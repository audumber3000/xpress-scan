// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod oauth;

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
            commands::start_google_oauth,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
