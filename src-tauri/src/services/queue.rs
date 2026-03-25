use tauri::{AppHandle, Emitter};
use crate::db::{DbPool, tasks, projects, activity, dependencies};
use crate::claude::runner;

/// Try to start the next queued task(s) respecting concurrency and DAG dependencies.
pub fn start_next_queued(db: &DbPool, app: &AppHandle, project_id: i64) {
    let project = match projects::get_by_id(db, project_id) {
        Some(p) => p,
        None => return,
    };
    if project.auto_queue.unwrap_or(0) == 0 {
        return;
    }

    let max_conc = project.max_concurrent.unwrap_or(1) as usize;
    let running = tasks::get_running_count(db, project_id) as usize;
    let slots = max_conc.saturating_sub(running);
    if slots == 0 {
        return;
    }

    // Get backlog tasks with ALL dependencies met (DAG-aware)
    let ready = dependencies::get_ready_tasks(db, project_id);

    let mut started = 0;
    let mcp_port: u16 = 4000;

    for task in &ready {
        if started >= slots {
            break;
        }
        if runner::is_running(task.id) {
            continue;
        }

        tasks::update_status(db, task.id, "in_progress");
        if task.started_at.is_none() {
            tasks::set_started(db, task.id);
        } else {
            tasks::set_resumed(db, task.id);
        }

        let updated = tasks::get_by_id(db, task.id).unwrap();
        runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
        activity::add(db, project_id, Some(task.id), "queue_auto_started",
            &format!("Auto-started: {}", task.title), None);
        crate::services::notification::notify_queue_started(app, &crate::services::notification::TaskNotification::new(&task.title, task.task_key.as_deref()));

        let mut val = serde_json::to_value(&updated).unwrap();
        val.as_object_mut().unwrap().insert("is_running".into(), serde_json::Value::Bool(true));
        app.emit("task:updated", &val).ok();
        started += 1;
    }
}

/// Called when a task completes — cascades to start newly unblocked dependents.
pub fn on_task_completed(db: &DbPool, app: &AppHandle, project_id: i64, _task_id: i64) {
    start_next_queued(db, app, project_id);
}

/// Handle task failure: retry if configured, otherwise leave as failed.
pub fn handle_task_failure(db: &DbPool, app: &AppHandle, project_id: i64, task_id: i64) {
    let project = match projects::get_by_id(db, project_id) {
        Some(p) => p,
        None => return,
    };
    let task = match tasks::get_by_id(db, task_id) {
        Some(t) => t,
        None => return,
    };

    let max_retries = project.max_retries.unwrap_or(0);
    let retry_count = task.retry_count.unwrap_or(0);

    if max_retries > 0 && retry_count < max_retries {
        tasks::increment_retry(db, task_id);
        tasks::update_status(db, task_id, "backlog");
        activity::add(db, project_id, Some(task_id), "queue_retry",
            &format!("Retry {}/{}: {}", retry_count + 1, max_retries, task.title), None);
        app.emit("task:updated", &tasks::get_by_id(db, task_id)).ok();
        start_next_queued(db, app, project_id);
    }
}
