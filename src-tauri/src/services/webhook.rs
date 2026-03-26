use crate::db::{self, webhooks};

/// Fire-and-forget webhook dispatch from sync context.
/// Spawns an async task so the caller is never blocked.
pub fn fire(project_id: i64, event_type: &str, message: &str, metadata: serde_json::Value) {
    let event_type = event_type.to_string();
    let message = message.to_string();
    tauri::async_runtime::spawn(async move {
        dispatch(project_id, &event_type, &message, &metadata).await;
    });
}

pub async fn dispatch(project_id: i64, event_type: &str, message: &str, metadata: &serde_json::Value) {
    let db = db::get_db();
    let hooks = webhooks::get_enabled_by_project(&db, project_id);
    if hooks.is_empty() { return; }

    let client = reqwest::Client::new();

    for hook in hooks {
        if !hook.events.is_empty() && !hook.events.contains(&event_type.to_string()) {
            continue;
        }

        let payload = build_payload(
            hook.platform.as_deref().unwrap_or("custom"),
            event_type, message, metadata,
        );

        if let Err(e) = client.post(&hook.url)
            .json(&payload)
            .timeout(std::time::Duration::from_secs(10))
            .send().await
        {
            log::warn!("Webhook delivery failed for {}: {}", hook.name, e);
        }
    }
}

fn build_payload(platform: &str, event_type: &str, message: &str, metadata: &serde_json::Value) -> serde_json::Value {
    match platform {
        "discord" => serde_json::json!({
            "embeds": [{
                "title": event_type,
                "description": message,
                "color": match event_type {
                    "task_approved" => 0x22c55e,
                    "task_failed" => 0xef4444,
                    "task_started" => 0xf59e0b,
                    _ => 0x3b82f6,
                },
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "footer": {"text": "Claude Board"}
            }]
        }),
        "slack" => serde_json::json!({
            "blocks": [{
                "type": "section",
                "text": {"type": "mrkdwn", "text": format!("*{}*\n{}", event_type, message)}
            }]
        }),
        _ => serde_json::json!({
            "event": event_type,
            "message": message,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "metadata": metadata,
        }),
    }
}
