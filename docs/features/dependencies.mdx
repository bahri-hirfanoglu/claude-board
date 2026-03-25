---
title: "Task Dependencies"
description: "DAG-based dependency system with conditional workflows, context handoff, and sub-task spawning"
icon: "diagram-project"
---

Task dependencies define execution order and enable advanced orchestration patterns. Claude Board supports full DAG (Directed Acyclic Graph) dependencies with conditional branching, automatic context sharing, and sub-task spawning.

## Adding Dependencies

<Steps>
  <Step title="Open task modal">
    Click edit on an existing task, or create a new task.
  </Step>
  <Step title="Expand Options">
    Click the **Options** section to reveal the dependency editor.
  </Step>
  <Step title="Search and add">
    Click **Add dependency** to search and select parent tasks. You can also **Shift+drag** between nodes in the Orchestration Graph view.
  </Step>
</Steps>

## Conditional Dependencies

Dependencies can have conditions that control when child tasks are triggered:

| Condition | Edge Color | Behavior |
|-----------|-----------|----------|
| **Always** (default) | Gray solid | Child starts when parent reaches `done` or `testing` |
| **On Success** | Green dashed | Same as Always — child starts when parent succeeds |
| **On Failure** | Red dashed | Child starts only when parent has permanently failed (retries exhausted) |

<Tip>Use On Failure conditions to create automatic recovery workflows. Example: If a build task fails, trigger a debug task automatically.</Tip>

## Agent Context Handoff

When a parent task completes, Claude Board automatically generates a **context summary** containing:

- Git diff statistics (files changed)
- Recent commit messages
- Last Claude output summary
- Branch information

This context is **automatically injected** into dependent child task prompts. Child agents know what the parent did, what files changed, and can build on that work without re-exploring the codebase.

## Sub-task Spawning

Running agents can create sub-tasks via MCP tools. When an agent calls `create_task` with a `parent_task_id`, the sub-task is linked to the parent:

1. Agent calls `create_task` with `parent_task_id` set to its own task ID
2. Sub-task is created in backlog and auto-queued
3. Parent task enters **awaiting sub-tasks** state after its Claude process finishes
4. Sub-tasks execute (respecting DAG and concurrency)
5. When **all** sub-tasks reach `done`/`testing`, the parent automatically completes

<Info>Sub-tasks inherit the parent's project context. The parent task's prompt instructs Claude on how to use `parent_task_id` when creating sub-tasks.</Info>

## Cycle Detection

Claude Board prevents circular dependencies using DFS (Depth-First Search) traversal. If adding a dependency would create a cycle (A -> B -> C -> A), the operation is rejected.

## Dependency Patterns

<Tabs>
  <Tab title="Chain">
    Sequential: A -> B -> C -> D. Each task starts only after the previous completes.
  </Tab>
  <Tab title="Fan-out">
    One parent, multiple children: A -> [B, C, D]. All children run in parallel once A completes.
  </Tab>
  <Tab title="Fan-in">
    Multiple parents, one child: [A, B, C] -> D. D starts only when ALL parents complete.
  </Tab>
  <Tab title="Conditional">
    Success/failure branching: A -> B (on_success), A -> C (on_failure). If A succeeds, B runs. If A fails, C runs instead.
  </Tab>
</Tabs>

## API

- `addDependency(taskId, dependsOnId, conditionType?)` — Add dependency with optional condition (`always`, `on_success`, `on_failure`)
- `removeDependency(taskId, dependsOnId)` — Remove a dependency
- `getTaskDependencies(taskId)` — Get parents and children
- `getDependencyGraph(projectId)` — Full graph with edges (including `conditionType`) and waves
- `getExecutionWaves(projectId)` — Wave groupings
