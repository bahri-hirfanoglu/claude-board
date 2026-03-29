#![allow(dead_code)]

mod claude;
mod commands;
mod config;
mod db;
mod error;
mod migration;
mod services;
mod setup;

use tauri::{Emitter, Manager};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                w.set_focus().ok();
            }
        }))
        .setup(|app| {
            if let Some(cfg) = config::load(app) {
                migration::migrate_from_electron(std::path::Path::new(&cfg.data_dir));
                db::init_db(&cfg.data_dir);

                // Recover orphaned tasks and start auto-queue
                services::queue::startup_recovery(app.handle());

                let port = cfg.port;
                tauri::async_runtime::spawn(async move {
                    services::http_api::start_server(port).await;
                });

                let main_window = tauri::WebviewWindowBuilder::new(
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

                // ─── System Tray (best-effort, don't crash if it fails) ───
                if let Err(e) = (|| -> Result<(), Box<dyn std::error::Error>> {
                    let show_item = MenuItem::with_id(app, "show", "Claude Board", true, None::<&str>)?;
                    let sep = PredefinedMenuItem::separator(app)?;
                    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                    let tray_menu = Menu::with_items(app, &[&show_item, &sep, &quit_item])?;

                    let mut builder = TrayIconBuilder::new()
                        .tooltip("Claude Board")
                        .menu(&tray_menu)
                        .on_menu_event(|app, event| {
                            match event.id().as_ref() {
                                "show" => {
                                    if let Some(w) = app.get_webview_window("main") {
                                        w.show().ok();
                                        w.unminimize().ok();
                                        w.set_focus().ok();
                                    }
                                }
                                "quit" => { app.exit(0); }
                                _ => {}
                            }
                        })
                        .on_tray_icon_event(|tray, event| {
                            if let TrayIconEvent::Click {
                                button: MouseButton::Left,
                                button_state: MouseButtonState::Up, ..
                            } = event {
                                let app = tray.app_handle();
                                if let Some(w) = app.get_webview_window("main") {
                                    w.show().ok();
                                    w.unminimize().ok();
                                    w.set_focus().ok();
                                }
                            }
                        });

                    if let Some(icon) = app.default_window_icon() {
                        builder = builder.icon(icon.clone());
                    }

                    builder.build(app)?;
                    Ok(())
                })() {
                    log::warn!("System tray init failed: {}", e);
                }

                // ─── Minimize to Tray: intercept window close ───
                let close_handle = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let pool = db::get_db();
                        let s = db::settings::get(&pool);
                        if s.minimize_to_tray {
                            api.prevent_close();
                            if let Some(w) = close_handle.get_webview_window("main") {
                                w.hide().ok();
                            }
                        }
                    }
                });

                // Check for updates in background
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    let updater = match app_handle.updater() {
                        Ok(u) => u,
                        Err(e) => { log::warn!("Updater init failed: {}", e); return; }
                    };
                    match updater.check().await {
                        Ok(Some(update)) => {
                            let version = update.version.clone();
                            log::info!("Update available: {}", version);
                            app_handle.emit("update:available", &serde_json::json!({
                                "version": version, "status": "downloading",
                            })).ok();
                            // Download and install
                            match update.download_and_install(|_, _| {}, || {}).await {
                                Ok(_) => {
                                    log::info!("Update installed, restart required");
                                    app_handle.emit("update:ready", &serde_json::json!({
                                        "version": version,
                                    })).ok();
                                }
                                Err(e) => {
                                    log::warn!("Update install failed: {}", e);
                                    app_handle.emit("update:available", &serde_json::json!({
                                        "version": version, "status": "available",
                                    })).ok();
                                }
                            }
                        }
                        Ok(None) => log::info!("App is up to date"),
                        Err(e) => log::warn!("Update check failed: {}", e),
                    }
                });
            } else {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "setup",
                    tauri::WebviewUrl::App("setup.html".into()),
                )
                .title("Claude Board Setup")
                .inner_size(620.0, 720.0)
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
            setup::check_system,
            setup::check_directory,
            setup::finish,
            setup::quit,
            // Projects
            commands::projects::get_projects,
            commands::projects::get_projects_summary,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::get_project_groups,
            commands::projects::reset_circuit_breaker,
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
            commands::tasks::reorder_queue,
            commands::tasks::set_task_dependency,
            commands::tasks::add_task_dependency,
            commands::tasks::remove_task_dependency,
            commands::tasks::get_task_dependencies,
            commands::tasks::get_task_events,
            commands::tasks::get_execution_waves,
            commands::tasks::get_dependency_graph,
            commands::tasks::get_pipeline_status,
            commands::tasks::get_task_diff,
            commands::tasks::get_active_file_map,
            commands::tasks::get_agent_activity,
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
            // Claude Manager
            commands::claude_manager::get_auth_info,
            commands::claude_manager::list_mcp_servers,
            commands::claude_manager::add_mcp_server,
            commands::claude_manager::remove_mcp_server,
            commands::claude_manager::list_plugins,
            commands::claude_manager::install_plugin,
            commands::claude_manager::uninstall_plugin,
            commands::claude_manager::toggle_plugin,
            commands::claude_manager::list_marketplaces,
            commands::claude_manager::add_marketplace,
            commands::claude_manager::remove_marketplace,
            commands::claude_manager::get_claude_settings,
            commands::claude_manager::save_claude_settings,
            commands::claude_manager::list_agents,
            commands::claude_manager::get_claude_version,
            commands::claude_manager::update_claude_cli,
            commands::claude_manager::get_hooks,
            commands::claude_manager::save_hooks,
            commands::claude_manager::list_sessions,
            commands::claude_manager::get_permission_rules,
            commands::claude_manager::prescan_stats,
            commands::claude_manager::scan_codebase,
            commands::claude_manager::save_scan_result,
            commands::claude_manager::get_scan_history,
            commands::claude_manager::get_scan_detail,
            commands::claude_manager::delete_scan,
            commands::claude_manager::get_suggestions,
            // Custom Commands & Skills
            commands::claude_manager::list_custom_commands,
            commands::claude_manager::list_custom_skills,
            commands::claude_manager::save_custom_skill,
            commands::claude_manager::delete_custom_skill,
            commands::claude_manager::fetch_github_skills,
            commands::claude_manager::fetch_skill_content,
            // Settings
            commands::settings::get_app_settings,
            commands::settings::update_app_settings,
            // GitHub
            commands::github::github_detect_repo,
            commands::github::github_check_status,
            commands::github::github_fetch_issues,
            commands::github::github_import_issues,
            commands::github::github_close_issue,
            // Workflows
            commands::workflows::get_workflow_templates,
            commands::workflows::create_workflow_template,
            commands::workflows::update_workflow_template,
            commands::workflows::delete_workflow_template,
            commands::workflows::apply_workflow_template,
            commands::chat::chat_send,
            // Roadmap (GSD)
            commands::roadmap::get_milestones,
            commands::roadmap::create_milestone,
            commands::roadmap::update_milestone,
            commands::roadmap::delete_milestone,
            commands::roadmap::get_phases,
            commands::roadmap::create_phase,
            commands::roadmap::update_phase,
            commands::roadmap::delete_phase,
            commands::roadmap::reorder_phases,
            commands::roadmap::insert_phase,
            commands::roadmap::get_plans,
            commands::roadmap::create_plan,
            commands::roadmap::update_plan,
            commands::roadmap::delete_plan,
            commands::roadmap::link_task_to_plan,
            commands::roadmap::unlink_task_from_plan,
            commands::roadmap::get_plan_tasks,
            commands::roadmap::get_roadmap,
            commands::roadmap::get_phase_progress,
            commands::roadmap::update_success_criterion,
            commands::roadmap::plan_phase,
            commands::roadmap::approve_phase_plan,
            commands::roadmap::execute_phase,
            // GSD Package Integration
            commands::gsd::gsd_check_status,
            commands::gsd::gsd_install,
            commands::gsd::gsd_get_roadmap,
            commands::gsd::gsd_get_state,
            commands::gsd::gsd_get_project,
            commands::gsd::gsd_get_phase_details,
            commands::gsd::gsd_get_config,
            commands::gsd::gsd_parse_phase_plans,
            commands::gsd::gsd_create_tasks_from_plans,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                services::queue::request_shutdown();
            }
        });
}
