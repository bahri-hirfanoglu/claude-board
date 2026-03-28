use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use parking_lot::Mutex;
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
    if ACTIVE_PLANS.lock().contains_key(&project_id) {
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
    if effort != "medium" { args.extend(["--effort".to_string(), effort.clone()]); }

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

        ACTIVE_PLANS.lock().insert(project_id, child.id());
        log::info!("Planning: claude spawned, pid={}", child.id());

        // Drain stderr in background to prevent buffer deadlock
        let stderr = match child.stderr.take() {
            Some(s) => s,
            None => { log::error!("Planning: no stderr pipe"); return; }
        };
        let app_err = app.clone();
        let pid_clone = plan_id_clone.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                let line = line.trim().to_string();
                if line.is_empty() { continue; }
                log::warn!("Planning stderr: {}", &line);
                app_err.emit("plan:log", &serde_json::json!({
                    "projectId": project_id, "planId": &pid_clone,
                    "type": "error", "message": line
                })).ok();
            }
        });

        let stdout = match child.stdout.take() {
            Some(s) => s,
            None => {
                ACTIVE_PLANS.lock().remove(&project_id);
                log::error!("Planning: no stdout pipe");
                return;
            }
        };
        let reader = BufReader::new(stdout);
        let mut full_text = String::new();
        let mut tool_calls = 0;
        let mut turns = 0;
        let mut current_phase = "starting";
        let start_time = std::time::Instant::now();

        for line in reader.lines().map_while(Result::ok) {
            if line.trim().is_empty() { continue; }
            if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                if event.get("type").and_then(|v| v.as_str()) == Some("assistant") {
                    turns += 1;
                    if let Some(blocks) = event.pointer("/message/content").and_then(|c| c.as_array()) {
                        for block in blocks {
                            if block.get("type").and_then(|v| v.as_str()) == Some("text") {
                                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                                    full_text.push_str(text);
                                    // Phase transition: exploring -> writing
                                    if current_phase == "exploring" && tool_calls > 2 {
                                        current_phase = "writing";
                                        app.emit("plan:phase", &serde_json::json!({
                                            "projectId": project_id, "phase": "writing"
                                        })).ok();
                                    }
                                    app.emit("plan:progress", &serde_json::json!({
                                        "projectId": project_id, "planId": &plan_id_clone,
                                        "type": "text", "content": text
                                    })).ok();
                                }
                            } else if block.get("type").and_then(|v| v.as_str()) == Some("thinking") {
                                if let Some(text) = block.get("thinking").and_then(|v| v.as_str()) {
                                    // Stream thinking content so UI doesn't feel frozen
                                    app.emit("plan:progress", &serde_json::json!({
                                        "projectId": project_id, "planId": &plan_id_clone,
                                        "type": "thinking", "content": text
                                    })).ok();
                                }
                            } else if block.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                                tool_calls += 1;
                                // Phase transition: starting -> exploring
                                if current_phase == "starting" {
                                    current_phase = "exploring";
                                    app.emit("plan:phase", &serde_json::json!({
                                        "projectId": project_id, "phase": "exploring"
                                    })).ok();
                                }
                                let tool = block.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                                let input = block.get("input").cloned().unwrap_or(serde_json::Value::Object(Default::default()));
                                let detail = input.get("file_path").or(input.get("command")).or(input.get("pattern"))
                                    .and_then(|v| v.as_str()).unwrap_or("");
                                let msg = if detail.is_empty() { tool.to_string() } else {
                                    let end = detail.char_indices().nth(80).map(|(i, _)| i).unwrap_or(detail.len());
                                    format!("{} → {}", tool, &detail[..end])
                                };
                                app.emit("plan:log", &serde_json::json!({
                                    "projectId": project_id, "planId": &plan_id_clone,
                                    "type": "tool", "message": msg
                                })).ok();
                            }
                        }
                    }
                }
                // Emit result stats (tokens, turns, cost)
                if event.get("type").and_then(|v| v.as_str()) == Some("result") {
                    let usage = event.get("usage").cloned().unwrap_or(serde_json::Value::Object(Default::default()));
                    let in_tok = usage.get("input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
                    let out_tok = usage.get("output_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
                    app.emit("plan:stats", &serde_json::json!({
                        "projectId": project_id,
                        "tokens": { "input": in_tok, "output": out_tok },
                        "toolCalls": tool_calls,
                        "turns": turns,
                    })).ok();
                }

                // Emit system messages (rate limits, errors)
                if event.get("type").and_then(|v| v.as_str()) == Some("system") {
                    let msg = event.get("message").and_then(|v| v.as_str()).unwrap_or("");
                    if !msg.is_empty() {
                        app.emit("plan:log", &serde_json::json!({
                            "projectId": project_id, "planId": &plan_id_clone,
                            "type": "system", "message": msg
                        })).ok();
                    }
                }

                // Emit rate limit events
                if event.get("type").and_then(|v| v.as_str()) == Some("rate_limit_event") {
                    let info = event.get("rate_limit_info").cloned().unwrap_or(serde_json::Value::Object(Default::default()));
                    let rlt = info.get("rateLimitType").and_then(|v| v.as_str()).unwrap_or("");
                    let status = info.get("status").and_then(|v| v.as_str()).unwrap_or("");
                    if status != "allowed" {
                        app.emit("plan:log", &serde_json::json!({
                            "projectId": project_id, "planId": &plan_id_clone,
                            "type": "error", "message": format!("Rate limited ({}): {}", rlt, status)
                        })).ok();
                    }
                }

                // Emit tool results
                if event.get("type").and_then(|v| v.as_str()) == Some("user") {
                    if let Some(blocks) = event.pointer("/message/content").and_then(|c| c.as_array()) {
                        for block in blocks {
                            if block.get("type").and_then(|v| v.as_str()) == Some("tool_result") {
                                let is_error = block.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                let preview = block.get("content").and_then(|v| v.as_str())
                                    .map(|s| s.lines().take(5).collect::<Vec<_>>().join("\n").chars().take(300).collect::<String>())
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
        ACTIVE_PLANS.lock().remove(&project_id);

        // Phase transition: -> done
        app.emit("plan:phase", &serde_json::json!({
            "projectId": project_id, "phase": "done"
        })).ok();
        let elapsed = start_time.elapsed().as_millis() as i64;

        log::info!("Planning: claude exited with code {}, full_text length: {}, tool_calls: {}, turns: {}", status, full_text.len(), tool_calls, turns);

        // Parse tasks as PROPOSALS — don't create in DB yet
        let plan = parse_tasks_from_output(&full_text);
        log::info!("Planning: parsed {} tasks, {} dependencies", plan.tasks.len(), plan.dependencies.len());
        if plan.tasks.is_empty() && !full_text.is_empty() {
            // Log last 500 chars to help debug parsing failures
            let tail: String = full_text.chars().rev().take(500).collect::<Vec<_>>().into_iter().rev().collect();
            log::warn!("Planning: no tasks parsed. Tail of output:\n{}", tail);
        }

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
/// Auto-generates a plan tag from the topic for filtering.
#[tauri::command]
pub fn approve_plan(
    app: AppHandle, project_id: i64, tasks: Vec<serde_json::Value>,
    model: Option<String>,
    dependencies: Option<Vec<Vec<i64>>>,
    topic: Option<String>,
) -> Result<Vec<tq::Task>, String> {
    let db = db::get_db();
    if pq::get_by_id(&db, project_id).is_none() { return Err("Project not found".into()); }
    let model = model.unwrap_or_else(|| "sonnet".into());

    // Generate plan tag from topic
    let plan_tag = topic.as_deref().map(|t| {
        let lower = t.to_lowercase();
        let words: Vec<&str> = lower
            .split(|c: char| !c.is_alphanumeric())
            .filter(|w| w.len() > 2)
            .take(3)
            .collect();
        let slug = if words.is_empty() { "plan".to_string() } else { words.join("-") };
        let slug: String = slug.chars().take(15).collect();
        format!("plan:{}", slug.trim_end_matches('-'))
    }).unwrap_or_else(|| "plan:unnamed".into());

    let mut created = Vec::new();
    for t in &tasks {
        // Merge plan tag with any proposal-level tags
        let mut task_tags = vec![plan_tag.clone()];
        if let Some(extra) = t.get("tags").and_then(|v| v.as_array()) {
            for tag in extra {
                if let Some(s) = tag.as_str() {
                    if !task_tags.contains(&s.to_string()) {
                        task_tags.push(s.to_string());
                    }
                }
            }
        }
        let tags_json = serde_json::to_string(&task_tags).unwrap_or_else(|_| "[]".into());

        let id = tq::create(&db, project_id,
            t.get("title").and_then(|v| v.as_str()).unwrap_or(""),
            t.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            t.get("priority").and_then(|v| v.as_i64()).unwrap_or(0),
            t.get("task_type").and_then(|v| v.as_str()).unwrap_or("feature"),
            t.get("acceptance_criteria").and_then(|v| v.as_str()).unwrap_or(""),
            &model, "medium", None,
            Some(&tags_json),
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
                    db::dependencies::add_dependency(&db, child_id, parent_id, None).ok();
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
    let pid = ACTIVE_PLANS.lock().remove(&project_id)
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
    let active = ACTIVE_PLANS.lock().contains_key(&project_id);
    serde_json::json!({"active": active})
}

fn build_planning_prompt(topic: &str, context: &str, project: &pq::Project, granularity: &str) -> String {
    let (count, style) = match granularity {
        "high-level" => ("3-5", "Create FEW large tasks (3-5 maximum). Each task should be a major milestone. Include sub-steps as bullet points."),
        "detailed" => ("10-20", "Create detailed, atomic tasks (10-20). Each should be small and focused on a single concern."),
        _ => ("5-10", "Create a moderate number of tasks (5-10). Group related changes into single tasks."),
    };

    format!(r#"You are a senior software architect performing a codebase analysis and task planning exercise. Your goal is to produce a precise, actionable task breakdown that another AI agent (Claude) can execute autonomously, one task at a time.

## Project
- **Name:** {}
- **Working Directory:** {}

## Planning Request
{}

{}

## Granularity: {}
{}

## Step-by-Step Process

### Step 1 — Explore
Examine the codebase structure, key files, and existing patterns. Focus on:
- Entry points and module organization
- Existing conventions (naming, error handling, testing patterns)
- Files and modules that will need to change

### Step 2 — Analyze
Identify what needs to change and what risks exist:
- Which components are affected
- What new code or files are needed
- Potential breaking changes or edge cases

### Step 3 — Plan
Write a brief summary of your findings, then produce the task breakdown as a JSON code block.

## Task Prioritization Guidelines
- **Priority 0 (highest):** Foundation work — schemas, core types, shared utilities that other tasks depend on
- **Priority 1:** Primary feature implementation — the main functional changes
- **Priority 2:** Integration and wiring — connecting components, updating routes/commands
- **Priority 3 (lowest):** Polish — tests, documentation, error handling improvements

## Parallel Execution
Tasks without dependency relationships will be executed in parallel by separate Claude agents. Maximize parallelism by only adding a dependency when one task truly cannot start until another finishes. Independent modules, separate files, and unrelated concerns should be separate parallel tasks.

## CRITICAL: Output Format
You MUST end your response with exactly one JSON code block in this format:

```json
{{
  "tasks": [
    {{
      "title": "Short, imperative task title (e.g. Add user auth middleware)",
      "description": "Detailed implementation instructions. Include specific file paths, function signatures, and expected behavior. This must be detailed enough for Claude to implement without further clarification.",
      "task_type": "feature|bugfix|refactor|docs|test|chore",
      "priority": 0,
      "acceptance_criteria": "Concrete, verifiable definition of done (e.g. 'The /api/users endpoint returns 401 for unauthenticated requests')",
      "checkpoint_type": "auto|human-verify|decision|human-action"
    }}
  ],
  "dependencies": [[0, 1], [0, 2], [1, 3]]
}}
```

### Field Reference
- **title**: Short imperative description (under 80 chars)
- **description**: Full implementation guide — file paths, logic, edge cases
- **task_type**: One of `feature`, `bugfix`, `refactor`, `docs`, `test`, `chore`
- **priority**: 0 (highest) to 3 (lowest), following the guidelines above
- **acceptance_criteria**: Testable condition that proves the task is complete
- **checkpoint_type**: One of `auto` (default, fully automated), `human-verify` (AI implements, human verifies), `decision` (human chooses between options), `human-action` (human must perform non-automatable action)
- **dependencies**: Array of `[parentIndex, childIndex]` pairs. `[0, 1]` means task 1 depends on task 0. Tasks with no dependency edges run in parallel.

### Rules
- Create {} tasks
- Every description must be self-contained — assume the implementing agent has no context beyond the task itself and access to the codebase
- Maximize parallel execution: only add dependency edges where strictly required
- Each task must be independently executable once its dependencies are complete"#,
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
    // Strategy 1: Find JSON in markdown code blocks (try all blocks, prefer ones with "tasks")
    let re = regex_lite::Regex::new(r"```(?:json)?\s*\n?([\s\S]*?)```").unwrap();
    let mut blocks: Vec<String> = vec![];
    for cap in re.captures_iter(text) {
        blocks.push(cap[1].trim().to_string());
    }

    // Try blocks in reverse (last block is most likely the final output)
    for block in blocks.iter().rev() {
        if let Some(plan) = try_parse_plan(block) {
            return plan;
        }
    }

    // Strategy 2: Find raw JSON object with "tasks" key using brace matching (no code fences)
    if let Some(plan) = find_json_in_text(text) {
        return plan;
    }

    // Strategy 3: Try to parse any JSON array in the text
    for block in blocks.iter().rev() {
        if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(block) {
            let tasks: Vec<_> = arr.into_iter().filter(|t| {
                t.get("title").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false)
            }).collect();
            if !tasks.is_empty() {
                return ParsedPlan { tasks, dependencies: vec![] };
            }
        }
    }

    ParsedPlan { tasks: vec![], dependencies: vec![] }
}

fn try_parse_plan(block: &str) -> Option<ParsedPlan> {
    let obj = serde_json::from_str::<serde_json::Value>(block).ok()?;

    // Format: { "tasks": [...], "dependencies": [...] }
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
            return Some(ParsedPlan { tasks: filtered, dependencies: deps });
        }
    }

    // Format: plain array of task objects
    if let Some(arr) = obj.as_array() {
        let tasks: Vec<_> = arr.iter()
            .filter(|t| t.get("title").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false))
            .cloned()
            .collect();
        if !tasks.is_empty() {
            return Some(ParsedPlan { tasks, dependencies: vec![] });
        }
    }

    None
}

/// Scan text for a JSON object containing "tasks" using brace-depth matching.
fn find_json_in_text(text: &str) -> Option<ParsedPlan> {
    let bytes = text.as_bytes();
    let mut i = 0;
    let mut best: Option<ParsedPlan> = None;

    while i < bytes.len() {
        if bytes[i] == b'{' {
            let start = i;
            let mut depth = 0i32;
            let mut j = i;
            while j < bytes.len() {
                if bytes[j] == b'{' { depth += 1; }
                if bytes[j] == b'}' { depth -= 1; if depth == 0 { break; } }
                j += 1;
            }
            if depth == 0 && j < bytes.len() {
                let candidate = &text[start..=j];
                if candidate.contains("\"tasks\"") {
                    if let Some(plan) = try_parse_plan(candidate) {
                        best = Some(plan);
                    }
                }
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }

    best
}
