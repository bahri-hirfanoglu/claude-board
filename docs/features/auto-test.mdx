---
title: "Auto Test"
description: "Automatic verification of completed tasks with rich terminal output"
icon: "flask-conical"
---

When a task completes, it enters **Testing** status. With Auto Test enabled, a verification agent automatically checks the work using the same rich terminal output as regular tasks.

## How It Works

1. Task completes and enters **Testing** status
2. A verification agent (Sonnet, low effort) starts automatically
3. The agent runs build checks, tests, code review, and acceptance criteria validation
4. **Pass** — task moves to **Done** automatically
5. **Fail** — task stays in **Testing** with detailed feedback

## Enabling Auto Test

Open **Project Settings > Automation** and toggle **Auto Test** on. Optionally add custom test instructions.

## Verification Steps

The agent executes these checks **sequentially** (never in parallel, to avoid cascading errors):

<Steps>
  <Step title="Build Check">
    Runs the project's build command (npm run build, cargo check, etc.). Reports success or failure.
  </Step>
  <Step title="Test Suite">
    Checks if a test suite exists, then runs it. Reports pass/fail counts. Skipped if no test suite found.
  </Step>
  <Step title="Code Review">
    Reviews changed files for syntax errors, broken imports, security concerns, and missing error handling.
  </Step>
  <Step title="Acceptance Criteria">
    If acceptance criteria are specified, each criterion is verified individually.
  </Step>
</Steps>

## Rich Terminal Output

Auto-test output uses the **same event system** as regular task execution. This means:

- Full tool call grouping with expand/collapse
- Input parameters and output preview for each tool call
- Duration tracking per tool call
- Status indicators (running, success, error)
- Token usage and cost tracking

## Test Report

Results are stored as a structured JSON report on the task, viewable in the **Test** tab of the task detail modal:

- **Verdict banner** — Pass (green) or Fail (red) with summary
- **Individual check cards** — Build, Tests, Code Review, Acceptance Criteria with PASS/FAIL/SKIP status
- **Feedback section** — Detailed feedback when rejected

## Crash Recovery

If the app crashes during auto-test:

- Tasks in `testing` status are detected on restart
- If auto-test is enabled, verification is **automatically re-triggered** after a 3-second startup delay
- No manual intervention needed

## Custom Instructions

Add project-specific verification commands:

```
Run 'npm test' and verify all tests pass.
Check TypeScript compilation with 'npx tsc --noEmit'.
Ensure no console.log statements remain in production code.
```

## Auto-Test Token Tracking

Token usage during auto-test is now counted in the task's total token usage. This means the token counter, cost estimate, and analytics all reflect the full cost of execution including verification.

## Step Progress Markers

During auto-test execution, the task card shows real-time step progress indicators:
- **Step 1/4: Build Check**
- **Step 2/4: Test Suite**
- **Step 3/4: Code Review**
- **Step 4/4: Acceptance Criteria**

Each step displays its current status (running, passed, failed, skipped) as it executes.

## Auto-Test Model Selection

By default, auto-test runs with Sonnet at low effort. You can override this in **Project Settings → Engine tab**:
- **Test Model** — choose between Haiku, Sonnet, or Opus
- Higher-capability models catch more subtle issues but cost more

<Note>The verification agent runs commands one at a time to prevent parallel tool call cancellation errors on Windows.</Note>
