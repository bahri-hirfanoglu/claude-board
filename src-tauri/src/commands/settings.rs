use tauri::AppHandle;
use crate::db::{self, settings};

#[tauri::command]
pub fn get_app_settings(_app: AppHandle) -> Result<settings::AppSettings, String> {
    let db = db::get_db();
    let mut s = settings::get(&db);

    // Sync autostart state with OS
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        if let Ok(enabled) = _app.autolaunch().is_enabled() {
            if s.launch_at_startup != enabled {
                s.launch_at_startup = enabled;
                settings::set(&db, "launch_at_startup", &enabled.to_string());
            }
        }
    }

    Ok(s)
}

#[tauri::command]
pub fn update_app_settings(_app: AppHandle, data: serde_json::Value) -> Result<settings::AppSettings, String> {
    let db = db::get_db();
    let mut current = settings::get(&db);

    if let Some(v) = data.get("launch_at_startup").and_then(|v| v.as_bool()) {
        current.launch_at_startup = v;
        #[cfg(desktop)]
        {
            use tauri_plugin_autostart::ManagerExt;
            let autostart = _app.autolaunch();
            if v {
                autostart.enable().ok();
            } else {
                autostart.disable().ok();
            }
        }
    }
    if let Some(v) = data.get("minimize_to_tray").and_then(|v| v.as_bool()) {
        current.minimize_to_tray = v;
    }
    if let Some(v) = data.get("confirm_before_delete").and_then(|v| v.as_bool()) {
        current.confirm_before_delete = v;
    }
    if let Some(v) = data.get("default_model").and_then(|v| v.as_str()) {
        current.default_model = v.to_string();
    }
    if let Some(v) = data.get("default_effort").and_then(|v| v.as_str()) {
        current.default_effort = v.to_string();
    }
    if let Some(v) = data.get("language").and_then(|v| v.as_str()) {
        current.language = v.to_string();
    }
    if let Some(v) = data.get("notify_task_completed").and_then(|v| v.as_bool()) {
        current.notify_task_completed = v;
    }
    if let Some(v) = data.get("notify_task_failed").and_then(|v| v.as_bool()) {
        current.notify_task_failed = v;
    }
    if let Some(v) = data.get("notify_task_started").and_then(|v| v.as_bool()) {
        current.notify_task_started = v;
    }
    if let Some(v) = data.get("notify_revision_requested").and_then(|v| v.as_bool()) {
        current.notify_revision_requested = v;
    }
    if let Some(v) = data.get("notify_queue_started").and_then(|v| v.as_bool()) {
        current.notify_queue_started = v;
    }
    if let Some(v) = data.get("sound_enabled").and_then(|v| v.as_bool()) {
        current.sound_enabled = v;
    }
    if let Some(v) = data.get("auto_open_terminal").and_then(|v| v.as_bool()) {
        current.auto_open_terminal = v;
    }

    settings::update(&db, &current);
    Ok(current)
}
