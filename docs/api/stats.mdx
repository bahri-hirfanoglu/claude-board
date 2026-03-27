---
title: "Stats API"
description: "Project statistics, activity feed, and Claude usage data"
icon: "chart-mixed"
---

## Project Stats

```http
GET /api/projects/:projectId/stats
```

Returns aggregate statistics for a project.

```json
{
  "statusCounts": {
    "backlog": 5,
    "in_progress": 2,
    "testing": 1,
    "done": 12
  },
  "typeCounts": {
    "feature": 8,
    "bugfix": 5,
    "refactor": 3,
    "docs": 2,
    "test": 1,
    "chore": 1
  },
  "priorityCounts": {
    "0": 3,
    "1": 10,
    "2": 5,
    "3": 2
  },
  "totalTasks": 20,
  "avgDuration": 845000,
  "completedToday": 3
}
```

| Field | Description |
|-------|-------------|
| `statusCounts` | Tasks per status column |
| `typeCounts` | Tasks per type |
| `priorityCounts` | Tasks per priority level |
| `totalTasks` | Total task count |
| `avgDuration` | Average completion time in milliseconds |
| `completedToday` | Tasks moved to Done today |

## Activity Feed

```http
GET /api/projects/:projectId/activity?limit=50&offset=0
```

Returns recent task events in chronological order. Useful for building a project timeline.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `50` | Max number of entries to return |
| `offset` | `0` | Number of entries to skip (for pagination) |

```json
[
  {
    "taskId": 5,
    "taskTitle": "Add login page",
    "event": "status_change",
    "from": "in_progress",
    "to": "testing",
    "timestamp": "2025-01-15T14:30:00Z"
  }
]
```

## Claude Usage

```http
GET /api/stats/claude-usage
```

Returns aggregated Claude API usage across all projects and tasks. This is a global endpoint, not per-project.

```json
{
  "usage": {
    "totalInputTokens": 125000,
    "totalOutputTokens": 48000,
    "totalCacheRead": 30000,
    "totalCacheCreation": 15000,
    "totalCost": 12.50
  },
  "models": {
    "sonnet": { "tasks": 10, "inputTokens": 80000, "outputTokens": 30000, "cost": 5.20 },
    "opus": { "tasks": 3, "inputTokens": 40000, "outputTokens": 15000, "cost": 6.80 },
    "haiku": { "tasks": 7, "inputTokens": 5000, "outputTokens": 3000, "cost": 0.50 }
  },
  "timeline": [...],
  "limits": {
    "dailyLimit": null,
    "currentUsage": 12.50
  }
}
```

<Info>Cost estimates are calculated from published Claude API pricing. Actual costs may vary based on your billing plan.</Info>

## CLAUDE.md (Tauri IPC)

### Get CLAUDE.md

```javascript
invoke('get_claude_md', { projectId: 1 })
```

Returns the contents of the project's CLAUDE.md file.

```json
{
  "content": "# Project Instructions\n...",
  "path": "/home/user/my-app/CLAUDE.md",
  "exists": true
}
```

### Save CLAUDE.md

```javascript
invoke('save_claude_md', { projectId: 1, content: "# Updated instructions" })
```

Writes content to the project's CLAUDE.md file.
