---
title: "Tasks API"
description: "CRUD, status changes, agent control, dependencies, and observability"
icon: "list-check"
---

## List Tasks

```http
GET /api/projects/:projectId/tasks
```

Returns all tasks for a project, ordered by priority and creation date.

## Get Task

```http
GET /api/tasks/:id
```

Returns a single task with all fields.

## Get Task Detail

```http
GET /api/tasks/:id/detail
```

Extended detail view including revision history, attachments, parsed commits, and complete log entries.

```json
{
  "id": 1,
  "title": "Add authentication",
  "description": "Implement JWT login",
  "status": "testing",
  "priority": 2,
  "task_type": "feature",
  "model": "sonnet",
  "thinking_effort": "medium",
  "acceptance_criteria": "All tests pass",
  "tags": "[\"auth\", \"backend\"]",
  "task_key": "FTR-PRJ-1001",
  "commits": [{ "hash": "abc1234", "message": "Add login endpoint" }],
  "revisions": [
    { "id": 1, "taskId": 1, "feedback": "Add validation", "createdAt": "..." }
  ],
  "attachments": [
    { "id": 1, "taskId": 1, "fileName": "spec.pdf", "mimeType": "application/pdf" }
  ]
}
```

## Create Task

```http
POST /api/projects/:projectId/tasks
Content-Type: application/json
```

```json
{
  "title": "Add user authentication",
  "description": "Implement JWT-based login and registration",
  "task_type": "feature",
  "priority": 2,
  "model": "sonnet",
  "thinking_effort": "medium",
  "acceptance_criteria": "All auth tests pass, tokens expire correctly",
  "tags": "[\"auth\"]",
  "parent_task_id": null
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `title` | Yes | -- | Task title |
| `description` | No | `""` | Detailed instructions for the agent |
| `task_type` | No | `feature` | `feature`, `bugfix`, `refactor`, `docs`, `test`, `chore` |
| `priority` | No | `0` | 0 (low) to 3 (urgent) |
| `model` | No | `sonnet` | `opus`, `sonnet`, `haiku` |
| `thinking_effort` | No | `medium` | `low`, `medium`, `high` |
| `acceptance_criteria` | No | `""` | Criteria the agent must satisfy |
| `tags` | No | `null` | JSON array string of tag labels |
| `parent_task_id` | No | `null` | Parent task ID for sub-task linking |

<Info>When `parent_task_id` is set, the new task becomes a sub-task. The parent automatically enters "awaiting sub-tasks" mode and completes when all sub-tasks finish.</Info>

## Update Task

```http
PUT /api/tasks/:id
Content-Type: application/json
```

Accepts the same fields as Create (except `parent_task_id`). Only included fields are updated.

```json
{
  "title": "Updated title",
  "priority": 3,
  "tags": "[\"urgent\", \"auth\"]"
}
```

## Change Status

```http
PATCH /api/tasks/:id/status
Content-Type: application/json
```

```json
{ "status": "in_progress" }
```

Valid statuses: `backlog`, `in_progress`, `testing`, `done`, `failed`

Moving to `in_progress` spawns a Claude agent. Moving to `done` stops any running agent.

## Get Logs

```http
GET /api/tasks/:id/logs?limit=500
```

Returns recent agent log entries for a task, ordered chronologically (oldest first).

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `500` | Max number of log entries to return |

## Get Revisions

```http
GET /api/tasks/:id/revisions
```

Returns all change-request revisions for a task.

## Delete Task

```http
DELETE /api/tasks/:id
```

Returns `{ "ok": true }` on success.

---

## Agent Control (Tauri IPC)

<Note>These endpoints are only available in the Tauri desktop app. They are not exposed via the HTTP API.</Note>

### Stop Agent

```javascript
invoke('stop_task', { id: 1 })
```

Kills the running Claude process for a task and sets status to `backlog`.

### Restart Agent

```javascript
invoke('restart_task', { id: 1, mcpPort: 4000 })
```

Stops any running agent and restarts a fresh Claude session.

### Request Changes

```javascript
invoke('request_changes', {
  id: 1,
  feedback: "Add input validation to the login endpoint",
  mcpPort: 4000
})
```

Creates a revision record and resumes the agent with the feedback.

### Get Task Diff

```javascript
invoke('get_task_diff', { taskId: 1 })
```

Returns git diff of changes made by the agent on the task's feature branch.

```json
{
  "diff": "diff --git a/src/auth.rs ...",
  "branch": "cb/add-authentication-1",
  "stats": { "files": 3, "insertions": 45, "deletions": 12 }
}
```

---

## Dependencies (Tauri IPC)

### Add Dependency

```javascript
invoke('add_task_dependency', {
  taskId: 5,
  dependsOnId: 3,
  conditionType: 'always' // 'always' | 'on_success' | 'on_failure'
})
```

Creates a dependency edge with an optional condition type. Returns error if it would create a cycle.

### Remove Dependency

```javascript
invoke('remove_task_dependency', { taskId: 5, dependsOnId: 3 })
```

### Get Task Dependencies

```javascript
invoke('get_task_dependencies', { taskId: 5 })
// -> { parents: [3, 1], children: [8, 9] }
```

### Get Dependency Graph

```javascript
invoke('get_dependency_graph', { projectId: 1 })
// -> { tasks: [...], edges: [{from: 3, to: 5, conditionType: "always"}, ...], waves: [...] }
```

### Get Execution Waves

```javascript
invoke('get_execution_waves', { projectId: 1 })
// -> [[task1, task2], [task3], [task4, task5]]
```

Returns tasks grouped by execution wave. Tasks in the same wave can run in parallel.

### Get Pipeline Status

```javascript
invoke('get_pipeline_status', { projectId: 1 })
```

Returns current pipeline execution state including which wave is active and which tasks are blocked.

---

## Queue Management (Tauri IPC)

### Reorder Queue

```javascript
invoke('reorder_queue', { projectId: 1, taskIds: [5, 3, 8, 1] })
```

Reorders the task queue by setting priority based on the provided order.

---

## Observability (Tauri IPC)

### Get Agent Activity

```javascript
invoke('get_agent_activity', { projectId: 1 })
```

Returns real-time data about all running agents:

```json
{
  "agents": [
    {
      "taskId": 5,
      "taskKey": "FTR-PRJ-1005",
      "title": "Add authentication",
      "model": "sonnet",
      "elapsedSec": 120,
      "inputTokens": 50000,
      "outputTokens": 12000,
      "totalCost": 0.33,
      "toolCallCount": 45,
      "recentTools": [...],
      "activeFiles": ["src/auth.rs", "src/main.rs"],
      "isRunning": true,
      "awaitingSubtasks": false
    }
  ],
  "fileMap": {
    "src/auth.rs": [5],
    "src/main.rs": [5, 8]
  },
  "conflicts": [
    { "filePath": "src/main.rs", "taskIds": [5, 8] }
  ]
}
```

### Get Active File Map

```javascript
invoke('get_active_file_map')
// -> { "src/auth.rs": [5], "src/main.rs": [5, 8] }
```

Returns a map of file paths to task IDs currently accessing them.

### Get Task Events

```javascript
invoke('get_task_events', { taskId: 1, limit: 500 })
```

Returns structured event log for a task including tool calls, status changes, and agent messages.
