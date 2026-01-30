use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde_json::json;

use crate::oauth;

const CONFIG_FILE: &str = "config.json";

// Internal function to get app mode (online-only app; mode is always "client")
pub async fn get_app_mode_internal(app: &AppHandle) -> Result<String, String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let mode = store.get("mode")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "client".to_string());

    Ok(mode)
}

#[tauri::command]
pub async fn get_app_mode(app: AppHandle) -> Result<String, String> {
    get_app_mode_internal(&app).await
}

#[tauri::command]
pub async fn set_app_mode(app: AppHandle, mode: String) -> Result<(), String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set("mode", json!(mode));
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_server_ip(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let ip = store.get("server_ip")
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    Ok(ip)
}

#[tauri::command]
pub async fn set_server_ip(app: AppHandle, ip: String) -> Result<(), String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set("server_ip", json!(ip));
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// No-op: app is online-only; backend is used via VITE_BACKEND_URL (run explicitly if local).
#[tauri::command]
pub async fn start_server_services(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

/// No-op: app is online-only; no embedded server to stop.
#[tauri::command]
pub async fn stop_server_services(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

/// Returns status for online-only app. Backend is whatever is configured at build time (VITE_BACKEND_URL).
#[tauri::command]
pub async fn check_server_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let mode = store.get("mode")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "client".to_string());

    let server_ip = store.get("server_ip")
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    Ok(json!({
        "mode": mode,
        "server_ip": server_ip,
        "postgres_running": false,
        "backend_running": true,
        "all_services_running": true
    }))
}

#[tauri::command]
pub async fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("Failed to get local IP: {}", e))
}

#[tauri::command]
pub async fn is_first_run(app: AppHandle) -> Result<bool, String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let first_run_complete = store.get("first_run_complete")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    Ok(!first_run_complete)
}

#[tauri::command]
pub async fn complete_setup(app: AppHandle, mode: String, server_ip: Option<String>) -> Result<(), String> {
    let store = app.store(CONFIG_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set("mode", json!(mode));
    store.set("first_run_complete", json!(true));

    if let Some(ip) = server_ip {
        store.set("server_ip", json!(ip));
    }

    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn start_google_oauth(app: AppHandle, oauth_url: String) -> Result<String, String> {
    oauth::start_oauth_flow(app, oauth_url).await
}
