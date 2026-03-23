use tauri::{AppHandle, Emitter};
use crate::db::{self, webhooks as wq};

#[tauri::command]
pub fn get_webhooks(project_id: i64) -> Vec<wq::Webhook> {
    wq::get_by_project(&db::get_db(), project_id)
}

#[tauri::command]
pub fn create_webhook(
    app: AppHandle, project_id: i64,
    name: String, url: String, platform: Option<String>, events: Option<Vec<String>>,
) -> Result<wq::Webhook, String> {
    let db = db::get_db();
    let id = wq::create(&db, project_id, &name, &url, platform.as_deref(), &events.unwrap_or_default());
    let w = wq::get_by_id(&db, id).unwrap();
    app.emit("webhook:created", &w).ok();
    Ok(w)
}

#[tauri::command]
pub fn update_webhook(
    app: AppHandle, id: i64,
    name: String, url: String, platform: Option<String>,
    events: Option<Vec<String>>, enabled: Option<bool>,
) -> Result<wq::Webhook, String> {
    let db = db::get_db();
    wq::update(&db, id, &name, &url, platform.as_deref(), &events.unwrap_or_default(), enabled.unwrap_or(true));
    let w = wq::get_by_id(&db, id).unwrap();
    app.emit("webhook:updated", &w).ok();
    Ok(w)
}

#[tauri::command]
pub fn delete_webhook(app: AppHandle, id: i64) {
    wq::delete(&db::get_db(), id);
    app.emit("webhook:deleted", &serde_json::json!({"id": id})).ok();
}

#[tauri::command]
pub async fn test_webhook(id: i64) -> Result<String, String> {
    let db = db::get_db();
    let webhook = wq::get_by_id(&db, id).ok_or("Webhook not found")?;
    let payload = serde_json::json!({
        "event": "test",
        "message": "Test notification from Claude Board",
        "timestamp": chrono::Local::now().to_rfc3339(),
    });
    let client = reqwest::Client::new();
    let res = client.post(&webhook.url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(10))
        .send().await
        .map_err(|e| e.to_string())?;
    Ok(format!("Status: {}", res.status()))
}
