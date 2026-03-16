---
title: "Webhooks API"
description: "CRUD and test endpoints for webhook configuration"
icon: "bell"
---

## List Webhooks

```http
GET /api/projects/:projectId/webhooks
```

Returns all webhooks configured for a project.

```json
[
  {
    "id": 1,
    "projectId": 1,
    "platform": "slack",
    "url": "https://hooks.slack.com/services/...",
    "events": ["task:completed", "task:approved"],
    "enabled": true
  }
]
```

## Get Webhook

```http
GET /api/projects/:projectId/webhooks/:id
```

## Create Webhook

```http
POST /api/projects/:projectId/webhooks
Content-Type: application/json
```

```json
{
  "platform": "slack",
  "url": "https://hooks.slack.com/services/T00/B00/xxx",
  "events": ["task:completed", "task:approved"],
  "enabled": true
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `platform` | Yes | `slack`, `discord`, `teams`, `custom` |
| `url` | Yes | Webhook endpoint URL |
| `events` | Yes | Array of event types to subscribe to |
| `enabled` | No | Default `true` |

### Available Events

| Event | Trigger |
|-------|---------|
| `task:created` | New task added |
| `task:started` | Task moved to In Progress |
| `task:completed` | Agent finished, task in Testing |
| `task:approved` | Task approved, moved to Done |
| `task:changes_requested` | Reviewer requested revisions |

## Update Webhook

```http
PUT /api/projects/:projectId/webhooks/:id
Content-Type: application/json
```

Accepts the same fields as Create.

## Delete Webhook

```http
DELETE /api/projects/:projectId/webhooks/:id
```

## Test Webhook

```http
POST /api/projects/:projectId/webhooks/:id/test
```

Sends a sample payload to the webhook URL using the configured platform format. Returns the HTTP status code from the target endpoint.

<Tip>Always test webhooks after creation to verify the URL and authentication are correct.</Tip>
