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
    #[serde(default = "default_lang")]
    pub language: String,
}

fn default_lang() -> String { "en".into() }

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

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            data_dir: String::new(),
            port: DEFAULT_PORT,
            language: default_lang(),
        }
    }
}

pub fn load(app: &tauri::App) -> Option<AppConfig> {
    let p = path(app);
    if p.exists() {
        let content = match std::fs::read_to_string(&p) {
            Ok(c) => c,
            Err(_) => return None,
        };
        match serde_json::from_str::<AppConfig>(&content) {
            Ok(config) => Some(config),
            Err(e) => {
                log::warn!("Config file corrupted, backing up and using defaults: {}", e);
                let bak = p.with_extension("json.bak");
                std::fs::rename(&p, &bak).ok();
                Some(AppConfig::default())
            }
        }
    } else {
        None
    }
}

pub fn load_from_handle(app: &tauri::AppHandle) -> AppConfig {
    let p = path_from_handle(app);
    if p.exists() {
        if let Ok(content) = std::fs::read_to_string(&p) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

pub fn save(app: &tauri::AppHandle, config: &AppConfig) {
    let p = path_from_handle(app);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        std::fs::write(&p, json).ok();
    }
}
