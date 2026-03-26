---
title: "Failed Status"
description: "Dedicated status column for permanently failed tasks"
icon: "circle-xmark"
---

Tasks that exhaust all retry attempts are moved to a dedicated **Failed** status. This gives you clear visibility into what went wrong and easy recovery options.

## Visual Indicators

The Failed status is clearly marked with red indicators across every view:

<Tabs>
  <Tab title="Board View">
    A dedicated red **Failed** column appears on the Kanban board. Cards show the retry count and failure reason.
  </Tab>
  <Tab title="List View">
    Red status dot with failure details. Sortable by failure time.
  </Tab>
  <Tab title="Graph View">
    Red-filled node with red stroke in the dependency DAG. Downstream tasks show a blocked indicator.
  </Tab>
  <Tab title="Timeline View">
    Red bar segment with the retry attempts visible as smaller bars before the final failure.
  </Tab>
</Tabs>

## Task Lifecycle

```
Backlog ──▶ In Progress ──▶ Testing ──▶ Done
                │               │
                ▼               ▼
             Failed ◀───────────┘
                │
                ▼ (manual action)
             Backlog (retry count resets)
```

A task reaches Failed status when:
1. The agent process crashes or exits with an error
2. The task has already used all configured [retry attempts](/features/retry-backoff)
3. No more retries are available

## Recovery

<Steps>
  <Step title="Review the failure" icon="magnifying-glass">
    Open the task to see the terminal output and understand what went wrong. Check the last tool calls and error messages.
  </Step>
  <Step title="Fix the issue" icon="wrench">
    Common fixes: update the task description with more context, change the model to Opus for complex tasks, fix a broken dependency, or resolve a git conflict.
  </Step>
  <Step title="Retry the task" icon="rotate">
    Move the task back to **Backlog** or **In Progress**. The retry counter automatically resets to 0.
  </Step>
</Steps>

<Tip>If a task keeps failing, try breaking it into smaller sub-tasks with dependencies. Complex tasks have a higher success rate when decomposed.</Tip>

## Conditional Dependencies

Failed tasks can trigger [on_failure dependencies](/features/dependencies). This lets you build recovery workflows:

- Task A fails → Task B (debug/fix task) starts automatically
- Notification webhook fires with failure details
- A simpler version of the task can be attempted with a different model
