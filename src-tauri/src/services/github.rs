use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubIssue {
    pub number: i64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub html_url: String,
    pub labels: Vec<GitHubLabel>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubLabel {
    pub name: String,
    pub color: String,
}

fn client() -> Client {
    Client::builder()
        .user_agent("Claude-Board")
        .build()
        .unwrap_or_else(|_| Client::new())
}

pub async fn fetch_issues(token: &str, repo: &str, state: &str) -> Result<Vec<GitHubIssue>, String> {
    let url = format!("https://api.github.com/repos/{}/issues?state={}&per_page=100&sort=updated&direction=desc", repo, state);
    let resp = client().get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API returned {}: {}", status, body));
    }

    let issues: Vec<GitHubIssue> = resp.json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    // Filter out pull requests (GitHub returns PRs in issues endpoint)
    Ok(issues.into_iter().filter(|i| !i.html_url.contains("/pull/")).collect())
}

pub async fn close_issue(token: &str, repo: &str, issue_number: i64) -> Result<(), String> {
    let url = format!("https://api.github.com/repos/{}/issues/{}", repo, issue_number);
    let resp = client().patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({"state": "closed"}))
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Failed to close issue #{}: {}", issue_number, resp.status()));
    }
    Ok(())
}

pub async fn add_comment(token: &str, repo: &str, issue_number: i64, body: &str) -> Result<(), String> {
    let url = format!("https://api.github.com/repos/{}/issues/{}/comments", repo, issue_number);
    let resp = client().post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({"body": body}))
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Failed to comment on issue #{}: {}", issue_number, resp.status()));
    }
    Ok(())
}

pub async fn validate_token(token: &str, repo: &str) -> Result<bool, String> {
    let url = format!("https://api.github.com/repos/{}", repo);
    let resp = client().get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;
    Ok(resp.status().is_success())
}
