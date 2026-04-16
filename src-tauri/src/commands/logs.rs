//! Commands for inspecting and exporting the app's log directory.
//!
//! The `tauri-plugin-log` plugin writes a rotating log file to the app's
//! platform-standard log directory. When a user hits a bug, asking them to
//! `Open Log Directory` from Settings → About and attach the file is the
//! fastest way to get structured error context into a bug report.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Resolve the path tauri-plugin-log writes to.
fn log_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|e| format!("Could not resolve log directory: {}", e))
}

/// Returns the absolute path to the log directory as a string so the frontend
/// can display it.
#[tauri::command]
pub fn get_logs_dir(app: AppHandle) -> Result<String, String> {
    Ok(log_dir(&app)?.to_string_lossy().to_string())
}

/// Opens the log directory in the OS file manager. Best-effort — if the native
/// opener fails we return the path so the user can open it manually.
#[tauri::command]
pub fn open_logs_dir(app: AppHandle) -> Result<String, String> {
    let path = log_dir(&app)?;
    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Could not create log directory: {}", e))?;
    }

    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(&path_str);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| format!("Could not open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Could not open Finder: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Could not run xdg-open: {}", e))?;
    }

    Ok(path_str)
}
