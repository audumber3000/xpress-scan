use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::process::Command;
use std::path::PathBuf;
use std::net::TcpListener;

pub struct ServerState {
    pub postgres_running: bool,
    pub backend_running: bool,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            postgres_running: false,
            backend_running: false,
        }
    }
}

fn get_resource_path(app: &AppHandle) -> Option<PathBuf> {
    // Get the path to bundled resources
    app.path().resource_dir().ok()
}

fn get_pg_bin_path(app: &AppHandle, binary: &str) -> Option<PathBuf> {
    let resource_dir = get_resource_path(app)?;
    let pg_bin = resource_dir.join("sidecars").join("postgresql").join("bin").join(binary);
    if pg_bin.exists() {
        Some(pg_bin)
    } else {
        // Fallback for development
        None
    }
}

pub async fn start_services(app: &AppHandle) -> Result<(), String> {
    // Start PostgreSQL
    start_postgres(app).await?;
    
    // Wait a moment for PostgreSQL to be ready
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // Start FastAPI backend
    start_backend(app).await?;
    
    Ok(())
}

pub async fn stop_services(app: &AppHandle) -> Result<(), String> {
    // Stop backend first
    stop_backend(app).await?;
    
    // Then stop PostgreSQL
    stop_postgres(app).await?;
    
    Ok(())
}

fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn kill_process_on_port(port: u16) -> bool {
    // Use lsof to find and kill process on port (macOS/Linux)
    #[cfg(unix)]
    {
        let output = Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output();
        
        if let Ok(out) = output {
            let pids = String::from_utf8_lossy(&out.stdout);
            for pid in pids.lines() {
                if let Ok(pid_num) = pid.trim().parse::<i32>() {
                    println!("Killing process {} on port {}", pid_num, port);
                    let _ = Command::new("kill")
                        .args(["-9", &pid_num.to_string()])
                        .output();
                }
            }
            // Wait a moment for process to die
            std::thread::sleep(std::time::Duration::from_millis(500));
            return is_port_available(port);
        }
    }
    false
}

async fn start_postgres(app: &AppHandle) -> Result<(), String> {
    // Check if port 5432 is already in use
    if !is_port_available(5432) {
        println!("Port 5432 is already in use, attempting to free it...");
        
        // Try to kill the process using the port
        if kill_process_on_port(5432) {
            println!("Successfully freed port 5432");
        } else {
            // Port still in use - check if it's our PostgreSQL
            println!("Could not free port 5432, checking if it's a compatible PostgreSQL...");
            
            // Try to connect to existing PostgreSQL
            let test_output = Command::new("psql")
                .args(["-h", "localhost", "-p", "5432", "-U", "postgres", "-c", "SELECT 1"])
                .output();
            
            if let Ok(out) = test_output {
                if out.status.success() {
                    println!("Existing PostgreSQL on port 5432 is compatible, using it");
                    return Ok(());
                }
            }
            
            return Err("Port 5432 is in use by another application. Please close it and restart BDent.".to_string());
        }
    }
    
    // Get the data directory path
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let pg_data_dir = app_data_dir.join("pgdata");
    
    // Get PostgreSQL binary paths from resources
    let initdb_path = get_pg_bin_path(app, "initdb")
        .ok_or_else(|| "PostgreSQL initdb not found in resources".to_string())?;
    let pg_ctl_path = get_pg_bin_path(app, "pg_ctl")
        .ok_or_else(|| "PostgreSQL pg_ctl not found in resources".to_string())?;
    
    // Get lib path for PostgreSQL
    let resource_dir = get_resource_path(app)
        .ok_or_else(|| "Resource directory not found".to_string())?;
    let pg_lib_dir = resource_dir.join("sidecars").join("postgresql").join("lib");
    
    // Check if PostgreSQL data directory exists, if not initialize it
    if !pg_data_dir.exists() {
        println!("Initializing PostgreSQL database...");
        
        // Create the directory
        std::fs::create_dir_all(&pg_data_dir)
            .map_err(|e| format!("Failed to create pgdata dir: {}", e))?;
        
        // Initialize the database using Command
        let output = Command::new(&initdb_path)
            .env("DYLD_LIBRARY_PATH", &pg_lib_dir)
            .env("LD_LIBRARY_PATH", &pg_lib_dir)
            .args(["-D", pg_data_dir.to_str().unwrap(), "-U", "postgres", "-E", "UTF8"])
            .output()
            .map_err(|e| format!("Failed to run initdb: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("initdb failed: {}", String::from_utf8_lossy(&output.stderr)));
        }
        
        println!("PostgreSQL database initialized successfully");
    }
    
    // Start PostgreSQL server
    println!("Starting PostgreSQL server...");
    
    let log_file = app_data_dir.join("postgresql.log");
    
    // Use -w to wait for startup, with timeout
    let output = Command::new(&pg_ctl_path)
        .env("DYLD_LIBRARY_PATH", &pg_lib_dir)
        .env("LD_LIBRARY_PATH", &pg_lib_dir)
        .args([
            "start", 
            "-D", pg_data_dir.to_str().unwrap(), 
            "-l", log_file.to_str().unwrap(),
            "-w",  // Wait for startup
            "-t", "10"  // Timeout after 10 seconds
        ])
        .output()
        .map_err(|e| format!("Failed to start PostgreSQL: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("PostgreSQL start output: {} {}", stdout, stderr);
        // Don't fail - PostgreSQL might already be running
        println!("PostgreSQL may already be running, continuing...");
    } else {
        println!("PostgreSQL server started successfully");
    }
    
    Ok(())
}

async fn stop_postgres(app: &AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let pg_data_dir = app_data_dir.join("pgdata");
    
    if let Some(pg_ctl_path) = get_pg_bin_path(app, "pg_ctl") {
        let resource_dir = get_resource_path(app).unwrap();
        let pg_lib_dir = resource_dir.join("sidecars").join("postgresql").join("lib");
        
        let _ = Command::new(&pg_ctl_path)
            .env("DYLD_LIBRARY_PATH", &pg_lib_dir)
            .env("LD_LIBRARY_PATH", &pg_lib_dir)
            .args(["stop", "-D", pg_data_dir.to_str().unwrap(), "-m", "fast"])
            .output();
    }
    
    Ok(())
}

async fn start_backend(app: &AppHandle) -> Result<(), String> {
    // Check if port 8000 is already in use
    if !is_port_available(8000) {
        println!("Port 8000 is already in use, attempting to free it...");
        
        if kill_process_on_port(8000) {
            println!("Successfully freed port 8000");
        } else {
            return Err("Port 8000 is in use by another application. Please close it and restart BDent.".to_string());
        }
    }
    
    let shell = app.shell();
    
    println!("Starting FastAPI backend...");
    
    // Set environment variables for offline mode (no Supabase needed)
    let sidecar_cmd = shell
        .sidecar("backend")
        .map_err(|e| {
            let err_msg = format!("Failed to create backend sidecar: {}", e);
            println!("{}", err_msg);
            err_msg
        })?;
    
    println!("Backend sidecar command created, spawning...");
    
    let (mut rx, _child) = sidecar_cmd
        .env("USE_LOCAL_DB", "true")
        .env("LOCAL_DB_HOST", "localhost")
        .env("LOCAL_DB_PORT", "5432")
        .env("LOCAL_DB_NAME", "bdent")
        .env("LOCAL_DB_USER", "postgres")
        .env("LOCAL_DB_PASSWORD", "postgres")
        .spawn()
        .map_err(|e| {
            let err_msg = format!("Failed to spawn backend: {}", e);
            println!("{}", err_msg);
            err_msg
        })?;
    
    // Log backend output for debugging
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    println!("Backend stdout: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    println!("Backend stderr: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    println!("Backend error: {}", err);
                }
                CommandEvent::Terminated(payload) => {
                    println!("Backend terminated with code: {:?}", payload.code);
                }
                _ => {}
            }
        }
    });
    
    println!("FastAPI backend spawned successfully");
    Ok(())
}

async fn stop_backend(_app: &AppHandle) -> Result<(), String> {
    // Backend will be stopped when the sidecar process is killed
    // Tauri handles this automatically on app exit
    Ok(())
}

pub async fn check_postgres_status(app: &AppHandle) -> bool {
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return false,
    };
    
    let pg_data_dir = app_data_dir.join("pgdata");
    
    let pg_ctl_path = match get_pg_bin_path(app, "pg_ctl") {
        Some(path) => path,
        None => return false,
    };
    
    let resource_dir = match get_resource_path(app) {
        Some(dir) => dir,
        None => return false,
    };
    let pg_lib_dir = resource_dir.join("sidecars").join("postgresql").join("lib");
    
    let output = Command::new(&pg_ctl_path)
        .env("DYLD_LIBRARY_PATH", &pg_lib_dir)
        .env("LD_LIBRARY_PATH", &pg_lib_dir)
        .args(["status", "-D", pg_data_dir.to_str().unwrap()])
        .output();
    
    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

pub async fn check_backend_status(api_url: &str) -> bool {
    // Try to hit the health endpoint
    let client = reqwest::Client::new();
    match client.get(format!("{}/health", api_url))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}
