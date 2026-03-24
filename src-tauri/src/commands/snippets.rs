use tauri::{AppHandle, Emitter};
use crate::db::{self, snippets as sq};

#[tauri::command]
pub fn get_snippets(project_id: i64) -> Vec<sq::Snippet> {
    sq::get_by_project(&db::get_db(), project_id)
}

#[tauri::command]
pub fn create_snippet(app: AppHandle, project_id: i64, title: String, content: String) -> Result<sq::Snippet, String> {
    let db = db::get_db();
    let id = sq::create(&db, project_id, &title, &content);
    let snippet = sq::get_by_id(&db, id).ok_or("Snippet not found")?;
    app.emit("snippet:created", &snippet).ok();
    Ok(snippet)
}

#[tauri::command]
pub fn update_snippet(app: AppHandle, id: i64, title: String, content: String, enabled: bool) -> Result<sq::Snippet, String> {
    let db = db::get_db();
    sq::update(&db, id, &title, &content, enabled);
    let snippet = sq::get_by_id(&db, id).ok_or("Snippet not found")?;
    app.emit("snippet:updated", &snippet).ok();
    Ok(snippet)
}

#[tauri::command]
pub fn delete_snippet(app: AppHandle, id: i64) {
    sq::delete(&db::get_db(), id);
    app.emit("snippet:deleted", &serde_json::json!({"id": id})).ok();
}
