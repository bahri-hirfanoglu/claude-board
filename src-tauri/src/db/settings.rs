use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::db::DbPool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub launch_at_startup: bool,
    pub minimize_to_tray: bool,
    pub confirm_before_delete: bool,
    pub default_model: String,
    pub default_effort: String,
    pub language: String,
    pub notify_task_completed: bool,
    pub notify_task_failed: bool,
    pub notify_task_started: bool,
    pub notify_revision_requested: bool,
    pub notify_queue_started: bool,
    pub sound_enabled: bool,
    pub auto_open_terminal: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_startup: false,
            minimize_to_tray: false,
            confirm_before_delete: true,
            default_model: "sonnet".to_string(),
            default_effort: "medium".to_string(),
            language: "en".to_string(),
            notify_task_completed: true,
            notify_task_failed: true,
            notify_task_started: false,
            notify_revision_requested: true,
            notify_queue_started: false,
            sound_enabled: true,
            auto_open_terminal: true,
        }
    }
}

pub fn get(db: &DbPool) -> AppSettings {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT key, value FROM app_settings") {
        Ok(s) => s,
        Err(_) => return AppSettings::default(),
    };
    let rows: Vec<(String, String)> = match stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
    {
        Ok(r) => r.flatten().collect(),
        Err(e) => { log::error!("get: {}", e); return AppSettings::default(); }
    };

    let mut settings = AppSettings::default();
    for (key, value) in rows {
        match key.as_str() {
            "launch_at_startup" => settings.launch_at_startup = value == "true",
            "minimize_to_tray" => settings.minimize_to_tray = value == "true",
            "confirm_before_delete" => settings.confirm_before_delete = value == "true",
            "default_model" => settings.default_model = value,
            "default_effort" => settings.default_effort = value,
            "language" => settings.language = value,
            "notify_task_completed" => settings.notify_task_completed = value == "true",
            "notify_task_failed" => settings.notify_task_failed = value == "true",
            "notify_task_started" => settings.notify_task_started = value == "true",
            "notify_revision_requested" => settings.notify_revision_requested = value == "true",
            "notify_queue_started" => settings.notify_queue_started = value == "true",
            "sound_enabled" => settings.sound_enabled = value == "true",
            "auto_open_terminal" => settings.auto_open_terminal = value == "true",
            _ => {}
        }
    }
    settings
}

pub fn set(db: &DbPool, key: &str, value: &str) {
    let conn = db.lock();
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now','localtime')",
        params![key, value],
    )
    .ok();
}

pub fn update(db: &DbPool, settings: &AppSettings) {
    let pairs: Vec<(&str, String)> = vec![
        ("launch_at_startup", settings.launch_at_startup.to_string()),
        ("minimize_to_tray", settings.minimize_to_tray.to_string()),
        ("confirm_before_delete", settings.confirm_before_delete.to_string()),
        ("default_model", settings.default_model.clone()),
        ("default_effort", settings.default_effort.clone()),
        ("language", settings.language.clone()),
        ("notify_task_completed", settings.notify_task_completed.to_string()),
        ("notify_task_failed", settings.notify_task_failed.to_string()),
        ("notify_task_started", settings.notify_task_started.to_string()),
        ("notify_revision_requested", settings.notify_revision_requested.to_string()),
        ("notify_queue_started", settings.notify_queue_started.to_string()),
        ("sound_enabled", settings.sound_enabled.to_string()),
        ("auto_open_terminal", settings.auto_open_terminal.to_string()),
    ];
    for (key, value) in pairs {
        set(db, key, &value);
    }
}
