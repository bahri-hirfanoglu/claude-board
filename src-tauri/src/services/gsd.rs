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

/// Canonical phase status values. Any status written to DB, emitted to UI, or
/// round-tripped through ROADMAP.md MUST be one of these to keep DB and file
/// representation comparable.
pub const PHASE_STATUS_PENDING: &str = "pending";
pub const PHASE_STATUS_PLANNING: &str = "planning";
pub const PHASE_STATUS_IN_PROGRESS: &str = "in_progress";
pub const PHASE_STATUS_VERIFYING: &str = "verifying";
pub const PHASE_STATUS_COMPLETED: &str = "completed";
pub const PHASE_STATUS_FAILED: &str = "failed";
pub const PHASE_STATUS_BLOCKED: &str = "blocked";
pub const PHASE_STATUS_SKIPPED: &str = "skipped";

pub const PHASE_STATUSES: &[&str] = &[
    PHASE_STATUS_PENDING,
    PHASE_STATUS_PLANNING,
    PHASE_STATUS_IN_PROGRESS,
    PHASE_STATUS_VERIFYING,
    PHASE_STATUS_COMPLETED,
    PHASE_STATUS_FAILED,
    PHASE_STATUS_BLOCKED,
    PHASE_STATUS_SKIPPED,
];

/// Normalize any free-form status string (from ROADMAP.md, legacy DB rows, or
/// user input) to one of the canonical values above. Unknown inputs fall back
/// to `pending` so the rest of the system never has to handle unexpected values.
/// Accepts emoji prefixes, capitalizations, partial words ("complete", "done").
pub fn normalize_phase_status(raw: &str) -> &'static str {
    let cleaned: String = raw
        .chars()
        .filter(|c| !matches!(c, '✅' | '⏳' | '🔄' | '❌' | '⚪' | '🚫' | '🔴' | '🟢' | '🟡' | '🔵' | '⏸'))
        .collect();
    let trimmed = cleaned.trim().trim_matches(['*', '`', ':', '-', ' ', '\t']);
    let lower = trimmed.to_lowercase();

    if lower.is_empty() {
        // Emoji-only status lines
        if raw.contains('✅') { return PHASE_STATUS_COMPLETED; }
        if raw.contains('❌') { return PHASE_STATUS_FAILED; }
        if raw.contains("🔄") || raw.contains("⏳") { return PHASE_STATUS_IN_PROGRESS; }
        if raw.contains("🚫") { return PHASE_STATUS_BLOCKED; }
        if raw.contains("⏸") { return PHASE_STATUS_PAUSED_FALLBACK; }
        return PHASE_STATUS_PENDING;
    }

    // Exact matches first (fast path, authoritative)
    for canon in PHASE_STATUSES {
        if lower == *canon { return canon; }
    }

    // Fuzzy matching on common variants
    if lower.contains("complete") || lower == "done" || lower == "finished" {
        return PHASE_STATUS_COMPLETED;
    }
    if lower.contains("progress") || lower.contains("active") || lower == "running" || lower == "executing" {
        return PHASE_STATUS_IN_PROGRESS;
    }
    if lower.contains("plan") {
        return PHASE_STATUS_PLANNING;
    }
    if lower.contains("verif") || lower.contains("testing") || lower.contains("review") {
        return PHASE_STATUS_VERIFYING;
    }
    if lower.contains("fail") || lower.contains("error") {
        return PHASE_STATUS_FAILED;
    }
    if lower.contains("block") || lower.contains("stuck") {
        return PHASE_STATUS_BLOCKED;
    }
    if lower.contains("skip") {
        return PHASE_STATUS_SKIPPED;
    }
    if lower.contains("pend") || lower.contains("todo") || lower == "new" || lower.is_empty() {
        return PHASE_STATUS_PENDING;
    }

    PHASE_STATUS_PENDING
}

// Fallback: we don't have a canonical "paused" in the enum, map to blocked.
const PHASE_STATUS_PAUSED_FALLBACK: &str = PHASE_STATUS_BLOCKED;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdRoadmap {
    pub phases: Vec<GsdPhase>,
    pub raw: String,
}

// ─── Health report ───

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HealthCheck {
    pub name: String,
    pub status: String,  // "ok" | "warning" | "error"
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HealthReport {
    pub overall: String,  // "healthy" | "degraded" | "broken"
    pub checks: Vec<HealthCheck>,
}

/// Run `.planning/` directory integrity checks. Mirrors what `/gsd:health`
/// does from the CLI: file presence, parseability, and phase consistency.
pub fn run_health_checks(working_dir: &str) -> HealthReport {
    let mut checks: Vec<HealthCheck> = Vec::new();
    let planning_dir = Path::new(working_dir).join(".planning");

    // Check 1: .planning directory exists
    if !planning_dir.exists() {
        checks.push(HealthCheck {
            name: ".planning/ directory".into(),
            status: "error".into(),
            message: Some("Directory not found — run /gsd:new-project to initialize".into()),
        });
        return HealthReport { overall: "broken".into(), checks };
    }
    checks.push(HealthCheck { name: ".planning/ directory".into(), status: "ok".into(), message: None });

    // Checks 2-6: required files
    let required_files: &[(&str, &str)] = &[
        ("PROJECT.md", "Project vision & constraints"),
        ("REQUIREMENTS.md", "Scope for current milestone"),
        ("ROADMAP.md", "Phase breakdown"),
        ("STATE.md", "Current position tracking"),
        ("config.json", "GSD configuration"),
    ];
    for (file, desc) in required_files {
        let p = planning_dir.join(file);
        checks.push(if p.exists() {
            HealthCheck { name: format!("{} present", file), status: "ok".into(), message: None }
        } else {
            HealthCheck {
                name: format!("{} present", file),
                status: "error".into(),
                message: Some(format!("Missing — {}", desc)),
            }
        });
    }

    // Check 7: config.json parses as JSON
    let config_path = planning_dir.join("config.json");
    if config_path.exists() {
        match std::fs::read_to_string(&config_path) {
            Ok(raw) => {
                if let Err(e) = serde_json::from_str::<serde_json::Value>(&raw) {
                    checks.push(HealthCheck {
                        name: "config.json parses".into(),
                        status: "error".into(),
                        message: Some(format!("Invalid JSON: {}", e)),
                    });
                } else {
                    checks.push(HealthCheck { name: "config.json parses".into(), status: "ok".into(), message: None });
                }
            }
            Err(e) => checks.push(HealthCheck {
                name: "config.json readable".into(),
                status: "error".into(),
                message: Some(format!("{}", e)),
            }),
        }
    }

    // Check 8: ROADMAP.md has at least one phase
    if let Some(roadmap) = read_roadmap(working_dir) {
        if roadmap.phases.is_empty() {
            checks.push(HealthCheck {
                name: "ROADMAP.md phases".into(),
                status: "warning".into(),
                message: Some("No phases detected — check heading format (## Phase N: Title)".into()),
            });
        } else {
            checks.push(HealthCheck {
                name: "ROADMAP.md phases".into(),
                status: "ok".into(),
                message: Some(format!("{} phase(s) detected", roadmap.phases.len())),
            });

            // Check 9: phase numbers are unique
            let mut seen = std::collections::HashSet::new();
            let mut dupes: Vec<String> = Vec::new();
            for p in &roadmap.phases {
                if !seen.insert(p.number.clone()) {
                    dupes.push(p.number.clone());
                }
            }
            if dupes.is_empty() {
                checks.push(HealthCheck { name: "Phase numbers unique".into(), status: "ok".into(), message: None });
            } else {
                checks.push(HealthCheck {
                    name: "Phase numbers unique".into(),
                    status: "warning".into(),
                    message: Some(format!("Duplicate: {}", dupes.join(", "))),
                });
            }

            // Check 10: each phase has canonical status
            let non_canonical: Vec<String> = roadmap.phases.iter()
                .filter(|p| !PHASE_STATUSES.contains(&p.status.as_str()))
                .map(|p| format!("Phase {}: '{}'", p.number, p.status))
                .collect();
            if non_canonical.is_empty() {
                checks.push(HealthCheck { name: "Phase statuses canonical".into(), status: "ok".into(), message: None });
            } else {
                checks.push(HealthCheck {
                    name: "Phase statuses canonical".into(),
                    status: "warning".into(),
                    message: Some(format!("Non-canonical values: {}", non_canonical.join("; "))),
                });
            }
        }
    }

    // Overall verdict: error > warning > ok
    let has_error = checks.iter().any(|c| c.status == "error");
    let has_warning = checks.iter().any(|c| c.status == "warning");
    let overall = if has_error { "broken" } else if has_warning { "degraded" } else { "healthy" };

    HealthReport { overall: overall.into(), checks }
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

/// Parse a task `tags` column value (CSV like "gsd,phase-2" or JSON array like
/// ["gsd","phase-2"]) into a lowercase vector of individual tags.
fn parse_task_tags(raw: &str) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        return Vec::new();
    }
    if trimmed.starts_with('[') {
        if let Ok(arr) = serde_json::from_str::<Vec<String>>(trimmed) {
            return arr.into_iter().map(|s| s.trim().to_lowercase()).collect();
        }
    }
    trimmed
        .split(',')
        .map(|s| s.trim().trim_matches(['"', '\'']).to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Determine the GSD phase number encoded in a task's tags, e.g. `phase-2` →
/// `"2"`. Requires the task to also carry the `gsd` marker.
pub fn extract_gsd_phase_from_tags(raw_tags: Option<&str>) -> Option<String> {
    let raw = raw_tags?;
    let tags = parse_task_tags(raw);
    if !tags.iter().any(|t| t == "gsd") {
        return None;
    }
    let phase = tags
        .iter()
        .find_map(|t| t.strip_prefix("phase-").map(|s| s.to_string()));
    if phase.is_none() {
        log::warn!(
            "gsd::extract_gsd_phase_from_tags: task has `gsd` tag but no `phase-N` tag — tags were {:?}",
            tags
        );
    }
    phase
}

/// Aggregate status for a GSD phase based on its tagged tasks and sync
/// ROADMAP.md accordingly. Returns the new status on success.
pub fn recompute_phase_status_from_tasks(
    working_dir: &str,
    phase_number: &str,
    task_statuses: &[String],
) -> Option<String> {
    if task_statuses.is_empty() {
        log::debug!(
            "gsd::recompute_phase_status_from_tasks: phase {} has no tasks — skipping",
            phase_number
        );
        return None;
    }
    let total = task_statuses.len();
    let done = task_statuses.iter().filter(|s| s.as_str() == "done").count();
    let active = task_statuses.iter().filter(|s| matches!(s.as_str(), "in_progress" | "testing")).count();
    let failed = task_statuses.iter().filter(|s| s.as_str() == "failed").count();

    let new_status: &'static str = if done == total {
        PHASE_STATUS_COMPLETED
    } else if failed > 0 && active == 0 && done + failed == total {
        PHASE_STATUS_FAILED
    } else if active > 0 || done > 0 {
        PHASE_STATUS_IN_PROGRESS
    } else {
        log::debug!(
            "gsd::recompute_phase_status_from_tasks: phase {} all pending/backlog ({} tasks) — leaving ROADMAP.md untouched",
            phase_number, total
        );
        return None;
    };

    if update_roadmap_phase_status(working_dir, phase_number, new_status) {
        log::info!(
            "gsd: phase {} → {} in ROADMAP.md ({}/{} done, {} active, {} failed)",
            phase_number, new_status, done, total, active, failed
        );
        Some(new_status.to_string())
    } else {
        log::warn!(
            "gsd::recompute_phase_status_from_tasks: computed {} for phase {} but could not write ROADMAP.md in {}",
            new_status, phase_number, working_dir
        );
        None
    }
}

/// Apply the full GSD roadmap cascade after a task's status changes. This is
/// the single choke-point that every task-status mutation path should call so
/// ROADMAP.md and the DB roadmap never drift.
///
/// Runs both cascades when applicable:
///  1. DB-based: if the task is linked to a `phase_plan_id`, recompute plan →
///     phase statuses and sync the phase status back to ROADMAP.md.
///  2. File-based: if the task carries `gsd,phase-N` tags, recompute the
///     phase's aggregate status from all sibling tasks and update ROADMAP.md.
///
/// Pass `Some(&app)` to fan out `roadmap:updated` events for UI refresh. When
/// called from a non-Tauri context (e.g. the MCP HTTP bridge) pass `None` —
/// data still propagates correctly; only the UI push is skipped.
///
/// Failures are logged but never propagated — callers fire-and-forget.
pub fn apply_task_status_cascade(
    db: &crate::db::DbPool,
    app: Option<&tauri::AppHandle>,
    task_id: i64,
) {
    use crate::db::{projects as pq, roadmap, tasks as tq};
    use tauri::Emitter;

    let task = match tq::get_by_id(db, task_id) {
        Some(t) => t,
        None => {
            log::warn!(
                "gsd::apply_task_status_cascade: task {} not found — skipping cascade",
                task_id
            );
            return;
        }
    };

    // ── DB-based cascade (plan → phase → ROADMAP.md) ──
    if let Some(plan_id) = task.phase_plan_id {
        roadmap::recompute_plan_status(db, plan_id);
        if let Some(plan) = roadmap::get_plan(db, plan_id) {
            roadmap::recompute_phase_status(db, plan.phase_id);
            if let Some(phase) = roadmap::get_phase(db, plan.phase_id) {
                if let Some(a) = app {
                    a.emit("roadmap:updated", &phase.project_id).ok();
                }
                if let Some(project) = pq::get_by_id(db, phase.project_id) {
                    if !update_roadmap_phase_status(
                        &project.working_dir,
                        &phase.phase_number,
                        &phase.status,
                    ) {
                        log::warn!(
                            "gsd::apply_task_status_cascade[db]: failed to sync phase {} status '{}' to ROADMAP.md in {}",
                            phase.phase_number, phase.status, project.working_dir
                        );
                    }
                }
            } else {
                log::warn!(
                    "gsd::apply_task_status_cascade[db]: plan {} points to missing phase {}",
                    plan_id, plan.phase_id
                );
            }
        } else {
            log::warn!(
                "gsd::apply_task_status_cascade[db]: task {} references missing plan {}",
                task_id, plan_id
            );
        }
    }

    // ── File-based cascade (tags → ROADMAP.md) ──
    if let Some(phase_num) = extract_gsd_phase_from_tags(task.tags.as_deref()) {
        let project = match pq::get_by_id(db, task.project_id) {
            Some(p) => p,
            None => {
                log::warn!(
                    "gsd::apply_task_status_cascade[file]: project {} not found for task {}",
                    task.project_id, task_id
                );
                return;
            }
        };
        let statuses: Vec<String> = tq::get_by_project(db, task.project_id)
            .into_iter()
            .filter(|t| {
                extract_gsd_phase_from_tags(t.tags.as_deref()).as_deref()
                    == Some(phase_num.as_str())
            })
            .filter_map(|t| t.status)
            .collect();

        if recompute_phase_status_from_tasks(&project.working_dir, &phase_num, &statuses)
            .is_some()
        {
            if let Some(a) = app {
                a.emit("roadmap:updated", &task.project_id).ok();
            }
        }
    }
}

/// Update the Status: line for a given phase in ROADMAP.md. If no Status line
/// exists under the phase heading, inserts one immediately after the heading.
/// Returns true when the file was rewritten.
pub fn update_roadmap_phase_status(working_dir: &str, phase_number: &str, new_status: &str) -> bool {
    let path = Path::new(working_dir).join(".planning").join("ROADMAP.md");
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            log::warn!(
                "gsd::update_roadmap_phase_status: cannot read {} — {}",
                path.display(),
                e
            );
            return false;
        }
    };

    let target_norm = phase_number.trim_start_matches('0');
    let lines: Vec<&str> = content.lines().collect();
    let mut out: Vec<String> = Vec::with_capacity(lines.len() + 1);
    let mut in_target = false;
    let mut pending_insert = false;
    let mut done = false;

    for raw in lines.iter() {
        let trimmed = raw.trim();

        // Phase heading detection (## / ### lines)
        if trimmed.starts_with('#') {
            if let Some(phase) = parse_phase_header(trimmed) {
                // Leaving a target phase without having replaced a Status line → insert before next heading
                if in_target && pending_insert && !done {
                    out.push(format!("**Status:** {}", new_status));
                    out.push(String::new());
                    done = true;
                }
                let phase_norm = phase.number.trim_start_matches('0');
                in_target = !done && (phase_norm == target_norm || phase.number == phase_number);
                pending_insert = in_target;
                out.push(raw.to_string());
                continue;
            }
        }

        // Replace existing Status: / **Status:** line inside target phase
        if in_target && pending_insert && parse_status_line(trimmed).is_some() {
            let leading: String = raw.chars().take_while(|c| c.is_whitespace()).collect();
            let after = &raw[leading.len()..];
            let bullet = if after.starts_with("- ") { "- " }
                else if after.starts_with("* ") { "* " }
                else { "" };
            out.push(format!("{}{}**Status:** {}", leading, bullet, new_status));
            pending_insert = false;
            done = true;
            continue;
        }

        out.push(raw.to_string());
    }

    // Target phase ran to EOF without a Status line
    if in_target && pending_insert && !done {
        out.push(format!("**Status:** {}", new_status));
        done = true;
    }

    if !done {
        log::warn!(
            "gsd::update_roadmap_phase_status: phase '{}' heading not found in {} — expected '## Phase {}: …' or similar. Status '{}' not written.",
            phase_number,
            path.display(),
            phase_number,
            new_status
        );
        return false;
    }

    let mut new_content = out.join("\n");
    if content.ends_with('\n') && !new_content.ends_with('\n') {
        new_content.push('\n');
    }
    match std::fs::write(&path, &new_content) {
        Ok(_) => true,
        Err(e) => {
            log::warn!(
                "gsd::update_roadmap_phase_status: failed to write {} — {}",
                path.display(),
                e
            );
            false
        }
    }
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
    let stripped = line.replace("**", "").replace('*', "");
    let lower = stripped.to_lowercase();

    for prefix in ["status:", "state:"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            let normalized = normalize_phase_status(rest);
            return Some(normalized.to_string());
        }
    }

    // Emoji-only lines (no "Status:" prefix) — treat as implicit status markers
    if line.contains('✅') || line.contains('❌') || line.contains('⏳') || line.contains("🔄") || line.contains("🚫") {
        return Some(normalize_phase_status(line).to_string());
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GsdTodo {
    pub path: String,
    pub filename: String,
    pub title: String,
    pub area: String,
    pub status: String, // "pending" | "done"
    pub preview: String,
}

/// List all todos under `.planning/todos/{pending,done}/**/*.md`.
/// Returns empty vec if the directory doesn't exist.
pub fn list_todos(working_dir: &str) -> Vec<GsdTodo> {
    let todos_dir = Path::new(working_dir).join(".planning").join("todos");
    if !todos_dir.exists() {
        return Vec::new();
    }

    let mut result: Vec<GsdTodo> = Vec::new();
    for status in &["pending", "done"] {
        let bucket = todos_dir.join(status);
        if !bucket.exists() { continue; }
        collect_todos_recursive(&bucket, &bucket, status, &mut result);
    }
    // Sort: pending first, then by filename
    result.sort_by(|a, b| {
        let status_cmp = a.status.cmp(&b.status).reverse(); // pending > done
        if status_cmp != std::cmp::Ordering::Equal { return status_cmp; }
        a.filename.cmp(&b.filename)
    });
    result
}

fn collect_todos_recursive(root: &Path, current: &Path, status: &str, out: &mut Vec<GsdTodo>) {
    let entries = match std::fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            collect_todos_recursive(root, &p, status, out);
        } else if p.extension().and_then(|e| e.to_str()) == Some("md") {
            let filename = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            // Area = first subdirectory under root (e.g. "general", "ui")
            let area = p.strip_prefix(root).ok()
                .and_then(|rel| rel.components().next())
                .and_then(|c| c.as_os_str().to_str())
                .filter(|s| *s != filename)
                .unwrap_or("general").to_string();

            let content = std::fs::read_to_string(&p).unwrap_or_default();
            let (title, preview) = parse_todo_content(&content, &filename);

            out.push(GsdTodo {
                path: p.to_string_lossy().to_string(),
                filename,
                title,
                area,
                status: status.to_string(),
                preview,
            });
        }
    }
}

fn parse_todo_content(content: &str, filename: &str) -> (String, String) {
    // Skip YAML frontmatter
    let body_start = if content.starts_with("---") {
        content.find("\n---\n").or_else(|| content.find("\n---\r\n")).map(|i| i + 5).unwrap_or(0)
    } else { 0 };
    let body = content[body_start..].trim();

    // Try to extract a title: first `# Heading` line, then first non-empty line
    let heading = body.lines()
        .find(|l| l.trim_start().starts_with("# "))
        .map(|l| l.trim_start_matches('#').trim().to_string());

    let title = heading.unwrap_or_else(|| {
        filename.trim_end_matches(".md").replace(['-', '_'], " ").trim().to_string()
    });

    let preview: String = body.lines()
        .filter(|l| !l.trim_start().starts_with('#'))
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
        .chars().take(200).collect();

    (title, preview)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_exact_canonical_values() {
        for s in PHASE_STATUSES {
            assert_eq!(normalize_phase_status(s), *s);
        }
    }

    #[test]
    fn normalize_fuzzy_variants() {
        assert_eq!(normalize_phase_status("Completed"), PHASE_STATUS_COMPLETED);
        assert_eq!(normalize_phase_status("complete"), PHASE_STATUS_COMPLETED);
        assert_eq!(normalize_phase_status("done"), PHASE_STATUS_COMPLETED);
        assert_eq!(normalize_phase_status("In Progress"), PHASE_STATUS_IN_PROGRESS);
        assert_eq!(normalize_phase_status("active"), PHASE_STATUS_IN_PROGRESS);
        assert_eq!(normalize_phase_status("running"), PHASE_STATUS_IN_PROGRESS);
        assert_eq!(normalize_phase_status("planning phase"), PHASE_STATUS_PLANNING);
        assert_eq!(normalize_phase_status("verifying"), PHASE_STATUS_VERIFYING);
        assert_eq!(normalize_phase_status("testing"), PHASE_STATUS_VERIFYING);
        assert_eq!(normalize_phase_status("FAILED"), PHASE_STATUS_FAILED);
        assert_eq!(normalize_phase_status("error"), PHASE_STATUS_FAILED);
        assert_eq!(normalize_phase_status("blocked"), PHASE_STATUS_BLOCKED);
        assert_eq!(normalize_phase_status("skipped"), PHASE_STATUS_SKIPPED);
        assert_eq!(normalize_phase_status("pending"), PHASE_STATUS_PENDING);
        assert_eq!(normalize_phase_status("todo"), PHASE_STATUS_PENDING);
    }

    #[test]
    fn normalize_emoji_prefixes() {
        assert_eq!(normalize_phase_status("✅ Completed"), PHASE_STATUS_COMPLETED);
        assert_eq!(normalize_phase_status("✅"), PHASE_STATUS_COMPLETED);
        assert_eq!(normalize_phase_status("❌ failed"), PHASE_STATUS_FAILED);
        assert_eq!(normalize_phase_status("🔄 in_progress"), PHASE_STATUS_IN_PROGRESS);
        assert_eq!(normalize_phase_status("⏳"), PHASE_STATUS_IN_PROGRESS);
        assert_eq!(normalize_phase_status("🚫 blocked"), PHASE_STATUS_BLOCKED);
    }

    #[test]
    fn normalize_unknown_falls_back_to_pending() {
        assert_eq!(normalize_phase_status("xyzzy"), PHASE_STATUS_PENDING);
        assert_eq!(normalize_phase_status(""), PHASE_STATUS_PENDING);
        assert_eq!(normalize_phase_status("   "), PHASE_STATUS_PENDING);
    }

    #[test]
    fn normalize_handles_markdown_decorations() {
        assert_eq!(normalize_phase_status("**completed**"), PHASE_STATUS_COMPLETED);
        assert_eq!(normalize_phase_status("`in_progress`"), PHASE_STATUS_IN_PROGRESS);
        assert_eq!(normalize_phase_status(": done"), PHASE_STATUS_COMPLETED);
    }
}
