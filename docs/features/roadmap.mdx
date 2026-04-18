---
title: "Roadmap"
description: "Plan milestones and phases with AI-assisted roadmap view — integrates with the GSD (Get Shit Done) spec-driven workflow"
icon: "map"
---

The **Roadmap** view gives you a bird's-eye perspective of a project's milestones and phases, and bridges to the [GSD](https://github.com/bahri-hirfanoglu/gsd) spec-driven development framework when the project has a `.planning/` directory.

<Frame>
  <img src="/images/feature-planning.svg" alt="Roadmap view" />
</Frame>

## Opening the Roadmap

Open any project, then click the **Roadmap** tab in the top view tabs. The view has three stacked sections:

1. **Project Overview** — summary of `.planning/PROJECT.md` plus current state (when GSD is initialized)
2. **.planning/ Roadmap** — GSD file-based roadmap, phase list with per-phase actions
3. **Milestones** — classic DB-backed milestones and phases, independent of GSD

If the project has no `.planning/` directory, only the Milestones section is shown.

## Project Overview panel

When `.planning/PROJECT.md` exists, a collapsible card appears at the top of the Roadmap:

- **Header**: project name (the H1 of PROJECT.md) + a short summary line + the `current_phase` badge from STATE.md
- **Expanded**: current phase / current step from STATE.md + the full raw `PROJECT.md` and `STATE.md` contents

Use this to quickly remind yourself what the project is about, and where the GSD workflow currently stands, without leaving the Roadmap tab.

## Structured phase description

Phase descriptions in `ROADMAP.md` usually follow a convention:

```markdown
## Phase 1: Foundation and Tech Debt

**Goal**: The codebase runs on a fully supported, bug-free dependency stack
**Depends on**: Nothing (first phase)
**Requirements**: TECH-01, TECH-02, TECH-03
**Success Criteria** (what must be TRUE):
1. Terminal renders correctly
2. No orphaned shell processes
**Plans**: plan-1-xterm-upgrade, plan-2-server-fixes
**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3
| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | 0/4 | Not started |
```

Instead of dumping this as raw markdown, the view **parses** it into dedicated sections with icons and badges:

| Section            | Visual                                         |
|--------------------|------------------------------------------------|
| Goal               | Target icon · accent color · body text         |
| Depends on         | Link icon · body text                          |
| Requirements       | Flag icon · count badge · chip list            |
| Success Criteria   | Check icon · count badge · numbered list       |
| Plans              | File icon · count badge · chip list            |
| Execution Order    | Arrow icon · body text + markdown table        |

Markdown tables anywhere in the description are rendered as actual HTML tables with zebra rows and an emphasized first column — no more raw `| --- |` lines.

## Phase actions

Each phase row shows a state-machine action button based on its status:

<Steps>
  <Step title="pending / planning (no PLAN.md yet)" icon="brain">
    **Plan Phase** — kicks off a Claude agent that researches how to implement the phase and writes `PLAN.md` files under `.planning/phases/phase-N/`. Progress streams in-place.
  </Step>
  <Step title="has PLAN.md files (no tasks yet)" icon="zap">
    **Generate Tasks** — parses the PLAN.md files and creates board tasks with wave-based dependencies. The queue picks them up immediately.
  </Step>
  <Step title="completed" icon="eye">
    **Verify** — creates a `/gsd:verify-work` task that re-checks the implementation against the success criteria.
  </Step>
  <Step title="failed" icon="rotate">
    **Retry** — re-runs task generation from the existing PLAN.md files.
  </Step>
</Steps>

### Preview parsed tasks

Before committing to **Generate Tasks**, expand the phase and click **Preview parsed tasks**. The view fetches the parsed task list from `PLAN.md` without creating anything, and shows:

- Tasks grouped by **wave** (wave N runs after wave N-1)
- Per task: type badge · name · plan file · files touched · done criteria

Review the list; if it looks right, click **Generate N tasks** inside the preview to commit. You can close the preview with the `×` if you want to edit the plans first.

## .planning/ roadmap header

Above the phases, the `.planning/ Roadmap` card header shows:

- Overall progress bar (completed / in-progress / failed / pending)
- Current phase + current step (from STATE.md)
- Refresh button to re-read the files from disk
- **Raw toggle** — pre-formatted view of the entire `ROADMAP.md` if you want to see the source

## Health check

The Roadmap toolbar has a **Health** button that calls `gsd_health_check` and reports whether the `.planning/` directory is healthy, degraded, or broken — useful after manual edits.

## Todos

The **Todos** button lists every todo captured under `.planning/todos/pending` and `.planning/todos/done` with their area and preview. Use `/gsd:add-todo` in a Claude session to capture ideas; they'll show up here for later review.

<Info>
  GSD integration is optional. Projects without a `.planning/` directory still get the Milestone section — you can create milestones, add phases, and run AI planning on a phase without using GSD at all.
</Info>
