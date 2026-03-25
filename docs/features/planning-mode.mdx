---
title: "Planning Mode"
description: "AI-powered task breakdown with step-by-step wizard, dependency generation, and live progress"
icon: "sparkles"
---

Planning Mode uses Claude to analyze a topic and automatically break it down into structured, actionable tasks on your board. Describe what you want to build, and Claude explores your codebase, researches the approach, and generates a complete task breakdown with dependency relationships.

<Frame><img src="/images/feature-planning.svg" alt="Planning Mode Workflow" /></Frame>

## Step-by-Step Wizard

Planning Mode follows a 4-step wizard flow with a visual progress indicator at the top:

```
  Define ──────── Analyze ──────── Review ──────── Complete
```

Each step is shown with numbered circles. Completed steps display a green checkmark, the active step pulses with the Claude accent color, and future steps are dimmed.

## Step 1: Define

Configure what you want Claude to plan:

<Steps>
  <Step title="Topic" icon="pen">
    Describe what you want to build. This is the main input — be as specific as possible.
  </Step>
  <Step title="Additional Context" icon="circle-info">
    Optionally provide extra context like tech stack, constraints, or preferences. Collapsed by default.
  </Step>
  <Step title="Configuration" icon="sliders">
    Choose granularity, model, and thinking effort in organized setting cards.
  </Step>
</Steps>

### Task Granularity

Control how Claude breaks down the work:

| Level | Tasks | Style |
|-------|-------|-------|
| **High-level** | 3-5 | Major milestones with sub-step checklists |
| **Balanced** | 5-10 | Meaningful units grouping related changes |
| **Detailed** | 10-20 | Atomic tasks, each completable in a single session |

### Model Selection

| Model | Best For |
|-------|----------|
| **Haiku** | Quick breakdowns of simple features |
| **Sonnet** | Balanced speed and quality (default) |
| **Opus** | Complex architecture and deep analysis |

### Thinking Effort

| Level | Behavior |
|-------|----------|
| **Low** | Fast, surface-level analysis |
| **Medium** | Balanced depth (default) |
| **High** | Deep research and thorough exploration |

## Step 2: Analyze

Claude explores your codebase and generates the task breakdown. The analyze phase shows real-time progress:

### Live Stats Bar

A horizontal metrics bar displays:
- **Elapsed time** — How long Claude has been working
- **Tokens** — Input and output token usage
- **Tool calls** — Number of file reads, searches, etc.
- **Turns** — Conversation turns with Claude

### Sub-Phase Indicator

The analysis progresses through automated sub-phases:

| Sub-Phase | Trigger | Description |
|-----------|---------|-------------|
| **Starting** | Process spawned | Claude is initializing |
| **Exploring** | First tool call | Claude is reading files and searching the codebase |
| **Planning** | Text output after exploration | Claude is writing its analysis and generating tasks |
| **Finalizing** | Process completing | Claude is formatting the final output |

Phase transitions are detected automatically on the backend and emitted as real-time events.

### Activity Feed

A terminal-style log shows each tool call as it happens:
- **Tool calls** grouped with their results
- Color-coded by tool type (Read, Write, Edit, Bash, Grep, Glob, etc.)
- Expandable details showing file paths and output previews
- Pending indicators for tools awaiting results

### Analysis Preview

Claude's reasoning text streams in real-time in a collapsible section. Watch as Claude documents its findings about your codebase architecture.

## Step 3: Review

After analysis completes, the review phase presents the generated plan:

### Summary Bar

A quick overview at the top showing:
- **Total task count**
- **Type breakdown** — Colored badges for each task type (feature, bugfix, refactor, etc.)
- **Dependency count** — Number of dependency edges
- **Elapsed time**

### Task Cards

Each proposed task is displayed as an expandable card:

- **Task number** in a numbered circle
- **Type badge** — Color-coded (feature, bugfix, refactor, docs, test, chore)
- **Priority badge** — If priority is set (Low, Medium, High)
- **Title** — Short, actionable description
- **Expandable details**:
  - **Description** — Detailed implementation instructions
  - **Acceptance Criteria** — Definition of done

### Editing Proposals

Before approving, you can:
- **Remove tasks** — Click the trash icon to delete unwanted tasks. Dependency indices are automatically adjusted.
- **Review dependencies** — Open the Dependency Graph section to visualize the DAG

### Dependency Graph

If Claude generated dependency relationships, a collapsible section shows the full DAG visualization using the same [Dependency Graph](/features/dependencies) component used in the Orchestration view.

### Actions

- **Revise** — Go back to Step 1 with your topic preserved. Modify the topic or settings and re-plan.
- **Approve & Create N Tasks** — Create all proposed tasks in the database with their dependency edges.

## Step 4: Complete

After approval, a success screen confirms the tasks were created:

- Large checkmark icon
- Task count summary
- **Plan Again** — Start a new planning session
- **Done — View Board** — Close the modal and see your new tasks on the board

## Backend Architecture

### Planning Prompt

The backend uses a structured prompt with the "senior software architect" role:

1. **Explore** — Examine codebase structure, entry points, conventions
2. **Analyze** — Identify affected components, new code needs, risks
3. **Plan** — Produce the JSON task breakdown

The prompt includes:
- Task prioritization guidelines (priority 0-3)
- Parallel execution emphasis
- Self-contained description requirements for autonomous agent execution
- Detailed JSON format specification with field reference

### Phase Detection

The backend automatically detects and emits phase transitions:

```
starting → exploring (first tool_use event)
exploring → writing (text output after 2+ tool calls)
writing → done (process completes)
```

### Task Parsing

The output parser uses a 3-strategy approach for robustness:

1. **Markdown code blocks** — Finds ```json blocks, tries all in reverse order
2. **Raw JSON detection** — Scans text for `{"tasks":` using brace-depth matching
3. **Array fallback** — Tries parsing as a plain JSON array (backward compatible)

## Session Persistence

Planning sessions survive page refreshes. If you reload the page while planning is active, the modal automatically reopens and reconnects to the running session.

## Generated Tasks

Each generated task includes:

- **Title** — Short, imperative description (under 80 chars)
- **Description** — Full implementation guide with file paths and logic
- **Type** — `feature`, `bugfix`, `refactor`, `docs`, `test`, or `chore`
- **Priority** — 0 (highest, foundation work) to 3 (lowest, polish)
- **Acceptance Criteria** — Testable condition that proves the task is complete

## Dependency Generation

Planning Mode generates [dependency relationships](/features/dependencies) between tasks. When Claude determines that task B requires task A first, it creates a dependency edge.

Approved plans create all tasks with their DAG structure intact:
- Tasks with no dependencies land in **Wave 0** and can run immediately
- Dependent tasks are queued and auto-start when their parents complete
- View the full dependency graph in [Orchestration View](/features/orchestration)

<Tip>Add context in the optional field to guide Claude's planning. For example: "Express.js backend, React frontend, PostgreSQL with Prisma ORM" helps Claude generate more relevant tasks.</Tip>

## API

Planning Mode is also available through the [Planning API](/api/planning).
