---
title: "Webhooks"
description: "Send task events to Slack, Discord, Teams, or custom endpoints"
icon: "bell"
---

Webhooks notify external services when events happen in Claude Board. Get alerts when tasks start, finish, or need review.

<Frame><img src="/images/feature-webhooks.svg" alt="Webhook Notifications" /></Frame>

## Supported Platforms

<Columns cols={2}>
  <Card title="Slack" icon="hashtag">
    Posts formatted messages to a Slack channel via incoming webhook URL.
  </Card>
  <Card title="Discord" icon="discord">
    Sends rich embeds to a Discord channel webhook.
  </Card>
  <Card title="Microsoft Teams" icon="microsoft">
    Delivers adaptive cards to a Teams channel connector.
  </Card>
  <Card title="Custom" icon="globe">
    Sends raw JSON payloads to any HTTP endpoint.
  </Card>
</Columns>

## Event Filtering

Choose which events trigger the webhook:

| Event | Description |
|-------|-------------|
| `task:created` | A new task is added |
| `task:started` | Task moves to In Progress |
| `task:completed` | Agent finishes, task enters Testing |
| `task:approved` | Task is approved and moves to Done |
| `task:changes_requested` | Reviewer requests revisions |

<Tip>For a "notify on completion" setup, subscribe only to `task:completed` and `task:approved`.</Tip>

## Platform-Specific Payloads

Each platform receives a tailored payload format:

<Tabs>
  <Tab title="Slack">
    Uses Slack Block Kit with task title, status, model, and a link to the board.
  </Tab>
  <Tab title="Discord">
    Uses Discord embed format with color-coded status, fields for priority and type.
  </Tab>
  <Tab title="Teams">
    Uses Adaptive Card schema with action buttons.
  </Tab>
  <Tab title="Custom">
    Raw JSON with all task fields, event type, and timestamp.
    ```json
    {
      "event": "task:completed",
      "task": { "id": 1, "title": "...", "status": "testing" },
      "project": { "id": 1, "name": "..." },
      "timestamp": "2025-01-15T10:30:00Z"
    }
    ```
  </Tab>
</Tabs>

## Test Button

After creating a webhook, click **Test** to send a sample payload. This verifies your URL and authentication are correct without waiting for a real event.

## Setup

<Steps>
  <Step title="Go to project settings → Webhooks">
    Click "Add Webhook".
  </Step>
  <Step title="Select platform and enter URL">
    Paste your webhook URL from Slack, Discord, Teams, or your custom service.
  </Step>
  <Step title="Choose events">
    Select which events should trigger this webhook.
  </Step>
  <Step title="Test and save">
    Click Test to verify, then Save.
  </Step>
</Steps>
