use tauri::AppHandle;

// Placeholder service controls for client-mode builds.
// These keep the app compiling if server orchestration isn't needed.
pub async fn start_services(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub async fn stop_services(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub async fn check_postgres_status(_app: &AppHandle) -> bool {
    false
}
