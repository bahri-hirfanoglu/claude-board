use crate::db::{self, stats as sq, activity, projects as pq};

#[tauri::command]
pub fn get_project_stats(project_id: i64) -> Result<sq::ProjectStats, String> {
    let db = db::get_db();
    if pq::get_by_id(&db, project_id).is_none() { return Err("Project not found".into()); }
    Ok(sq::get_project_stats(&db, project_id))
}

#[tauri::command]
pub fn get_claude_usage() -> serde_json::Value {
    let db = db::get_db();
    serde_json::json!({
        "usage": sq::get_global_usage(&db),
        "models": sq::get_global_model_breakdown(&db),
        "timeline": sq::get_usage_timeline(&db),
        "limits": sq::get_claude_limits(&db),
    })
}

#[tauri::command]
pub fn get_activity(project_id: i64, limit: Option<i64>, offset: Option<i64>) -> Vec<activity::ActivityEntry> {
    activity::get_by_project(&db::get_db(), project_id, limit.unwrap_or(50), offset.unwrap_or(0))
}

#[tauri::command]
pub fn get_claude_md(project_id: i64) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    let project = pq::get_by_id(&db, project_id).ok_or("Project not found")?;
    let path = std::path::Path::new(&project.working_dir).join("CLAUDE.md");
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        Ok(serde_json::json!({"exists": true, "content": content}))
    } else {
        Ok(serde_json::json!({"exists": false, "content": ""}))
    }
}

#[tauri::command]
pub fn save_claude_md(project_id: i64, content: String) -> Result<(), String> {
    let db = db::get_db();
    let project = pq::get_by_id(&db, project_id).ok_or("Project not found")?;
    let path = std::path::Path::new(&project.working_dir).join("CLAUDE.md");
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}
