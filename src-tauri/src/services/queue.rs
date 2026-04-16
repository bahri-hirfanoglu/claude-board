use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use crate::db::{self, DbPool, tasks, projects, activity, dependencies};
use crate::claude::runner;
use crate::claude::state_machine::{TaskStatus, EngineConfig};
use crate::config;

/// Shared shutdown flag — set to true when app is exiting.
static SHUTDOWN: once_cell::sync::Lazy<Arc<AtomicBool>> =
    once_cell::sync::Lazy::new(|| Arc::new(AtomicBool::new(false)));

/// Signal all background queue threads to stop.
pub fn request_shutdown() {
    SHUTDOWN.store(true, Ordering::SeqCst);
    runner::cleanup_all();
    log::info!("Queue shutdown requested — background threads will exit");
}

/// Recover orphaned tasks and kick-start auto-queue on app startup.
/// Must be called once after db::init_db() in the setup hook.
pub fn startup_recovery(app: &AppHandle) {
    let db = db::get_db();

    // 1. Recover orphaned tasks
    let (recovered, testing_ids) = tasks::recover_orphaned_tasks(&db);
    if recovered > 0 {
        log::info!("Recovered {} orphaned in_progress task(s) back to backlog", recovered);
        app.emit("task:updated", &serde_json::json!({"recovered": recovered})).ok();
    }

    // 2. Re-trigger auto-test for tasks that were mid-testing when app crashed
    if !testing_ids.is_empty() {
        log::info!("Found {} task(s) in testing state, re-triggering auto-test", testing_ids.len());
        let app_test = app.clone();
        std::thread::spawn(move || {
            // Small delay to let the app fully initialize
            std::thread::sleep(std::time::Duration::from_secs(3));
            let db = db::get_db();
            for task_id in testing_ids {
                if let Some(task) = tasks::get_by_id(&db, task_id) {
                    if let Some(project) = projects::get_by_id(&db, task.project_id) {
                        if project.auto_test.unwrap_or(0) == 1 {
                            log::info!("Re-starting auto-test for task {} ({})", task_id, task.title);
                            tasks::add_log(&db, task_id, "Auto-test: Resuming after app restart...", "system", None);
                            let mcp_port = config::load_from_handle(&app_test).port;
                            runner::start_test(&task, app_test.clone(), &project.working_dir, &project, mcp_port);
                        }
                    }
                }
            }
        });
    }

    // 3. Kick-start auto-queue for all projects that have it enabled
    let project_ids = tasks::get_auto_queue_project_ids(&db);
    for pid in &project_ids {
        start_next_queued(&db, app, *pid);
    }

    // 4. Start periodic queue poll (every 15 seconds, shutdown-aware)
    let app_handle = app.clone();
    let shutdown = SHUTDOWN.clone();
    std::thread::Builder::new()
        .name("queue-poll".into())
        .spawn(move || {
            log::info!("Queue poll thread started");
            while !shutdown.load(Ordering::SeqCst) {
                // Sleep in small increments to respond to shutdown quickly
                for _ in 0..15 {
                    if shutdown.load(Ordering::SeqCst) { return; }
                    std::thread::sleep(std::time::Duration::from_secs(1));
                }
                let db = db::get_db();
                // Enforce task timeouts before starting new tasks
                runner::enforce_timeouts(&app_handle);
                let pids = tasks::get_auto_queue_project_ids(&db);
                for pid in pids {
                    if shutdown.load(Ordering::SeqCst) { return; }
                    start_next_queued(&db, &app_handle, pid);
                }
            }
            log::info!("Queue poll thread stopped");
        })
        .ok();
}

/// Try to start the next queued task(s) respecting concurrency and DAG dependencies.
pub fn start_next_queued(db: &DbPool, app: &AppHandle, project_id: i64) {
    let project = match projects::get_by_id(db, project_id) {
        Some(p) => p,
        None => return,
    };
    if project.auto_queue.unwrap_or(0) == 0 {
        return;
    }
    // Circuit breaker: block queue if active
    if project.circuit_breaker_active.unwrap_or(0) == 1 {
        return;
    }

    let max_conc = project.max_concurrent.unwrap_or(1) as usize;
    // Count only ACTUALLY running tasks (process alive), not just DB status
    let all_tasks = tasks::get_by_project(db, project_id);
    let running = all_tasks.iter()
        .filter(|t| t.status.as_deref() == Some(TaskStatus::InProgress.as_str()) && (runner::is_running(t.id) || runner::is_starting(t.id)))
        .count();
    let slots = max_conc.saturating_sub(running);
    if slots == 0 {
        return;
    }

    // Get backlog tasks with ALL dependencies met (DAG-aware)
    let ready = dependencies::get_ready_tasks(db, project_id);

    let mut started = 0;
    let mcp_port = config::load_from_handle(app).port;

    for task in &ready {
        if started >= slots {
            break;
        }
        if runner::is_running(task.id) || runner::is_starting(task.id) {
            continue;
        }

        tasks::update_status(db, task.id, TaskStatus::InProgress.as_str());
        if task.started_at.is_none() {
            tasks::set_started(db, task.id);
        } else {
            tasks::set_resumed(db, task.id);
        }
        crate::services::gsd::apply_task_status_cascade(db, Some(app), task.id);

        let updated = match tasks::get_by_id(db, task.id) {
            Some(t) => t,
            None => { log::error!("start_next_queued: task {} not found after status update", task.id); continue; }
        };
        runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
        activity::add(db, project_id, Some(task.id), "queue_auto_started",
            &format!("Auto-started: {}", task.title), None);
        crate::services::notification::notify_queue_started(app, &crate::services::notification::TaskNotification::new(&task.title, task.task_key.as_deref()));
        crate::services::webhook::fire(project_id, "queue_auto_started", &format!("Auto-started: {}", task.title),
            serde_json::json!({"taskId": task.id, "taskKey": task.task_key, "title": task.title}));

        if let Ok(mut val) = serde_json::to_value(&updated) {
            if let Some(obj) = val.as_object_mut() {
                obj.insert("is_running".into(), serde_json::Value::Bool(true));
            }
            app.emit("task:updated", &val).ok();
        }
        started += 1;
    }
}

/// Called when a task completes — cascades to start newly unblocked dependents
/// and checks if parent task's sub-tasks are all done.
pub fn on_task_completed(db: &DbPool, app: &AppHandle, project_id: i64, task_id: i64) {
    // Check if this task is a sub-task — if so, atomically check if parent can complete
    if let Some(task) = tasks::get_by_id(db, task_id) {
        if let Some(parent_id) = task.parent_task_id {
            // Use transaction to prevent double parent completion from concurrent subtask completions
            let result = db::with_transaction(db, |conn| {
                let total: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM tasks WHERE parent_task_id=?1 AND deleted_at IS NULL", rusqlite::params![parent_id], |r| r.get(0),
                ).unwrap_or(0);
                let done: i64 = conn.query_row(
                    &format!("SELECT COUNT(*) FROM tasks WHERE parent_task_id=?1 AND deleted_at IS NULL AND status IN ('{}','{}')",
                        TaskStatus::Done.as_str(), TaskStatus::Testing.as_str()),
                    rusqlite::params![parent_id], |r| r.get(0),
                ).unwrap_or(0);
                if total == 0 || done < total { return Ok(false); }

                let awaiting: i64 = conn.query_row(
                    "SELECT COALESCE(awaiting_subtasks, 0) FROM tasks WHERE id=?1",
                    rusqlite::params![parent_id], |r| r.get(0),
                ).unwrap_or(0);
                if awaiting != 1 { return Ok(false); }

                // Only auto-complete if parent is still in_progress and awaiting
                conn.execute(
                    &format!("UPDATE tasks SET awaiting_subtasks=0, status='{}', completed_at=datetime('now','localtime'), updated_at=datetime('now','localtime') WHERE id=?1 AND status='{}'",
                        TaskStatus::Testing.as_str(), TaskStatus::InProgress.as_str()),
                    rusqlite::params![parent_id]).map_err(|e| e.to_string())?;
                Ok(true)
            });

            if result.unwrap_or(false) {
                if let Some(parent) = tasks::get_by_id(db, parent_id) {
                    activity::add(db, project_id, Some(parent_id), "subtasks_completed",
                        &format!("All sub-tasks completed for: {}", parent.title), None);
                    app.emit("task:updated", &parent).ok();
                }
                log::info!("Parent task {} completed — all sub-tasks done", parent_id);
            }
        }
    }
    // Reset circuit breaker counter on success
    projects::reset_consecutive_failures(db, project_id);
    start_next_queued(db, app, project_id);
}

/// Handle task failure: retry up to max, then permanently fail.
/// Uses EngineConfig for retry limits and backoff parameters.
pub fn handle_task_failure(db: &DbPool, app: &AppHandle, project_id: i64, task_id: i64) {
    let project = match projects::get_by_id(db, project_id) {
        Some(p) => p,
        None => return,
    };
    let task = match tasks::get_by_id(db, task_id) {
        Some(t) => t,
        None => return,
    };

    let config = EngineConfig::from_project(&project);
    let retry_count = task.retry_count.unwrap_or(0);

    if retry_count < config.max_retries {
        tasks::increment_retry(db, task_id);
        tasks::update_status(db, task_id, TaskStatus::Backlog.as_str());
        crate::services::gsd::apply_task_status_cascade(db, Some(app), task_id);
        let new_count = retry_count + 1;
        let final_delay = config.retry_delay(retry_count);
        tasks::set_retry_after(db, task_id, final_delay);
        let msg = format!("Retry {}/{}: {} (backoff {}s)", new_count, config.max_retries, task.title, final_delay);
        tasks::add_log(db, task_id, &format!("Auto-retry ({}/{}): Waiting {}s before retry...", new_count, config.max_retries, final_delay), "system", None);
        activity::add(db, project_id, Some(task_id), "queue_retry", &msg, None);
        app.emit("task:log", &serde_json::json!({
            "taskId": task_id, "message": format!("Auto-retry ({}/{})", new_count, config.max_retries), "logType": "system"
        })).ok();
        app.emit("task:updated", &tasks::get_by_id(db, task_id)).ok();
        start_next_queued(db, app, project_id);
    } else {
        // Retries exhausted — move to failed status
        tasks::increment_retry(db, task_id);
        tasks::update_status(db, task_id, TaskStatus::Failed.as_str());
        crate::services::gsd::apply_task_status_cascade(db, Some(app), task_id);
        let msg = format!("Permanently failed after {} retries: {}", config.max_retries, task.title);
        tasks::add_log(db, task_id, &format!("All {} retries exhausted. Task will not auto-start. Move manually to retry.", config.max_retries), "error", None);
        activity::add(db, project_id, Some(task_id), "task_failed_permanent", &msg, None);
        app.emit("task:log", &serde_json::json!({
            "taskId": task_id, "message": format!("All {} retries exhausted", config.max_retries), "logType": "error"
        })).ok();
        app.emit("task:updated", &tasks::get_by_id(db, task_id)).ok();

        // Circuit breaker: track consecutive failures
        let threshold = project.circuit_breaker_threshold.unwrap_or(0);
        if threshold > 0 {
            let count = projects::increment_consecutive_failures(db, project_id);
            if count >= threshold {
                projects::activate_circuit_breaker(db, project_id);
                log::warn!("Circuit breaker activated for project {} after {} consecutive failures", project_id, count);
                tasks::add_log(db, task_id, &format!("Circuit breaker activated — {} consecutive failures. Queue paused.", count), "error", None);
                app.emit("project:circuit_breaker", &serde_json::json!({"projectId": project_id, "active": true, "failures": count})).ok();
                crate::services::webhook::fire(project_id, "circuit_breaker_activated", &format!("Circuit breaker: {} failures", count),
                    serde_json::json!({"projectId": project_id, "consecutiveFailures": count}));
            }
        }

        start_next_queued(db, app, project_id);
    }
}
