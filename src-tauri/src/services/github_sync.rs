//! Synchronous GitHub helpers for use in sync contexts (e.g., task status change).
//! Uses reqwest::blocking to avoid async runtime issues in std::thread::spawn.

use reqwest::blocking::Client;

fn client() -> Client {
    Client::builder()
        .user_agent("Claude-Board")
        .build()
        .unwrap_or_else(|_| Client::new())
}

pub fn close_and_comment(token: &str, repo: &str, issue_number: i64, comment: &str) -> Result<(), String> {
    let c = client();

    // Add comment first
    let comment_url = format!("https://api.github.com/repos/{}/issues/{}/comments", repo, issue_number);
    c.post(&comment_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({"body": comment}))
        .send()
        .map_err(|e| format!("Comment failed: {}", e))?;

    // Close issue
    let close_url = format!("https://api.github.com/repos/{}/issues/{}", repo, issue_number);
    let resp = c.patch(&close_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({"state": "closed"}))
        .send()
        .map_err(|e| format!("Close failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Failed to close issue #{}: {}", issue_number, resp.status()));
    }

    log::info!("GitHub issue #{} closed with comment", issue_number);
    Ok(())
}
