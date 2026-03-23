use serde_json::Value;
use tauri::{AppHandle, Emitter};
use crate::db::{self, DbPool};
use crate::db::tasks;
use crate::db::stats;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct UsageTracker {
    pub baseline: UsageBaseline,
    pub session: UsageSession,
}

pub struct UsageBaseline {
    pub input: i64,
    pub output: i64,
    pub cache_read: i64,
    pub cache_creation: i64,
    pub cost: f64,
}

#[derive(Default)]
pub struct UsageSession {
    pub input: i64,
    pub output: i64,
    pub cache_read: i64,
    pub cache_creation: i64,
}

pub struct ToolCall {
    pub task_id: i64,
    pub tool_name: String,
    pub start_time: std::time::Instant,
}

pub struct EventContext {
    pub task_usage: Mutex<HashMap<i64, UsageTracker>>,
    pub active_tool_calls: Mutex<HashMap<String, ToolCall>>,
}

impl EventContext {
    pub fn new() -> Self {
        Self {
            task_usage: Mutex::new(HashMap::new()),
            active_tool_calls: Mutex::new(HashMap::new()),
        }
    }
}

pub fn handle_event(
    task_id: i64,
    event: &Value,
    db: &DbPool,
    app: &AppHandle,
    ctx: &EventContext,
) {
    let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match event_type {
        "assistant" => handle_assistant(task_id, event, db, app, ctx),
        "user" => handle_user(task_id, event, db, app, ctx),
        "result" => handle_result(task_id, event, db, app, ctx),
        "system" => handle_system(task_id, event, db, app),
        "rate_limit_event" => handle_rate_limit(task_id, event, db, app),
        _ => {}
    }
}

fn add_log(task_id: i64, message: &str, log_type: &str, db: &DbPool, app: &AppHandle, meta: Option<&str>) {
    tasks::add_log(db, task_id, message, log_type, meta);
    let payload = serde_json::json!({
        "taskId": task_id,
        "message": message,
        "logType": log_type,
        "created_at": chrono::Local::now().to_rfc3339(),
    });
    app.emit("task:log", &payload).ok();
}

fn handle_assistant(task_id: i64, event: &Value, db: &DbPool, app: &AppHandle, ctx: &EventContext) {
    let content = event.pointer("/message/content");
    if let Some(blocks) = content.and_then(|c| c.as_array()) {
        for block in blocks {
            let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
            match block_type {
                "text" => {
                    if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                        add_log(task_id, text, "claude", db, app, None);
                    }
                }
                "tool_use" => {
                    let tool_name = block.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let tool_id = block.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    let input = block.get("input").cloned().unwrap_or(Value::Object(Default::default()));

                    let mut display = format!("Tool: {}", tool_name);
                    if let Some(f) = input.get("file_path").or(input.get("path")).and_then(|v| v.as_str()) {
                        display = format!("{} → {}", display, f);
                    } else if let Some(c) = input.get("command").and_then(|v| v.as_str()) {
                        display = format!("{} → {}", display, &c[..c.len().min(120)]);
                    } else if let Some(p) = input.get("pattern").and_then(|v| v.as_str()) {
                        display = format!("{} → {}", display, p);
                    }

                    let meta = serde_json::json!({"toolName": tool_name, "toolId": tool_id}).to_string();
                    add_log(task_id, &display, "tool", db, app, Some(&meta));

                    if !tool_id.is_empty() {
                        ctx.active_tool_calls.lock().unwrap().insert(tool_id.to_string(), ToolCall {
                            task_id,
                            tool_name: tool_name.to_string(),
                            start_time: std::time::Instant::now(),
                        });
                    }
                }
                _ => {}
            }
        }
    }

    // Usage tracking
    if let Some(usage) = event.pointer("/message/usage") {
        let mut trackers = ctx.task_usage.lock().unwrap();
        if let Some(tracker) = trackers.get_mut(&task_id) {
            tracker.session.input += usage.get("input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
            tracker.session.output += usage.get("output_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
            tracker.session.cache_read += usage.get("cache_read_input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
            tracker.session.cache_creation += usage.get("cache_creation_input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);

            let total_input = tracker.baseline.input + tracker.session.input;
            let total_output = tracker.baseline.output + tracker.session.output;
            let total_cr = tracker.baseline.cache_read + tracker.session.cache_read;
            let total_cc = tracker.baseline.cache_creation + tracker.session.cache_creation;
            let total_cost = tracker.baseline.cost;

            let model_used = event.pointer("/message/model").and_then(|v| v.as_str()).unwrap_or("");
            tasks::set_usage_live(db, task_id, total_input, total_output, total_cr, total_cc, total_cost, model_used);

            app.emit("task:usage", &serde_json::json!({
                "taskId": task_id,
                "input_tokens": total_input,
                "output_tokens": total_output,
                "cache_read_tokens": total_cr,
                "cache_creation_tokens": total_cc,
                "total_tokens": total_input + total_output,
                "total_cost": total_cost,
            })).ok();
        }
    }
}

fn handle_user(task_id: i64, event: &Value, db: &DbPool, app: &AppHandle, ctx: &EventContext) {
    let content = event.pointer("/message/content");
    if let Some(blocks) = content.and_then(|c| c.as_array()) {
        for block in blocks {
            if block.get("type").and_then(|v| v.as_str()) == Some("tool_result") {
                let tool_id = block.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("");
                let tracked = ctx.active_tool_calls.lock().unwrap().remove(tool_id);
                let duration = tracked.as_ref().map(|t| t.start_time.elapsed().as_millis() as i64);
                let tool_name = tracked.as_ref().map(|t| t.tool_name.as_str()).unwrap_or("unknown");
                let is_error = block.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);

                let result_preview = if let Some(s) = block.get("content").and_then(|v| v.as_str()) {
                    s[..s.len().min(500)].to_string()
                } else {
                    String::new()
                };

                let icon = if is_error { "✗" } else { "✓" };
                let dur_str = duration.map(|d| format!(" ({}ms)", d)).unwrap_or_default();
                let first_line = result_preview.lines().next().unwrap_or("").chars().take(120).collect::<String>();
                let display = if first_line.trim().is_empty() {
                    format!("{} {}{}", icon, tool_name, dur_str)
                } else {
                    format!("{} {}{} — {}", icon, tool_name, dur_str, first_line)
                };

                let lt = if is_error { "error" } else { "tool_result" };
                add_log(task_id, &display, lt, db, app, None);
            }
        }
    }
}

fn handle_result(task_id: i64, event: &Value, db: &DbPool, app: &AppHandle, ctx: &EventContext) {
    let usage = event.get("usage").cloned().unwrap_or(Value::Object(Default::default()));
    let session_input = usage.get("input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
    let session_output = usage.get("output_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
    let session_cr = usage.get("cache_read_input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
    let session_cc = usage.get("cache_creation_input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
    let total_cost = event.get("total_cost").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let num_turns = event.get("num_turns").and_then(|v| v.as_i64()).unwrap_or(0);
    let duration_ms = event.get("duration_ms").and_then(|v| v.as_i64()).unwrap_or(0);
    let model_used = event.get("model").and_then(|v| v.as_str()).unwrap_or("");
    let session_id = event.get("session_id").and_then(|v| v.as_str()).unwrap_or("");

    let trackers = ctx.task_usage.lock().unwrap();
    let base = trackers.get(&task_id).map(|t| &t.baseline);
    let bi = base.map(|b| b.input).unwrap_or(0);
    let bo = base.map(|b| b.output).unwrap_or(0);
    let bcr = base.map(|b| b.cache_read).unwrap_or(0);
    let bcc = base.map(|b| b.cache_creation).unwrap_or(0);
    let bc = base.map(|b| b.cost).unwrap_or(0.0);
    drop(trackers);

    let fin_input = bi + session_input;
    let fin_output = bo + session_output;
    let fin_cr = bcr + session_cr;
    let fin_cc = bcc + session_cc;
    let fin_cost = bc + total_cost;

    if session_input > 0 || session_output > 0 {
        tasks::set_usage_live(db, task_id, fin_input, fin_output, fin_cr, fin_cc, fin_cost, model_used);
        if num_turns > 0 { tasks::update_num_turns(db, task_id, num_turns); }
        if !session_id.is_empty() { tasks::update_claude_session(db, task_id, session_id); }

        let cost_str = if total_cost > 0.0 { format!(" | Cost: ${:.4}", total_cost) } else { String::new() };
        let dur_str = if duration_ms > 0 { format!(" | Duration: {}s", duration_ms / 1000) } else { String::new() };
        let msg = format!(
            "Usage: {} tokens ({} in / {} out){} | Turns: {}{} | Model: {}",
            session_input + session_output, session_input, session_output, cost_str, num_turns, dur_str, model_used
        );
        add_log(task_id, &msg, "system", db, app, None);

        if let Some(updated) = tasks::get_by_id(db, task_id) {
            app.emit("task:updated", &updated).ok();
            app.emit("task:usage", &serde_json::json!({
                "taskId": task_id,
                "input_tokens": fin_input, "output_tokens": fin_output,
                "cache_read_tokens": fin_cr, "cache_creation_tokens": fin_cc,
                "total_tokens": fin_input + fin_output, "total_cost": fin_cost,
            })).ok();
        }
    }

    // Save model limits
    if let Some(model_usage) = event.get("modelUsage").and_then(|v| v.as_object()) {
        if let Some((first_model, mu)) = model_usage.iter().next() {
            stats::upsert_claude_limits(
                &db::get_db(), "", "allowed", 0, "", false,
                first_model, event.get("total_cost_usd").and_then(|v| v.as_f64()).unwrap_or(total_cost),
                mu.get("contextWindow").and_then(|v| v.as_i64()).unwrap_or(0),
                mu.get("maxOutputTokens").and_then(|v| v.as_i64()).unwrap_or(0),
            );
        }
    }

    if let Some(result) = event.get("result").and_then(|v| v.as_str()) {
        let preview = &result[..result.len().min(500)];
        add_log(task_id, &format!("Result: {}", preview), "success", db, app, None);
    }
}

fn handle_system(task_id: i64, event: &Value, db: &DbPool, app: &AppHandle) {
    let subtype = event.get("subtype").and_then(|v| v.as_str()).unwrap_or("");
    if subtype == "hook_started" || subtype == "hook_response" { return; }
    if subtype == "init" {
        let tools = event.get("tools").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
        add_log(task_id, &format!("Session initialized ({} tools available)", tools), "system", db, app, None);
        return;
    }
    let msg = event.get("message").and_then(|v| v.as_str()).unwrap_or("");
    if !msg.is_empty() {
        let lower = msg.to_lowercase();
        if lower.contains("rate limit") || lower.contains("429") || lower.contains("overloaded") {
            tasks::increment_rate_limit_hits(db, task_id);
        }
        add_log(task_id, msg, "system", db, app, None);
    }
}

fn handle_rate_limit(task_id: i64, event: &Value, db: &DbPool, app: &AppHandle) {
    let info = event.get("rate_limit_info").cloned().unwrap_or(Value::Object(Default::default()));
    let rlt = info.get("rateLimitType").and_then(|v| v.as_str()).unwrap_or("");
    let status = info.get("status").and_then(|v| v.as_str()).unwrap_or("");
    let resets_at = info.get("resetsAt").and_then(|v| v.as_i64()).unwrap_or(0);
    let overage_status = info.get("overageStatus").and_then(|v| v.as_str()).unwrap_or("");
    let is_using_overage = info.get("isUsingOverage").and_then(|v| v.as_bool()).unwrap_or(false);

    stats::upsert_claude_limits(
        &db::get_db(), rlt, status, resets_at,
        overage_status, is_using_overage,
        "", 0.0, 0, 0,
    );

    app.emit("claude:limits", &serde_json::json!({
        "rateLimitType": rlt,
        "status": status,
        "resets_at": resets_at,
        "overageStatus": overage_status,
        "isUsingOverage": is_using_overage,
    })).ok();

    if status != "allowed" {
        tasks::increment_rate_limit_hits(db, task_id);
        let msg = format!("Rate limited ({})", rlt);
        add_log(task_id, &msg, "error", db, app, None);
    }
}
