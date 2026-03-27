use std::process::Command;
use tauri::{AppHandle, Emitter};
use crate::db;
use crate::services::github;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Run a command silently (no visible terminal window on Windows)
fn silent_cmd(program: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output()
}

/// Detect GitHub repo (owner/repo) from git remote in a working directory
#[tauri::command]
pub fn github_detect_repo(working_dir: String) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(["remote", "get-url", "origin"])
        .current_dir(&working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Err("No git remote found".into());
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();

    let repo = if url.contains("github.com") {
        url.replace("https://github.com/", "")
            .replace("git@github.com:", "")
            .replace(".git", "")
            .trim_end_matches('/')
            .to_string()
    } else {
        return Err("Remote is not a GitHub repository".into());
    };

    if repo.contains('/') && repo.split('/').count() == 2 {
        Ok(repo)
    } else {
        Err(format!("Could not parse repo from: {}", url))
    }
}

/// Public access to gh token for other modules (e.g., auto-close on task done)
pub fn get_gh_token_pub() -> Result<String, String> {
    get_gh_token()
}

/// Get token from `gh auth token`
fn get_gh_token() -> Result<String, String> {
    let output = silent_cmd("gh", &["auth", "token"])
        .map_err(|_| "GitHub CLI (gh) is not installed. Install from https://cli.github.com and run: gh auth login".to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.contains("not logged") || stderr.contains("no oauth") {
            return Err("Not authenticated. Run: gh auth login".into());
        }
        return Err(format!("gh auth token failed: {}", stderr));
    }

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() {
        return Err("No token returned. Run: gh auth login".into());
    }
    Ok(token)
}

/// Check gh CLI status: installed + authenticated + repo accessible
#[tauri::command]
pub async fn github_check_status(repo: String) -> Result<serde_json::Value, String> {
    // 1. Check gh installed
    let gh_installed = silent_cmd("gh", &["--version"]).is_ok();
    if !gh_installed {
        return Ok(serde_json::json!({
            "status": "not_installed",
            "message": "GitHub CLI (gh) is not installed"
        }));
    }

    // 2. Check authenticated
    let token = match get_gh_token() {
        Ok(t) => t,
        Err(_) => {
            return Ok(serde_json::json!({
                "status": "not_authenticated",
                "message": "Not logged in. Run: gh auth login"
            }));
        }
    };

    // 3. Check repo access (async HTTP call)
    if !repo.is_empty() {
        match github::validate_token(&token, &repo).await {
            Ok(true) => {
                return Ok(serde_json::json!({
                    "status": "ready",
                    "message": "Connected",
                    "repo": repo
                }));
            }
            _ => {
                return Ok(serde_json::json!({
                    "status": "no_access",
                    "message": "Cannot access repository"
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "status": "authenticated",
        "message": "Authenticated but no repo configured"
    }))
}

/// Read project repo from DB (sync, runs in calling context)
fn get_project_repo(project_id: i64) -> Result<String, String> {
    let pool = db::get_db();
    let conn = pool.lock();
    let mut stmt = conn.prepare("SELECT github_repo FROM projects WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let repo: String = stmt.query_row([project_id], |row| {
        row.get::<_, Option<String>>(0).map(|v| v.unwrap_or_default())
    }).map_err(|e| format!("Project not found: {}", e))?;
    Ok(repo)
}

/// Get already-imported issue numbers for a project
fn get_imported_issues(project_id: i64) -> Vec<i64> {
    let pool = db::get_db();
    let conn = pool.lock();
    let mut stmt = match conn.prepare(
        "SELECT github_issue_number FROM tasks WHERE project_id = ?1 AND github_issue_number IS NOT NULL"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let result: Vec<i64> = match stmt.query_map([project_id], |row| row.get(0)) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };
    result
}

/// Fetch GitHub issues list (does NOT create tasks — just returns the list)
#[tauri::command]
pub async fn github_fetch_issues(project_id: i64) -> Result<serde_json::Value, String> {
    let repo = get_project_repo(project_id)?;
    if repo.is_empty() {
        return Err("GitHub repo not configured. Go to Project Settings > GitHub.".into());
    }

    let token = get_gh_token()?;
    let issues = github::fetch_issues(&token, &repo, "open").await?;
    let imported = get_imported_issues(project_id);

    let result: Vec<serde_json::Value> = issues.iter().map(|issue| {
        serde_json::json!({
            "number": issue.number,
            "title": issue.title,
            "body": issue.body,
            "state": issue.state,
            "html_url": issue.html_url,
            "labels": issue.labels,
            "created_at": issue.created_at,
            "updated_at": issue.updated_at,
            "already_imported": imported.contains(&issue.number),
            "suggested_type": map_labels_to_type(&issue.labels),
        })
    }).collect();

    Ok(serde_json::json!({ "issues": result, "repo": repo }))
}

/// Import selected GitHub issues as tasks (user picks which ones)
#[tauri::command]
pub async fn github_import_issues(app: AppHandle, project_id: i64, issue_numbers: Vec<i64>) -> Result<serde_json::Value, String> {
    let repo = get_project_repo(project_id)?;
    let token = get_gh_token()?;
    let issues = github::fetch_issues(&token, &repo, "open").await?;

    let pool = db::get_db();

    // Use a transaction to ensure all-or-nothing import (no partial imports on failure)
    let (imported, task_events) = db::with_transaction(&pool, |conn| {
        let mut imported = 0i64;
        let mut task_events: Vec<serde_json::Value> = Vec::new();

        for issue in &issues {
            if !issue_numbers.contains(&issue.number) { continue; }

            let exists: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM tasks WHERE project_id = ?1 AND github_issue_number = ?2",
                rusqlite::params![project_id, issue.number],
                |row| row.get(0),
            ).unwrap_or(false);
            if exists { continue; }

            let task_type = map_labels_to_type(&issue.labels);
            let description = issue.body.clone().unwrap_or_default();
            let tags = serde_json::json!(["github"]).to_string();

            conn.execute(
                "INSERT INTO tasks (project_id, title, description, status, task_type, tags, github_issue_number, github_issue_url, created_at, updated_at) VALUES (?1, ?2, ?3, 'backlog', ?4, ?5, ?6, ?7, datetime('now','localtime'), datetime('now','localtime'))",
                rusqlite::params![project_id, issue.title, description, task_type, tags, issue.number, issue.html_url],
            ).map_err(|e| e.to_string())?;

            let task_id = conn.last_insert_rowid();
            if let Ok(task_json) = conn.query_row(
                "SELECT id, project_id, title, description, status, priority, task_type, model, thinking_effort, github_issue_number, github_issue_url, tags, task_key, created_at, updated_at FROM tasks WHERE id = ?1",
                [task_id],
                |row| Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "project_id": row.get::<_, i64>(1)?,
                    "title": row.get::<_, String>(2)?,
                    "description": row.get::<_, Option<String>>(3)?,
                    "status": row.get::<_, String>(4)?,
                    "priority": row.get::<_, i64>(5)?,
                    "task_type": row.get::<_, String>(6)?,
                    "model": row.get::<_, Option<String>>(7)?,
                    "thinking_effort": row.get::<_, Option<String>>(8)?,
                    "github_issue_number": row.get::<_, Option<i64>>(9)?,
                    "github_issue_url": row.get::<_, Option<String>>(10)?,
                    "tags": row.get::<_, Option<String>>(11)?,
                    "task_key": row.get::<_, Option<String>>(12)?,
                    "created_at": row.get::<_, Option<String>>(13)?,
                    "updated_at": row.get::<_, Option<String>>(14)?,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_cost": 0.0,
                }))
            ) {
                task_events.push(task_json);
            }

            imported += 1;
        }

        Ok((imported, task_events))
    })?;

    // Emit events after transaction commits successfully
    for task_json in &task_events {
        app.emit("task:created", task_json).ok();
    }

    Ok(serde_json::json!({ "imported": imported }))
}

#[tauri::command]
pub async fn github_close_issue(project_id: i64, task_id: i64) -> Result<(), String> {
    let repo = get_project_repo(project_id)?;
    if repo.is_empty() { return Ok(()); }

    let token = get_gh_token()?;

    let issue_num: Option<i64> = {
        let pool = db::get_db();
        let conn = pool.lock();
        let mut stmt = conn.prepare("SELECT github_issue_number FROM tasks WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row([task_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
    };

    if let Some(num) = issue_num {
        github::close_issue(&token, &repo, num).await?;
    }
    Ok(())
}

fn map_labels_to_type(labels: &[github::GitHubLabel]) -> String {
    for label in labels {
        let name = label.name.to_lowercase();
        if name.contains("bug") || name.contains("fix") { return "bugfix".to_string(); }
        if name.contains("refactor") { return "refactor".to_string(); }
        if name.contains("doc") { return "docs".to_string(); }
        if name.contains("test") { return "test".to_string(); }
        if name.contains("chore") || name.contains("maintenance") { return "chore".to_string(); }
    }
    "feature".to_string()
}
