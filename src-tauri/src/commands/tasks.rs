use tauri::{AppHandle, Emitter};
use crate::db::{self, tasks as tq, projects as pq, attachments, activity};
use crate::claude::runner;
use crate::claude::state_machine::{TaskStatus, is_valid_transition};
use crate::services::queue;

#[tauri::command]
pub fn get_tasks(project_id: i64) -> Vec<tq::Task> {
    let db = db::get_db();
    tq::get_by_project(&db, project_id)
        .into_iter()
        .map(|mut t| { t.is_running = runner::is_running(t.id) || runner::is_starting(t.id); t })
        .collect()
}

#[tauri::command]
pub fn get_task(id: i64) -> Result<tq::Task, String> {
    let db = db::get_db();
    tq::get_by_id(&db, id).map(|mut t| { t.is_running = runner::is_running(t.id) || runner::is_starting(t.id); t })
        .ok_or_else(|| "Task not found".into())
}

#[tauri::command]
#[allow(non_snake_case)]
#[allow(clippy::too_many_arguments)]
pub fn create_task(
    app: AppHandle, project_id: i64,
    title: String, description: Option<String>, priority: Option<i64>,
    task_type: Option<String>, acceptance_criteria: Option<String>,
    model: Option<String>, thinking_effort: Option<String>, role_id: Option<i64>,
    parentTaskId: Option<i64>, tags: Option<String>,
) -> Result<tq::Task, String> {
    let db = db::get_db();
    if pq::get_by_id(&db, project_id).is_none() { return Err("Project not found".into()); }
    if title.trim().is_empty() { return Err("Title is required".into()); }

    let id = tq::create(&db, project_id, title.trim(),
        description.as_deref().unwrap_or("").trim(),
        priority.unwrap_or(0),
        task_type.as_deref().unwrap_or("feature"),
        acceptance_criteria.as_deref().unwrap_or("").trim(),
        model.as_deref().unwrap_or("sonnet"),
        thinking_effort.as_deref().unwrap_or("medium"),
        role_id,
        tags.as_deref(),
    );

    // Link as sub-task if parent_task_id provided
    if let Some(parent_id) = parentTaskId {
        if tq::get_by_id(&db, parent_id).is_some() {
            tq::set_parent_task_id(&db, id, parent_id);
            tq::set_awaiting_subtasks(&db, parent_id, true);
            activity::add(&db, project_id, Some(id), "subtask_created",
                &format!("Sub-task created under #{}: {}", parent_id, title.trim()), None);
        }
    }

    let task = tq::get_by_id(&db, id).ok_or("Failed to retrieve created task")?;
    app.emit("task:created", &task).ok();
    activity::add(&db, project_id, Some(task.id), "task_created", &format!("Task created: {}", title.trim()), None);
    queue::start_next_queued(&db, &app, project_id);
    Ok(task)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_task(
    app: AppHandle, id: i64,
    title: Option<String>, description: Option<String>, priority: Option<i64>,
    task_type: Option<String>, acceptance_criteria: Option<String>,
    model: Option<String>, thinking_effort: Option<String>, role_id: Option<i64>,
    tags: Option<String>,
) -> Result<tq::Task, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    tq::update(&db, id,
        title.as_deref().unwrap_or(&task.title),
        description.as_deref().unwrap_or(task.description.as_deref().unwrap_or("")),
        priority.unwrap_or(task.priority.unwrap_or(0)),
        task_type.as_deref().unwrap_or(task.task_type.as_deref().unwrap_or("feature")),
        acceptance_criteria.as_deref().unwrap_or(task.acceptance_criteria.as_deref().unwrap_or("")),
        model.as_deref().unwrap_or(task.model.as_deref().unwrap_or("sonnet")),
        thinking_effort.as_deref().unwrap_or(task.thinking_effort.as_deref().unwrap_or("medium")),
        if role_id.is_some() { role_id } else { task.role_id },
        tags.as_deref().or(task.tags.as_deref()),
    );
    let mut updated = tq::get_by_id(&db, id).ok_or("Failed to retrieve updated task")?;
    updated.is_running = runner::is_running(id);
    app.emit("task:updated", &updated).ok();
    Ok(updated)
}

#[tauri::command]
pub fn change_task_status(app: AppHandle, id: i64, status: String, mcp_port: u16) -> Result<tq::Task, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;

    // ── Parse & validate via state machine ──
    let to = TaskStatus::from_str(&status).ok_or("Invalid status")?;
    let from = TaskStatus::from_str(task.status.as_deref().unwrap_or("backlog"))
        .unwrap_or(TaskStatus::Backlog);

    if from != to && !is_valid_transition(from, to) {
        return Err(format!("Invalid transition: {} -> {}", from, to));
    }

    // ── Apply status in DB ──
    tq::update_status(&db, id, to.as_str());

    // ── Side effects by target status ──

    // Reset retry state when leaving failed
    if from == TaskStatus::Failed && (to == TaskStatus::Backlog || to == TaskStatus::InProgress) {
        tq::reset_retry_count(&db, id);
    }

    if to == TaskStatus::InProgress {
        // Timer management
        if task.started_at.is_none() { tq::set_started(&db, id); }
        else { tq::set_resumed(&db, id); }
        // Reset retry count when manually starting
        if task.retry_count.unwrap_or(0) > 0 {
            tq::reset_retry_count(&db, id);
        }
    }

    if to == TaskStatus::Testing && from == TaskStatus::InProgress {
        tq::pause_timer(&db, id);
    }

    if to == TaskStatus::Done {
        if task.completed_at.is_none() {
            tq::finalize_timer(&db, id);
        }
        activity::add(&db, task.project_id, Some(id), "task_approved", &format!("Task approved: {}", task.title), None);
        execute_done_side_effects(&db, &app, id, &task);
    }

    if to == TaskStatus::Backlog {
        tq::reset_retry_count(&db, id);
    }

    // ── Runner lifecycle ──
    let updated = tq::get_by_id(&db, id).ok_or("Task not found after status update")?;

    if to == TaskStatus::InProgress && from != TaskStatus::InProgress {
        let project = pq::get_by_id(&db, task.project_id).ok_or("Project not found")?;
        if !runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port) {
            log::error!("Failed to start runner for task {}, reverting status to {}", id, from);
            tq::update_status(&db, id, from.as_str());
        } else {
            activity::add(&db, task.project_id, Some(id), "task_started", &format!("Task started: {}", task.title), None);
        }
    }

    // Stop runner when leaving active state
    if to != TaskStatus::InProgress && runner::is_running(id) {
        runner::stop(id, &db, &app);
    }

    // Cascade queue when freeing a slot
    if from == TaskStatus::InProgress && (to == TaskStatus::Done || to == TaskStatus::Testing) {
        queue::start_next_queued(&db, &app, task.project_id);
    }

    // Cascade when approving: AwaitingApproval -> Done unblocks dependents
    if from == TaskStatus::AwaitingApproval && to == TaskStatus::Done {
        queue::on_task_completed(&db, &app, task.project_id, id);
    }

    let mut final_task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    final_task.is_running = runner::is_running(id) || runner::is_starting(id);
    app.emit("task:updated", &final_task).ok();

    // Propagate status change to both DB roadmap (plan/phase) and file-based
    // GSD roadmap (.planning/ROADMAP.md). Single choke-point so every mutation
    // path keeps the two in sync.
    crate::services::gsd::apply_task_status_cascade(&db, Some(&app), id);

    Ok(final_task)
}

/// Side effects when a task transitions to Done (manual approval).
fn execute_done_side_effects(db: &crate::db::DbPool, app: &AppHandle, id: i64, task: &tq::Task) {
    if let Some(project) = pq::get_by_id(db, task.project_id) {
        let fresh_task = tq::get_by_id(db, id).unwrap_or(task.clone());
        // Use worktree dir for PR creation (where commits live), fall back to project dir
        let pr_dir = runner::get_task_worktree(id).unwrap_or_else(|| project.working_dir.clone());
        runner::auto_create_pr_public(&fresh_task, &pr_dir, &project, db, app);
        let after_pr = tq::get_by_id(db, id).unwrap_or(fresh_task.clone());
        // Cleanup uses project root (manages worktrees and branches)
        runner::cleanup_task_branch(&after_pr, &project.working_dir, &project);

        // Auto-close linked GitHub issue
        if project.github_sync_enabled.unwrap_or(0) == 1 {
            if let Some(issue_num) = fresh_task.github_issue_number {
                let repo = project.github_repo.as_deref().unwrap_or("");
                if !repo.is_empty() {
                    let pr_url = after_pr.pr_url.as_deref().unwrap_or("");
                    let task_key = fresh_task.task_key.as_deref().unwrap_or("");
                    let comment_body = if !pr_url.is_empty() {
                        format!("Completed via Claude Board task `{}`. PR: {}", task_key, pr_url)
                    } else {
                        format!("Completed via Claude Board task `{}`.", task_key)
                    };
                    let repo_owned = repo.to_string();
                    std::thread::spawn(move || {
                        if let Ok(token) = crate::commands::github::get_gh_token_pub() {
                            let _ = crate::services::github_sync::close_and_comment(&token, &repo_owned, issue_num, &comment_body);
                        }
                    });
                }
            }
        }
    }
}

#[tauri::command]
pub fn delete_task(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    if runner::is_running(id) || runner::is_starting(id) {
        runner::stop(id, &db, &app);
    }
    // Notify children that their parent is being removed
    let children = db::dependencies::get_child_ids(&db, id);
    db::dependencies::remove_all_for_task(&db, id).map_err(|e| e.to_string())?;
    tq::delete(&db, id);
    app.emit("task:deleted", &serde_json::json!({"id": task.id})).ok();
    // Emit updates for children so they refresh dependency state
    for child_id in children {
        if let Some(child) = tq::get_by_id(&db, child_id) {
            app.emit("task:updated", &child).ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_task_logs(id: i64, limit: Option<i64>) -> Vec<tq::TaskLog> {
    let db = db::get_db();
    let mut logs = tq::get_recent_logs(&db, id, limit.unwrap_or(500));
    logs.reverse();
    logs
}

#[tauri::command]
pub fn stop_task(app: AppHandle, id: i64) {
    let db = db::get_db();
    runner::stop(id, &db, &app);
}

#[tauri::command]
pub fn restart_task(app: AppHandle, id: i64, mcp_port: u16) -> Result<tq::Task, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    runner::stop(id, &db, &app);
    tq::clear_logs(&db, id);
    tq::update_status(&db, id, "in_progress");
    let updated = tq::get_by_id(&db, id).ok_or("Task not found after restart")?;
    let project = pq::get_by_id(&db, task.project_id).ok_or("Project not found")?;
    runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
    if let Ok(mut val) = serde_json::to_value(&updated) {
        if let Some(obj) = val.as_object_mut() {
            obj.insert("is_running".into(), serde_json::Value::Bool(true));
        }
        app.emit("task:updated", &val).ok();
    }
    Ok(updated)
}

#[tauri::command]
pub fn request_changes(app: AppHandle, id: i64, feedback: String, mcp_port: u16) -> Result<tq::Task, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    let current = TaskStatus::from_str(task.status.as_deref().unwrap_or("backlog"))
        .unwrap_or(TaskStatus::Backlog);
    if current != TaskStatus::Testing && current != TaskStatus::Done {
        return Err(format!("Cannot request changes on task in '{}' status", current));
    }
    if feedback.trim().is_empty() { return Err("Feedback is required".into()); }
    // Stop any running process (auto-test) before restarting with revision
    if runner::is_running(id) {
        runner::stop(id, &db, &app);
    }

    tq::increment_revision_count(&db, id);
    let rev_num = tq::get_by_id(&db, id).map(|t| t.revision_count.unwrap_or(1)).unwrap_or(1);
    tq::add_revision(&db, id, rev_num, feedback.trim());
    tq::update_status(&db, id, "in_progress");
    let updated = tq::get_by_id(&db, id).ok_or("Task not found")?;
    let project = pq::get_by_id(&db, task.project_id).ok_or("Project not found")?;
    runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
    activity::add(&db, task.project_id, Some(id), "revision_requested",
        &format!("Revision #{}: {}", rev_num, task.title),
        Some(&serde_json::json!({"feedback": feedback.trim()}).to_string()));
    crate::services::notification::notify_revision_requested(&app, &crate::services::notification::TaskNotification::new(&task.title, task.task_key.as_deref()));
    crate::services::webhook::fire(task.project_id, "revision_requested", &format!("Revision #{}: {}", rev_num, task.title),
        serde_json::json!({"taskId": id, "taskKey": task.task_key, "title": task.title, "revision": rev_num, "feedback": feedback.trim()}));
    let mut final_task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    final_task.is_running = runner::is_running(id) || runner::is_starting(id);
    app.emit("task:updated", &final_task).ok();
    Ok(final_task)
}

#[tauri::command]
pub fn get_revisions(id: i64) -> Vec<tq::TaskRevision> {
    tq::get_revisions(&db::get_db(), id)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_task_events(taskId: i64, limit: Option<i64>) -> Vec<serde_json::Value> {
    let db = db::get_db();
    let conn = db.lock();
    let lim = limit.unwrap_or(500);
    let mut stmt = match conn.prepare(
        "SELECT id, event_type, event_data, timestamp_ms FROM task_events
         WHERE task_id=?1 ORDER BY timestamp_ms ASC LIMIT ?2"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_task_events prepare: {}", e); return vec![]; }
    };
    let result: Vec<serde_json::Value> = match stmt.query_map(rusqlite::params![taskId, lim], |r| {
        let data_str: String = r.get(2)?;
        let data: serde_json::Value = serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?,
            "eventType": r.get::<_, String>(1)?,
            "data": data,
            "timestampMs": r.get::<_, i64>(3)?,
        }))
    }) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_task_events query: {}", e); vec![] }
    };
    result
}

#[tauri::command]
pub fn get_task_detail(id: i64) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    let revisions = tq::get_revisions(&db, id);
    let task_attachments = attachments::get_by_task(&db, id);
    let commits: serde_json::Value = task.commits.as_deref()
        .and_then(|c| serde_json::from_str(c).ok())
        .unwrap_or(serde_json::json!([]));

    let mut val = serde_json::to_value(&task).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.insert("commits".into(), commits);
        obj.insert("revisions".into(), serde_json::to_value(revisions).unwrap_or_default());
        obj.insert("attachments".into(), serde_json::to_value(task_attachments).unwrap_or_default());
        obj.insert("is_running".into(), serde_json::Value::Bool(runner::is_running(id)));
    }
    Ok(val)
}

#[tauri::command]
pub fn reorder_queue(project_id: i64, task_ids: Vec<i64>) -> Vec<tq::Task> {
    let db = db::get_db();
    for (i, id) in task_ids.iter().enumerate() {
        tq::update_queue_position(&db, *id, i as i64);
    }
    tq::get_by_project(&db, project_id)
        .into_iter()
        .map(|mut t| { t.is_running = runner::is_running(t.id); t })
        .collect()
}

#[tauri::command]
pub fn reorder_tasks(task_ids: Vec<i64>) {
    let db = db::get_db();
    for (i, id) in task_ids.iter().enumerate() {
        tq::update_sort_order(&db, *id, i as i64);
    }
}

#[tauri::command]
pub fn set_task_dependency(app: AppHandle, id: i64, depends_on: Option<i64>) -> Result<tq::Task, String> {
    let db = db::get_db();
    let _task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    if let Some(dep_id) = depends_on {
        if dep_id == id { return Err("Task cannot depend on itself".into()); }
        if tq::get_by_id(&db, dep_id).is_none() { return Err("Dependency task not found".into()); }
    }
    tq::update_depends_on(&db, id, depends_on);
    let updated = tq::get_by_id(&db, id).ok_or("Task not found")?;
    app.emit("task:updated", &updated).ok();
    Ok(updated)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn add_task_dependency(app: AppHandle, taskId: i64, dependsOnId: i64, conditionType: Option<String>) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    tq::get_by_id(&db, taskId).ok_or("Task not found")?;
    tq::get_by_id(&db, dependsOnId).ok_or("Parent task not found")?;
    db::dependencies::add_dependency(&db, taskId, dependsOnId, conditionType.as_deref()).map_err(|e| e.to_string())?;
    let updated = tq::get_by_id(&db, taskId).ok_or("Task not found")?;
    app.emit("task:updated", &updated).ok();
    Ok(serde_json::json!({
        "task": updated,
        "parents": db::dependencies::get_parent_ids(&db, taskId),
        "children": db::dependencies::get_child_ids(&db, taskId),
    }))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn remove_task_dependency(app: AppHandle, taskId: i64, dependsOnId: i64) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    db::dependencies::remove_dependency(&db, taskId, dependsOnId).map_err(|e| e.to_string())?;
    let updated = tq::get_by_id(&db, taskId).ok_or("Task not found")?;
    app.emit("task:updated", &updated).ok();
    Ok(serde_json::json!({
        "task": updated,
        "parents": db::dependencies::get_parent_ids(&db, taskId),
        "children": db::dependencies::get_child_ids(&db, taskId),
    }))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_task_dependencies(taskId: i64) -> serde_json::Value {
    let db = db::get_db();
    let parents = db::dependencies::get_parent_ids(&db, taskId);
    let children = db::dependencies::get_child_ids(&db, taskId);
    serde_json::json!({ "parents": parents, "children": children })
}

#[tauri::command]
pub fn get_execution_waves(project_id: i64) -> Vec<Vec<tq::Task>> {
    let db = db::get_db();
    db::dependencies::get_execution_waves(&db, project_id)
}

#[tauri::command]
pub fn get_dependency_graph(project_id: i64) -> serde_json::Value {
    let db = db::get_db();
    db::dependencies::get_graph_data(&db, project_id)
}

#[tauri::command]
pub fn get_pipeline_status(project_id: i64) -> serde_json::Value {
    let db = db::get_db();
    let tasks = tq::get_by_project(&db, project_id);
    let running: Vec<_> = tasks.iter().filter(|t| t.status.as_deref() == Some(TaskStatus::InProgress.as_str()) || runner::is_running(t.id)).collect();
    let queued: Vec<_> = tasks.iter().filter(|t| t.status.as_deref() == Some(TaskStatus::Backlog.as_str()))
        .collect();
    let completed: Vec<_> = tasks.iter().filter(|t| matches!(t.status.as_deref(), Some("done") | Some("testing")))
        .collect();
    let total_cost: f64 = tasks.iter().map(|t| t.total_cost.unwrap_or(0.0)).sum();
    let total_tokens: i64 = tasks.iter().map(|t| t.input_tokens.unwrap_or(0) + t.output_tokens.unwrap_or(0)).sum();
    let avg_duration: i64 = {
        let durations: Vec<i64> = completed.iter().filter_map(|t| t.work_duration_ms).filter(|d| *d > 0).collect();
        if durations.is_empty() { 0 } else { durations.iter().sum::<i64>() / durations.len() as i64 }
    };

    let waves = db::dependencies::get_execution_waves(&db, project_id);
    let failed: Vec<_> = tasks.iter().filter(|t| t.status.as_deref() == Some(TaskStatus::Failed.as_str())).collect();
    let awaiting_approval: Vec<_> = tasks.iter().filter(|t| t.status.as_deref() == Some("awaiting_approval")).collect();

    // Circuit breaker status
    let project = pq::get_by_id(&db, project_id);
    let circuit_breaker_active = project.as_ref().map(|p| p.circuit_breaker_active.unwrap_or(0) == 1).unwrap_or(false);
    let circuit_breaker_threshold = project.as_ref().and_then(|p| p.circuit_breaker_threshold).unwrap_or(0);
    let consecutive_failures = project.as_ref().and_then(|p| p.consecutive_failures).unwrap_or(0);

    // Bottlenecks: tasks that block the most other tasks
    let bottlenecks: Vec<serde_json::Value> = {
        let conn = db.lock();
        let mut stmt = match conn.prepare(
            "SELECT t.id, t.title, t.status, COUNT(cd.task_id) as blocker_count
             FROM tasks t
             JOIN task_dependencies cd ON cd.depends_on_id = t.id
             WHERE t.project_id = ?1 AND t.deleted_at IS NULL AND t.status NOT IN ('done')
             GROUP BY t.id
             ORDER BY blocker_count DESC
             LIMIT 5"
        ) {
            Ok(s) => s,
            Err(_) => return serde_json::json!({}),
        };
        let result: Vec<serde_json::Value> = stmt.query_map(rusqlite::params![project_id], |r| {
            Ok(serde_json::json!({
                "taskId": r.get::<_, i64>(0)?,
                "title": r.get::<_, String>(1)?,
                "status": r.get::<_, String>(2)?,
                "blockerCount": r.get::<_, i64>(3)?,
            }))
        }).ok().map(|rows| rows.flatten().collect()).unwrap_or_default();
        result
    };

    // Burn rate: tokens per minute based on running tasks
    let burn_rate: f64 = running.iter().filter_map(|t| {
        let started = t.started_at.as_ref()?;
        let elapsed_sec = chrono::NaiveDateTime::parse_from_str(started, "%Y-%m-%d %H:%M:%S").ok()
            .map(|d| (chrono::Local::now().naive_local() - d).num_seconds())?;
        if elapsed_sec <= 0 { return None; }
        let tokens = (t.input_tokens.unwrap_or(0) + t.output_tokens.unwrap_or(0)) as f64;
        Some(tokens / (elapsed_sec as f64 / 60.0))
    }).sum();

    serde_json::json!({
        "running": running.len(),
        "queued": queued.len(),
        "completed": completed.len(),
        "failed": failed.len(),
        "awaitingApproval": awaiting_approval.len(),
        "total": tasks.len(),
        "totalCost": total_cost,
        "totalTokens": total_tokens,
        "avgDurationMs": avg_duration,
        "waves": waves.len(),
        "circuitBreakerActive": circuit_breaker_active,
        "circuitBreakerThreshold": circuit_breaker_threshold,
        "consecutiveFailures": consecutive_failures,
        "bottlenecks": bottlenecks,
        "burnRate": burn_rate,
        "tasks": {
            "running": running,
            "queued": queued,
        }
    })
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_task_diff(taskId: i64) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, taskId).ok_or("Task not found")?;
    let project = pq::get_by_id(&db, task.project_id).ok_or("Project not found")?;
    let working_dir = &project.working_dir;

    let exec = |args: &[&str]| -> Option<String> {
        let mut cmd = std::process::Command::new("git");
        cmd.args(args).current_dir(working_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null());
        #[cfg(target_os = "windows")]
        { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
        cmd.output().ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };

    // Parse task commits to find the range
    let commits: Vec<serde_json::Value> = task.commits.as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let diff = if commits.len() >= 2 {
        // Multiple commits: diff from parent of first to last
        let first = commits.last().and_then(|c| c.get("short").and_then(|v| v.as_str())).unwrap_or("HEAD~1");
        let last = commits.first().and_then(|c| c.get("short").and_then(|v| v.as_str())).unwrap_or("HEAD");
        exec(&["diff", "--no-color", &format!("{}~1..{}", first, last)])
            .unwrap_or_default()
    } else if commits.len() == 1 {
        let hash = commits[0].get("short").and_then(|v| v.as_str()).unwrap_or("HEAD");
        exec(&["diff", "--no-color", &format!("{}~1..{}", hash, hash)])
            .unwrap_or_default()
    } else {
        // Fallback: last commit
        exec(&["diff", "--no-color", "HEAD~1..HEAD"])
            .unwrap_or_default()
    };

    // Truncate if too large (max ~200KB), safe for UTF-8
    let diff = if diff.len() > 200_000 {
        let mut end = 200_000;
        while end > 0 && !diff.is_char_boundary(end) { end -= 1; }
        format!("{}\n\n--- Diff truncated ({} bytes total) ---", &diff[..end], diff.len())
    } else {
        diff
    };

    Ok(serde_json::json!({ "diff": diff }))
}

// ─── Observability & Collaboration Commands ───

#[tauri::command]
pub fn get_active_file_map() -> serde_json::Value {
    let map = crate::claude::events::get_file_access_map();
    serde_json::to_value(map).unwrap_or(serde_json::json!({}))
}

#[tauri::command]
pub fn get_agent_activity(project_id: i64) -> serde_json::Value {
    let db = db::get_db();
    let tasks = tq::get_by_project(&db, project_id);
    let file_map = crate::claude::events::get_file_access_map();

    let agents: Vec<serde_json::Value> = tasks.iter()
        .filter(|t| t.status.as_deref() == Some(TaskStatus::InProgress.as_str()) || runner::is_running(t.id))
        .map(|t| {
            // Get recent tool calls from logs
            let conn = db.lock();
            let recent_tools: Vec<serde_json::Value> = conn.prepare(
                "SELECT message, meta, created_at FROM task_logs WHERE task_id=?1 AND log_type='tool' ORDER BY id DESC LIMIT 20"
            ).ok().map(|mut stmt| {
                stmt.query_map(rusqlite::params![t.id], |r| {
                    let msg: String = r.get(0)?;
                    let meta: Option<String> = r.get(1)?;
                    let created: Option<String> = r.get(2)?;
                    let meta_val = meta.and_then(|m| serde_json::from_str::<serde_json::Value>(&m).ok());
                    Ok(serde_json::json!({
                        "message": msg,
                        "meta": meta_val,
                        "created_at": created,
                    }))
                }).ok().map(|rows| rows.flatten().collect()).unwrap_or_default()
            }).unwrap_or_default();
            let tool_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM task_logs WHERE task_id=?1 AND log_type='tool'",
                rusqlite::params![t.id], |r| r.get(0),
            ).unwrap_or(0);
            drop(conn);

            // Files this agent is accessing
            let agent_files: Vec<String> = file_map.iter()
                .filter(|(_, task_ids)| task_ids.contains(&t.id))
                .map(|(path, _)| path.clone())
                .collect();

            let elapsed: i64 = t.started_at.as_ref().and_then(|s| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok()
                    .map(|d| (chrono::Local::now().naive_local() - d).num_seconds())
            }).unwrap_or(0);

            serde_json::json!({
                "taskId": t.id,
                "taskKey": t.task_key,
                "title": t.title,
                "model": t.model_used.as_ref().or(t.model.as_ref()),
                "startedAt": t.started_at,
                "elapsedSec": elapsed,
                "inputTokens": t.input_tokens.unwrap_or(0),
                "outputTokens": t.output_tokens.unwrap_or(0),
                "totalCost": t.total_cost.unwrap_or(0.0),
                "toolCallCount": tool_count,
                "recentTools": recent_tools,
                "activeFiles": agent_files,
                "isRunning": runner::is_running(t.id),
                "awaitingSubtasks": t.awaiting_subtasks.unwrap_or(0) == 1,
            })
        })
        .collect();

    // Detect conflicts
    let conflicts: Vec<serde_json::Value> = file_map.iter()
        .filter(|(_, task_ids)| task_ids.len() > 1)
        .map(|(path, task_ids)| serde_json::json!({
            "filePath": path,
            "taskIds": task_ids,
        }))
        .collect();

    serde_json::json!({
        "agents": agents,
        "fileMap": file_map,
        "conflicts": conflicts,
    })
}
