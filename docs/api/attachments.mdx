---
title: "Attachments API"
description: "File attachments for tasks"
icon: "paperclip"
---

## Get Attachments

```javascript
invoke('get_attachments', { taskId: 1 })
```

Returns all attachments for a task.

```json
[
  {
    "id": 1,
    "taskId": 1,
    "fileName": "design-spec.pdf",
    "mimeType": "application/pdf",
    "size": 245000,
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

## Upload Attachments (Tauri IPC)

```javascript
invoke('upload_attachment', {
  taskId: 1,
  fileData: [...],       // Uint8Array as number array
  fileName: "spec.pdf",
  mimeType: "application/pdf"
})
```

Uploads a single file attachment to a task. The frontend handles multiple files by calling this for each file sequentially.

| Field | Required | Description |
|-------|----------|-------------|
| `taskId` | Yes | Target task ID |
| `fileData` | Yes | File contents as byte array |
| `fileName` | Yes | Original file name |
| `mimeType` | Yes | MIME type (e.g. `application/pdf`, `image/png`) |

## Upload Attachments (HTTP)

```http
POST /api/tasks/:taskId/attachments
Content-Type: multipart/form-data
```

Upload one or more files using standard multipart form data. Files should be sent under the `files` field name.

## Delete Attachment

```javascript
invoke('delete_attachment', { id: 1 })
```

Permanently removes an attachment and its stored file data.

<Note>Attachments are stored in the local SQLite database. They are included in the task detail view and can be referenced by Claude agents during task execution.</Note>
