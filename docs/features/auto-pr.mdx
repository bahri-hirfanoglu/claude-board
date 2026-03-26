---
title: "Auto PR"
description: "Automatic pull request creation when tasks complete"
icon: "code-pull-request"
---

When enabled, Claude Board automatically creates a GitHub pull request when a task finishes successfully. No manual `git push` or PR creation needed.

## Setup

<Steps>
  <Step title="Install GitHub CLI" icon="github">
    Install [`gh`](https://cli.github.com/) and authenticate:
    ```bash
    gh auth login
    ```
  </Step>
  <Step title="Enable Auto PR" icon="toggle-on">
    In **Project Settings > Git**, enable **Auto PR** and set your **Base Branch** (default: `main`).
  </Step>
  <Step title="Done" icon="check">
    Every completed task will now automatically push its branch and create a PR.
  </Step>
</Steps>

## How It Works

When a task completes successfully:

<Steps>
  <Step title="Push branch" icon="upload">
    Branch is pushed to origin: `git push -u origin <branch>`
  </Step>
  <Step title="Create PR" icon="code-pull-request">
    PR created via `gh pr create` with:
    - **Title**: `{task_type}: {task_title}` (e.g., "feat: Add JWT auth")
    - **Body**: Task description, task key, type, and model used
    - **Base**: Project's configured base branch
    - **Head**: Task's feature branch
  </Step>
  <Step title="Link saved" icon="link">
    PR URL is saved to the task and visible in the Task Detail modal.
  </Step>
</Steps>

## Branch Cleanup

| Auto PR | Branch Behavior |
|---------|----------------|
| **Enabled** | Branches are preserved to keep PRs functional |
| **Disabled** | Completed task branches are automatically deleted (local + remote) |

## Requirements

<Accordion title="Requirements checklist">
  - `gh` CLI installed and authenticated (`gh auth status` to verify)
  - Repository has a GitHub remote (`git remote -v` should show a GitHub URL)
  - Auto-branch is enabled (task must have created its own branch)
  - Task completed successfully (failed tasks don't create PRs)
</Accordion>

<Info>Auto PR works with the [orchestration engine](/features/orchestration). When tasks complete in waves, each task creates its own PR independently.</Info>
