---
title: "GitHub Issues Sync"
description: "Browse, import, and sync GitHub issues as tasks with automatic label mapping"
icon: "github"
---

GitHub Issues Sync lets you browse your repository's open issues directly from Claude Board and selectively import them as tasks. Imported tasks get a `github` tag and link back to the original issue.

## Prerequisites

<Steps>
  <Step title="Install GitHub CLI" icon="terminal">
    Install [`gh`](https://cli.github.com/) — Claude Board uses your existing `gh` authentication, no separate token needed.
  </Step>
  <Step title="Authenticate" icon="key">
    Run `gh auth login` and follow the prompts. Claude Board will automatically use this session.
  </Step>
  <Step title="Configure project" icon="gear">
    Go to **Project Settings > GitHub** tab. The repository is auto-detected from your git remote. Enable sync and save.
  </Step>
</Steps>

<Tip>The setup wizard checks for `gh` CLI during initial configuration. It's optional — you can install it later.</Tip>

## Browsing Issues

Click the **Issues** button in the board toolbar to open the GitHub Issues panel on the right side.

The panel shows all open issues from your repository with:
- **Issue number and title**
- **Body preview** (first 200 characters)
- **Labels** with color-coded badges
- **Suggested task type** based on label mapping
- **Import status** — already imported issues are dimmed

Use the **refresh** button to fetch the latest issues from GitHub.

## Importing Issues

<Steps>
  <Step title="Select issues" icon="check">
    Click individual issues to select them, or use **Select all new** to select all unimported issues at once.
  </Step>
  <Step title="Import as tasks" icon="download">
    Click **Import N as tasks**. Selected issues are created as backlog tasks with:
    - Title from issue title
    - Description from issue body
    - Task type mapped from labels (see below)
    - `github` tag automatically applied
    - Link to original GitHub issue
  </Step>
  <Step title="Work on tasks" icon="play">
    Imported tasks appear in your backlog. They are NOT auto-queued — you review and start them manually like any other task.
  </Step>
</Steps>

## Label Mapping

GitHub labels are automatically mapped to Claude Board task types:

| GitHub Label | Task Type |
|-------------|-----------|
| `bug`, `fix` | bugfix |
| `refactor` | refactor |
| `documentation`, `docs` | docs |
| `test`, `testing` | test |
| `chore`, `maintenance` | chore |
| *(no match)* | feature |

## Auto-Close on Approve

When you approve a task that was imported from a GitHub issue, the linked issue is **automatically closed** on GitHub. This keeps both systems in sync without manual work.

## Task Card Badge

Tasks imported from GitHub show a small badge with the issue number (e.g., `#42`) on the task card. Clicking the badge opens the original issue on GitHub in a new tab.

## Check Connection

In **Project Settings > GitHub**, use the **Check Connection** button to verify:

| Status | Meaning |
|--------|---------|
| **Connected** | `gh` CLI installed, authenticated, and repo accessible |
| **Not installed** | `gh` CLI not found — install from [cli.github.com](https://cli.github.com) |
| **Not authenticated** | Run `gh auth login` to authenticate |
| **Cannot access** | Token doesn't have access to this repository |

<Info>Claude Board never stores your GitHub token. It reads it from `gh auth token` on every request, using your existing CLI session.</Info>
