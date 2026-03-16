---
title: "Templates API"
description: "CRUD endpoints for prompt templates"
icon: "file-lines"
---

## List Templates

```http
GET /api/projects/:projectId/templates
```

Returns all prompt templates for a project.

```json
[
  {
    "id": 1,
    "projectId": 1,
    "name": "Feature Template",
    "content": "You are working on {{project_name}}...",
    "taskType": "feature",
    "model": "sonnet",
    "thinkingEffort": "medium",
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

## Get Template

```http
GET /api/projects/:projectId/templates/:id
```

## Create Template

```http
POST /api/projects/:projectId/templates
Content-Type: application/json
```

```json
{
  "name": "Feature Template",
  "content": "You are working on {{project_name}}.\nTask: {{task_title}}\nType: {{task_type}}\n\nWrite clean, tested code.",
  "taskType": "feature",
  "model": "sonnet",
  "thinkingEffort": "medium"
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | — | Template display name |
| `content` | Yes | — | Template text with optional `{{variables}}` |
| `taskType` | No | — | Auto-apply to this task type |
| `model` | No | — | Default model when template is used |
| `thinkingEffort` | No | — | Default thinking effort |

### Template Variables

| Variable | Resolves To |
|----------|-------------|
| `{{project_name}}` | Project name |
| `{{task_title}}` | Task title |
| `{{task_type}}` | Task type (feature, bugfix, etc.) |
| `{{priority}}` | Priority level |
| `{{model}}` | Selected model |

## Update Template

```http
PUT /api/projects/:projectId/templates/:id
Content-Type: application/json
```

Accepts the same fields as Create.

## Delete Template

```http
DELETE /api/projects/:projectId/templates/:id
```
