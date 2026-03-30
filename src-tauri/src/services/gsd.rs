use std::path::Path;
use std::process::{Command, Stdio};
use serde::{Serialize, Deserialize};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdStatus {
    pub installed: bool,
    pub has_planning: bool,
    pub has_roadmap: bool,
    pub has_state: bool,
    pub has_project: bool,
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdPhase {
    pub number: String,
    pub title: String,
    pub status: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdRoadmap {
    pub phases: Vec<GsdPhase>,
    pub raw: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdState {
    pub current_phase: Option<String>,
    pub current_step: Option<String>,
    pub raw: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdProject {
    pub name: Option<String>,
    pub raw: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdPhaseDetail {
    pub number: String,
    pub name: String,
    pub files: Vec<GsdPhaseFile>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdPhaseFile {
    pub name: String,
    pub content: String,
}

/// Check if GSD is installed and .planning/ exists.
pub fn check_status(working_dir: &str) -> GsdStatus {
    let planning = Path::new(working_dir).join(".planning");
    let has_planning = planning.is_dir();
    let has_roadmap = planning.join("ROADMAP.md").is_file();
    let has_state = planning.join("STATE.md").is_file();
    let has_project = planning.join("PROJECT.md").is_file();

    // Check if get-shit-done-cc is available
    let installed = check_gsd_installed(working_dir);

    // Try to read version from config.json
    let version = if has_planning {
        let config_path = planning.join("config.json");
        if config_path.is_file() {
            std::fs::read_to_string(&config_path)
                .ok()
                .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
                .and_then(|v| v.get("version").and_then(|v| v.as_str()).map(String::from))
        } else {
            None
        }
    } else {
        None
    };

    GsdStatus {
        installed,
        has_planning,
        has_roadmap,
        has_state,
        has_project,
        version,
    }
}

fn check_gsd_installed(working_dir: &str) -> bool {
    // Check local .claude/commands/gsd/ directory
    let local_gsd = Path::new(working_dir).join(".claude").join("commands").join("gsd");
    if local_gsd.is_dir() {
        return true;
    }

    // Check global ~/.claude/commands/gsd/
    if let Some(home) = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)
    {
        let global_gsd = home.join(".claude").join("commands").join("gsd");
        if global_gsd.is_dir() {
            return true;
        }
    }

    false
}

/// Install GSD via npx.
pub fn install(working_dir: &str, scope: &str) -> Result<String, String> {
    let flag = match scope {
        "local" => "--local",
        _ => "--global",
    };

    let npx = if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" };
    let mut cmd = Command::new(npx);
    cmd.args(["get-shit-done-cc@latest", "--claude", flag])
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| format!("Failed to run npx: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(format!("{}\n{}", stdout, stderr))
    } else {
        Err(format!("Install failed: {}\n{}", stdout, stderr))
    }
}

/// Read and parse ROADMAP.md.
pub fn read_roadmap(working_dir: &str) -> Option<GsdRoadmap> {
    let path = Path::new(working_dir).join(".planning").join("ROADMAP.md");
    let raw = std::fs::read_to_string(&path).ok()?;
    let phases = parse_roadmap_phases(&raw);
    Some(GsdRoadmap { phases, raw })
}

/// Parse phases from ROADMAP.md content.
fn parse_roadmap_phases(content: &str) -> Vec<GsdPhase> {
    let mut phases = Vec::new();
    let mut current_phase: Option<GsdPhase> = None;
    let mut desc_lines: Vec<String> = Vec::new();
    let mut seen_numbers = std::collections::HashSet::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Phase headers: only match markdown headings (## Phase N: Title, ### Phase N, etc.)
        // Skip non-heading lines to avoid matching numbered lists, criteria, table rows
        if trimmed.starts_with('#') {
            if let Some(phase) = parse_phase_header(trimmed) {
                // Save previous phase
                if let Some(mut prev) = current_phase.take() {
                    let desc = desc_lines.join("\n").trim().to_string();
                    if !desc.is_empty() {
                        prev.description = Some(desc);
                    }
                    phases.push(prev);
                }
                desc_lines.clear();
                current_phase = Some(phase);
                continue;
            }
        }

        // Status line: "Status: completed" or "**Status:** in_progress"
        if let Some(ref mut phase) = current_phase {
            if let Some(status) = parse_status_line(trimmed) {
                phase.status = status;
                continue;
            }
            // Collect description lines
            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                desc_lines.push(trimmed.to_string());
            }
        }
    }

    // Push last phase
    if let Some(mut prev) = current_phase {
        let desc = desc_lines.join("\n").trim().to_string();
        if !desc.is_empty() {
            prev.description = Some(desc);
        }
        phases.push(prev);
    }

    // Deduplicate: if same number appears multiple times, suffix with .1, .2 etc.
    for phase in &mut phases {
        if !seen_numbers.insert(phase.number.clone()) {
            for suffix in 1..100 {
                let candidate = format!("{}.{}", phase.number, suffix);
                if seen_numbers.insert(candidate.clone()) {
                    phase.number = candidate;
                    break;
                }
            }
        }
    }

    phases
}

fn parse_phase_header(line: &str) -> Option<GsdPhase> {
    let line = line.trim_start_matches('#').trim();

    // "Phase N: Title" or "Phase N - Title" — require a digit after "Phase "
    if let Some(rest) = line.strip_prefix("Phase ").or_else(|| line.strip_prefix("phase ")) {
        // Must start with a digit (skip "Phase Details", "Phase Numbering", etc.)
        if rest.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
            let (num, title) = split_phase_number_title(rest);
            if !title.is_empty() {
                return Some(GsdPhase {
                    number: num,
                    title,
                    status: "pending".to_string(),
                    description: None,
                });
            }
        }
    }

    None
}

fn split_phase_number_title(s: &str) -> (String, String) {
    let num: String = s.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    let rest = s[num.len()..].trim();
    let rest = rest.trim_start_matches(['.', ':', '-', ' ']);
    (num.trim_end_matches('.').to_string(), rest.trim().to_string())
}

fn parse_status_line(line: &str) -> Option<String> {
    let line = line.replace("**", "").replace('*', "");
    let lower = line.to_lowercase();

    for prefix in ["status:", "state:"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            let status = rest.trim()
                .trim_start_matches(['`', ' '])
                .trim_end_matches(['`', ' '])
                .to_string();
            return match status.as_str() {
                s if s.contains("complete") => Some("completed".into()),
                s if s.contains("progress") || s.contains("active") => Some("in_progress".into()),
                s if s.contains("plan") => Some("planning".into()),
                s if s.contains("verif") => Some("verifying".into()),
                s if s.contains("fail") => Some("failed".into()),
                s if s.contains("skip") => Some("skipped".into()),
                s if s.contains("pend") => Some("pending".into()),
                _ => Some(status),
            };
        }
    }

    // Check for status emoji patterns: ✅ ⏳ 🔄 ❌
    if line.starts_with('✅') || line.contains("✅") {
        return Some("completed".into());
    }
    if line.starts_with('⏳') || line.starts_with("🔄") {
        return Some("in_progress".into());
    }

    None
}

/// Read STATE.md.
pub fn read_state(working_dir: &str) -> Option<GsdState> {
    let path = Path::new(working_dir).join(".planning").join("STATE.md");
    let raw = std::fs::read_to_string(&path).ok()?;

    let mut current_phase = None;
    let mut current_step = None;
    let mut in_position_section = false;

    for line in raw.lines() {
        let lower = line.to_lowercase().replace("**", "");
        let trimmed = lower.trim();

        // Track sections
        if trimmed.starts_with("## ") || trimmed.starts_with("# ") {
            in_position_section = trimmed.contains("current position") || trimmed.contains("position");
        }

        // "Phase: 1 of 5 (Foundation...)" or "Current Phase: ..."
        if (trimmed.starts_with("phase:") || trimmed.contains("current phase") || trimmed.contains("active phase"))
            && current_phase.is_none()
        {
            current_phase = extract_value(line);
        }

        // "Status: Ready to plan" or "Current step: ..."
        if in_position_section
            && (trimmed.starts_with("status:") || trimmed.starts_with("plan:"))
            && current_step.is_none()
        {
            current_step = extract_value(line);
        }
        if trimmed.contains("current step") || trimmed.contains("next step") || trimmed.contains("next action") {
            current_step = extract_value(line);
        }
    }

    Some(GsdState {
        current_phase,
        current_step,
        raw,
    })
}

fn extract_value(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.splitn(2, ':').collect();
    if parts.len() == 2 {
        let val = parts[1].trim().trim_matches(['*', '`', ' ']).to_string();
        if !val.is_empty() { Some(val) } else { None }
    } else {
        None
    }
}

/// Read PROJECT.md.
pub fn read_project(working_dir: &str) -> Option<GsdProject> {
    let path = Path::new(working_dir).join(".planning").join("PROJECT.md");
    let raw = std::fs::read_to_string(&path).ok()?;

    let mut name = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            name = Some(trimmed.trim_start_matches("# ").trim().to_string());
            break;
        }
    }

    Some(GsdProject { name, raw })
}

/// List phase detail directories and their files.
pub fn read_phase_details(working_dir: &str) -> Vec<GsdPhaseDetail> {
    let phases_dir = Path::new(working_dir).join(".planning").join("phases");
    if !phases_dir.is_dir() {
        return Vec::new();
    }

    let mut details = Vec::new();
    let mut entries: Vec<_> = std::fs::read_dir(&phases_dir)
        .ok()
        .map(|rd| rd.filter_map(|e| e.ok()).collect())
        .unwrap_or_default();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let (number, name) = parse_phase_dir_name(&dir_name);

        let mut files = Vec::new();
        let mut file_entries: Vec<_> = std::fs::read_dir(entry.path())
            .ok()
            .map(|rd| rd.filter_map(|e| e.ok()).collect())
            .unwrap_or_default();
        file_entries.sort_by_key(|e| e.file_name());

        for fe in file_entries {
            let fname = fe.file_name().to_string_lossy().to_string();
            if fname.ends_with(".md") {
                let content = std::fs::read_to_string(fe.path()).unwrap_or_default();
                files.push(GsdPhaseFile { name: fname, content });
            }
        }

        details.push(GsdPhaseDetail { number, name, files });
    }

    details
}

fn parse_phase_dir_name(name: &str) -> (String, String) {
    let lower = name.to_lowercase();
    // Format: "phase-1", "phase-01", "phase-1-title"
    if let Some(rest) = lower.strip_prefix("phase-").or_else(|| lower.strip_prefix("phase")) {
        let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !num.is_empty() {
            let after_num = &rest[num.len()..];
            let title = after_num.trim_start_matches('-').replace('-', " ");
            let title = if title.is_empty() { format!("Phase {}", num) } else { title };
            return (num, title);
        }
    }
    // Format: "01-phase-name" or "1-setup"
    let parts: Vec<&str> = name.splitn(2, '-').collect();
    if parts.len() == 2 {
        (parts[0].to_string(), parts[1].replace('-', " "))
    } else {
        (name.to_string(), name.to_string())
    }
}

/// Parsed task from a PLAN.md file.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdPlanTask {
    pub plan_file: String,
    pub plan_number: String,
    pub wave: i64,
    pub depends_on: Vec<String>,
    pub task_name: String,
    pub task_type: String,
    pub files: String,
    pub action: String,
    pub verify: String,
    pub done_criteria: String,
    pub checkpoint_type: String,
}

/// Parse all PLAN.md files in a phase directory and extract tasks.
pub fn parse_phase_plans(working_dir: &str, phase_number: &str) -> Vec<GsdPlanTask> {
    let phases_dir = Path::new(working_dir).join(".planning").join("phases");
    if !phases_dir.is_dir() {
        return Vec::new();
    }

    // Find the phase directory matching this number
    let phase_dir = find_phase_dir(&phases_dir, phase_number);
    let phase_dir = match phase_dir {
        Some(d) => d,
        None => return Vec::new(),
    };

    let mut all_tasks = Vec::new();

    // Read all PLAN.md files
    let mut entries: Vec<_> = std::fs::read_dir(&phase_dir)
        .ok()
        .map(|rd| rd.filter_map(|e| e.ok()).collect())
        .unwrap_or_default();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let fname = entry.file_name().to_string_lossy().to_string();
        if !fname.to_lowercase().contains("plan") || !fname.ends_with(".md") {
            continue;
        }
        let content = match std::fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let (front_matter, body) = split_front_matter(&content);
        let plan_number = extract_yaml_str(&front_matter, "plan")
            .unwrap_or_else(|| extract_plan_number_from_filename(&fname));
        let wave = extract_yaml_int(&front_matter, "wave").unwrap_or(1);
        let depends_on = extract_yaml_array(&front_matter, "depends_on");

        let tasks = extract_xml_tasks(&body);
        if tasks.is_empty() {
            // No XML tasks found — create one task from the whole plan
            let title = extract_plan_title(&body).unwrap_or_else(|| fname.clone());
            all_tasks.push(GsdPlanTask {
                plan_file: fname.clone(),
                plan_number: plan_number.clone(),
                wave,
                depends_on: depends_on.clone(),
                task_name: title,
                task_type: "auto".to_string(),
                files: String::new(),
                action: body.chars().take(2000).collect(),
                verify: String::new(),
                done_criteria: String::new(),
                checkpoint_type: "auto".to_string(),
            });
        } else {
            for t in tasks {
                all_tasks.push(GsdPlanTask {
                    plan_file: fname.clone(),
                    plan_number: plan_number.clone(),
                    wave,
                    depends_on: depends_on.clone(),
                    ..t
                });
            }
        }
    }

    all_tasks
}

fn find_phase_dir(phases_dir: &Path, phase_number: &str) -> Option<std::path::PathBuf> {
    let normalized = phase_number.trim_start_matches('0');
    let padded = format!("{:0>2}", phase_number);
    let entries = std::fs::read_dir(phases_dir).ok()?;
    for entry in entries.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_lowercase();

        // Match various formats: "01-xxx", "1-xxx", "phase-1", "phase-01", "phase1"
        if lower == format!("phase-{}", normalized)
            || lower == format!("phase-{}", padded)
            || lower == format!("phase{}", normalized)
        {
            return Some(entry.path());
        }

        // Match numeric prefix: "01-xxx" or "1-xxx"
        let dir_num = name.split('-').next().unwrap_or("");
        let dir_normalized = dir_num.trim_start_matches('0');
        if dir_normalized == normalized || dir_num == padded {
            return Some(entry.path());
        }
    }
    None
}

fn split_front_matter(content: &str) -> (String, String) {
    if content.len() > 3 && content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let fm = content[3..3 + end].to_string();
            let body_start = 3 + end + 3;
            let body = if body_start < content.len() { content[body_start..].to_string() } else { String::new() };
            return (fm, body);
        }
    }
    (String::new(), content.to_string())
}

fn extract_yaml_str(yaml: &str, key: &str) -> Option<String> {
    for line in yaml.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(&format!("{}:", key)) {
            let val = rest.trim().trim_matches('"').trim_matches('\'').to_string();
            if !val.is_empty() { return Some(val); }
        }
    }
    None
}

fn extract_yaml_int(yaml: &str, key: &str) -> Option<i64> {
    extract_yaml_str(yaml, key)?.parse().ok()
}

fn extract_yaml_array(yaml: &str, key: &str) -> Vec<String> {
    let val = match extract_yaml_str(yaml, key) {
        Some(v) => v,
        None => return Vec::new(),
    };
    // Parse inline array: ["01-01", "01-02"]
    val.trim_matches(['[', ']'])
        .split(',')
        .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn extract_plan_number_from_filename(fname: &str) -> String {
    let lower = fname.to_lowercase();
    let stem = lower.trim_end_matches(".md");
    // "plan-1-xterm-upgrade" → "1"
    if let Some(rest) = stem.strip_prefix("plan-") {
        let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !num.is_empty() { return num; }
    }
    // "01-02-PLAN" → "02"
    let parts: Vec<&str> = stem.split('-').collect();
    if parts.len() >= 2 { parts[1].to_string() } else { parts[0].to_string() }
}

fn extract_plan_title(body: &str) -> Option<String> {
    // Look for <objective> or first heading
    if let Some(start) = body.find("<objective>") {
        if let Some(end) = body.find("</objective>") {
            let obj = body[start + 11..end].trim();
            let first_line = obj.lines().next().unwrap_or("").trim();
            if !first_line.is_empty() {
                return Some(first_line.chars().take(100).collect());
            }
        }
    }
    for line in body.lines() {
        let t = line.trim();
        if t.starts_with('#') {
            return Some(t.trim_start_matches('#').trim().to_string());
        }
    }
    None
}

fn extract_xml_tasks(body: &str) -> Vec<GsdPlanTask> {
    let mut tasks = Vec::new();
    let search = body.as_bytes();
    let mut i = 0;

    while i < search.len() {
        // Find <task
        if let Some(pos) = body[i..].find("<task") {
            let start = i + pos;
            // Find closing </task>
            if let Some(end_pos) = body[start..].find("</task>") {
                let end = start + end_pos + 7;
                let chunk = &body[start..end];

                let task_type = extract_xml_attr(chunk, "type").unwrap_or_else(|| "auto".to_string());
                let checkpoint = if task_type.contains("checkpoint:") {
                    task_type.strip_prefix("checkpoint:").unwrap_or("auto").to_string()
                } else {
                    task_type.clone()
                };

                let name = extract_xml_tag(chunk, "name").unwrap_or_default();
                let files = extract_xml_tag(chunk, "files").unwrap_or_default();
                let action = extract_xml_tag(chunk, "action").unwrap_or_default();
                let verify = extract_xml_tag(chunk, "verify")
                    .or_else(|| extract_xml_tag(chunk, "automated"))
                    .unwrap_or_default();
                let done = extract_xml_tag(chunk, "done").unwrap_or_default();

                if !name.is_empty() {
                    tasks.push(GsdPlanTask {
                        plan_file: String::new(),
                        plan_number: String::new(),
                        wave: 1,
                        depends_on: Vec::new(),
                        task_name: name,
                        task_type: if task_type.contains("checkpoint") { "chore".to_string() } else { "feature".to_string() },
                        files,
                        action,
                        verify,
                        done_criteria: done,
                        checkpoint_type: checkpoint,
                    });
                }

                i = end;
                continue;
            }
        }
        break;
    }

    tasks
}

fn extract_xml_attr(chunk: &str, attr: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr);
    if let Some(pos) = chunk.find(&pattern) {
        let start = pos + pattern.len();
        if let Some(end) = chunk[start..].find('"') {
            return Some(chunk[start..start + end].to_string());
        }
    }
    None
}

fn extract_xml_tag(chunk: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    if let Some(start_pos) = chunk.find(&open) {
        // Find end of opening tag (handle <tag> or <tag attr="val">)
        let after_open = start_pos + open.len();
        if let Some(gt) = chunk[after_open..].find('>') {
            let content_start = after_open + gt + 1;
            if let Some(end_pos) = chunk[content_start..].find(&close) {
                let val = chunk[content_start..content_start + end_pos].trim().to_string();
                if !val.is_empty() { return Some(val); }
            }
        }
    }
    None
}

/// Read config.json.
pub fn read_config(working_dir: &str) -> Option<serde_json::Value> {
    let path = Path::new(working_dir).join(".planning").join("config.json");
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}
