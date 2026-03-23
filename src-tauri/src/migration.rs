use std::path::{Path, PathBuf};

/// Migrate database and uploads from the legacy Electron app to the Tauri data directory.
pub fn migrate_from_electron(tauri_data_dir: &Path) {
    let tauri_db = tauri_data_dir.join("data.db");

    // Skip if Tauri DB already has real data
    if tauri_db.exists() {
        if let Ok(conn) = rusqlite::Connection::open(&tauri_db) {
            let has_data: bool = conn
                .prepare("SELECT COUNT(*) FROM projects")
                .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
                .unwrap_or(0)
                > 0;
            if has_data {
                return;
            }
        }
    }

    let electron_config_dir = resolve_electron_config_dir();

    let search_paths: Vec<PathBuf> = [
        electron_config_dir.as_ref().and_then(|dir| {
            let config_path = dir.join("config.json");
            if config_path.exists() {
                let content = std::fs::read_to_string(&config_path).ok()?;
                let config: serde_json::Value = serde_json::from_str(&content).ok()?;
                config
                    .get("dataDir")
                    .and_then(|v| v.as_str())
                    .map(|s| PathBuf::from(s.replace("\\\\", "\\")))
            } else {
                None
            }
        }),
        electron_config_dir.as_ref().map(|dir| dir.join("data")),
        electron_config_dir,
    ]
    .into_iter()
    .flatten()
    .collect();

    for search_dir in &search_paths {
        let candidate = search_dir.join("data.db");
        if candidate.exists() {
            std::fs::create_dir_all(tauri_data_dir).ok();
            if std::fs::copy(&candidate, &tauri_db).is_ok() {
                let old_uploads = search_dir.join("..").join("uploads");
                let new_uploads = tauri_data_dir.join("..").join("uploads");
                if old_uploads.exists() && !new_uploads.exists() {
                    copy_dir_recursive(&old_uploads, &new_uploads).ok();
                }
                return;
            }
        }
        let legacy = search_dir.join("tasks.db");
        if legacy.exists() {
            std::fs::create_dir_all(tauri_data_dir).ok();
            if std::fs::copy(&legacy, &tauri_db).is_ok() {
                return;
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn resolve_electron_config_dir() -> Option<PathBuf> {
    std::env::var("APPDATA")
        .ok()
        .map(|p| PathBuf::from(p).join("claude-board"))
}

#[cfg(target_os = "macos")]
fn resolve_electron_config_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|h| PathBuf::from(h).join("Library/Application Support/claude-board"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn resolve_electron_config_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|h| PathBuf::from(h).join("claude-board"))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let dest_path = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), &dest_path)?;
        }
    }
    Ok(())
}
