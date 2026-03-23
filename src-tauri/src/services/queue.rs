use tauri::{AppHandle, Emitter};
use crate::db::{DbPool, tasks, projects, snippets, attachments, roles, activity};
use crate::claude::runner;

pub fn start_next_queued(db: &DbPool, app: &AppHandle, project_id: i64) {
    let project = match projects::get_by_id(db, project_id) {
        Some(p) => p,
        None => return,
    };
    if project.auto_queue.unwrap_or(0) == 0 { return; }

    let running = tasks::get_running_count(db, project_id);
    let max_conc = project.max_concurrent.unwrap_or(1);
    if running >= max_conc { return; }

    let next = match tasks::get_next_queued(db, project_id) {
        Some(t) => t,
        None => return,
    };

    if runner::is_running(next.id) { return; }

    tasks::update_status(db, next.id, "in_progress");
    if next.started_at.is_none() { tasks::set_started(db, next.id); }

    let updated = tasks::get_by_id(db, next.id).unwrap();
    // MCP port - use default for auto-queue
    let mcp_port = std::env::var("CLAUDE_BOARD_MCP_PORT").ok()
        .and_then(|p| p.parse().ok()).unwrap_or(4000u16);
    runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);

    activity::add(db, project_id, Some(next.id), "queue_auto_started",
        &format!("Auto-started: {}", next.title), None);

    let mut task_with_running = updated;
    task_with_running.is_running = true;
    app.emit("task:updated", &task_with_running).ok();
}
