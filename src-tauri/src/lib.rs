mod claude;
mod commands;
mod config;
mod db;
mod migration;
mod services;
mod setup;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                w.set_focus().ok();
            }
        }))
        .setup(|app| {
            if let Some(cfg) = config::load(app) {
                migration::migrate_from_electron(std::path::Path::new(&cfg.data_dir));
                db::init_db(&cfg.data_dir);

                let port = cfg.port;
                tauri::async_runtime::spawn(async move {
                    services::http_api::start_server(port).await;
                });

                tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("Claude Board")
                .inner_size(1400.0, 900.0)
                .min_inner_size(800.0, 600.0)
                .center()
                .disable_drag_drop_handler()
                .build()?;
            } else {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "setup",
                    tauri::WebviewUrl::App("setup.html".into()),
                )
                .title("Claude Board Setup")
                .inner_size(520.0, 580.0)
                .resizable(false)
                .center()
                .decorations(false)
                .build()?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Setup
            setup::get_default_dir,
            setup::browse_folder,
            setup::finish,
            setup::quit,
            // Projects
            commands::projects::get_projects,
            commands::projects::get_projects_summary,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            // Tasks
            commands::tasks::get_tasks,
            commands::tasks::get_task,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::change_task_status,
            commands::tasks::delete_task,
            commands::tasks::get_task_logs,
            commands::tasks::stop_task,
            commands::tasks::restart_task,
            commands::tasks::request_changes,
            commands::tasks::get_revisions,
            commands::tasks::get_task_detail,
            // Stats
            commands::stats::get_project_stats,
            commands::stats::get_claude_usage,
            commands::stats::get_activity,
            commands::stats::get_claude_md,
            commands::stats::save_claude_md,
            // Snippets
            commands::snippets::get_snippets,
            commands::snippets::create_snippet,
            commands::snippets::update_snippet,
            commands::snippets::delete_snippet,
            // Templates
            commands::templates::get_templates,
            commands::templates::create_template,
            commands::templates::update_template,
            commands::templates::delete_template,
            // Attachments
            commands::attachments::get_attachments,
            commands::attachments::upload_attachment,
            commands::attachments::delete_attachment,
            // Webhooks
            commands::webhooks::get_webhooks,
            commands::webhooks::create_webhook,
            commands::webhooks::update_webhook,
            commands::webhooks::delete_webhook,
            commands::webhooks::test_webhook,
            // Roles
            commands::roles::get_roles,
            commands::roles::get_global_roles,
            commands::roles::create_role,
            commands::roles::update_role,
            commands::roles::delete_role,
            // Auth
            commands::auth::get_auth_status,
            commands::auth::enable_auth,
            commands::auth::disable_auth,
            // Planning
            commands::planning::start_planning,
            commands::planning::approve_plan,
            commands::planning::cancel_planning,
            commands::planning::get_planning_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
