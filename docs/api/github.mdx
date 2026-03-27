---
title: "GitHub API"
description: "GitHub integration for issue sync, repo detection, and PR automation"
icon: "github"
---

<Note>GitHub integration features are Tauri-only. They require the GitHub CLI (`gh`) to be installed and authenticated via `gh auth login`.</Note>

## Detect Repository

```javascript
invoke('github_detect_repo', { workingDir: "/home/user/my-app" })
// -> "owner/repo"
```

Detects the GitHub repository from the git remote URL in the specified working directory.

Returns the repository in `owner/repo` format, or an error if:
- No git remote is found
- The remote is not a GitHub URL
- The repository format cannot be parsed

## Check Status

```javascript
invoke('github_check_status', { repo: "owner/repo" })
```

Checks the full GitHub integration status: CLI installed, authenticated, and repository accessible.

```json
{
  "status": "ready",
  "message": "Connected",
  "repo": "owner/repo"
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `not_installed` | GitHub CLI (`gh`) is not installed |
| `not_authenticated` | Not logged in -- run `gh auth login` |
| `authenticated` | Logged in but no repo configured |
| `no_access` | Cannot access the specified repository |
| `ready` | Fully connected and repository accessible |

## Fetch Issues

```javascript
invoke('github_fetch_issues', { projectId: 1 })
```

Fetches open GitHub issues from the project's configured repository. Does not create tasks -- just returns the issue list for the user to select from.

```json
{
  "issues": [
    {
      "number": 42,
      "title": "Login page crashes on mobile",
      "body": "Steps to reproduce...",
      "state": "open",
      "html_url": "https://github.com/owner/repo/issues/42",
      "labels": [{ "name": "bug", "color": "d73a4a" }],
      "created_at": "2025-01-10T08:00:00Z",
      "updated_at": "2025-01-12T15:30:00Z",
      "already_imported": false,
      "suggested_type": "bugfix"
    }
  ],
  "repo": "owner/repo"
}
```

| Field | Description |
|-------|-------------|
| `already_imported` | Whether this issue has already been imported as a task |
| `suggested_type` | Auto-detected task type based on issue labels (`feature`, `bugfix`, `refactor`, `docs`, `test`, `chore`) |

<Info>The project must have a GitHub repo configured in Project Settings before fetching issues.</Info>

## Import Issues

```javascript
invoke('github_import_issues', {
  projectId: 1,
  issueNumbers: [42, 55, 61]
})
```

Imports selected GitHub issues as tasks in the project. Each imported issue becomes a task in `backlog` status.

```json
{
  "imported": 3
}
```

- Duplicate imports are automatically skipped (matched by issue number)
- Task type is auto-detected from issue labels
- Issue body becomes the task description
- All imported tasks are tagged with `["github"]`
- A `task:created` event is emitted for each imported task

## Close Issue

```javascript
invoke('github_close_issue', { projectId: 1, taskId: 5 })
```

Closes the GitHub issue linked to a task. Called automatically when a task with a linked issue moves to `done` status.

Does nothing if the task has no linked GitHub issue or the project has no GitHub repo configured.
