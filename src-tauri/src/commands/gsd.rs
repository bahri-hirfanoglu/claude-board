use tauri::{AppHandle, Emitter};
use crate::db::{self, projects, tasks, dependencies};
use crate::services::gsd;

#[tauri::command]
pub fn gsd_check_status(project_id: i64) -> Result<gsd::GsdStatus, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::check_status(&project.working_dir))
}

#[tauri::command]
pub fn gsd_health_check(project_id: i64) -> Result<gsd::HealthReport, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::run_health_checks(&project.working_dir))
}

#[tauri::command]
pub fn gsd_list_todos(project_id: i64) -> Result<Vec<gsd::GsdTodo>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::list_todos(&project.working_dir))
}

#[tauri::command]
pub async fn gsd_install(app: AppHandle, project_id: i64, scope: Option<String>) -> Result<String, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    let scope_str = scope.unwrap_or_else(|| "global".to_string());
    let working_dir = project.working_dir.clone();

    app.emit("gsd:installing", &serde_json::json!({"projectId": project_id})).ok();

    let result = tokio::task::spawn_blocking(move || {
        gsd::install(&working_dir, &scope_str)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    match &result {
        Ok(msg) => {
            app.emit("gsd:installed", &serde_json::json!({"projectId": project_id, "message": msg})).ok();
        }
        Err(msg) => {
            app.emit("gsd:install_failed", &serde_json::json!({"projectId": project_id, "error": msg})).ok();
        }
    }

    result
}

#[tauri::command]
pub fn gsd_get_roadmap(project_id: i64) -> Result<Option<gsd::GsdRoadmap>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::read_roadmap(&project.working_dir))
}

#[tauri::command]
pub fn gsd_get_state(project_id: i64) -> Result<Option<gsd::GsdState>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::read_state(&project.working_dir))
}

#[tauri::command]
pub fn gsd_get_project(project_id: i64) -> Result<Option<gsd::GsdProject>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::read_project(&project.working_dir))
}

#[tauri::command]
pub fn gsd_get_phase_details(project_id: i64) -> Result<Vec<gsd::GsdPhaseDetail>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::read_phase_details(&project.working_dir))
}

#[tauri::command]
pub fn gsd_get_config(project_id: i64) -> Result<Option<serde_json::Value>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::read_config(&project.working_dir))
}

/// Parse PLAN files for a phase and return extracted tasks (preview, no creation).
#[tauri::command]
pub fn gsd_parse_phase_plans(project_id: i64, phase_number: String) -> Result<Vec<gsd::GsdPlanTask>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    Ok(gsd::parse_phase_plans(&project.working_dir, &phase_number))
}

/// Parse PLAN files and create board tasks from them, with dependencies based on wave ordering.
#[tauri::command]
pub fn gsd_create_tasks_from_plans(
    app: AppHandle,
    project_id: i64,
    phase_number: String,
    _phase_title: String,
    auto_start: Option<bool>,
) -> Result<Vec<tasks::Task>, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;

    let plan_tasks = gsd::parse_phase_plans(&project.working_dir, &phase_number);
    if plan_tasks.is_empty() {
        return Err(format!("No tasks found in PLAN files for phase {}", phase_number));
    }

    let mut created: Vec<tasks::Task> = Vec::new();
    // Track plan_number → task IDs for wave-based dependencies
    let mut plan_to_task_ids: std::collections::HashMap<String, Vec<i64>> = std::collections::HashMap::new();

    for pt in &plan_tasks {
        let title = format!("[P{}] {}", phase_number, pt.task_name);
        let mut desc_parts = Vec::new();
        if !pt.action.is_empty() {
            desc_parts.push(pt.action.clone());
        }
        if !pt.files.is_empty() {
            desc_parts.push(format!("\n**Files:** {}", pt.files));
        }
        if !pt.verify.is_empty() {
            desc_parts.push(format!("\n**Verify:** {}", pt.verify));
        }
        if !pt.done_criteria.is_empty() {
            desc_parts.push(format!("\n**Done:** {}", pt.done_criteria));
        }
        let description = desc_parts.join("\n");
        let tags = format!("gsd,phase-{},plan-{},wave-{}", phase_number, pt.plan_number, pt.wave);

        let task_id = tasks::create(
            &db,
            project_id,
            &title,
            &description,
            0, // priority
            &pt.task_type,
            &pt.done_criteria,
            "sonnet",
            "medium",
            None, // role_id
            Some(&tags),
        );

        plan_to_task_ids
            .entry(pt.plan_number.clone())
            .or_default()
            .push(task_id);

        if let Some(task) = tasks::get_by_id(&db, task_id) {
            app.emit("task:created", &task).ok();
            created.push(task);
        }
    }

    // Set up dependencies: tasks in wave N depend on all tasks from wave N-1
    let mut wave_task_ids: std::collections::BTreeMap<i64, Vec<i64>> = std::collections::BTreeMap::new();
    for pt in &plan_tasks {
        if let Some(ids) = plan_to_task_ids.get(&pt.plan_number) {
            wave_task_ids
                .entry(pt.wave)
                .or_default()
                .extend(ids.iter());
        }
    }

    let waves: Vec<i64> = wave_task_ids.keys().cloned().collect();
    for w in 1..waves.len() {
        let prev_wave = waves[w - 1];
        let curr_wave = waves[w];
        let prev_ids = wave_task_ids.get(&prev_wave).cloned().unwrap_or_default();
        let curr_ids = wave_task_ids.get(&curr_wave).cloned().unwrap_or_default();

        for &curr_id in &curr_ids {
            for &prev_id in &prev_ids {
                if let Err(e) = dependencies::add_dependency(&db, curr_id, prev_id, Some("on_success")) {
                    log::warn!("GSD: Failed to add dependency {} → {}: {}", prev_id, curr_id, e);
                }
            }
        }
    }

    // If auto_start, trigger queue
    if auto_start.unwrap_or(false) {
        crate::services::queue::start_next_queued(&db, &app, project_id);
    }

    app.emit("roadmap:updated", &project_id).ok();
    Ok(created)
}
