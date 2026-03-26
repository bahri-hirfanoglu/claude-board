---
title: "Retry & Backoff"
description: "Exponential backoff retry strategy for failed tasks"
icon: "rotate"
---

When a task fails, Claude Board automatically retries it with increasing delays to avoid hammering rate limits and give transient issues time to resolve.

## How It Works

Failed tasks follow an exponential backoff strategy with jitter:

<Tabs>
  <Tab title="Delay Schedule">
    | Retry | Base Delay | With Jitter (±20%) |
    |-------|-----------|---------------------|
    | 1st | 30s | 24–36s |
    | 2nd | 60s | 48–72s |
    | 3rd | 120s | 96–144s |
    | 4th | 240s | 192–288s |
    | 5th+ | 600s (max) | 480–600s |
  </Tab>
  <Tab title="Formula">
    ```
    delay = min(30s × 2^retry_count, 600s) + random_jitter(±20%)
    ```

    The jitter prevents multiple failed tasks from retrying at exactly the same time (thundering herd problem).
  </Tab>
</Tabs>

## Retry Flow

<Steps>
  <Step title="Task fails" icon="xmark">
    The Claude process exits with a non-zero exit code (crash, rate limit, timeout, etc.)
  </Step>
  <Step title="Retry check" icon="rotate">
    Claude Board checks if `retry_count < max_retries`. If yes, the task is moved back to **Backlog** with a `retry_after` timestamp.
  </Step>
  <Step title="Backoff delay" icon="clock">
    The queue poller skips the task until the `retry_after` timestamp expires.
  </Step>
  <Step title="Auto-restart" icon="play">
    Once the delay expires, the queue picks up the task and starts a new agent.
  </Step>
</Steps>

If all retries are exhausted, the task moves to [**Failed** status](/features/failed-status) permanently.

## Configuration

Set max retries per project in **Project Settings > Automation**:

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Max Retries | 2 | 0–10 | Number of retry attempts before permanent failure |

<Tip>Set max retries to **0** to disable automatic retrying. Failed tasks will immediately move to Failed status.</Tip>

## Manual Reset

Moving a failed task back to **Backlog** or **In Progress** resets the retry counter to 0, giving it a fresh start.

## When Retries Trigger

Retries activate when a task fails due to:
- **Rate limiting** — Claude API returns 429
- **Process crash** — unexpected exit code
- **Timeout** — task exceeds the [configured timeout](/features/task-timeout)
- **Auto-test rejection** — tests fail and auto-revision is enabled

<Info>Tasks that complete successfully but fail during auto-testing follow a separate [auto-revision](/features/auto-test) flow before entering the retry cycle.</Info>
