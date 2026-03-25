use tauri::{AppHandle, Emitter};
use crate::db::{self, DbPool, tasks, projects, activity, dependencies};
use crate::claude::runner;

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
                            runner::start_test(&task, app_test.clone(), &project.working_dir, &project, 4000);
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

    // 4. Start periodic queue poll (every 15 seconds)
    let app_handle = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));
            let db = db::get_db();
            let pids = tasks::get_auto_queue_project_ids(&db);
            for pid in pids {
                start_next_queued(&db, &app_handle, pid);
            }
        }
    });
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

    let max_conc = project.max_concurrent.unwrap_or(1) as usize;
    // Count only ACTUALLY running tasks (process alive), not just DB status
    let all_tasks = tasks::get_by_project(db, project_id);
    let running = all_tasks.iter()
        .filter(|t| t.status.as_deref() == Some("in_progress") && runner::is_running(t.id))
        .count();
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

/// Called when a task completes — cascades to start newly unblocked dependents
/// and checks if parent task's sub-tasks are all done.
pub fn on_task_completed(db: &DbPool, app: &AppHandle, project_id: i64, task_id: i64) {
    // Check if this task is a sub-task — if so, check if parent can complete
    if let Some(task) = tasks::get_by_id(db, task_id) {
        if let Some(parent_id) = task.parent_task_id {
            if tasks::are_all_subtasks_done(db, parent_id) {
                // All sub-tasks done — complete the parent
                if let Some(parent) = tasks::get_by_id(db, parent_id) {
                    if parent.awaiting_subtasks.unwrap_or(0) == 1 {
                        tasks::set_awaiting_subtasks(db, parent_id, false);
                        tasks::update_status(db, parent_id, "testing");
                        tasks::set_completed(db, parent_id);
                        activity::add(db, project_id, Some(parent_id), "subtasks_completed",
                            &format!("All sub-tasks completed for: {}", parent.title), None);
                        if let Some(updated) = tasks::get_by_id(db, parent_id) {
                            app.emit("task:updated", &updated).ok();
                        }
                        log::info!("Parent task {} completed — all sub-tasks done", parent_id);
                    }
                }
            }
        }
    }
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
    } else {
        // Retries exhausted (or max_retries=0) — task has permanently failed.
        // Mark as backlog with retry_count=1 so on_failure dependencies can detect it.
        if retry_count == 0 {
            tasks::increment_retry(db, task_id);
        }
        tasks::update_status(db, task_id, "backlog");
        activity::add(db, project_id, Some(task_id), "task_failed_permanent",
            &format!("Task permanently failed: {}", task.title), None);
        app.emit("task:updated", &tasks::get_by_id(db, task_id)).ok();
        // Cascade: on_failure dependent tasks are now unblocked
        start_next_queued(db, app, project_id);
    }
}
