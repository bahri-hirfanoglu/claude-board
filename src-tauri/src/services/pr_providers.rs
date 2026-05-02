//! Pull / merge request creation across git hosting providers.
//!
//! Supports GitHub (`gh`), GitLab (`glab`), Azure DevOps (`az`), and
//! Gitea/Forgejo (`tea`). The provider is auto-detected from the project's
//! `git remote get-url origin` output, or overridden by the project's
//! `pr_provider` setting.

use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrProvider {
    GitHub,
    GitLab,
    AzureDevOps,
    Gitea,
    /// User explicitly disabled auto-PR for this project.
    None,
    /// Auto-detect failed and no override was set.
    Unknown,
}

impl PrProvider {
    pub fn as_setting_str(&self) -> &'static str {
        match self {
            Self::GitHub => "github",
            Self::GitLab => "gitlab",
            Self::AzureDevOps => "azure_devops",
            Self::Gitea => "gitea",
            Self::None => "none",
            Self::Unknown => "auto",
        }
    }

    /// Parse a project setting value. Returns `None` for "auto" / empty so the
    /// caller falls back to URL-based detection.
    pub fn from_setting(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "github" => Some(Self::GitHub),
            "gitlab" => Some(Self::GitLab),
            "azure_devops" | "azure" | "azuredevops" => Some(Self::AzureDevOps),
            "gitea" | "forgejo" => Some(Self::Gitea),
            "none" | "disabled" | "off" => Some(Self::None),
            "auto" | "" => None,
            _ => None,
        }
    }

    pub fn cli_tool(&self) -> Option<&'static str> {
        match self {
            Self::GitHub => Some("gh"),
            Self::GitLab => Some("glab"),
            Self::AzureDevOps => Some("az"),
            Self::Gitea => Some("tea"),
            _ => None,
        }
    }

    pub fn install_url(&self) -> Option<&'static str> {
        match self {
            Self::GitHub => Some("https://cli.github.com/"),
            Self::GitLab => Some("https://gitlab.com/gitlab-org/cli"),
            Self::AzureDevOps => Some("https://learn.microsoft.com/cli/azure/install-azure-cli"),
            Self::Gitea => Some("https://gitea.com/gitea/tea"),
            _ => None,
        }
    }

    pub fn login_hint(&self) -> Option<&'static str> {
        match self {
            Self::GitHub => Some("gh auth login"),
            Self::GitLab => Some("glab auth login"),
            Self::AzureDevOps => Some("az login && az extension add -n azure-devops"),
            Self::Gitea => Some("tea login add"),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::GitHub => "GitHub",
            Self::GitLab => "GitLab",
            Self::AzureDevOps => "Azure DevOps",
            Self::Gitea => "Gitea/Forgejo",
            Self::None => "Disabled",
            Self::Unknown => "Unknown",
        }
    }
}

/// Decide a provider from a remote URL string. Pure function — testable.
pub fn detect_from_url(url: &str) -> PrProvider {
    let lower = url.trim().to_ascii_lowercase();
    if lower.is_empty() {
        return PrProvider::Unknown;
    }
    if lower.contains("github.com") {
        PrProvider::GitHub
    } else if lower.contains("dev.azure.com")
        || lower.contains("visualstudio.com")
        || lower.contains("ssh.dev.azure.com")
    {
        PrProvider::AzureDevOps
    } else if lower.contains("gitlab.") || lower.contains("/gitlab/") {
        PrProvider::GitLab
    } else if lower.contains("codeberg.org") || lower.contains("gitea.") {
        PrProvider::Gitea
    } else {
        PrProvider::Unknown
    }
}

fn silent_cmd(name: &str) -> Command {
    let mut c = Command::new(name);
    c.stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

/// Detect the provider for a working directory, honouring an optional override.
pub fn detect_remote_provider(working_dir: &str, override_setting: Option<&str>) -> PrProvider {
    if let Some(setting) = override_setting {
        if let Some(p) = PrProvider::from_setting(setting) {
            return p;
        }
    }
    let mut cmd = silent_cmd("git");
    cmd.args(["remote", "get-url", "origin"])
        .current_dir(working_dir);
    match cmd.output() {
        Ok(o) if o.status.success() => {
            let url = String::from_utf8_lossy(&o.stdout).trim().to_string();
            detect_from_url(&url)
        }
        _ => PrProvider::Unknown,
    }
}

/// Best-effort check that the provider's CLI is installed. Returns false for
/// `None` / `Unknown` (they have no CLI).
pub fn cli_available(provider: PrProvider) -> bool {
    let tool = match provider.cli_tool() {
        Some(t) => t,
        None => return false,
    };
    let mut cmd = silent_cmd(tool);
    cmd.arg("--version");
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

#[derive(Debug, Clone)]
pub struct PrCreateContext<'a> {
    pub working_dir: &'a str,
    pub branch: &'a str,
    pub base: &'a str,
    pub title: &'a str,
    pub body: &'a str,
}

#[derive(Debug)]
pub enum PrCreateOutcome {
    Created {
        url: String,
        provider: PrProvider,
    },
    CliMissing {
        provider: PrProvider,
        install_url: &'static str,
    },
    NotAuthenticated {
        provider: PrProvider,
        login_hint: &'static str,
    },
    Failed {
        provider: PrProvider,
        error: String,
    },
    Skipped {
        reason: String,
    },
}

pub fn create_pr(provider: PrProvider, ctx: &PrCreateContext) -> PrCreateOutcome {
    match provider {
        PrProvider::None => {
            return PrCreateOutcome::Skipped {
                reason: "PR provider set to 'none' for this project".into(),
            };
        }
        PrProvider::Unknown => {
            return PrCreateOutcome::Skipped {
                reason: "Could not detect remote provider; set 'PR Provider' on the project to enable auto-PR".into(),
            };
        }
        _ => {}
    }
    if !cli_available(provider) {
        return PrCreateOutcome::CliMissing {
            provider,
            install_url: provider.install_url().unwrap_or(""),
        };
    }

    match provider {
        PrProvider::GitHub => create_github(ctx),
        PrProvider::GitLab => create_gitlab(ctx),
        PrProvider::AzureDevOps => create_azure_devops(ctx),
        PrProvider::Gitea => create_gitea(ctx),
        _ => PrCreateOutcome::Skipped {
            reason: "Unsupported provider".into(),
        },
    }
}

fn looks_like_auth_error(stderr: &str) -> bool {
    let s = stderr.to_ascii_lowercase();
    s.contains("not authenticated")
        || s.contains("authentication")
        || s.contains("not logged")
        || s.contains("token")
        || s.contains("unauthorized")
        || s.contains("401")
        || s.contains("403")
        || s.contains("please run") && s.contains("login")
}

fn extract_url(text: &str) -> Option<String> {
    text.split_whitespace()
        .find(|tok| tok.starts_with("http://") || tok.starts_with("https://"))
        .map(|s| s.trim_end_matches(['.', ',', ')', '"', '\'']).to_string())
}

// ── GitHub: gh pr create ──────────────────────────────────────────────────

fn create_github(ctx: &PrCreateContext) -> PrCreateOutcome {
    let mut cmd = silent_cmd("gh");
    cmd.args([
        "pr", "create", "--title", ctx.title, "--body", ctx.body, "--base", ctx.base, "--head",
        ctx.branch,
    ])
    .current_dir(ctx.working_dir);

    match cmd.output() {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            match extract_url(&stdout) {
                Some(url) => PrCreateOutcome::Created {
                    url,
                    provider: PrProvider::GitHub,
                },
                None => PrCreateOutcome::Failed {
                    provider: PrProvider::GitHub,
                    error: format!("gh did not return a URL: {}", stdout.trim()),
                },
            }
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            if looks_like_auth_error(&stderr) {
                PrCreateOutcome::NotAuthenticated {
                    provider: PrProvider::GitHub,
                    login_hint: PrProvider::GitHub.login_hint().unwrap(),
                }
            } else {
                PrCreateOutcome::Failed {
                    provider: PrProvider::GitHub,
                    error: stderr.trim().to_string(),
                }
            }
        }
        Err(e) => PrCreateOutcome::Failed {
            provider: PrProvider::GitHub,
            error: e.to_string(),
        },
    }
}

// ── GitLab: glab mr create ────────────────────────────────────────────────

fn create_gitlab(ctx: &PrCreateContext) -> PrCreateOutcome {
    let mut cmd = silent_cmd("glab");
    cmd.args([
        "mr",
        "create",
        "--title",
        ctx.title,
        "--description",
        ctx.body,
        "--target-branch",
        ctx.base,
        "--source-branch",
        ctx.branch,
        "--yes",
    ])
    .current_dir(ctx.working_dir);

    match cmd.output() {
        Ok(o) if o.status.success() => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            );
            match extract_url(&combined) {
                Some(url) => PrCreateOutcome::Created {
                    url,
                    provider: PrProvider::GitLab,
                },
                None => PrCreateOutcome::Failed {
                    provider: PrProvider::GitLab,
                    error: format!("Could not parse URL from glab output: {}", combined.trim()),
                },
            }
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            if looks_like_auth_error(&stderr) {
                PrCreateOutcome::NotAuthenticated {
                    provider: PrProvider::GitLab,
                    login_hint: PrProvider::GitLab.login_hint().unwrap(),
                }
            } else {
                PrCreateOutcome::Failed {
                    provider: PrProvider::GitLab,
                    error: stderr.trim().to_string(),
                }
            }
        }
        Err(e) => PrCreateOutcome::Failed {
            provider: PrProvider::GitLab,
            error: e.to_string(),
        },
    }
}

// ── Azure DevOps: az repos pr create ──────────────────────────────────────

fn create_azure_devops(ctx: &PrCreateContext) -> PrCreateOutcome {
    let mut cmd = silent_cmd("az");
    cmd.args([
        "repos",
        "pr",
        "create",
        "--source-branch",
        ctx.branch,
        "--target-branch",
        ctx.base,
        "--title",
        ctx.title,
        "--description",
        ctx.body,
        "--output",
        "json",
    ])
    .current_dir(ctx.working_dir);

    match cmd.output() {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            match serde_json::from_str::<serde_json::Value>(&stdout) {
                Ok(json) => {
                    let pr_id = json
                        .get("pullRequestId")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let web_url = json
                        .pointer("/repository/webUrl")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .trim_end_matches('/');
                    if pr_id > 0 && !web_url.is_empty() {
                        PrCreateOutcome::Created {
                            url: format!("{}/pullrequest/{}", web_url, pr_id),
                            provider: PrProvider::AzureDevOps,
                        }
                    } else {
                        PrCreateOutcome::Failed {
                            provider: PrProvider::AzureDevOps,
                            error: "Could not extract pullRequestId or repository.webUrl from az output".into(),
                        }
                    }
                }
                Err(e) => PrCreateOutcome::Failed {
                    provider: PrProvider::AzureDevOps,
                    error: format!("Failed to parse az JSON output: {}", e),
                },
            }
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            // az's "extension not installed" message is very specific
            if stderr.contains("repos") && stderr.contains("not in the") {
                PrCreateOutcome::Failed {
                    provider: PrProvider::AzureDevOps,
                    error: "azure-devops extension not installed. Run: az extension add -n azure-devops".into(),
                }
            } else if looks_like_auth_error(&stderr) {
                PrCreateOutcome::NotAuthenticated {
                    provider: PrProvider::AzureDevOps,
                    login_hint: PrProvider::AzureDevOps.login_hint().unwrap(),
                }
            } else {
                PrCreateOutcome::Failed {
                    provider: PrProvider::AzureDevOps,
                    error: stderr.trim().to_string(),
                }
            }
        }
        Err(e) => PrCreateOutcome::Failed {
            provider: PrProvider::AzureDevOps,
            error: e.to_string(),
        },
    }
}

// ── Gitea / Forgejo: tea pr create ────────────────────────────────────────

fn create_gitea(ctx: &PrCreateContext) -> PrCreateOutcome {
    let mut cmd = silent_cmd("tea");
    cmd.args([
        "pr",
        "create",
        "--title",
        ctx.title,
        "--description",
        ctx.body,
        "--base",
        ctx.base,
        "--head",
        ctx.branch,
    ])
    .current_dir(ctx.working_dir);

    match cmd.output() {
        Ok(o) if o.status.success() => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            );
            match extract_url(&combined) {
                Some(url) => PrCreateOutcome::Created {
                    url,
                    provider: PrProvider::Gitea,
                },
                None => PrCreateOutcome::Failed {
                    provider: PrProvider::Gitea,
                    error: format!("Could not parse URL from tea output: {}", combined.trim()),
                },
            }
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            if looks_like_auth_error(&stderr) {
                PrCreateOutcome::NotAuthenticated {
                    provider: PrProvider::Gitea,
                    login_hint: PrProvider::Gitea.login_hint().unwrap(),
                }
            } else {
                PrCreateOutcome::Failed {
                    provider: PrProvider::Gitea,
                    error: stderr.trim().to_string(),
                }
            }
        }
        Err(e) => PrCreateOutcome::Failed {
            provider: PrProvider::Gitea,
            error: e.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_github() {
        assert_eq!(
            detect_from_url("https://github.com/foo/bar.git"),
            PrProvider::GitHub
        );
        assert_eq!(
            detect_from_url("git@github.com:foo/bar.git"),
            PrProvider::GitHub
        );
    }

    #[test]
    fn detects_gitlab() {
        assert_eq!(
            detect_from_url("https://gitlab.com/foo/bar.git"),
            PrProvider::GitLab
        );
        assert_eq!(
            detect_from_url("git@gitlab.example.com:foo/bar.git"),
            PrProvider::GitLab
        );
    }

    #[test]
    fn detects_azure_devops() {
        assert_eq!(
            detect_from_url("https://dev.azure.com/myorg/myproject/_git/myrepo"),
            PrProvider::AzureDevOps
        );
        assert_eq!(
            detect_from_url("https://myorg.visualstudio.com/myproject/_git/myrepo"),
            PrProvider::AzureDevOps
        );
        assert_eq!(
            detect_from_url("git@ssh.dev.azure.com:v3/myorg/myproject/myrepo"),
            PrProvider::AzureDevOps
        );
    }

    #[test]
    fn detects_gitea() {
        assert_eq!(
            detect_from_url("https://codeberg.org/foo/bar.git"),
            PrProvider::Gitea
        );
        assert_eq!(
            detect_from_url("https://gitea.example.com/foo/bar.git"),
            PrProvider::Gitea
        );
    }

    #[test]
    fn unknown_for_other_hosts() {
        assert_eq!(
            detect_from_url("https://example.com/foo/bar.git"),
            PrProvider::Unknown
        );
        assert_eq!(detect_from_url(""), PrProvider::Unknown);
    }

    #[test]
    fn from_setting_handles_aliases() {
        assert_eq!(PrProvider::from_setting("github"), Some(PrProvider::GitHub));
        assert_eq!(PrProvider::from_setting("GitLab"), Some(PrProvider::GitLab));
        assert_eq!(
            PrProvider::from_setting("azure"),
            Some(PrProvider::AzureDevOps)
        );
        assert_eq!(
            PrProvider::from_setting("azure_devops"),
            Some(PrProvider::AzureDevOps)
        );
        assert_eq!(PrProvider::from_setting("forgejo"), Some(PrProvider::Gitea));
        assert_eq!(PrProvider::from_setting("none"), Some(PrProvider::None));
        assert_eq!(PrProvider::from_setting("auto"), None);
        assert_eq!(PrProvider::from_setting(""), None);
    }

    #[test]
    fn extracts_url_from_output() {
        assert_eq!(
            extract_url("Created PR https://github.com/foo/bar/pull/1"),
            Some("https://github.com/foo/bar/pull/1".to_string())
        );
        assert_eq!(extract_url("no url here"), None);
        assert_eq!(
            extract_url("Trailing punctuation https://example.com/x."),
            Some("https://example.com/x".to_string())
        );
    }
}
