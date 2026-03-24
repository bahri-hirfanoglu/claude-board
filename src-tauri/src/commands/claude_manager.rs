use std::process::{Command, Stdio};
use serde_json::Value;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn strip_ansi(s: &str) -> String {
    let re = regex_lite::Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\[\?[0-9]*[a-zA-Z]").unwrap();
    re.replace_all(s, "").trim().to_string()
}

fn run_claude_sync(args: Vec<String>) -> Result<String, String> {
    let mut cmd = Command::new("claude");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .env("NO_COLOR", "1")
        .env("TERM", "dumb");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output().map_err(|e| format!("Failed to run claude: {}", e))?;
    let stdout = strip_ansi(&String::from_utf8_lossy(&output.stdout));
    let stderr = strip_ansi(&String::from_utf8_lossy(&output.stderr));
    if output.status.success() {
        Ok(stdout)
    } else {
        if !stdout.is_empty() { return Ok(stdout); }
        Err(if stderr.is_empty() { "Command failed".into() } else { stderr })
    }
}

async fn run_claude(args: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_claude_sync(args))
        .await
        .map_err(|e| e.to_string())?
}

fn extract_json(out: &str) -> Result<Value, String> {
    let start = out.find('{').ok_or("No JSON found in output")?;
    serde_json::from_str(&out[start..]).map_err(|e| format!("Parse error: {}", e))
}

fn parse_mcp_list(out: &str) -> Value {
    let mut servers = Vec::new();
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Checking") { continue; }
        if let Some(colon_pos) = line.find(": ") {
            let name = line[..colon_pos].trim();
            let rest = &line[colon_pos + 2..];
            let (detail, status) = if let Some(dash_pos) = rest.rfind(" - ") {
                (rest[..dash_pos].trim(), rest[dash_pos + 3..].trim())
            } else { (rest.trim(), "") };
            servers.push(serde_json::json!({
                "name": name, "detail": detail, "status": status,
                "connected": status.contains("Connected") || status.contains("✓"),
            }));
        }
    }
    serde_json::json!(servers)
}

fn parse_plugin_list(out: &str) -> Value {
    let mut plugins = Vec::new();
    let mut current: Option<serde_json::Map<String, Value>> = None;
    for line in out.lines() {
        let line = line.trim();
        if line.starts_with('❯') || line.starts_with('>') {
            if let Some(p) = current.take() { plugins.push(Value::Object(p)); }
            let name = line.trim_start_matches(['❯', '>', ' '].as_ref()).trim();
            let mut map = serde_json::Map::new();
            map.insert("name".into(), Value::String(name.to_string()));
            current = Some(map);
        } else if let Some(ref mut map) = current {
            if let Some(v) = line.strip_prefix("Version:") { map.insert("version".into(), Value::String(v.trim().into())); }
            else if let Some(v) = line.strip_prefix("Scope:") { map.insert("scope".into(), Value::String(v.trim().into())); }
            else if let Some(v) = line.strip_prefix("Status:") { map.insert("status".into(), Value::String(v.trim().into())); map.insert("enabled".into(), Value::Bool(v.contains("enabled"))); }
        }
    }
    if let Some(p) = current.take() { plugins.push(Value::Object(p)); }
    Value::Array(plugins)
}

fn parse_marketplace_list(out: &str) -> Value {
    let mut list = Vec::new();
    let mut current: Option<serde_json::Map<String, Value>> = None;
    for line in out.lines() {
        let line = line.trim();
        if line.starts_with('❯') || line.starts_with('>') {
            if let Some(m) = current.take() { list.push(Value::Object(m)); }
            let name = line.trim_start_matches(['❯', '>', ' '].as_ref()).trim();
            let mut map = serde_json::Map::new();
            map.insert("name".into(), Value::String(name.to_string()));
            current = Some(map);
        } else if let Some(ref mut map) = current {
            if let Some(v) = line.strip_prefix("Source:") { map.insert("source".into(), Value::String(v.trim().into())); }
        }
    }
    if let Some(m) = current.take() { list.push(Value::Object(m)); }
    Value::Array(list)
}

fn parse_agents(out: &str) -> Value {
    let mut agents = Vec::new();
    let mut section = "";
    for line in out.lines() {
        let line = line.trim();
        if line.starts_with("User agents") { section = "user"; continue; }
        if line.starts_with("Built-in agents") { section = "builtin"; continue; }
        if line.is_empty() || line.ends_with("active agents") { continue; }
        if let Some(dot_pos) = line.find('·') {
            agents.push(serde_json::json!({"name": line[..dot_pos].trim(), "model": line[dot_pos+2..].trim(), "type": section}));
        } else if !line.is_empty() {
            agents.push(serde_json::json!({"name": line, "model": "inherit", "type": section}));
        }
    }
    Value::Array(agents)
}

// ─── Auth ───
#[tauri::command]
pub async fn get_auth_info() -> Result<Value, String> {
    let out = run_claude(vec!["auth".into(), "status".into()]).await?;
    Ok(extract_json(&out).unwrap_or_else(|_| serde_json::json!({"raw": out})))
}

// ─── MCP ───
#[tauri::command]
pub async fn list_mcp_servers() -> Result<Value, String> {
    let out = run_claude(vec!["mcp".into(), "list".into()]).await?;
    Ok(parse_mcp_list(&out))
}

#[tauri::command]
pub async fn add_mcp_server(name: String, command_str: String, args: Option<Vec<String>>, scope: Option<String>, env: Option<Vec<String>>) -> Result<Value, String> {
    let mut cli: Vec<String> = vec!["mcp".into(), "add".into(), "--scope".into(), scope.unwrap_or("local".into())];
    if let Some(envs) = env { for e in envs { cli.push("-e".into()); cli.push(e); } }
    cli.push(name); cli.push("--".into()); cli.push(command_str);
    if let Some(a) = args { cli.extend(a); }
    run_claude(cli).await?;
    list_mcp_servers().await
}

#[tauri::command]
pub async fn remove_mcp_server(name: String, scope: Option<String>) -> Result<Value, String> {
    run_claude(vec!["mcp".into(), "remove".into(), "--scope".into(), scope.unwrap_or("local".into()), name]).await?;
    list_mcp_servers().await
}

// ─── Plugins ───
#[tauri::command]
pub async fn list_plugins() -> Result<Value, String> {
    let out = run_claude(vec!["plugin".into(), "list".into()]).await?;
    Ok(parse_plugin_list(&out))
}

#[tauri::command]
pub async fn install_plugin(name: String) -> Result<Value, String> {
    run_claude(vec!["plugin".into(), "install".into(), name]).await?;
    list_plugins().await
}

#[tauri::command]
pub async fn uninstall_plugin(name: String) -> Result<Value, String> {
    run_claude(vec!["plugin".into(), "uninstall".into(), name]).await?;
    list_plugins().await
}

#[tauri::command]
pub async fn toggle_plugin(name: String, enabled: bool) -> Result<Value, String> {
    run_claude(vec!["plugin".into(), if enabled { "enable" } else { "disable" }.into(), name]).await?;
    list_plugins().await
}

#[tauri::command]
pub async fn list_marketplaces() -> Result<Value, String> {
    let out = run_claude(vec!["plugin".into(), "marketplace".into(), "list".into()]).await?;
    Ok(parse_marketplace_list(&out))
}

#[tauri::command]
pub async fn add_marketplace(source: String, scope: Option<String>) -> Result<Value, String> {
    run_claude(vec!["plugin".into(), "marketplace".into(), "add".into(), "--scope".into(), scope.unwrap_or("user".into()), source]).await?;
    list_marketplaces().await
}

#[tauri::command]
pub async fn remove_marketplace(name: String) -> Result<Value, String> {
    run_claude(vec!["plugin".into(), "marketplace".into(), "remove".into(), name]).await?;
    list_marketplaces().await
}

// ─── Settings ───
#[tauri::command]
pub async fn get_claude_settings() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = dirs_home().join(".claude").join("settings.json");
        if !path.exists() { return Ok(serde_json::json!({})); }
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| format!("Parse error: {}", e))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_claude_settings(settings: Value) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = dirs_home().join(".claude");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(dir.join("settings.json"), serde_json::to_string_pretty(&settings).unwrap()).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// ─── Agents ───
#[tauri::command]
pub async fn list_agents() -> Result<Value, String> {
    let out = run_claude(vec!["agents".into()]).await?;
    Ok(parse_agents(&out))
}

// ─── Version ───
#[tauri::command]
pub async fn get_claude_version() -> Result<String, String> {
    run_claude(vec!["--version".into()]).await
}

// ─── Marketplace ───
#[tauri::command]
pub async fn update_claude_cli() -> Result<String, String> {
    run_claude(vec!["update".into()]).await
}

// ─── Hooks ───
#[tauri::command]
pub async fn get_hooks() -> Result<Value, String> {
    let settings = get_claude_settings().await?;
    Ok(settings.get("hooks").cloned().unwrap_or(serde_json::json!({})))
}

#[tauri::command]
pub async fn save_hooks(hooks: Value) -> Result<(), String> {
    let mut settings = get_claude_settings().await?;
    let obj = settings.as_object_mut().ok_or("Settings is not an object")?;
    obj.insert("hooks".into(), hooks);
    save_claude_settings(Value::Object(obj.clone())).await
}

// ─── Sessions ───
#[tauri::command]
pub async fn list_sessions() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let projects_dir = dirs_home().join(".claude").join("projects");
        if !projects_dir.exists() { return Ok(Value::Array(vec![])); }
        let mut all = Vec::new();
        for pe in std::fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
            let pe = pe.map_err(|e| e.to_string())?;
            if !pe.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
            let pname = pe.file_name().to_string_lossy().to_string();
            let display = pname.replace("C--", "C:/").replace("c--", "C:/").replace('-', "/");
            for f in std::fs::read_dir(pe.path()).map_err(|e| e.to_string())? {
                let f = f.map_err(|e| e.to_string())?;
                let fname = f.file_name().to_string_lossy().to_string();
                if !fname.ends_with(".jsonl") { continue; }
                let meta = f.metadata().map_err(|e| e.to_string())?;
                let modified = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64).unwrap_or(0);
                // Use file size as proxy for line count (avoid reading entire file)
                all.push(serde_json::json!({
                    "sessionId": fname.trim_end_matches(".jsonl"),
                    "project": display, "projectDir": pname,
                    "size": meta.len(), "modified": modified,
                }));
            }
        }
        all.sort_by(|a, b| b["modified"].as_i64().unwrap_or(0).cmp(&a["modified"].as_i64().unwrap_or(0)));
        all.truncate(50);
        Ok(Value::Array(all))
    }).await.map_err(|e| e.to_string())?
}

// ─── Permissions ───
#[tauri::command]
pub async fn get_permission_rules() -> Result<Value, String> {
    let out = run_claude(vec!["auto-mode".into(), "config".into()]).await?;
    extract_json(&out)
}

// ─── Scan Codebase ───
#[tauri::command]
pub async fn scan_codebase(app: tauri::AppHandle, project_id: i64, mode: Option<String>) -> Result<String, String> {
    let db = crate::db::get_db();
    let project = crate::db::projects::get_by_id(&db, project_id).ok_or("Project not found")?;
    let working_dir = project.working_dir.clone();

    let summary = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("claude");
        cmd.args(["-p", "Analyze this codebase and write a concise summary. Include: tech stack, main directories, key patterns, entry points. Output ONLY the summary text, no conversation.", "--output-format", "text", "--max-turns", "10", "--dangerously-skip-permissions"])
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .env("NO_COLOR", "1");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        let output = cmd.output().map_err(|e| format!("Failed to scan: {}", e))?;
        let text = strip_ansi(&String::from_utf8_lossy(&output.stdout));
        if text.is_empty() {
            Err("Scan returned empty result".to_string())
        } else {
            Ok(text)
        }
    }).await.map_err(|e| e.to_string())??;

    // Write to CLAUDE.md
    let write_mode = mode.unwrap_or_else(|| "overwrite".into());
    let claude_md_path = std::path::Path::new(&project.working_dir).join("CLAUDE.md");
    let new_content = if write_mode == "append" {
        let existing = std::fs::read_to_string(&claude_md_path).unwrap_or_default();
        if existing.is_empty() {
            format!("# Project Overview\n\n{}", summary)
        } else {
            format!("{}\n\n---\n\n# Codebase Analysis (Auto-generated)\n\n{}", existing.trim(), summary)
        }
    } else {
        format!("# Project Overview\n\n{}", summary)
    };
    std::fs::write(&claude_md_path, &new_content).map_err(|e| e.to_string())?;

    use tauri::Emitter;
    app.emit("scan:completed", &serde_json::json!({"projectId": project_id})).ok();
    Ok(summary)
}

// ─── Check environment suggestions ───
#[tauri::command]
pub async fn get_suggestions() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut suggestions = Vec::new();

        // Check if claude-mem plugin is installed
        let plugins_out = run_claude_sync(vec!["plugin".into(), "list".into()]).unwrap_or_default();
        if !plugins_out.contains("claude-mem") {
            suggestions.push(serde_json::json!({
                "id": "install-claude-mem",
                "type": "plugin",
                "title": "Install claude-mem",
                "description": "Persistent memory across sessions - Claude remembers context between tasks",
                "action": "install_plugin",
                "actionArgs": "claude-mem@thedotmack",
                "priority": "high",
            }));
        }

        // Check if any MCP server is configured
        let mcp_out = run_claude_sync(vec!["mcp".into(), "list".into()]).unwrap_or_default();
        let has_connected = mcp_out.contains("Connected") || mcp_out.contains("✓");
        if !has_connected && !mcp_out.contains(":") {
            suggestions.push(serde_json::json!({
                "id": "add-mcp",
                "type": "mcp",
                "title": "Add an MCP server",
                "description": "MCP servers give Claude access to external tools and data sources",
                "action": "navigate",
                "actionArgs": "claude-manager:mcp",
                "priority": "medium",
            }));
        }

        // Check git config
        let mut git_cmd = Command::new("git");
        git_cmd.args(["config", "user.name"])
            .stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(target_os = "windows")]
        git_cmd.creation_flags(CREATE_NO_WINDOW);
        let git_check = git_cmd.output();
        if git_check.map(|o| o.stdout.is_empty()).unwrap_or(true) {
            suggestions.push(serde_json::json!({
                "id": "git-config",
                "type": "config",
                "title": "Configure git identity",
                "description": "Git user.name is not set - Claude's commits won't have proper attribution",
                "action": "info",
                "priority": "low",
            }));
        }

        Ok(Value::Array(suggestions))
    }).await.map_err(|e| e.to_string())?
}

// ─── Custom Commands ───
#[tauri::command]
pub async fn list_custom_commands() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut items = Vec::new();
        let dirs = [
            dirs_home().join(".claude").join("commands"),
        ];
        for dir in &dirs {
            if !dir.exists() { continue; }
            let scope = if dir.starts_with(&dirs_home().join(".claude")) { "user" } else { "project" };
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
                    let ext = path.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
                    if ext != "md" { continue; }
                    let content = std::fs::read_to_string(&path).unwrap_or_default();
                    let meta = entry.metadata().ok();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    items.push(serde_json::json!({
                        "name": name,
                        "path": path.to_string_lossy(),
                        "scope": scope,
                        "content": content,
                        "size": size,
                    }));
                }
            }
        }
        items.sort_by(|a, b| a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")));
        Ok(Value::Array(items))
    }).await.map_err(|e| e.to_string())?
}

// ─── Custom Skills ───
#[tauri::command]
pub async fn list_custom_skills() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut items = Vec::new();
        let dir = dirs_home().join(".claude").join("skills");
        if !dir.exists() { return Ok(Value::Array(items)); }
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
                let ext = path.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
                if ext != "md" { continue; }
                let content = std::fs::read_to_string(&path).unwrap_or_default();
                let meta = entry.metadata().ok();
                let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                items.push(serde_json::json!({
                    "name": name,
                    "path": path.to_string_lossy(),
                    "content": content,
                    "size": size,
                }));
            }
        }
        items.sort_by(|a, b| a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")));
        Ok(Value::Array(items))
    }).await.map_err(|e| e.to_string())?
}

fn dirs_home() -> std::path::PathBuf {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}
