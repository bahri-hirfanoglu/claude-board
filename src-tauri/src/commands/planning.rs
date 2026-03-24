use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::{AppHandle, Emitter};
use crate::db::{self, projects as pq, tasks as tq, activity};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static ACTIVE_PLANS: Lazy<Mutex<HashMap<i64, u32>>> = Lazy::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub fn start_planning(
    app: AppHandle, project_id: i64,
    topic: String, model: Option<String>, effort: Option<String>,
    granularity: Option<String>, context: Option<String>,
) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    let project = pq::get_by_id(&db, project_id).ok_or("Project not found")?;
    if topic.trim().is_empty() { return Err("Topic is required".into()); }
    if ACTIVE_PLANS.lock().unwrap().contains_key(&project_id) {
        return Err("Planning already in progress".into());
    }

    let model = model.unwrap_or_else(|| "sonnet".into());
    let effort = effort.unwrap_or_else(|| "medium".into());
    let granularity = granularity.unwrap_or_else(|| "balanced".into());
    let plan_id = format!("plan-{}-{}", project_id, chrono::Utc::now().timestamp_millis());

    let prompt = build_planning_prompt(&topic, context.as_deref().unwrap_or(""), &project, &granularity);
    let mut args = vec![
        "-p".to_string(), prompt,
        "--output-format".to_string(), "stream-json".to_string(),
        "--verbose".to_string(),
        "--dangerously-skip-permissions".to_string(),
        "--model".to_string(), model.clone(),
    ];
    if effort != "medium" { args.extend(["--thinking-budget".to_string(), effort.clone()]); }

    let plan_id_clone = plan_id.clone();
    let working_dir = project.working_dir.clone();
    let _topic_clone = topic.clone();

    app.emit("plan:started", &serde_json::json!({
        "projectId": project_id, "planId": &plan_id, "topic": &topic, "model": &model, "effort": &effort
    })).ok();
    activity::add(&db, project_id, None, "plan_started", &format!("Planning started: {}", topic.trim()), None);

    std::thread::spawn(move || {
        log::info!("Planning: spawning claude in {}", &working_dir);
        let mut cmd = Command::new("claude");
        cmd.args(&args)
            .current_dir(&working_dir)
            .stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                app.emit("plan:completed", &serde_json::json!({
                    "projectId": project_id, "planId": &plan_id_clone,
                    "proposals": [], "error": e.to_string()
                })).ok();
                return;
            }
        };

        ACTIVE_PLANS.lock().unwrap().insert(project_id, child.id());
        log::info!("Planning: claude spawned, pid={}", child.id());

        // Drain stderr in background to prevent buffer deadlock
        let stderr = child.stderr.take().unwrap();
        let app_err = app.clone();
        let pid_clone = plan_id_clone.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let line = line.trim().to_string();
                if line.is_empty() { continue; }
                log::warn!("Planning stderr: {}", &line);
                app_err.emit("plan:log", &serde_json::json!({
                    "projectId": project_id, "planId": &pid_clone,
                    "type": "error", "message": line
                })).ok();
            }
        });

        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);
        let mut full_text = String::new();
        let mut tool_calls = 0;
        let mut turns = 0;
        let start_time = std::time::Instant::now();

        for line in reader.lines().flatten() {
            if line.trim().is_empty() { continue; }
            if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                if event.get("type").and_then(|v| v.as_str()) == Some("assistant") {
                    turns += 1;
                    if let Some(blocks) = event.pointer("/message/content").and_then(|c| c.as_array()) {
                        for block in blocks {
                            if block.get("type").and_then(|v| v.as_str()) == Some("text") {
                                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                                    full_text.push_str(text);
                                    app.emit("plan:progress", &serde_json::json!({
                                        "projectId": project_id, "planId": &plan_id_clone,
                                        "type": "text", "content": text
                                    })).ok();
                                }
                            } else if block.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                                tool_calls += 1;
                                let tool = block.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                                let input = block.get("input").cloned().unwrap_or(serde_json::Value::Object(Default::default()));
                                let detail = input.get("file_path").or(input.get("command")).or(input.get("pattern"))
                                    .and_then(|v| v.as_str()).unwrap_or("");
                                let msg = if detail.is_empty() { tool.to_string() } else { format!("{} → {}", tool, &detail[..detail.len().min(80)]) };
                                app.emit("plan:log", &serde_json::json!({
                                    "projectId": project_id, "planId": &plan_id_clone,
                                    "type": "tool", "message": msg
                                })).ok();
                            }
                        }
                    }
                }
                // Emit tool results
                if event.get("type").and_then(|v| v.as_str()) == Some("user") {
                    if let Some(blocks) = event.pointer("/message/content").and_then(|c| c.as_array()) {
                        for block in blocks {
                            if block.get("type").and_then(|v| v.as_str()) == Some("tool_result") {
                                let is_error = block.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                let preview = block.get("content").and_then(|v| v.as_str())
                                    .map(|s| s.lines().next().unwrap_or("").chars().take(100).collect::<String>())
                                    .unwrap_or_default();
                                let icon = if is_error { "✗" } else { "✓" };
                                app.emit("plan:log", &serde_json::json!({
                                    "projectId": project_id, "planId": &plan_id_clone,
                                    "type": if is_error { "error" } else { "result" },
                                    "message": format!("{} {}", icon, preview)
                                })).ok();
                            }
                        }
                    }
                }
            }
        }

        let status = child.wait().ok().and_then(|s| s.code()).unwrap_or(-1);
        ACTIVE_PLANS.lock().unwrap().remove(&project_id);
        let elapsed = start_time.elapsed().as_millis() as i64;

        // Parse tasks as PROPOSALS — don't create in DB yet
        let plan = parse_tasks_from_output(&full_text);

        app.emit("plan:completed", &serde_json::json!({
            "projectId": project_id, "planId": &plan_id_clone,
            "proposals": plan.tasks,
            "dependencies": plan.dependencies,
            "analysis": full_text,
            "stats": {"elapsed": elapsed, "toolCalls": tool_calls, "turns": turns, "exitCode": status}
        })).ok();
    });

    Ok(serde_json::json!({"planId": plan_id, "status": "started"}))
}

/// User approved the proposed tasks — create them in DB with optional dependency edges.
#[tauri::command]
pub fn approve_plan(
    app: AppHandle, project_id: i64, tasks: Vec<serde_json::Value>,
    model: Option<String>,
    dependencies: Option<Vec<Vec<i64>>>,
) -> Result<Vec<tq::Task>, String> {
    let db = db::get_db();
    if pq::get_by_id(&db, project_id).is_none() { return Err("Project not found".into()); }
    let model = model.unwrap_or_else(|| "sonnet".into());

    let mut created = Vec::new();
    for t in &tasks {
        let id = tq::create(&db, project_id,
            t.get("title").and_then(|v| v.as_str()).unwrap_or(""),
            t.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            t.get("priority").and_then(|v| v.as_i64()).unwrap_or(0),
            t.get("task_type").and_then(|v| v.as_str()).unwrap_or("feature"),
            t.get("acceptance_criteria").and_then(|v| v.as_str()).unwrap_or(""),
            &model, "medium", None,
        );
        if let Some(task) = tq::get_by_id(&db, id) {
            app.emit("task:created", &task).ok();
            created.push(task);
        }
    }

    // Create dependency edges: each entry is [parentIndex, childIndex] referencing the tasks array
    if let Some(deps) = dependencies {
        for edge in &deps {
            if edge.len() == 2 {
                let parent_idx = edge[0] as usize;
                let child_idx = edge[1] as usize;
                if parent_idx < created.len() && child_idx < created.len() {
                    let parent_id = created[parent_idx].id;
                    let child_id = created[child_idx].id;
                    db::dependencies::add_dependency(&db, child_id, parent_id).ok();
                }
            }
        }
    }

    activity::add(&db, project_id, None, "plan_completed",
        &format!("Plan approved: {} tasks created", created.len()), None);
    Ok(created)
}

#[tauri::command]
pub fn cancel_planning(app: AppHandle, project_id: i64) -> Result<(), String> {
    let pid = ACTIVE_PLANS.lock().unwrap().remove(&project_id)
        .ok_or("No active planning session")?;
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill").args(["/pid", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn().ok();
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsafe { libc::kill(pid as i32, libc::SIGTERM); }
    }
    app.emit("plan:cancelled", &serde_json::json!({"projectId": project_id})).ok();
    Ok(())
}

#[tauri::command]
pub fn get_planning_status(project_id: i64) -> serde_json::Value {
    let active = ACTIVE_PLANS.lock().unwrap().contains_key(&project_id);
    serde_json::json!({"active": active})
}

fn build_planning_prompt(topic: &str, context: &str, project: &pq::Project, granularity: &str) -> String {
    let (count, style) = match granularity {
        "high-level" => ("3-5", "Create FEW large tasks (3-5 maximum). Each task should be a major milestone. Include sub-steps as bullet points."),
        "detailed" => ("10-20", "Create detailed, atomic tasks (10-20). Each should be small and focused on a single concern."),
        _ => ("5-10", "Create a moderate number of tasks (5-10). Group related changes into single tasks."),
    };

    format!(r#"You are a technical project planner. Analyze the codebase and create a structured task breakdown.

## Project
Name: {}
Working Directory: {}

## Topic to Plan
{}

{}

## Task Granularity: {}
{}

## Instructions
1. First, explore the codebase to understand the current architecture
2. Analyze what needs to change for the requested topic
3. Write a brief analysis of your findings
4. End with a JSON code block containing the task breakdown

## CRITICAL: Output Format
End your response with a JSON code block containing tasks AND their dependency relationships:

```json
{{
  "tasks": [
    {{
      "title": "Short task title",
      "description": "Detailed description of what to implement",
      "task_type": "feature|bugfix|refactor|docs|test|chore",
      "priority": 0,
      "acceptance_criteria": "Clear definition of done"
    }}
  ],
  "dependencies": [[0, 1], [0, 2], [1, 3]]
}}
```

The `dependencies` array contains [parentIndex, childIndex] pairs where the child task depends on the parent.
Example: [0, 1] means task at index 1 depends on task at index 0 (task 0 must complete before task 1 starts).
Tasks with no dependencies can run in parallel.

Rules:
- Create {} tasks
- Descriptions should be detailed enough for Claude to implement autonomously
- Define dependency relationships between tasks
- Tasks that CAN run in parallel SHOULD have no dependency between them
- Each task should be independently executable once its dependencies are met"#,
        project.name, project.working_dir, topic.trim(),
        if context.is_empty() { String::new() } else { format!("## Additional Context\n{}", context) },
        granularity.to_uppercase(), style, count
    )
}

/// Parsed planning output: tasks + optional dependency edges.
struct ParsedPlan {
    tasks: Vec<serde_json::Value>,
    dependencies: Vec<Vec<i64>>,
}

fn parse_tasks_from_output(text: &str) -> ParsedPlan {
    let re = regex_lite::Regex::new(r"```(?:json)?\s*\n?([\s\S]*?)```").unwrap();
    let mut last_block = None;
    for cap in re.captures_iter(text) {
        last_block = Some(cap[1].trim().to_string());
    }
    let block = match last_block {
        Some(b) => b,
        None => return ParsedPlan { tasks: vec![], dependencies: vec![] },
    };

    // Try new format: { "tasks": [...], "dependencies": [...] }
    if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&block) {
        if let Some(tasks) = obj.get("tasks").and_then(|v| v.as_array()) {
            let filtered: Vec<serde_json::Value> = tasks.iter()
                .filter(|t| t.get("title").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false))
                .cloned()
                .collect();
            if !filtered.is_empty() {
                let deps = obj.get("dependencies").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().filter_map(|e| {
                        let a = e.as_array()?;
                        Some(vec![a.first()?.as_i64()?, a.get(1)?.as_i64()?])
                    }).collect()
                }).unwrap_or_default();
                return ParsedPlan { tasks: filtered, dependencies: deps };
            }
        }
    }

    // Fallback: plain array format (backward compatible, no deps)
    let tasks = match serde_json::from_str::<Vec<serde_json::Value>>(&block) {
        Ok(arr) => arr.into_iter().filter(|t| {
            t.get("title").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false)
        }).collect(),
        Err(_) => vec![],
    };
    ParsedPlan { tasks, dependencies: vec![] }
}
