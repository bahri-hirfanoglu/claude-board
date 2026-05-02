use serde::Serialize;
use std::path::Path;
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize)]
pub struct GitRepoStatus {
    pub is_repo: bool,
    pub has_remote: bool,
    pub current_branch: Option<String>,
    pub path_exists: bool,
    /// Auto-detected PR provider for the origin remote (github / gitlab /
    /// azure_devops / gitea / unknown). Only meaningful when `has_remote` is
    /// true; otherwise reported as "unknown".
    pub detected_provider: String,
}

fn git_output(args: &[&str], dir: &str) -> Option<std::process::Output> {
    let mut c = Command::new("git");
    c.args(args)
        .current_dir(dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    c.creation_flags(CREATE_NO_WINDOW);
    c.output().ok()
}

#[tauri::command]
pub fn check_git_repo(path: String) -> Result<GitRepoStatus, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok(GitRepoStatus {
            is_repo: false,
            has_remote: false,
            current_branch: None,
            path_exists: false,
            detected_provider: "unknown".into(),
        });
    }
    let p = Path::new(trimmed);
    if !p.exists() || !p.is_dir() {
        return Ok(GitRepoStatus {
            is_repo: false,
            has_remote: false,
            current_branch: None,
            path_exists: false,
            detected_provider: "unknown".into(),
        });
    }

    let is_repo = git_output(&["rev-parse", "--is-inside-work-tree"], trimmed)
        .map(|o| o.status.success() && String::from_utf8_lossy(&o.stdout).trim() == "true")
        .unwrap_or(false);

    if !is_repo {
        return Ok(GitRepoStatus {
            is_repo: false,
            has_remote: false,
            current_branch: None,
            path_exists: true,
            detected_provider: "unknown".into(),
        });
    }

    let has_remote = git_output(&["remote"], trimmed)
        .map(|o| o.status.success() && !String::from_utf8_lossy(&o.stdout).trim().is_empty())
        .unwrap_or(false);

    let current_branch = git_output(&["rev-parse", "--abbrev-ref", "HEAD"], trimmed)
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty() && s != "HEAD");

    let detected_provider = if has_remote {
        let url = git_output(&["remote", "get-url", "origin"], trimmed)
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        crate::services::pr_providers::detect_from_url(&url)
            .as_setting_str()
            .to_string()
    } else {
        "unknown".to_string()
    };

    Ok(GitRepoStatus {
        is_repo: true,
        has_remote,
        current_branch,
        path_exists: true,
        detected_provider,
    })
}

#[tauri::command]
pub fn init_git_repo(path: String, initial_branch: Option<String>) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is required".into());
    }
    let p = Path::new(trimmed);
    if !p.exists() || !p.is_dir() {
        return Err("Path does not exist or is not a directory".into());
    }

    let branch = initial_branch.as_deref().unwrap_or("main");
    let init_args: Vec<&str> = vec!["init", "-b", branch];
    let out = git_output(&init_args, trimmed).ok_or_else(|| "Failed to invoke git".to_string())?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "git init failed".into()
        } else {
            stderr
        });
    }
    Ok(())
}
