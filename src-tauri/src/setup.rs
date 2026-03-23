use std::path::PathBuf;
use tauri::Manager;

use crate::{config, db, migration, services};

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
        .set_title("Select Data Directory")
        .blocking_pick_folder()
        .map(|p| p.to_string())
}

#[tauri::command]
pub async fn finish(app: tauri::AppHandle, data_dir: String, port: u16) {
    let app_clone = app.clone();
    let data_dir_clone = data_dir.clone();

    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&data_dir_clone).ok();
        let cfg = config::AppConfig {
            data_dir: data_dir_clone.clone(),
            port,
        };
        config::save(&app_clone, &cfg);
        migration::migrate_from_electron(std::path::Path::new(&data_dir_clone));
        db::init_db(&data_dir_clone);
    })
    .await
    .ok();

    let mcp_port = port;
    tauri::async_runtime::spawn(async move {
        services::http_api::start_server(mcp_port).await;
    });

    // Create main window FIRST, then close setup
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
