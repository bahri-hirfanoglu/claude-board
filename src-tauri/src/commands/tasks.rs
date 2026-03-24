use tauri::{AppHandle, Emitter};
use crate::db::{self, tasks as tq, projects as pq, attachments, activity};
use crate::claude::runner;
use crate::services::queue;

#[tauri::command]
pub fn get_tasks(project_id: i64) -> Vec<tq::Task> {
    let db = db::get_db();
    tq::get_by_project(&db, project_id)
        .into_iter()
        .map(|mut t| { t.is_running = runner::is_running(t.id); t })
        .collect()
}

#[tauri::command]
pub fn get_task(id: i64) -> Result<tq::Task, String> {
    let db = db::get_db();
    tq::get_by_id(&db, id).map(|mut t| { t.is_running = runner::is_running(t.id); t })
        .ok_or_else(|| "Task not found".into())
}

#[tauri::command]
pub fn create_task(
    app: AppHandle, project_id: i64,
    title: String, description: Option<String>, priority: Option<i64>,
    task_type: Option<String>, acceptance_criteria: Option<String>,
    model: Option<String>, thinking_effort: Option<String>, role_id: Option<i64>,
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
    );
    let task = tq::get_by_id(&db, id).unwrap();
    app.emit("task:created", &task).ok();
    activity::add(&db, project_id, Some(task.id), "task_created", &format!("Task created: {}", title.trim()), None);
    queue::start_next_queued(&db, &app, project_id);
    Ok(task)
}

#[tauri::command]
pub fn update_task(
    app: AppHandle, id: i64,
    title: Option<String>, description: Option<String>, priority: Option<i64>,
    task_type: Option<String>, acceptance_criteria: Option<String>,
    model: Option<String>, thinking_effort: Option<String>, role_id: Option<i64>,
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
    );
    let updated = tq::get_by_id(&db, id).unwrap();
    app.emit("task:updated", &updated).ok();
    Ok(updated)
}

#[tauri::command]
pub fn change_task_status(app: AppHandle, id: i64, status: String, mcp_port: u16) -> Result<tq::Task, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    let valid = ["backlog", "in_progress", "testing", "done"];
    if !valid.contains(&status.as_str()) { return Err("Invalid status".into()); }

    let prev_status = task.status.as_deref().unwrap_or("backlog");
    tq::update_status(&db, id, &status);

    if status == "in_progress" {
        if task.started_at.is_none() { tq::set_started(&db, id); }
        else { tq::set_resumed(&db, id); }
    }
    if status == "testing" && prev_status == "in_progress" {
        tq::pause_timer(&db, id);
    }
    if status == "done" && task.completed_at.is_none() {
        tq::finalize_timer(&db, id);
        activity::add(&db, task.project_id, Some(id), "task_approved", &format!("Task approved: {}", task.title), None);
    }

    let updated = tq::get_by_id(&db, id).unwrap();

    if status == "in_progress" && prev_status != "in_progress" {
        let project = pq::get_by_id(&db, task.project_id).unwrap();
        runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
        activity::add(&db, task.project_id, Some(id), "task_started", &format!("Task started: {}", task.title), None);
    }
    if prev_status == "in_progress" && status != "in_progress" {
        runner::stop(id, &db, &app);
    }
    if (status == "done" || status == "testing") && prev_status == "in_progress" {
        queue::start_next_queued(&db, &app, task.project_id);
    }

    let mut final_task = tq::get_by_id(&db, id).unwrap();
    final_task.is_running = runner::is_running(id);
    app.emit("task:updated", &final_task).ok();
    Ok(final_task)
}

#[tauri::command]
pub fn delete_task(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    if runner::is_running(id) { runner::stop(id, &db, &app); }
    tq::delete(&db, id);
    app.emit("task:deleted", &serde_json::json!({"id": task.id})).ok();
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
    let updated = tq::get_by_id(&db, id).unwrap();
    let project = pq::get_by_id(&db, task.project_id).unwrap();
    runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
    let mut val = serde_json::to_value(&updated).unwrap();
    val.as_object_mut().unwrap().insert("is_running".into(), serde_json::Value::Bool(true));
    app.emit("task:updated", &val).ok();
    Ok(updated)
}

#[tauri::command]
pub fn request_changes(app: AppHandle, id: i64, feedback: String, mcp_port: u16) -> Result<tq::Task, String> {
    let db = db::get_db();
    let task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    if feedback.trim().is_empty() { return Err("Feedback is required".into()); }

    tq::increment_revision_count(&db, id);
    let rev_num = tq::get_by_id(&db, id).unwrap().revision_count.unwrap_or(1);
    tq::add_revision(&db, id, rev_num, feedback.trim());
    tq::update_status(&db, id, "in_progress");
    let updated = tq::get_by_id(&db, id).unwrap();
    let project = pq::get_by_id(&db, task.project_id).unwrap();
    runner::start(&updated, app.clone(), &project.working_dir, &project, mcp_port);
    activity::add(&db, task.project_id, Some(id), "revision_requested",
        &format!("Revision #{}: {}", rev_num, task.title),
        Some(&serde_json::json!({"feedback": feedback.trim()}).to_string()));
    let mut final_task = tq::get_by_id(&db, id).unwrap();
    final_task.is_running = runner::is_running(id);
    app.emit("task:updated", &final_task).ok();
    Ok(final_task)
}

#[tauri::command]
pub fn get_revisions(id: i64) -> Vec<tq::TaskRevision> {
    tq::get_revisions(&db::get_db(), id)
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

    let mut val = serde_json::to_value(&task).unwrap();
    let obj = val.as_object_mut().unwrap();
    obj.insert("commits".into(), commits);
    obj.insert("revisions".into(), serde_json::to_value(revisions).unwrap());
    obj.insert("attachments".into(), serde_json::to_value(task_attachments).unwrap());
    obj.insert("is_running".into(), serde_json::Value::Bool(runner::is_running(id)));
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
pub fn set_task_dependency(app: AppHandle, id: i64, depends_on: Option<i64>) -> Result<tq::Task, String> {
    let db = db::get_db();
    let _task = tq::get_by_id(&db, id).ok_or("Task not found")?;
    // Prevent circular dependency
    if let Some(dep_id) = depends_on {
        if dep_id == id { return Err("Task cannot depend on itself".into()); }
        if tq::get_by_id(&db, dep_id).is_none() { return Err("Dependency task not found".into()); }
    }
    tq::update_depends_on(&db, id, depends_on);
    let updated = tq::get_by_id(&db, id).unwrap();
    app.emit("task:updated", &updated).ok();
    Ok(updated)
}

#[tauri::command]
pub fn get_pipeline_status(project_id: i64) -> serde_json::Value {
    let db = db::get_db();
    let tasks = tq::get_by_project(&db, project_id);
    let running: Vec<_> = tasks.iter().filter(|t| t.status.as_deref() == Some("in_progress") || runner::is_running(t.id)).collect();
    let queued: Vec<_> = tasks.iter().filter(|t| t.status.as_deref() == Some("backlog"))
        .collect();
    let completed: Vec<_> = tasks.iter().filter(|t| matches!(t.status.as_deref(), Some("done") | Some("testing")))
        .collect();
    let total_cost: f64 = tasks.iter().map(|t| t.total_cost.unwrap_or(0.0)).sum();
    let total_tokens: i64 = tasks.iter().map(|t| t.input_tokens.unwrap_or(0) + t.output_tokens.unwrap_or(0)).sum();
    let avg_duration: i64 = {
        let durations: Vec<i64> = completed.iter().filter_map(|t| t.work_duration_ms).filter(|d| *d > 0).collect();
        if durations.is_empty() { 0 } else { durations.iter().sum::<i64>() / durations.len() as i64 }
    };

    serde_json::json!({
        "running": running.len(),
        "queued": queued.len(),
        "completed": completed.len(),
        "total": tasks.len(),
        "totalCost": total_cost,
        "totalTokens": total_tokens,
        "avgDurationMs": avg_duration,
        "tasks": {
            "running": running,
            "queued": queued,
        }
    })
}
