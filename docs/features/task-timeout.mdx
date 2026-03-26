---
title: "Task Timeout"
description: "Automatic task termination after configurable duration"
icon: "hourglass-end"
---

Prevent tasks from running indefinitely by setting a per-project timeout. When a task exceeds the limit, it's automatically terminated and follows the [retry policy](/features/retry-backoff).

## Configuration

In **Project Settings > Automation**, set **Task Timeout** in minutes:

| Value | Behavior |
|-------|----------|
| **0** (default) | No timeout — tasks run until completion |
| **1–1440** | Auto-kill after this many minutes (max 24 hours) |

<Tip>Start with a generous timeout (30–60 minutes) and adjust down based on your typical task duration. Check the [Analytics](/features/analytics) page to see average task times.</Tip>

## How It Works

<Steps>
  <Step title="Task starts" icon="play">
    A timer begins when the agent process spawns.
  </Step>
  <Step title="Monitoring" icon="eye">
    The queue poll thread checks active processes every 15 seconds against the timeout.
  </Step>
  <Step title="Timeout triggered" icon="hourglass-end">
    When a task exceeds the limit:
    1. Process is terminated (`SIGTERM` on macOS/Linux, `taskkill` on Windows)
    2. Task follows the retry policy — retry with backoff, or move to Failed
    3. Webhook notification fires (`task_timeout` event)
    4. Timeout logged in task history
  </Step>
</Steps>

## Use Cases

<Columns cols={3}>
  <Card title="Rate Limit Loops" icon="rotate">
    Kill tasks stuck in rate limit wait cycles that would otherwise run forever.
  </Card>
  <Card title="Infinite Loops" icon="infinity">
    Terminate tasks where Claude enters a reasoning or editing loop.
  </Card>
  <Card title="Resource Management" icon="gauge">
    Ensure no single task monopolizes an agent slot, keeping the queue healthy.
  </Card>
</Columns>

<Warning>A timed-out task counts as a failure and consumes a retry attempt. If all retries are exhausted, the task moves to [Failed status](/features/failed-status).</Warning>
