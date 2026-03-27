---
title: "Roles API"
description: "CRUD endpoints for agent roles (system prompts)"
icon: "user-gear"
---

Roles define custom system prompts that shape how Claude agents behave when working on tasks. A role can be assigned to individual tasks to customize agent behavior.

## List Roles

```javascript
invoke('get_roles', { projectId: 1 })
```

Returns all roles for a project.

```json
[
  {
    "id": 1,
    "projectId": 1,
    "name": "Backend Developer",
    "systemPrompt": "You are a senior backend developer...",
    "isGlobal": false,
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

## List Global Roles

```javascript
invoke('get_global_roles')
```

Returns all roles not tied to a specific project. Global roles are available across all projects.

## Create Role

```javascript
invoke('create_role', {
  projectId: 1,
  name: "Backend Developer",
  systemPrompt: "You are a senior backend developer specializing in Rust and TypeScript...",
  isGlobal: false
})
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `projectId` | Yes | -- | Project to associate the role with |
| `name` | Yes | -- | Role display name |
| `systemPrompt` | Yes | -- | System prompt injected into Claude's context |
| `isGlobal` | No | `false` | Make role available across all projects |

## Update Role

```javascript
invoke('update_role', {
  id: 1,
  name: "Senior Backend Developer",
  systemPrompt: "Updated system prompt...",
  isGlobal: false
})
```

Accepts the same fields as Create. All fields are required on update.

## Delete Role

```javascript
invoke('delete_role', { id: 1 })
```

<Warning>Deleting a role does not affect tasks that were previously assigned to it. Those tasks will continue to work without a role-specific system prompt.</Warning>
