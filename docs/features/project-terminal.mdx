---
title: "Project Terminal"
description: "Watch every running task in a project from a single live terminal tab with per-task color-coded badges"
icon: "terminal"
---

The **Project Terminal** tab aggregates log output from every task in the current project into one live view. Instead of opening a separate terminal per task, you get a single feed where each line is prefixed with a color-coded `[TASK-KEY]` badge so you can tell which CLI wrote what at a glance.

<Frame>
  <img src="/images/feature-terminal.svg" alt="Project Terminal tab" />
</Frame>

## Opening the tab

Open any project, then click the **Terminal** icon in the top view tabs (next to Roadmap). The tab streams logs in real time via the same `task:log` event used by the per-task Live Terminal, so there's nothing to start — the moment an agent emits a line, it appears here.

## Per-task color-coded prefix

Every line carries a `[TASK-KEY]` badge styled with the color mapped to the task's `task_type`:

| Type       | Color      |
|------------|------------|
| `feature`  | Blue       |
| `bugfix`   | Red        |
| `refactor` | Purple     |
| `docs`     | Green      |
| `test`     | Yellow     |
| `chore`    | Gray       |

Hover the badge to see the task title. The timestamp is shown in a fixed-width column so columns align cleanly even when messages span multiple lines.

## Unified vs Split view

The header has a toggle between two modes:

<Tabs>
  <Tab title="Unified">
    A single auto-scrolling log where all active tasks share one feed ordered by event arrival time. This is the default — it's the fastest way to follow a swarm of parallel agents without losing context.
  </Tab>
  <Tab title="Split">
    Each active task gets its own pane in a responsive grid. The grid adapts to the number of active tasks:

    - 2 tasks → 1 × 2
    - 3–4 tasks → 2 × 2
    - 5–9 tasks → 3 × 3
    - 10+ tasks → 4 columns

    Each pane auto-scrolls independently, so pausing your cursor in one pane doesn't pin the others.
  </Tab>
</Tabs>

## Active filter

The **Active only** toggle (default ON) limits the view to tasks that are actively running or under review. A task counts as active when any of the following is true:

- `is_running` is `true`
- `status` is `in_progress`
- `status` is `review` (the task is in testing)
- `status` is `verifying`

Toggle to **All tasks** when you want to see logs from completed or paused tasks as well — useful for scrolling back through history or comparing outputs across states.

## Stream controls

<Columns cols={3}>
  <Card title="Pause" icon="pause">
    Freezes the view. New log events are queued (a counter shows how many). Press Resume to flush them in order.
  </Card>
  <Card title="Resume" icon="play">
    Dumps all queued events into the view and re-enables live streaming. If the buffer exceeds the cap, older entries are trimmed.
  </Card>
  <Card title="Clear" icon="trash">
    Empties the current view (and any paused queue). Back-end logs are not touched — the per-task Live Terminal still has the full history.
  </Card>
</Columns>

## Auto-scroll behavior

The view sticks to the bottom while you're at the bottom. Scroll up and it pauses auto-scroll so you can read earlier output; an **Arrow-down** button appears in the bottom-right — click it to jump back to the live tail.

## When to use this

- **Watching parallel orchestrations** — multiple agents running via the DAG / queue at once; Split mode gives every agent its own viewport.
- **Debugging a chain of tasks** — Unified mode with Active only off lets you see the full timeline of cause-and-effect across a plan's execution.
- **Triage without context-switching** — stay on the Terminal tab while agents work; jump to the board only when an agent finishes or needs review.

<Info>
  Subscription to the event bus is registered once when the tab mounts and never re-subscribes on task-list updates. That means log events are never dropped between a React re-render and the new listener attaching.
</Info>

## Limits

- The view keeps the most recent 3000 lines in memory (trimmed to ~70% when the cap is hit). Older lines scroll out of view but remain in the per-task database if you need them later.
- Split mode fits up to 4 columns; beyond ~16 simultaneous active tasks the panes become quite narrow — Unified mode is a better fit at that scale.
