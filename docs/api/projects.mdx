---
title: "Projects API"
description: "CRUD endpoints for managing projects"
icon: "folder"
---

## List Projects

```http
GET /api/projects
```

Returns all projects with basic info.

```json
[
  {
    "id": 1,
    "name": "My App",
    "slug": "my-app",
    "workingDir": "/home/user/my-app",
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

## Get Project Summary

```http
GET /api/projects/summary
```

Returns all projects with task counts per status. Useful for dashboard overview.

```json
[
  {
    "id": 1,
    "name": "My App",
    "slug": "my-app",
    "workingDir": "/home/user/my-app",
    "backlogCount": 5,
    "inProgressCount": 2,
    "testingCount": 1,
    "doneCount": 12
  }
]
```

## Get Project

```http
GET /api/projects/:id
```

Returns a single project with full settings including permission mode, allowed tools, queue configuration, git settings, auto-test, and GitHub integration.

```json
{
  "id": 1,
  "name": "My App",
  "slug": "my-app",
  "workingDir": "/home/user/my-app",
  "icon": null,
  "iconSeed": null,
  "permissionMode": "auto-accept",
  "allowedTools": null,
  "autoQueue": 1,
  "maxConcurrent": 2,
  "autoBranch": 1,
  "autoPr": 0,
  "prBaseBranch": "main",
  "autoTest": 0,
  "testPrompt": "",
  "taskTimeoutMinutes": null,
  "maxRetries": 0,
  "githubRepo": "owner/repo",
  "githubSyncEnabled": 0,
  "createdAt": "2025-01-15T10:00:00Z"
}
```

## Create Project

```http
POST /api/projects
Content-Type: application/json
```

```json
{
  "name": "My App",
  "slug": "my-app",
  "workingDir": "/home/user/my-app",
  "permissionMode": "auto-accept",
  "allowedTools": [],
  "icon": null,
  "iconSeed": null
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Project display name |
| `slug` | Yes | URL-safe identifier (must be unique) |
| `workingDir` | Yes | Absolute path to codebase |
| `permissionMode` | No | `auto-accept`, `allow-tools`, `default` |
| `allowedTools` | No | Comma-separated tool names (for `allow-tools` mode) |
| `icon` | No | Custom icon identifier |
| `iconSeed` | No | Seed for auto-generated icon |

<Info>Additional settings like queue, git, auto-test, and GitHub integration are configured via Update Project after creation.</Info>

## Update Project

```http
PUT /api/projects/:id
Content-Type: application/json
```

Accepts any combination of the fields below. Only included fields are updated.

```json
{
  "name": "My App (Updated)",
  "autoQueue": true,
  "maxConcurrent": 3,
  "autoBranch": true,
  "autoPr": true,
  "prBaseBranch": "develop",
  "autoTest": true,
  "testPrompt": "Run npm test and verify all pass",
  "taskTimeoutMinutes": 30,
  "maxRetries": 3,
  "githubRepo": "owner/repo",
  "githubSyncEnabled": 1
}
```

### Basic Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Project display name |
| `slug` | string | URL-safe identifier |
| `workingDir` | string | Absolute path to codebase |
| `icon` | string | Custom icon identifier |
| `iconSeed` | string | Seed for auto-generated icon |
| `permissionMode` | string | `auto-accept`, `allow-tools`, `default` |
| `allowedTools` | string | Comma-separated tool names |

### Queue Settings

| Field | Type | Description |
|-------|------|-------------|
| `autoQueue` | boolean | Auto-start queued tasks when slots available |
| `maxConcurrent` | integer | Max concurrent agents (1–5) |

### Git & PR Settings

| Field | Type | Description |
|-------|------|-------------|
| `autoBranch` | boolean | Auto-create feature branches per task |
| `autoPr` | boolean | Auto-create pull request when task completes |
| `prBaseBranch` | string | Target branch for auto-PRs (default: `main`) |

### Auto-Test Settings

| Field | Type | Description |
|-------|------|-------------|
| `autoTest` | boolean | Enable automatic test verification after task completion |
| `testPrompt` | string | Custom prompt for the test verification agent |

### Retry & Timeout Settings

| Field | Type | Description |
|-------|------|-------------|
| `taskTimeoutMinutes` | integer | Kill agent after N minutes (0 = no timeout) |
| `maxRetries` | integer | Auto-retry failed tasks up to N times (0 = no retries, default max: 2) |

### GitHub Integration

| Field | Type | Description |
|-------|------|-------------|
| `githubRepo` | string | GitHub repository in `owner/repo` format |
| `githubSyncEnabled` | integer | Enable GitHub issue sync (1 = enabled, 0 = disabled) |

## Delete Project

```http
DELETE /api/projects/:id
```

<Warning>Deleting a project stops all running agents and removes all tasks, logs, webhooks, snippets, templates, and attachments. This cannot be undone.</Warning>
