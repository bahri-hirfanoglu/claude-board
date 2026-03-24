use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use crate::db::{self, DbPool};
use crate::db::{tasks, snippets, attachments, roles, projects, activity};
use super::events::{EventContext, UsageTracker, UsageBaseline, UsageSession};
use super::prompt::build_prompt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

type ProcessMap = Arc<Mutex<HashMap<i64, u32>>>;
type StartingSet = Arc<Mutex<HashSet<i64>>>;

static ACTIVE_PROCESSES: once_cell::sync::Lazy<ProcessMap> = once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
static STARTING_TASKS: once_cell::sync::Lazy<StartingSet> = once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(HashSet::new())));
static EVENT_CTX: once_cell::sync::Lazy<EventContext> = once_cell::sync::Lazy::new(EventContext::new);

pub fn is_running(task_id: i64) -> bool {
    ACTIVE_PROCESSES.lock().unwrap().contains_key(&task_id)
}

pub fn stop(task_id: i64, db: &DbPool, app: &AppHandle) {
    if let Some(pid) = ACTIVE_PROCESSES.lock().unwrap().remove(&task_id) {
        kill_process(pid);
        STARTING_TASKS.lock().unwrap().remove(&task_id);
        EVENT_CTX.task_usage.lock().unwrap().remove(&task_id);
        tasks::add_log(db, task_id, "Claude process stopped by user.", "system", None);
        app.emit("task:log", &serde_json::json!({
            "taskId": task_id, "message": "Claude process stopped by user.", "logType": "system"
        })).ok();
    }
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill")
            .args(["/pid", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn().ok();
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsafe { libc::kill(pid as i32, libc::SIGTERM); }
    }
}

fn generate_branch_slug(title: &str) -> String {
    title
        .to_lowercase()
        .replace(['ç', 'Ç'], "c").replace(['ğ', 'Ğ'], "g")
        .replace(['ı', 'İ'], "i").replace(['ö', 'Ö'], "o")
        .replace(['ş', 'Ş'], "s").replace(['ü', 'Ü'], "u")
        .chars().filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-').collect::<String>()
        .trim().replace(char::is_whitespace, "-")
        .replace("--", "-").trim_matches('-').to_string()
        .chars().take(40).collect::<String>()
        .trim_end_matches('-').to_string()
}

fn ensure_task_branch(task: &tasks::Task, working_dir: &str, project: &projects::Project, db: &DbPool, app: &AppHandle) -> Option<String> {
    if project.auto_branch.unwrap_or(1) == 0 { return None; }
    let is_revision = task.revision_count.unwrap_or(0) > 0;
    let slug = generate_branch_slug(&task.title);
    let slug = if slug.is_empty() { format!("task-{}", task.id) } else { slug };
    let branch_name = task.branch_name.clone().unwrap_or_else(|| {
        format!("{}/{}", task.task_type.as_deref().unwrap_or("feature"), slug)
    });

    let exec = |cmd: &str| -> Result<String, String> {
        let mut c = Command::new("git");
        c.args(cmd.split_whitespace())
            .current_dir(working_dir)
            .stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        c.creation_flags(CREATE_NO_WINDOW);
        let output = c.output().map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    };

    if exec("rev-parse --is-inside-work-tree").is_err() { return None; }

    let git_hidden = |args: &[&str], dir: &str| -> std::io::Result<std::process::Output> {
        let mut c = Command::new("git");
        c.args(args).current_dir(dir).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        c.creation_flags(CREATE_NO_WINDOW);
        c.output()
    };

    if is_revision && task.branch_name.is_some() {
        let bn = task.branch_name.as_deref().unwrap();
        if let Ok(current) = exec("branch --show-current") {
            if current != bn {
                let _ = git_hidden(&["checkout", bn], working_dir);
            }
        }
    } else {
        let base = project.pr_base_branch.as_deref().unwrap_or("main");
        if exec(&format!("rev-parse --verify {}", branch_name)).is_ok() {
            let _ = git_hidden(&["checkout", &branch_name], working_dir);
        } else if git_hidden(&["checkout", "-b", &branch_name, base], working_dir).is_err() {
            let _ = git_hidden(&["checkout", "-b", &branch_name], working_dir);
        }
    }

    tasks::update_branch(db, task.id, &branch_name);
    let _ = app;
    Some(branch_name)
}

fn scan_git_info(working_dir: &str, task_id: i64, db: &DbPool) {
    let exec = |args: &[&str]| -> Option<String> {
        let mut cmd = Command::new("git");
        cmd.args(args).current_dir(working_dir)
            .stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.output().ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    };

    let log_output = exec(&["log", "--oneline", "-10", "--no-merges", "--format=%H|%h|%s|%an|%ai"]).unwrap_or_default();
    let commits: Vec<serde_json::Value> = log_output.lines().filter(|l| !l.is_empty()).map(|line| {
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        serde_json::json!({
            "hash": parts.first().unwrap_or(&""),
            "short": parts.get(1).unwrap_or(&""),
            "message": parts.get(2).unwrap_or(&""),
            "author": parts.get(3).unwrap_or(&""),
            "date": parts.get(4).unwrap_or(&""),
        })
    }).collect();

    let diff_stat = exec(&["diff", "--stat", "HEAD~1..HEAD"]);
    let pr_url = exec(&["branch", "--show-current"]).and_then(|branch| {
        if branch == "main" || branch == "master" { return None; }
        exec(&["gh", "pr", "view", &branch, "--json", "url", "--jq", ".url"])
            .filter(|u| u.starts_with("http"))
    });

    let commits_json = serde_json::to_string(&commits).unwrap_or_else(|_| "[]".into());
    tasks::update_git_info(db, task_id, &commits_json, pr_url.as_deref(), diff_stat.as_deref());
}

/// Copy task attachments from uploads dir to working dir for Claude access.
fn copy_task_attachments(task_id: i64, working_dir: &str, db: &DbPool) -> (Vec<attachments::Attachment>, std::path::PathBuf) {
    let task_attachments = attachments::get_by_task(db, task_id);
    let uploads_dir = db::get_data_dir().parent().map(|p| p.join("uploads")).unwrap_or_default();
    let attach_dir = Path::new(working_dir).join(".claude-attachments");

    if !task_attachments.is_empty() {
        std::fs::create_dir_all(&attach_dir).ok();
        for a in &task_attachments {
            let src = uploads_dir.join(&a.filename);
            let dest = attach_dir.join(&a.filename);
            if src.exists() { std::fs::copy(&src, &dest).ok(); }
        }
    }

    (task_attachments, attach_dir)
}

/// Build Claude CLI arguments from task configuration.
fn build_claude_args(
    prompt: &str,
    model: &str,
    effort: &str,
    permission_mode: &str,
    allowed_tools: &str,
    mcp_server_port: u16,
) -> Vec<String> {
    let mut args = vec![
        "-p".to_string(), prompt.to_string(),
        "--output-format".to_string(), "stream-json".to_string(),
        "--verbose".to_string(),
        "--model".to_string(), model.to_string(),
    ];

    // MCP config
    let mcp_server_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("mcp-server.js").to_string_lossy().to_string()))
        .unwrap_or_default();

    let mcp_config = serde_json::json!({
        "mcpServers": {
            "claude-board": {
                "command": "node",
                "args": [mcp_server_path],
                "env": { "CLAUDE_BOARD_URL": format!("http://localhost:{}", mcp_server_port) }
            }
        }
    });
    args.extend(["--mcp-config".to_string(), mcp_config.to_string()]);

    // Permission mode
    if permission_mode == "auto-accept" {
        args.push("--dangerously-skip-permissions".to_string());
    } else if permission_mode == "allow-tools" {
        let tools: Vec<&str> = allowed_tools.split(',').map(|t| t.trim()).filter(|t| !t.is_empty()).collect();
        if tools.is_empty() {
            args.push("--dangerously-skip-permissions".to_string());
        } else {
            for t in tools { args.extend(["--allowedTools".to_string(), t.to_string()]); }
        }
    }

    if effort != "medium" {
        args.extend(["--thinking-budget".to_string(), effort.to_string()]);
    }

    args
}

/// Handle process output, track events, and update task state on completion.
fn handle_process_lifecycle(
    task_id: i64,
    mut child: std::process::Child,
    db: &DbPool,
    app: &AppHandle,
    working_dir: &str,
    project_id: i64,
    task_title: &str,
    attach_dir: &Path,
) {
    let pid = child.id();
    ACTIVE_PROCESSES.lock().unwrap().insert(task_id, pid);
    STARTING_TASKS.lock().unwrap().remove(&task_id);

    // Read stdout (safe: we configured Stdio::piped)
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            if line.trim().is_empty() { continue; }
            match serde_json::from_str::<serde_json::Value>(&line) {
                Ok(event) => super::events::handle_event(task_id, &event, db, app, &EVENT_CTX),
                Err(_) => { tasks::add_log(db, task_id, &line, "claude", None); }
            }
        }
    }

    let status = child.wait().ok().and_then(|s| s.code()).unwrap_or(-1);

    // Cleanup process tracking
    ACTIVE_PROCESSES.lock().unwrap().remove(&task_id);
    STARTING_TASKS.lock().unwrap().remove(&task_id);
    EVENT_CTX.task_usage.lock().unwrap().remove(&task_id);

    if status == 0 {
        scan_git_info(working_dir, task_id, db);
        tasks::add_log(db, task_id, "Claude finished successfully.", "success", None);
        tasks::update_status(db, task_id, "testing");
        tasks::set_completed(db, task_id);
        if let Some(updated) = tasks::get_by_id(db, task_id) {
            app.emit("task:updated", &updated).ok();
        }
        activity::add(db, project_id, Some(task_id), "task_completed", &format!("Task completed: {}", task_title), None);
    } else {
        tasks::add_log(db, task_id, &format!("Claude exited with code {}.", status), "error", None);
        activity::add(db, project_id, Some(task_id), "task_failed", &format!("Task failed (exit {}): {}", status, task_title), None);
        crate::services::queue::handle_task_failure(db, app, project_id, task_id);
    }

    // Cleanup attachments
    if attach_dir.exists() {
        std::fs::remove_dir_all(attach_dir).ok();
    }

    app.emit("claude:finished", &serde_json::json!({"taskId": task_id, "exitCode": status})).ok();
}

pub fn start(
    task: &tasks::Task,
    app: AppHandle,
    working_dir: &str,
    project: &projects::Project,
    mcp_server_port: u16,
) {
    let task_id = task.id;
    let db = db::get_db();

    if is_running(task_id) || STARTING_TASKS.lock().unwrap().contains(&task_id) {
        return;
    }
    STARTING_TASKS.lock().unwrap().insert(task_id);

    // Copy attachments to working dir
    let (task_attachments, attach_dir) = copy_task_attachments(task_id, working_dir, &db);

    let revisions = tasks::get_revisions(&db, task_id);
    let enabled_snippets = snippets::get_enabled_by_project(&db, task.project_id);
    let role = task.role_id.and_then(|rid| roles::get_by_id(&db, rid));

    let prompt = build_prompt(task, &revisions, &enabled_snippets, &task_attachments, role.as_ref(), task.project_id);
    let model = task.model.as_deref().unwrap_or("sonnet");
    let effort = task.thinking_effort.as_deref().unwrap_or("medium");
    let permission_mode = project.permission_mode.as_deref().unwrap_or("auto-accept");
    let allowed_tools = project.allowed_tools.as_deref().unwrap_or("");

    // Snapshot baseline usage
    if let Some(current) = tasks::get_by_id(&db, task_id) {
        EVENT_CTX.task_usage.lock().unwrap().insert(task_id, UsageTracker {
            baseline: UsageBaseline {
                input: current.input_tokens.unwrap_or(0),
                output: current.output_tokens.unwrap_or(0),
                cache_read: current.cache_read_tokens.unwrap_or(0),
                cache_creation: current.cache_creation_tokens.unwrap_or(0),
                cost: current.total_cost.unwrap_or(0.0),
            },
            session: UsageSession::default(),
        });
    }

    // Auto-create branch
    let mut task_clone = task.clone();
    if let Some(branch) = ensure_task_branch(task, working_dir, project, &db, &app) {
        task_clone.branch_name = Some(branch);
    }

    tasks::add_log(&db, task_id, &format!("Starting Claude for task: {}", task.title), "system", None);
    tasks::add_log(&db, task_id, &format!("Model: {} | Effort: {} | Permissions: {}", model, effort, permission_mode), "info", None);
    activity::add(&db, task.project_id, Some(task_id), "claude_started", &format!("Claude started: {}", task.title), None);

    // Build CLI arguments
    let args = build_claude_args(&prompt, model, effort, permission_mode, allowed_tools, mcp_server_port);

    let working_dir = working_dir.to_string();
    let project_id = task.project_id;
    let task_title = task.title.clone();

    std::thread::spawn(move || {
        let mut cmd = Command::new("claude");
        cmd.args(&args)
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let db = db::get_db();
                tasks::add_log(&db, task_id, &format!("Failed to start Claude: {}", e), "error", None);
                STARTING_TASKS.lock().unwrap().remove(&task_id);
                app.emit("claude:finished", &serde_json::json!({"taskId": task_id, "exitCode": -1})).ok();
                return;
            }
        };

        let db = db::get_db();
        handle_process_lifecycle(task_id, child, &db, &app, &working_dir, project_id, &task_title, &attach_dir);
    });
}
