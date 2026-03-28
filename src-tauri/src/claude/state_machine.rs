use serde::{Deserialize, Serialize};

// ─── Task Status Enum ───────────────────────────────────────────────────────

/// Single source of truth for all task status values.
/// Replaces scattered string literals across the codebase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaskStatus {
    #[serde(rename = "backlog")]
    Backlog,
    #[serde(rename = "in_progress")]
    InProgress,
    #[serde(rename = "testing")]
    Testing,
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "awaiting_approval")]
    AwaitingApproval,
}

impl TaskStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Backlog => "backlog",
            Self::InProgress => "in_progress",
            Self::Testing => "testing",
            Self::Done => "done",
            Self::Failed => "failed",
            Self::AwaitingApproval => "awaiting_approval",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "backlog" => Some(Self::Backlog),
            "in_progress" => Some(Self::InProgress),
            "testing" => Some(Self::Testing),
            "done" => Some(Self::Done),
            "failed" => Some(Self::Failed),
            "awaiting_approval" => Some(Self::AwaitingApproval),
            _ => None,
        }
    }

    pub fn is_valid(s: &str) -> bool {
        Self::from_str(s).is_some()
    }

    /// Whether this is a terminal state (no automatic progression).
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Done | Self::Failed)
    }

    /// Whether a runner process is expected in this state.
    pub fn expects_runner(&self) -> bool {
        matches!(self, Self::InProgress | Self::Testing)
    }

    /// Whether this is an approval-waiting state.
    pub fn is_awaiting_approval(&self) -> bool {
        matches!(self, Self::AwaitingApproval)
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ─── Transition Rules ───────────────────────────────────────────────────────

/// Declarative transition table. All valid status transitions are defined here.
/// Invalid transitions are rejected at the API boundary.
pub fn is_valid_transition(from: TaskStatus, to: TaskStatus) -> bool {
    use TaskStatus::*;
    if from == to {
        return false;
    }
    matches!(
        (from, to),
        // ── Normal flow ──
        (Backlog, InProgress)       // queue picks up or user starts
        | (InProgress, Testing)     // task completes, enters verification
        | (InProgress, Done)        // manual approval (no auto-test)
        | (InProgress, Failed)      // retries exhausted
        | (Testing, Done)           // auto-test passed or manual approval
        | (Testing, InProgress)     // revision requested or auto-revision

        // ── Approval gate ──
        | (Testing, AwaitingApproval)    // auto-test passed, needs approval
        | (AwaitingApproval, Done)       // approved
        | (AwaitingApproval, InProgress) // rejected, needs rework
        | (AwaitingApproval, Backlog)    // moved back
        | (AwaitingApproval, Failed)     // rejected permanently

        // ── Manual overrides ──
        | (InProgress, Backlog)     // user moves back to queue
        | (Testing, Backlog)        // user moves back to queue
        | (Testing, Failed)         // user marks as failed
        | (Failed, Backlog)         // user retries from failure
        | (Failed, InProgress)      // user directly restarts
        | (Done, Backlog)           // user reopens
        | (Done, InProgress)        // user reopens and restarts
    )
}

/// Get all valid target statuses from a given status.
pub fn valid_targets(from: TaskStatus) -> Vec<TaskStatus> {
    use TaskStatus::*;
    [Backlog, InProgress, Testing, Done, Failed, AwaitingApproval]
        .into_iter()
        .filter(|to| is_valid_transition(from, *to))
        .collect()
}

// ─── Engine Configuration ───────────────────────────────────────────────────

/// Extracted hard-coded values, now configurable per-project.
/// Zero/empty values mean "use default".
pub struct EngineConfig {
    pub max_auto_revisions: i64,
    pub max_retries: i64,
    pub retry_base_delay_secs: i64,
    pub retry_max_delay_secs: i64,
    pub auto_test_model: String,
}

impl EngineConfig {
    // Defaults matching original hard-coded values
    pub const DEFAULT_MAX_AUTO_REVISIONS: i64 = 3;
    pub const DEFAULT_MAX_RETRIES: i64 = 2;
    pub const DEFAULT_RETRY_BASE_DELAY: i64 = 30;
    pub const DEFAULT_RETRY_MAX_DELAY: i64 = 600;
    pub const DEFAULT_AUTO_TEST_MODEL: &'static str = "sonnet";

    /// Build config from project settings, falling back to defaults.
    pub fn from_project(project: &crate::db::projects::Project) -> Self {
        Self {
            max_auto_revisions: Self::resolve(project.max_auto_revisions, Self::DEFAULT_MAX_AUTO_REVISIONS),
            max_retries: Self::resolve(project.max_retries, Self::DEFAULT_MAX_RETRIES),
            retry_base_delay_secs: Self::resolve(project.retry_base_delay_secs, Self::DEFAULT_RETRY_BASE_DELAY),
            retry_max_delay_secs: Self::resolve(project.retry_max_delay_secs, Self::DEFAULT_RETRY_MAX_DELAY),
            auto_test_model: {
                let v = project.auto_test_model.as_deref().unwrap_or("");
                if v.is_empty() { Self::DEFAULT_AUTO_TEST_MODEL.to_string() } else { v.to_string() }
            },
        }
    }

    /// Resolve an optional i64: if 0 or None, use the default.
    fn resolve(val: Option<i64>, default: i64) -> i64 {
        match val {
            Some(v) if v > 0 => v,
            _ => default,
        }
    }

    /// Calculate exponential backoff delay with jitter for retry.
    pub fn retry_delay(&self, retry_count: i64) -> i64 {
        let delay = std::cmp::min(
            self.retry_base_delay_secs * (1 << retry_count),
            self.retry_max_delay_secs,
        );
        // +-20% jitter
        let jitter = (delay as f64 * 0.2 * (rand::random::<f64>() * 2.0 - 1.0)) as i64;
        std::cmp::max(delay + jitter, 10)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_roundtrip() {
        for s in ["backlog", "in_progress", "testing", "done", "failed", "awaiting_approval"] {
            let status = TaskStatus::from_str(s).unwrap();
            assert_eq!(status.as_str(), s);
        }
    }

    #[test]
    fn test_invalid_status() {
        assert!(TaskStatus::from_str("unknown").is_none());
        assert!(TaskStatus::from_str("").is_none());
    }

    #[test]
    fn test_valid_transitions() {
        use TaskStatus::*;
        // Normal flow
        assert!(is_valid_transition(Backlog, InProgress));
        assert!(is_valid_transition(InProgress, Testing));
        assert!(is_valid_transition(Testing, Done));
        // Revision
        assert!(is_valid_transition(Testing, InProgress));
        // Retry
        assert!(is_valid_transition(Failed, Backlog));
        assert!(is_valid_transition(Failed, InProgress));
    }

    #[test]
    fn test_invalid_transitions() {
        use TaskStatus::*;
        // Can't go backwards past queue
        assert!(!is_valid_transition(Backlog, Done));
        assert!(!is_valid_transition(Backlog, Testing));
        assert!(!is_valid_transition(Backlog, Failed));
        // Self-transition
        assert!(!is_valid_transition(Done, Done));
        // Can't go from done to testing directly
        assert!(!is_valid_transition(Done, Testing));
    }
}
