use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub mode: AppMode,
    pub server_ip: Option<String>,
    pub server_port: u16,
    pub db_port: u16,
    pub first_run_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Server,
    Client,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mode: AppMode::Client,
            server_ip: None,
            server_port: 8000,
            db_port: 5432,
            first_run_complete: false,
        }
    }
}

impl AppConfig {
    pub fn get_api_url(&self) -> String {
        match self.mode {
            AppMode::Server => format!("http://127.0.0.1:{}", self.server_port),
            AppMode::Client => {
                if let Some(ip) = &self.server_ip {
                    format!("http://{}:{}", ip, self.server_port)
                } else {
                    format!("http://127.0.0.1:{}", self.server_port)
                }
            }
        }
    }
}
