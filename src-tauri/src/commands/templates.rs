use tauri::{AppHandle, Emitter};
use crate::db::{self, templates as tq};

#[tauri::command]
pub fn get_templates(project_id: i64) -> Vec<tq::Template> {
    tq::get_by_project(&db::get_db(), project_id)
}

#[tauri::command]
pub fn create_template(
    app: AppHandle, project_id: i64,
    name: String, description: Option<String>, template: String,
    variables: Option<String>, task_type: Option<String>,
    model: Option<String>, thinking_effort: Option<String>,
) -> Result<tq::Template, String> {
    let db = db::get_db();
    let id = tq::create(&db, project_id, &name, description.as_deref(),
        &template, variables.as_deref(),
        task_type.as_deref().unwrap_or("feature"),
        model.as_deref().unwrap_or("sonnet"),
        thinking_effort.as_deref().unwrap_or("medium"));
    let t = tq::get_by_id(&db, id).ok_or("Template not found")?;
    app.emit("template:created", &t).ok();
    Ok(t)
}

#[tauri::command]
pub fn update_template(
    app: AppHandle, id: i64,
    name: String, description: Option<String>, template: String,
    variables: Option<String>, task_type: Option<String>,
    model: Option<String>, thinking_effort: Option<String>,
) -> Result<tq::Template, String> {
    let db = db::get_db();
    tq::update(&db, id, &name, description.as_deref(), &template,
        variables.as_deref(),
        task_type.as_deref().unwrap_or("feature"),
        model.as_deref().unwrap_or("sonnet"),
        thinking_effort.as_deref().unwrap_or("medium"));
    let t = tq::get_by_id(&db, id).ok_or("Template not found")?;
    app.emit("template:updated", &t).ok();
    Ok(t)
}

#[tauri::command]
pub fn delete_template(app: AppHandle, id: i64) {
    tq::delete(&db::get_db(), id);
    app.emit("template:deleted", &serde_json::json!({"id": id})).ok();
}
