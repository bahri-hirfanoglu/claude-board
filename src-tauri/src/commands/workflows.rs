use tauri::{AppHandle, Emitter};
use crate::db::{self, workflows as wf, tasks as tq, dependencies, activity};

#[tauri::command]
pub fn get_workflow_templates(project_id: i64) -> Vec<wf::WorkflowTemplate> {
    wf::get_by_project(&db::get_db(), project_id)
}

#[tauri::command]
pub fn create_workflow_template(
    project_id: i64, name: String, description: Option<String>, steps: String,
) -> Result<wf::WorkflowTemplate, String> {
    let db = db::get_db();
    if name.trim().is_empty() { return Err("Name is required".into()); }
    let id = wf::create(&db, project_id, name.trim(), description.as_deref().unwrap_or(""), &steps);
    wf::get_by_id(&db, id).ok_or("Failed to create workflow template".into())
}

#[tauri::command]
pub fn update_workflow_template(
    id: i64, name: String, description: Option<String>, steps: String,
) -> Result<wf::WorkflowTemplate, String> {
    let db = db::get_db();
    wf::update(&db, id, name.trim(), description.as_deref().unwrap_or(""), &steps);
    wf::get_by_id(&db, id).ok_or("Failed to update workflow template".into())
}

#[tauri::command]
pub fn delete_workflow_template(id: i64) -> Result<(), String> {
    wf::delete(&db::get_db(), id);
    Ok(())
}

#[tauri::command]
pub fn apply_workflow_template(app: AppHandle, template_id: i64, project_id: i64) -> Result<Vec<tq::Task>, String> {
    let db = db::get_db();
    let template = wf::get_by_id(&db, template_id).ok_or("Template not found")?;
    let steps: Vec<wf::WorkflowStep> = serde_json::from_str(template.steps.as_deref().unwrap_or("[]"))
        .map_err(|e| format!("Invalid template steps: {}", e))?;

    if steps.is_empty() { return Err("Template has no steps".into()); }

    // Create tasks for each step
    let mut created_ids: Vec<i64> = Vec::new();
    for step in &steps {
        let task_id = tq::create(&db, project_id,
            &step.title,
            step.description.as_deref().unwrap_or(""),
            0, // priority
            step.task_type.as_deref().unwrap_or("feature"),
            step.acceptance_criteria.as_deref().unwrap_or(""),
            step.model.as_deref().unwrap_or("sonnet"),
            "medium",
            None, // role_id
            None, // tags
        );
        created_ids.push(task_id);
    }

    // Set up dependencies between steps
    for (i, step) in steps.iter().enumerate() {
        let task_id = created_ids[i];
        for &dep_idx in &step.depends_on_steps {
            if dep_idx < created_ids.len() {
                let depends_on_id = created_ids[dep_idx];
                let condition = step.condition_type.as_deref().unwrap_or("always");
                dependencies::add_dependency(&db, task_id, depends_on_id, Some(condition)).ok();
            }
        }
    }

    // Collect created tasks
    let tasks: Vec<tq::Task> = created_ids.iter()
        .filter_map(|id| tq::get_by_id(&db, *id))
        .collect();

    activity::add(&db, project_id, None, "workflow_applied",
        &format!("Workflow '{}' applied: {} tasks created", template.name, tasks.len()), None);

    for task in &tasks {
        app.emit("task:created", task).ok();
    }

    // Trigger queue in case auto-queue is on
    crate::services::queue::start_next_queued(&db, &app, project_id);

    Ok(tasks)
}
