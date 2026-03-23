use crate::db::{self, auth};

#[tauri::command]
pub fn get_auth_status() -> serde_json::Value {
    serde_json::json!({"enabled": auth::is_auth_enabled(&db::get_db())})
}

#[tauri::command]
pub fn enable_auth() -> serde_json::Value {
    let key = auth::generate_api_key(&db::get_db());
    serde_json::json!({
        "enabled": true,
        "api_key": key,
        "message": "Save this key — it cannot be retrieved later."
    })
}

#[tauri::command]
pub fn disable_auth() -> serde_json::Value {
    auth::disable_auth(&db::get_db());
    serde_json::json!({"enabled": false})
}
