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
#[allow(clippy::too_many_arguments)]
pub fn create_project(
    app: AppHandle,
    name: String, slug: String, working_dir: String,
    icon: Option<String>, icon_seed: Option<String>,
    permission_mode: Option<String>, allowed_tools: Option<String>,
    // Automation settings — captured at creation time so the project
    // starts with the user's choices instead of DB defaults.
    auto_queue: Option<bool>, max_concurrent: Option<i64>,
    auto_branch: Option<bool>, auto_pr: Option<bool>, auto_push: Option<bool>, pr_base_branch: Option<String>,
    auto_test: Option<bool>, test_prompt: Option<String>,
    task_timeout_minutes: Option<i64>,
    max_retries: Option<i64>,
    github_repo: Option<String>, github_sync_enabled: Option<i64>,
    max_auto_revisions: Option<i64>,
    retry_base_delay_secs: Option<i64>,
    retry_max_delay_secs: Option<i64>,
    auto_test_model: Option<String>,
    circuit_breaker_threshold: Option<i64>,
    require_approval: Option<bool>,
) -> Result<pq::Project, String> {
    let db = db::get_db();
    if name.trim().is_empty() { return Err("Name is required".into()); }
    if slug.trim().is_empty() { return Err("Slug is required".into()); }
    if working_dir.trim().is_empty() { return Err("Working directory is required".into()); }
    if pq::get_by_slug(&db, slug.trim()).is_some() { return Err("Slug already exists".into()); }

    let id = pq::create(&db, name.trim(), slug.trim(), working_dir.trim(),
        icon.as_deref(), icon_seed.as_deref(), permission_mode.as_deref(), allowed_tools.as_deref());

    // Persist any settings the user chose at creation time. Each helper is only
    // called when at least one of its grouped fields is provided, so DB defaults
    // remain in place for anything not set.
    if auto_queue.is_some() || max_concurrent.is_some() {
        pq::update_queue(&db, id, auto_queue.unwrap_or(false), max_concurrent.unwrap_or(1));
    }
    if auto_branch.is_some() || auto_pr.is_some() || auto_push.is_some() || pr_base_branch.is_some() {
        pq::update_git_settings(&db, id,
            auto_branch.unwrap_or(true),
            auto_pr.unwrap_or(false),
            auto_push.unwrap_or(false),
            pr_base_branch.as_deref().unwrap_or("main"));
    }
    if auto_test.is_some() || test_prompt.is_some() {
        pq::update_test_settings(&db, id, auto_test.unwrap_or(false), test_prompt.as_deref().unwrap_or(""));
    }
    if let Some(timeout) = task_timeout_minutes {
        pq::update_timeout(&db, id, timeout);
    }
    if let Some(retries) = max_retries {
        pq::update_max_retries(&db, id, retries);
    }
    if github_repo.is_some() || github_sync_enabled.is_some() {
        pq::update_github_settings(&db, id,
            github_repo.as_deref().unwrap_or(""),
            github_sync_enabled.unwrap_or(0) == 1);
    }
    if max_auto_revisions.is_some() || retry_base_delay_secs.is_some() || retry_max_delay_secs.is_some() || auto_test_model.is_some() {
        pq::update_engine_settings(&db, id,
            max_auto_revisions.unwrap_or(0),
            retry_base_delay_secs.unwrap_or(0),
            retry_max_delay_secs.unwrap_or(0),
            auto_test_model.as_deref().unwrap_or(""));
    }
    if let Some(threshold) = circuit_breaker_threshold {
        pq::update_circuit_breaker_settings(&db, id, threshold);
    }
    if let Some(approval) = require_approval {
        pq::update_approval_settings(&db, id, approval);
    }

    let project = pq::get_by_id(&db, id).ok_or("Failed to retrieve created project")?;
    app.emit("project:created", &project).ok();
    activity::add(&db, project.id, None, "project_created", &format!("Project created: {}", project.name), None);
    Ok(project)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_project(
    app: AppHandle, id: i64,
    name: Option<String>, slug: Option<String>, working_dir: Option<String>,
    icon: Option<String>, icon_seed: Option<String>,
    permission_mode: Option<String>, allowed_tools: Option<String>,
    auto_queue: Option<bool>, max_concurrent: Option<i64>,
    auto_branch: Option<bool>, auto_pr: Option<bool>, auto_push: Option<bool>, pr_base_branch: Option<String>,
    auto_test: Option<bool>, test_prompt: Option<String>,
    task_timeout_minutes: Option<i64>,
    max_retries: Option<i64>,
    github_repo: Option<String>, github_sync_enabled: Option<i64>,
    max_auto_revisions: Option<i64>,
    retry_base_delay_secs: Option<i64>,
    retry_max_delay_secs: Option<i64>,
    auto_test_model: Option<String>,
    circuit_breaker_threshold: Option<i64>,
    require_approval: Option<bool>,
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
    if auto_test.is_some() || test_prompt.is_some() {
        pq::update_test_settings(&db, id,
            auto_test.unwrap_or(project.auto_test.unwrap_or(0) == 1),
            test_prompt.as_deref().unwrap_or(project.test_prompt.as_deref().unwrap_or("")));
    }
    if let Some(timeout) = task_timeout_minutes {
        pq::update_timeout(&db, id, timeout);
    }
    if let Some(retries) = max_retries {
        pq::update_max_retries(&db, id, retries);
    }
    if auto_branch.is_some() || auto_pr.is_some() || auto_push.is_some() || pr_base_branch.is_some() {
        pq::update_git_settings(&db, id,
            auto_branch.unwrap_or(project.auto_branch.unwrap_or(1) == 1),
            auto_pr.unwrap_or(project.auto_pr.unwrap_or(0) == 1),
            auto_push.unwrap_or(project.auto_push.unwrap_or(0) == 1),
            pr_base_branch.as_deref().unwrap_or(project.pr_base_branch.as_deref().unwrap_or("main")));
    }
    if github_repo.is_some() || github_sync_enabled.is_some() {
        pq::update_github_settings(&db, id,
            github_repo.as_deref().unwrap_or(project.github_repo.as_deref().unwrap_or("")),
            github_sync_enabled.unwrap_or(project.github_sync_enabled.unwrap_or(0)) == 1);
    }
    if max_auto_revisions.is_some() || retry_base_delay_secs.is_some() || retry_max_delay_secs.is_some() || auto_test_model.is_some() {
        pq::update_engine_settings(&db, id,
            max_auto_revisions.unwrap_or(project.max_auto_revisions.unwrap_or(0)),
            retry_base_delay_secs.unwrap_or(project.retry_base_delay_secs.unwrap_or(0)),
            retry_max_delay_secs.unwrap_or(project.retry_max_delay_secs.unwrap_or(0)),
            auto_test_model.as_deref().unwrap_or(project.auto_test_model.as_deref().unwrap_or("")));
    }

    if let Some(threshold) = circuit_breaker_threshold {
        pq::update_circuit_breaker_settings(&db, id, threshold);
    }
    if let Some(approval) = require_approval {
        pq::update_approval_settings(&db, id, approval);
    }

    let updated = pq::get_by_id(&db, id).ok_or("Failed to retrieve updated project")?;
    app.emit("project:updated", &updated).ok();
    Ok(updated)
}

#[tauri::command]
pub fn reset_circuit_breaker(app: AppHandle, id: i64) -> Result<pq::Project, String> {
    let db = db::get_db();
    pq::deactivate_circuit_breaker(&db, id);
    let updated = pq::get_by_id(&db, id).ok_or("Project not found")?;
    app.emit("project:circuit_breaker", &serde_json::json!({"projectId": id, "active": false})).ok();
    app.emit("project:updated", &updated).ok();
    // Restart queue after circuit breaker reset
    crate::services::queue::start_next_queued(&db, &app, id);
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

#[tauri::command]
pub async fn get_project_groups() -> Vec<serde_json::Value> {
  tauri::async_runtime::spawn_blocking(get_project_groups_sync).await.unwrap_or_default()
}

fn get_project_groups_sync() -> Vec<serde_json::Value> {
    let db = db::get_db();
    let projects = pq::get_all(&db);
    let mut groups: std::collections::BTreeMap<String, Vec<serde_json::Value>> = std::collections::BTreeMap::new();

    for p in &projects {
        let namespace = detect_namespace(&p.working_dir);
        groups.entry(namespace).or_default().push(serde_json::json!({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
        }));
    }

    groups.into_iter().map(|(ns, projs)| serde_json::json!({
        "namespace": ns,
        "projects": projs,
        "count": projs.len(),
    })).collect()
}

fn detect_namespace(working_dir: &str) -> String {
    // Try git remote first
    if let Some(ns) = git_namespace(working_dir) {
        return ns;
    }
    // Fallback: parent directory name
    std::path::Path::new(working_dir)
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Other".into())
}

fn git_namespace(working_dir: &str) -> Option<String> {
    let mut cmd = std::process::Command::new("git");
    cmd.args(["remote", "get-url", "origin"])
        .current_dir(working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let output = cmd.output().ok()?;
    if !output.status.success() { return None; }
    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    parse_git_namespace(&url)
}

fn parse_git_namespace(url: &str) -> Option<String> {
    // https://github.com/org/repo.git -> org
    // git@github.com:org/repo.git -> org
    // https://gitlab.com/group/subgroup/repo.git -> group/subgroup
    if let Some(rest) = url.strip_prefix("https://").or_else(|| url.strip_prefix("http://")) {
        let parts: Vec<&str> = rest.splitn(2, '/').collect();
        if parts.len() == 2 {
            let path = parts[1].trim_end_matches(".git");
            let segments: Vec<&str> = path.split('/').collect();
            if segments.len() >= 2 {
                return Some(segments[..segments.len() - 1].join("/"));
            }
        }
    }
    if let Some(rest) = url.split(':').nth(1) {
        let path = rest.trim_end_matches(".git");
        let segments: Vec<&str> = path.split('/').collect();
        if segments.len() >= 2 {
            return Some(segments[..segments.len() - 1].join("/"));
        }
    }
    None
}
