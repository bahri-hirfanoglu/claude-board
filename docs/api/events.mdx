---
title: "Tauri Events"
description: "Real-time events via the Tauri event system"
icon: "bolt"
---

Claude Board uses [Tauri's event system](https://v2.tauri.app/develop/calling-rust/#event-system) for real-time communication between the Rust backend and the frontend. All board updates, terminal logs, and usage metrics are delivered through Tauri events.

## Listening for Events

Subscribe to events on the frontend using the Tauri events API:

```javascript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen("task:updated", (event) => {
  console.log("Task updated:", event.payload);
});

// Call unlisten() to unsubscribe when no longer needed
```

## Task Events

### task:created

Emitted when a new task is added to any project.

```json
{
  "task": { "id": 1, "title": "Add login", "status": "backlog", "projectId": 1 }
}
```

### task:updated

Emitted when a task's fields or status change.

```json
{
  "task": { "id": 1, "title": "Add login", "status": "in_progress", "projectId": 1 }
}
```

### task:deleted

Emitted when a task is removed.

```json
{ "taskId": 1, "projectId": 1 }
```

## Agent Events

### task:log

Streamed in real-time as the Claude agent produces output.

```json
{
  "taskId": 1,
  "type": "tool",
  "content": "Reading file: src/app.ts",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

Log types: `claude`, `tool`, `tool_result`, `system`, `error`

### task:usage

Periodic token usage updates for a running task.

```json
{
  "taskId": 1,
  "inputTokens": 5000,
  "outputTokens": 1200,
  "cacheRead": 800,
  "cacheCreation": 200,
  "cost": 0.45
}
```

### claude:limits

Emitted when the agent encounters API rate limits.

```json
{
  "taskId": 1,
  "retryAfter": 30,
  "message": "Rate limit reached, retrying in 30s"
}
```

### claude:finished

Emitted when the Claude agent process exits.

```json
{
  "taskId": 1,
  "exitCode": 0,
  "duration": 45000
}
```

## Collaboration Events

### agent:file_conflict

Emitted when multiple agents access the same file simultaneously (specifically on Write/Edit operations).

```json
{
  "taskId": 5,
  "conflictingTaskId": 8,
  "filePath": "src/main.rs",
  "toolName": "Edit"
}
```

### task:test_started

Emitted when auto-test verification begins.

```json
{ "taskId": 1 }
```

### task:test_completed

Emitted when auto-test verification finishes.

```json
{
  "taskId": 1,
  "verdict": "approve",
  "summary": "All checks passed"
}
```

<Note>All events are emitted globally. Filter by `projectId` or `taskId` on the frontend to show only relevant updates.</Note>
