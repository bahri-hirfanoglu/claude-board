use tauri::{AppHandle, Emitter};
use crate::db::{self, projects as pq};
use crate::db::tasks as tq;
use crate::db::activity;
use crate::claude::runner;

#[tauri::command]
pub fn get_projects() -> Vec<pq::Project> {
    pq::get_all(&db::get_db())
}

#[tauri::command]
pub fn get_projects_summary() -> Vec<pq::ProjectSummary> {
    pq::get_summary(&db::get_db())
}

#[tauri::command]
pub fn get_project(id: i64) -> Result<pq::Project, String> {
    pq::get_by_id(&db::get_db(), id).ok_or_else(|| "Project not found".into())
}

#[tauri::command]
pub fn create_project(
    app: AppHandle,
    name: String, slug: String, working_dir: String,
    icon: Option<String>, icon_seed: Option<String>,
    permission_mode: Option<String>, allowed_tools: Option<String>,
) -> Result<pq::Project, String> {
    let db = db::get_db();
    if name.trim().is_empty() { return Err("Name is required".into()); }
    if slug.trim().is_empty() { return Err("Slug is required".into()); }
    if working_dir.trim().is_empty() { return Err("Working directory is required".into()); }
    if pq::get_by_slug(&db, slug.trim()).is_some() { return Err("Slug already exists".into()); }

    let id = pq::create(&db, name.trim(), slug.trim(), working_dir.trim(),
        icon.as_deref(), icon_seed.as_deref(), permission_mode.as_deref(), allowed_tools.as_deref());
    let project = pq::get_by_id(&db, id).unwrap();
    app.emit("project:created", &project).ok();
    activity::add(&db, project.id, None, "project_created", &format!("Project created: {}", project.name), None);
    Ok(project)
}

#[tauri::command]
pub fn update_project(
    app: AppHandle, id: i64,
    name: Option<String>, slug: Option<String>, working_dir: Option<String>,
    icon: Option<String>, icon_seed: Option<String>,
    permission_mode: Option<String>, allowed_tools: Option<String>,
    auto_queue: Option<bool>, max_concurrent: Option<i64>,
    auto_branch: Option<bool>, auto_pr: Option<bool>, pr_base_branch: Option<String>,
) -> Result<pq::Project, String> {
    let db = db::get_db();
    let project = pq::get_by_id(&db, id).ok_or("Project not found")?;

    pq::update(&db, id,
        name.as_deref().unwrap_or(&project.name),
        slug.as_deref().unwrap_or(&project.slug),
        working_dir.as_deref().unwrap_or(&project.working_dir),
        icon.as_deref().or(project.icon.as_deref()),
        icon_seed.as_deref().or(project.icon_seed.as_deref()),
        permission_mode.as_deref().or(project.permission_mode.as_deref()),
        allowed_tools.as_deref().or(project.allowed_tools.as_deref()),
    );

    if auto_queue.is_some() || max_concurrent.is_some() {
        pq::update_queue(&db, id,
            auto_queue.unwrap_or(project.auto_queue.unwrap_or(0) == 1),
            max_concurrent.unwrap_or(project.max_concurrent.unwrap_or(1)));
    }
    if auto_branch.is_some() || auto_pr.is_some() || pr_base_branch.is_some() {
        pq::update_git_settings(&db, id,
            auto_branch.unwrap_or(project.auto_branch.unwrap_or(1) == 1),
            auto_pr.unwrap_or(project.auto_pr.unwrap_or(0) == 1),
            pr_base_branch.as_deref().unwrap_or(project.pr_base_branch.as_deref().unwrap_or("main")));
    }

    let updated = pq::get_by_id(&db, id).unwrap();
    app.emit("project:updated", &updated).ok();
    Ok(updated)
}

#[tauri::command]
pub fn delete_project(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    let project = pq::get_by_id(&db, id).ok_or("Project not found")?;
    let tasks = tq::get_by_project(&db, id);
    for t in &tasks {
        if runner::is_running(t.id) { runner::stop(t.id, &db, &app); }
    }
    pq::delete(&db, id);
    app.emit("project:deleted", &serde_json::json!({"id": project.id})).ok();
    Ok(())
}
