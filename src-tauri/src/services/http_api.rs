/// Lightweight HTTP API for MCP server communication.
/// The MCP server (Node.js sidecar) talks to this API to manage tasks.
use axum::{
    Router, Json,
    extract::{Path, Query},
    routing::{get, patch},
    http::StatusCode,
    response::IntoResponse,
};
use tower_http::cors::CorsLayer;
use serde::Deserialize;
use crate::db::{self, projects, tasks, stats, activity, attachments, settings};

pub async fn start_server(port: u16) {
    let app = Router::new()
        // Projects
        .route("/api/projects", get(list_projects))
        .route("/api/projects/summary", get(projects_summary))
        .route("/api/projects/{id}", get(get_project))
        // Tasks
        .route("/api/projects/{project_id}/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/{id}", get(get_task).put(update_task).delete(delete_task_handler))
        .route("/api/tasks/{id}/status", patch(change_status))
        .route("/api/tasks/{id}/detail", get(task_detail))
        .route("/api/tasks/{id}/logs", get(task_logs))
        .route("/api/tasks/{id}/revisions", get(task_revisions))
        // Stats
        .route("/api/projects/{pid}/stats", get(project_stats))
        .route("/api/stats/claude-usage", get(claude_usage))
        .route("/api/projects/{pid}/activity", get(project_activity))
        // Auth
        .route("/api/auth/status", get(auth_status))
        // Settings
        .route("/api/settings", get(get_settings).put(update_settings))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await.expect("Failed to bind MCP HTTP API port");
    log::info!("MCP HTTP API listening on port {}", port);
    axum::serve(listener, app).await.ok();
}

// ─── Handlers ───

async fn list_projects() -> Json<serde_json::Value> {
    Json(serde_json::to_value(projects::get_all(&db::get_db())).unwrap())
}

async fn projects_summary() -> Json<serde_json::Value> {
    Json(serde_json::to_value(projects::get_summary(&db::get_db())).unwrap())
}

async fn get_project(Path(id): Path<i64>) -> impl IntoResponse {
    match projects::get_by_id(&db::get_db(), id) {
        Some(p) => Json(serde_json::to_value(p).unwrap()).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn list_tasks(Path(project_id): Path<i64>) -> Json<serde_json::Value> {
    let db = db::get_db();
    let t = tasks::get_by_project(&db, project_id);
    Json(serde_json::to_value(t).unwrap())
}

#[derive(Deserialize)]
struct CreateTaskBody {
    title: String,
    description: Option<String>,
    priority: Option<i64>,
    task_type: Option<String>,
    acceptance_criteria: Option<String>,
    model: Option<String>,
    thinking_effort: Option<String>,
    tags: Option<String>,
    parent_task_id: Option<i64>,
}

async fn create_task(Path(project_id): Path<i64>, Json(body): Json<CreateTaskBody>) -> impl IntoResponse {
    let db = db::get_db();
    let id = tasks::create(&db, project_id, &body.title,
        body.description.as_deref().unwrap_or(""),
        body.priority.unwrap_or(0),
        body.task_type.as_deref().unwrap_or("feature"),
        body.acceptance_criteria.as_deref().unwrap_or(""),
        body.model.as_deref().unwrap_or("sonnet"),
        body.thinking_effort.as_deref().unwrap_or("medium"),
        None,
        body.tags.as_deref(),
    );
    // Link as sub-task if parent_task_id provided
    if let Some(parent_id) = body.parent_task_id {
        if tasks::get_by_id(&db, parent_id).is_some() {
            tasks::set_parent_task_id(&db, id, parent_id);
            tasks::set_awaiting_subtasks(&db, parent_id, true);
        }
    }
    let task = tasks::get_by_id(&db, id).unwrap();
    (StatusCode::CREATED, Json(serde_json::to_value(task).unwrap()))
}

async fn get_task(Path(id): Path<i64>) -> impl IntoResponse {
    match tasks::get_by_id(&db::get_db(), id) {
        Some(t) => Json(serde_json::to_value(t).unwrap()).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateTaskBody {
    title: Option<String>,
    description: Option<String>,
    priority: Option<i64>,
    task_type: Option<String>,
    acceptance_criteria: Option<String>,
    model: Option<String>,
    thinking_effort: Option<String>,
    tags: Option<String>,
}

async fn update_task(Path(id): Path<i64>, Json(body): Json<UpdateTaskBody>) -> impl IntoResponse {
    let db = db::get_db();
    let task = match tasks::get_by_id(&db, id) {
        Some(t) => t,
        None => return StatusCode::NOT_FOUND.into_response(),
    };
    tasks::update(&db, id,
        body.title.as_deref().unwrap_or(&task.title),
        body.description.as_deref().unwrap_or(task.description.as_deref().unwrap_or("")),
        body.priority.unwrap_or(task.priority.unwrap_or(0)),
        body.task_type.as_deref().unwrap_or(task.task_type.as_deref().unwrap_or("feature")),
        body.acceptance_criteria.as_deref().unwrap_or(task.acceptance_criteria.as_deref().unwrap_or("")),
        body.model.as_deref().unwrap_or(task.model.as_deref().unwrap_or("sonnet")),
        body.thinking_effort.as_deref().unwrap_or(task.thinking_effort.as_deref().unwrap_or("medium")),
        task.role_id,
        body.tags.as_deref().or(task.tags.as_deref()),
    );
    let updated = tasks::get_by_id(&db, id).unwrap();
    Json(serde_json::to_value(updated).unwrap()).into_response()
}

async fn delete_task_handler(Path(id): Path<i64>) -> impl IntoResponse {
    tasks::delete(&db::get_db(), id);
    Json(serde_json::json!({"ok": true}))
}

#[derive(Deserialize)]
struct StatusBody {
    status: String,
}

async fn change_status(Path(id): Path<i64>, Json(body): Json<StatusBody>) -> impl IntoResponse {
    let db = db::get_db();
    tasks::update_status(&db, id, &body.status);
    match tasks::get_by_id(&db, id) {
        Some(t) => Json(serde_json::to_value(t).unwrap()).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn task_detail(Path(id): Path<i64>) -> impl IntoResponse {
    let db = db::get_db();
    let task = match tasks::get_by_id(&db, id) {
        Some(t) => t,
        None => return StatusCode::NOT_FOUND.into_response(),
    };
    let revisions = tasks::get_revisions(&db, id);
    let atts = attachments::get_by_task(&db, id);
    let commits: serde_json::Value = task.commits.as_deref()
        .and_then(|c| serde_json::from_str(c).ok())
        .unwrap_or(serde_json::json!([]));

    let mut val = serde_json::to_value(&task).unwrap();
    let obj = val.as_object_mut().unwrap();
    obj.insert("commits".into(), commits);
    obj.insert("revisions".into(), serde_json::to_value(revisions).unwrap());
    obj.insert("attachments".into(), serde_json::to_value(atts).unwrap());
    Json(val).into_response()
}

#[derive(Deserialize)]
struct LogsQuery { limit: Option<i64> }

async fn task_logs(Path(id): Path<i64>, Query(q): Query<LogsQuery>) -> Json<serde_json::Value> {
    let mut logs = tasks::get_recent_logs(&db::get_db(), id, q.limit.unwrap_or(500));
    logs.reverse();
    Json(serde_json::to_value(logs).unwrap())
}

async fn task_revisions(Path(id): Path<i64>) -> Json<serde_json::Value> {
    Json(serde_json::to_value(tasks::get_revisions(&db::get_db(), id)).unwrap())
}

async fn project_stats(Path(pid): Path<i64>) -> Json<serde_json::Value> {
    Json(serde_json::to_value(stats::get_project_stats(&db::get_db(), pid)).unwrap())
}

async fn claude_usage() -> Json<serde_json::Value> {
    let db = db::get_db();
    Json(serde_json::json!({
        "usage": stats::get_global_usage(&db),
        "models": stats::get_global_model_breakdown(&db),
        "timeline": stats::get_usage_timeline(&db),
        "limits": stats::get_claude_limits(&db),
    }))
}

#[derive(Deserialize)]
struct ActivityQuery { limit: Option<i64>, offset: Option<i64> }

async fn project_activity(Path(pid): Path<i64>, Query(q): Query<ActivityQuery>) -> Json<serde_json::Value> {
    Json(serde_json::to_value(
        activity::get_by_project(&db::get_db(), pid, q.limit.unwrap_or(50), q.offset.unwrap_or(0))
    ).unwrap())
}

async fn auth_status() -> Json<serde_json::Value> {
    Json(serde_json::json!({"enabled": crate::db::auth::is_auth_enabled(&db::get_db())}))
}

async fn get_settings() -> Json<serde_json::Value> {
    Json(serde_json::to_value(settings::get(&db::get_db())).unwrap())
}

async fn update_settings(Json(body): Json<serde_json::Value>) -> Json<serde_json::Value> {
    let db = db::get_db();
    let mut current = settings::get(&db);
    if let Some(v) = body.get("confirm_before_delete").and_then(|v| v.as_bool()) { current.confirm_before_delete = v; }
    if let Some(v) = body.get("default_model").and_then(|v| v.as_str()) { current.default_model = v.to_string(); }
    if let Some(v) = body.get("default_effort").and_then(|v| v.as_str()) { current.default_effort = v.to_string(); }
    if let Some(v) = body.get("language").and_then(|v| v.as_str()) { current.language = v.to_string(); }
    if let Some(v) = body.get("auto_open_terminal").and_then(|v| v.as_bool()) { current.auto_open_terminal = v; }
    if let Some(v) = body.get("sound_enabled").and_then(|v| v.as_bool()) { current.sound_enabled = v; }
    settings::update(&db, &current);
    Json(serde_json::to_value(current).unwrap())
}
