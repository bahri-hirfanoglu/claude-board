---
title: "Workflow Templates"
description: "Reusable task chain templates with dependency setup"
icon: "sitemap"
---

Workflow Templates let you define reusable sequences of tasks with pre-configured dependencies and conditions.

## Creating a Template

Use the API (UI coming soon):
```javascript
api.createWorkflowTemplate(projectId, "Feature Pipeline", "Standard feature workflow", JSON.stringify([
  { title: "Implement feature", task_type: "feature", depends_on_steps: [] },
  { title: "Write tests", task_type: "test", depends_on_steps: [0] },
  { title: "Code review", task_type: "refactor", depends_on_steps: [1] },
  { title: "Create PR", task_type: "chore", depends_on_steps: [2], condition_type: "on_success" }
]))
```

## Step Properties

| Field | Description |
|-------|-------------|
| `title` | Task title |
| `description` | Task description (optional) |
| `task_type` | feature, bugfix, refactor, docs, test, chore |
| `model` | Claude model override (optional) |
| `acceptance_criteria` | Test criteria (optional) |
| `depends_on_steps` | Array of step indices this step depends on |
| `condition_type` | always, on_success, on_failure, on_any |

## Applying a Template

```javascript
api.applyWorkflowTemplate(templateId, projectId)
```

This creates all tasks with proper dependency wiring. The queue will automatically execute them in the correct order.
