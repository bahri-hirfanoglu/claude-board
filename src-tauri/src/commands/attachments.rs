use tauri::{AppHandle, Emitter};
use crate::db::{self, attachments as aq};

#[tauri::command]
pub fn get_attachments(task_id: i64) -> Vec<aq::Attachment> {
    aq::get_by_task(&db::get_db(), task_id)
}

#[tauri::command]
pub fn upload_attachment(
    app: AppHandle, task_id: i64,
    file_data: Vec<u8>, file_name: String, mime_type: String,
) -> Result<aq::Attachment, String> {
    let db = db::get_db();
    let data_dir = db::get_data_dir();
    let uploads_dir = data_dir.parent().unwrap_or(&data_dir).join("uploads");
    std::fs::create_dir_all(&uploads_dir).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(&file_name)
        .extension().and_then(|e| e.to_str()).unwrap_or("bin");
    let stored_name = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let dest = uploads_dir.join(&stored_name);
    std::fs::write(&dest, &file_data).map_err(|e| e.to_string())?;

    let id = aq::create(&db, task_id, &stored_name, &file_name, Some(&mime_type), file_data.len() as i64);
    let attachment = aq::get_by_id(&db, id).ok_or_else(|| "Failed to create attachment".to_string())?;
    let all_attachments = aq::get_by_task(&db, task_id);
    app.emit("task:attachments", &serde_json::json!({
        "taskId": task_id, "attachments": all_attachments
    })).ok();
    Ok(attachment)
}

#[tauri::command]
pub fn delete_attachment(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    if let Some(att) = aq::get_by_id(&db, id) {
        let task_id = att.task_id;
        let data_dir = db::get_data_dir();
        let file_path = data_dir.parent().unwrap_or(&data_dir).join("uploads").join(&att.filename);
        // Delete file first, only remove DB record if file is gone
        let file_exists = file_path.exists();
        if file_exists {
            if let Err(e) = std::fs::remove_file(&file_path) {
                log::warn!("Failed to delete attachment file: {}", e);
                // Still remove DB record - file might be locked/moved
            }
        }
        aq::remove(&db, id);
        app.emit("task:attachmentDeleted", &serde_json::json!({"id": id, "taskId": task_id})).ok();
    }
    Ok(())
}
