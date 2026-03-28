---
title: "Circuit Breaker"
description: "Automatic queue pause after consecutive task failures"
icon: "shield-halved"
---

The Circuit Breaker prevents cascade failures by automatically pausing the task queue when too many tasks fail in a row.

## Configuration

In **Project Settings → Engine tab**:
- **Failure Threshold** — number of consecutive failures before pausing (0 = disabled)

## How It Works

1. When a task permanently fails (retries exhausted), the consecutive failure counter increments
2. If the counter reaches the threshold, the circuit breaker activates
3. The queue stops starting new tasks
4. A red alert banner appears in the Pipeline Stats

## Recovery

- Click the **Reset** button on the circuit breaker banner
- This resets the counter, deactivates the breaker, and restarts the queue
- A successful task completion also resets the counter

## Events

- `project:circuit_breaker` event emitted on activation/deactivation
- `circuit_breaker_activated` webhook fired when triggered
