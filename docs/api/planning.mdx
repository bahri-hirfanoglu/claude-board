---
title: "Planning API"
description: "Start, monitor, and cancel AI-powered planning sessions"
icon: "sparkles"
---

## Start Planning

```http
POST /api/projects/:projectId/plan
```

Starts a new planning session. Claude will explore the codebase and generate tasks.

**Request Body:**

```json
{
  "topic": "Build an authentication system with OAuth2 and JWT",
  "model": "sonnet",
  "effort": "medium",
  "granularity": "balanced",
  "context": "Express.js backend, React frontend"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `topic` | string | *required* | What to plan — the main feature or goal |
| `model` | string | `sonnet` | Claude model: `haiku`, `sonnet`, `opus` |
| `effort` | string | `medium` | Thinking budget: `low`, `medium`, `high` |
| `granularity` | string | `balanced` | Task detail: `high-level`, `balanced`, `detailed` |
| `context` | string | `""` | Additional context about tech stack or constraints |

**Response:**

```json
{
  "planId": "plan-1-1711234567890",
  "status": "started"
}
```

Returns `409` if a planning session is already active for the project.

## Get Status

```http
GET /api/projects/:projectId/plan/status
```

Check whether a planning session is currently running.

**Response (active):**

```json
{
  "active": true,
  "planId": "plan-1-1711234567890",
  "elapsed": 12340,
  "tokens": { "input": 15000, "output": 3200 },
  "toolCalls": 8,
  "turns": 3,
  "phase": "exploring",
  "topic": "Build an authentication system"
}
```

**Response (inactive):**

```json
{
  "active": false,
  "planId": null
}
```

## Cancel Planning

```http
POST /api/projects/:projectId/plan/cancel
```

Stops the active planning session and kills the Claude process.

**Response:**

```json
{
  "status": "cancelled"
}
```

Returns `404` if no active planning session exists.

## WebSocket Events

Planning progress is streamed via Socket.IO events:

### plan:started

Emitted when a planning session begins.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890",
  "topic": "Build authentication",
  "model": "sonnet",
  "effort": "medium"
}
```

### plan:phase

Emitted when the planning phase changes.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890",
  "phase": "exploring"
}
```

Phases: `starting` &rarr; `exploring` &rarr; `writing` &rarr; (completed)

### plan:progress

Emitted when Claude produces text output.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890",
  "type": "text",
  "content": "I'll start by examining the project structure..."
}
```

### plan:log

Emitted for tool calls and results.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890",
  "type": "tool",
  "message": "Read \u2192 src/app.js",
  "tool": "Read"
}
```

Types: `tool`, `result`, `error`, `phase`

### plan:stats

Emitted after each Claude turn with updated usage stats.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890",
  "elapsed": 8500,
  "tokens": { "input": 12000, "output": 2400 },
  "toolCalls": 5,
  "turns": 2
}
```

### plan:completed

Emitted when planning finishes. Contains the created tasks.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890",
  "tasks": [
    { "id": 42, "title": "Set up auth middleware", "task_type": "feature", "task_key": "FTR-CB-1042" }
  ],
  "stats": {
    "elapsed": 45000,
    "tokens": { "input": 25000, "output": 8000 },
    "toolCalls": 12,
    "turns": 4,
    "exitCode": 0
  }
}
```

### plan:cancelled

Emitted when a planning session is manually cancelled.

```json
{
  "projectId": 1,
  "planId": "plan-1-1711234567890"
}
```
