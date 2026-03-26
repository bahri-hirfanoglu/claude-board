use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

use crate::{config, db, migration, services};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn silent_cmd(program: &str, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output().ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

#[tauri::command]
pub fn get_default_dir(app: tauri::AppHandle) -> String {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./data"))
        .join("data")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub async fn browse_folder(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_title("Select Directory")
        .blocking_pick_folder()
        .map(|p| p.to_string())
}

/// Check system prerequisites: Claude CLI, Git, port availability.
#[tauri::command]
pub fn check_system(port: Option<u16>) -> serde_json::Value {
    let port = port.unwrap_or(4000);

    // Claude CLI
    let claude_version = silent_cmd("claude", &["--version"]);
    let claude_ok = claude_version.is_some();

    // Git
    let git_version = silent_cmd("git", &["--version"]);
    let git_ok = git_version.is_some();

    // Port availability
    let port_ok = std::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .map(|l| { drop(l); true })
        .unwrap_or(false);

    serde_json::json!({
        "claude": claude_ok,
        "claude_version": claude_version.unwrap_or_default(),
        "git": git_ok,
        "git_version": git_version.unwrap_or_default(),
        "port_available": port_ok,
        "port": port,
    })
}

/// Check if a directory path is writable.
#[tauri::command]
pub fn check_directory(path: String) -> serde_json::Value {
    let p = std::path::Path::new(&path);
    // Try to create and remove a temp file
    let writable = if p.exists() {
        let test = p.join(".claude_board_write_test");
        std::fs::write(&test, "test").is_ok() && { std::fs::remove_file(&test).ok(); true }
    } else {
        // Try creating the directory
        std::fs::create_dir_all(p).is_ok()
    };
    let exists = p.exists();
    serde_json::json!({ "exists": exists, "writable": writable, "path": path })
}

#[tauri::command]
pub async fn finish(
    app: tauri::AppHandle,
    data_dir: String,
    port: u16,
    language: Option<String>,
    project_name: Option<String>,
    project_dir: Option<String>,
) {
    let app_clone = app.clone();
    let data_dir_clone = data_dir.clone();
    let lang = language.unwrap_or_else(|| "en".into());

    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&data_dir_clone).ok();
        let cfg = config::AppConfig {
            data_dir: data_dir_clone.clone(),
            port,
            language: lang.clone(),
        };
        config::save(&app_clone, &cfg);
        migration::migrate_from_electron(std::path::Path::new(&data_dir_clone));
        db::init_db(&data_dir_clone);

        // Save language to app_settings
        let pool = db::get_db();
        let mut settings = db::settings::get(&pool);
        settings.language = lang;
        db::settings::update(&pool, &settings);

        // Create first project if provided
        if let (Some(name), Some(dir)) = (project_name, project_dir) {
            if !name.trim().is_empty() && !dir.trim().is_empty() {
                let slug = name.trim().to_lowercase()
                    .chars().filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
                    .collect::<String>()
                    .trim().replace(' ', "-");
                let slug = if slug.is_empty() { "project".to_string() } else { slug };
                db::projects::create(&pool, name.trim(), &slug, dir.trim(), None, None, None, None);
                log::info!("First project created: {}", name.trim());
            }
        }
    })
    .await
    .ok();

    let mcp_port = port;
    tauri::async_runtime::spawn(async move {
        services::http_api::start_server(mcp_port).await;
    });

    let _main_win = tauri::WebviewWindowBuilder::new(
        &app,
        "main",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Claude Board")
    .inner_size(1400.0, 900.0)
    .min_inner_size(800.0, 600.0)
    .center()
    .disable_drag_drop_handler()
    .build()
    .ok();

    if let Some(setup) = app.get_webview_window("setup") {
        setup.close().ok();
    }
}

#[tauri::command]
pub fn quit(app: tauri::AppHandle) {
    app.exit(0);
}
