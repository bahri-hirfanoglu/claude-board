use std::process::{Command, Stdio};
use crate::db::{self, projects, tasks};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Send a one-shot chat message to Claude CLI and return the text response.
/// Runs in the project's working directory with read-only context.
#[tauri::command]
pub async fn chat_send(
    project_id: i64,
    message: String,
    model: Option<String>,
) -> Result<String, String> {
    let db = db::get_db();
    let project = projects::get_by_id(&db, project_id).ok_or("Project not found")?;

    // Build context about current project state
    let all_tasks = tasks::get_by_project(&db, project_id);
    let running: Vec<_> = all_tasks.iter().filter(|t| t.status.as_deref() == Some("in_progress")).collect();
    let backlog: Vec<_> = all_tasks.iter().filter(|t| t.status.as_deref() == Some("backlog")).collect();
    let done: Vec<_> = all_tasks.iter().filter(|t| t.status.as_deref() == Some("done")).collect();
    let failed: Vec<_> = all_tasks.iter().filter(|t| t.status.as_deref() == Some("failed")).collect();

    let task_summary: String = all_tasks.iter().take(30).map(|t| {
        format!("- [{}] {} ({})", t.task_key.as_deref().unwrap_or(""), t.title, t.status.as_deref().unwrap_or("backlog"))
    }).collect::<Vec<_>>().join("\n");

    let system_context = format!(
        r#"You are Claude Board's AI assistant. You help users manage their development tasks.

## Current Project: {}
- Working directory: {}
- Tasks: {} total ({} running, {} queued, {} done, {} failed)

## Task List
{}

## Rules
- Answer concisely. Be helpful and direct.
- When asked to summarize, analyze tasks and their statuses.
- You can suggest task management actions but cannot execute them.
- Use markdown formatting for readability."#,
        project.name, project.working_dir,
        all_tasks.len(), running.len(), backlog.len(), done.len(), failed.len(),
        task_summary,
    );

    let prompt = format!("{}\n\n## User Message\n{}", system_context, message);
    let model_str = model.unwrap_or_else(|| "sonnet".to_string());

    // Run Claude CLI in one-shot mode
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("claude");
        cmd.args(["-p", &prompt, "--model", &model_str, "--output-format", "text"])
            .current_dir(&project.working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| format!("Failed to run Claude CLI: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Claude CLI error: {}", stderr.trim()))
        }
    }).await.map_err(|e| format!("Task join error: {}", e))?;

    result
}
