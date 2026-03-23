use std::process::{Command, Stdio};
use serde_json::Value;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn run_claude(args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("claude");
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output().map_err(|e| format!("Failed to run claude: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        // Some commands write to stderr but succeed conceptually
        if !stdout.is_empty() { return Ok(stdout); }
        Err(if stderr.is_empty() { "Command failed".into() } else { stderr })
    }
}

// ─── Auth ───

#[tauri::command]
pub fn get_auth_info() -> Result<Value, String> {
    let out = run_claude(&["auth", "status"])?;
    // auth status outputs JSON directly
    serde_json::from_str(&out).map_err(|_| {
        // Fallback: return as plain text
        serde_json::json!({"raw": out}).to_string()
    }).or_else(|_| Ok(serde_json::json!({"raw": out})))
}

// ─── MCP Servers ───

#[tauri::command]
pub fn list_mcp_servers() -> Result<Value, String> {
    let out = run_claude(&["mcp", "list"])?;
    // Parse text output: "name: command/url - status"
    let mut servers = Vec::new();
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Checking") { continue; }
        // Format: "name: command_or_url - status"
        if let Some(colon_pos) = line.find(": ") {
            let name = line[..colon_pos].trim();
            let rest = &line[colon_pos + 2..];
            let (detail, status) = if let Some(dash_pos) = rest.rfind(" - ") {
                (rest[..dash_pos].trim(), rest[dash_pos + 3..].trim())
            } else {
                (rest.trim(), "")
            };
            let connected = status.contains('✓') || status.contains("Connected");
            servers.push(serde_json::json!({
                "name": name,
                "detail": detail,
                "status": status,
                "connected": connected,
            }));
        }
    }
    Ok(serde_json::json!(servers))
}

#[tauri::command]
pub fn add_mcp_server(
    name: String, command_str: String, args: Option<Vec<String>>,
    scope: Option<String>, env: Option<Vec<String>>,
) -> Result<Value, String> {
    let scope_val = scope.unwrap_or_else(|| "local".into());
    let mut cli_args: Vec<String> = vec![
        "mcp".into(), "add".into(),
        "--scope".into(), scope_val,
    ];
    if let Some(ref env_vars) = env {
        for e in env_vars {
            cli_args.push("-e".into());
            cli_args.push(e.clone());
        }
    }
    // Name first, then -- separator, then command + args
    cli_args.push(name);
    cli_args.push("--".into());
    cli_args.push(command_str);
    if let Some(extra_args) = args {
        cli_args.extend(extra_args);
    }

    let refs: Vec<&str> = cli_args.iter().map(|s| s.as_str()).collect();
    run_claude(&refs)?;
    list_mcp_servers()
}

#[tauri::command]
pub fn remove_mcp_server(name: String, scope: Option<String>) -> Result<Value, String> {
    let scope_val = scope.unwrap_or_else(|| "local".into());
    run_claude(&["mcp", "remove", "--scope", &scope_val, &name])?;
    list_mcp_servers()
}

// ─── Plugins ───

#[tauri::command]
pub fn list_plugins() -> Result<Value, String> {
    let out = run_claude(&["plugin", "list"])?;
    // Parse: "❯ name@marketplace \n Version: x \n Scope: x \n Status: enabled/disabled"
    let mut plugins = Vec::new();
    let mut current: Option<serde_json::Map<String, Value>> = None;

    for line in out.lines() {
        let line = line.trim();
        if line.starts_with('❯') || line.starts_with('>') {
            if let Some(p) = current.take() {
                plugins.push(Value::Object(p));
            }
            let name = line.trim_start_matches(['❯', '>', ' '].as_ref()).trim();
            let mut map = serde_json::Map::new();
            map.insert("name".into(), Value::String(name.to_string()));
            current = Some(map);
        } else if let Some(ref mut map) = current {
            if let Some(val) = line.strip_prefix("Version:") {
                map.insert("version".into(), Value::String(val.trim().to_string()));
            } else if let Some(val) = line.strip_prefix("Scope:") {
                map.insert("scope".into(), Value::String(val.trim().to_string()));
            } else if let Some(val) = line.strip_prefix("Status:") {
                let status = val.trim();
                let enabled = status.contains("enabled");
                map.insert("status".into(), Value::String(status.to_string()));
                map.insert("enabled".into(), Value::Bool(enabled));
            }
        }
    }
    if let Some(p) = current.take() {
        plugins.push(Value::Object(p));
    }
    Ok(Value::Array(plugins))
}

#[tauri::command]
pub fn install_plugin(name: String) -> Result<Value, String> {
    run_claude(&["plugin", "install", &name])?;
    list_plugins()
}

#[tauri::command]
pub fn uninstall_plugin(name: String) -> Result<Value, String> {
    run_claude(&["plugin", "uninstall", &name])?;
    list_plugins()
}

#[tauri::command]
pub fn toggle_plugin(name: String, enabled: bool) -> Result<Value, String> {
    let cmd = if enabled { "enable" } else { "disable" };
    run_claude(&["plugin", cmd, &name])?;
    list_plugins()
}

#[tauri::command]
pub fn list_marketplaces() -> Result<Value, String> {
    let out = run_claude(&["plugin", "marketplace", "list"])?;
    let mut marketplaces = Vec::new();
    let mut current: Option<serde_json::Map<String, Value>> = None;

    for line in out.lines() {
        let line = line.trim();
        if line.starts_with('❯') || line.starts_with('>') {
            if let Some(m) = current.take() {
                marketplaces.push(Value::Object(m));
            }
            let name = line.trim_start_matches(['❯', '>', ' '].as_ref()).trim();
            let mut map = serde_json::Map::new();
            map.insert("name".into(), Value::String(name.to_string()));
            current = Some(map);
        } else if let Some(ref mut map) = current {
            if let Some(val) = line.strip_prefix("Source:") {
                map.insert("source".into(), Value::String(val.trim().to_string()));
            }
        }
    }
    if let Some(m) = current.take() {
        marketplaces.push(Value::Object(m));
    }
    Ok(Value::Array(marketplaces))
}


// ─── Settings ───

#[tauri::command]
pub fn get_claude_settings() -> Result<Value, String> {
    let home = dirs_home();
    let path = home.join(".claude").join("settings.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub fn save_claude_settings(settings: Value) -> Result<(), String> {
    let home = dirs_home();
    let dir = home.join(".claude");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// ─── Agents ───

#[tauri::command]
pub fn list_agents() -> Result<Value, String> {
    let out = run_claude(&["agents"])?;
    let mut agents = Vec::new();
    let mut section = "";

    for line in out.lines() {
        let line = line.trim();
        if line.starts_with("User agents") { section = "user"; continue; }
        if line.starts_with("Built-in agents") { section = "builtin"; continue; }
        if line.is_empty() || line.ends_with("active agents") { continue; }
        // Format: "name · model"
        if let Some(dot_pos) = line.find('·') {
            let name = line[..dot_pos].trim();
            let model = line[dot_pos + 2..].trim(); // skip "· "
            agents.push(serde_json::json!({
                "name": name,
                "model": model,
                "type": section,
            }));
        } else if !line.is_empty() {
            agents.push(serde_json::json!({
                "name": line,
                "model": "inherit",
                "type": section,
            }));
        }
    }
    Ok(Value::Array(agents))
}

// ─── Version ───

#[tauri::command]
pub fn get_claude_version() -> Result<String, String> {
    run_claude(&["--version"])
}

// ─── Marketplace management ───

#[tauri::command]
pub fn add_marketplace(source: String, scope: Option<String>) -> Result<Value, String> {
    let scope_val = scope.unwrap_or_else(|| "user".into());
    run_claude(&["plugin", "marketplace", "add", "--scope", &scope_val, &source])?;
    list_marketplaces()
}

#[tauri::command]
pub fn remove_marketplace(name: String) -> Result<Value, String> {
    run_claude(&["plugin", "marketplace", "remove", &name])?;
    list_marketplaces()
}

// ─── Update CLI ───

#[tauri::command]
pub fn update_claude_cli() -> Result<String, String> {
    run_claude(&["update"])
}

// ─── Hooks ───

#[tauri::command]
pub fn get_hooks() -> Result<Value, String> {
    let settings = get_claude_settings()?;
    Ok(settings.get("hooks").cloned().unwrap_or(serde_json::json!({})))
}

#[tauri::command]
pub fn save_hooks(hooks: Value) -> Result<(), String> {
    let mut settings = get_claude_settings()?;
    let obj = settings.as_object_mut().ok_or("Settings is not an object")?;
    obj.insert("hooks".into(), hooks);
    save_claude_settings(Value::Object(obj.clone()))
}

// ─── Sessions ───

#[tauri::command]
pub fn list_sessions() -> Result<Value, String> {
    let home = dirs_home();
    let projects_dir = home.join(".claude").join("projects");
    if !projects_dir.exists() { return Ok(Value::Array(vec![])); }

    let mut all_sessions = Vec::new();
    for project_entry in std::fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let project_entry = project_entry.map_err(|e| e.to_string())?;
        if !project_entry.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
        let project_name = project_entry.file_name().to_string_lossy().to_string();
        // Decode project path from directory name
        let display_name = project_name
            .replace("C--", "C:/").replace("c--", "C:/")
            .replace('-', "/");

        for file in std::fs::read_dir(project_entry.path()).map_err(|e| e.to_string())? {
            let file = file.map_err(|e| e.to_string())?;
            let fname = file.file_name().to_string_lossy().to_string();
            if !fname.ends_with(".jsonl") { continue; }
            let meta = file.metadata().map_err(|e| e.to_string())?;
            let size = meta.len();
            let modified = meta.modified().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let session_id = fname.trim_end_matches(".jsonl");
            // Count lines (messages) quickly
            let line_count = std::fs::read_to_string(file.path()).ok()
                .map(|c| c.lines().count() as i64).unwrap_or(0);

            all_sessions.push(serde_json::json!({
                "sessionId": session_id,
                "project": display_name,
                "projectDir": project_name,
                "size": size,
                "lines": line_count,
                "modified": modified,
            }));
        }
    }
    // Sort by modified desc
    all_sessions.sort_by(|a, b| {
        let ma = a.get("modified").and_then(|v| v.as_i64()).unwrap_or(0);
        let mb = b.get("modified").and_then(|v| v.as_i64()).unwrap_or(0);
        mb.cmp(&ma)
    });
    // Limit to 50 most recent
    all_sessions.truncate(50);
    Ok(Value::Array(all_sessions))
}

// ─── Permission Rules (auto-mode) ───

#[tauri::command]
pub fn get_permission_rules() -> Result<Value, String> {
    let out = run_claude(&["auto-mode", "config"])?;
    serde_json::from_str(&out).map_err(|e| format!("Parse error: {}", e))
}

fn dirs_home() -> std::path::PathBuf {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}
