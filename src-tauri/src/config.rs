use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[allow(dead_code)]
pub const DEFAULT_PORT: u16 = 4000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(rename = "dataDir")]
    pub data_dir: String,
    pub port: u16,
}

pub fn path(app: &tauri::App) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("config.json")
}

pub fn path_from_handle(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("config.json")
}

pub fn load(app: &tauri::App) -> Option<AppConfig> {
    let p = path(app);
    if p.exists() {
        let content = std::fs::read_to_string(&p).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

pub fn save(app: &tauri::AppHandle, config: &AppConfig) {
    let p = path_from_handle(app);
    std::fs::create_dir_all(p.parent().unwrap()).ok();
    std::fs::write(&p, serde_json::to_string_pretty(config).unwrap()).ok();
}
