# Changelog

## [1.7.1] - 2026-03-28

### Features
- **GSD Roadmap View** — Full "Get Stuff Done" workflow integration with Milestone → Phase → Plan → Task hierarchy
- **AI Phase Planning** — Click the Brain button on any phase to let Claude analyze your codebase and generate an executable task breakdown with dependencies
- **Checkpoint Types** — Tasks classified as auto, human-verify, decision, or human-action for GSD-style execution control
- **Success Criteria** — Interactive checklist per phase with click-to-verify and inline criterion addition
- **Phase Management** — Create, edit, delete, reorder phases. Insert decimal phases (2.1) for urgent work between existing phases
- **Milestone Lifecycle** — Create milestones with versions (v1.0), edit inline, transition between active/completed/archived states
- **Plan Management** — Create plans within phases, link/unlink tasks with checkpoint type selection, delete plans
- **Status Propagation** — Task completion automatically updates plan and phase status up the hierarchy
- **Manual Status Control** — Dropdown to manually set phase status (pending/planning/in_progress/verifying/completed/failed)

### Database
- New tables: milestones, phases, phase_plans, phase_plan_tasks
- New columns: tasks.phase_plan_id, projects.gsd_enabled
- Automatic status recomputation across plan → phase hierarchy

### Planning
- GSD-aware planning prompt with checkpoint_type guidance
- Success criteria included in AI planning context
- Phase goal and description enriched prompt for better task generation

## [1.7.0] - 2026-03-28

### Features
- **Command Palette (Ctrl+K)** — Fuzzy search across tasks, projects, and quick actions. Keyboard navigation, inline task actions (Start, Approve, Logs), shortcut hints
- **Battle Arena View** — Gamified orchestration view where agents fight with emoji projectiles (🔥⚡💫❄️☠️💣), HP bars, explosion effects, critical hit damage numbers, file conflict clash lines, victory/defeat animations
- **Agent Avatars & Names** — Each running agent gets a random character name (Nova, Atlas, Spark, etc.) with a unique avatar. Names appear in agent cards, terminal logs, and battle view
- **AI Chat Sidebar** — Right-side chat panel powered by Claude CLI. Ask questions about your project, summarize tasks, get suggestions. Markdown-rendered responses
- **Tooltip System** — Global tooltip component with hover delay, keyboard shortcut badges, viewport-aware positioning
- **Enhanced Dashboard** — Quick actions bar with Ctrl+K hint, stat cards with icons and glow effects, active task pulse animation

### Orchestration
- **Circuit Breaker** — Auto-pause queue after N consecutive failures with manual reset
- **Conditional Workflows** — on_success/on_failure/on_any dependency conditions
- **Smart Queue Priority** — Critical path analysis (tasks blocking most dependents run first)
- **Approval Gates** — Optional awaiting_approval status between testing and done
- **Workflow Templates** — Reusable task chains with one-click apply and DAG wiring
- **Enhanced Pipeline Stats** — Bottleneck detection, burn rate, circuit breaker banner, approval indicators

### UI Improvements
- **Redesigned Project Modal** — 720px sidebar layout with Section cards, Field/Toggle components
- **Compact Header Toolbar** — Icon-only toggle group replacing 8 separate buttons
- **Status Animations** — New violet approval effect, red fail flash with X mark
- **Auto-test improvements** — Token tracking during verification, step progress markers, configurable test model
- **Auto-open terminal** — Default changed to off; respects app settings toggle

### Engine
- **Task State Machine** — Declarative TaskStatus enum, transition validation table, EngineConfig
- **Configurable Parameters** — Max auto-revisions, retry delays, auto-test model per project
- **Agent name assignment** — Stored in tasks.agent_name column

## [1.6.6] - 2026-03-28

### Features
- **Task Engine Refactor** — Declarative state machine with TaskStatus enum, transition validation table, and configurable EngineConfig replacing scattered string literals and hard-coded values
- **Circuit Breaker** — Automatically pauses queue after N consecutive task failures to prevent cascade failures; configurable threshold per project with manual reset
- **Conditional Workflows** — Dependency conditions: `on_success`, `on_failure`, `on_any` (in addition to default `always`); enables fallback tasks and post-failure cleanup chains
- **Smart Queue Priority** — Critical path analysis: tasks blocking the most dependents run first; ORDER BY blocker_count DESC, priority, queue_position
- **Approval Gates** — New `awaiting_approval` status; when enabled, auto-test passes route to approval instead of done; manual approve/reject workflow
- **Workflow Templates** — Reusable task chain templates with step definitions, dependency setup, and condition types; one-click apply creates all tasks with proper DAG wiring
- **Enhanced Pipeline Dashboard** — Real-time bottleneck detection, token burn rate (tok/min), circuit breaker status banner with reset, awaiting approval indicators, failed task counts
- **Configurable Engine Parameters** — Max auto-revisions, retry base/max delay, auto-test model selection (haiku/sonnet/opus) — all per-project in Engine settings tab
- **Auto-test Token Tracking** — Test verification phase tokens now counted toward task totals with proper UsageTracker baseline
- **Auto-test Step Progress** — Step markers (Step 1/4: Build Check, etc.) logged to terminal during auto-test verification

### UI Improvements
- **Redesigned Project Modal** — Wider 720px layout with sidebar navigation, section-based cards, consistent Field/Toggle components, and reusable `input-field` CSS class
- **Engine Settings Tab** — New dedicated tab for advanced engine parameters, circuit breaker, and approval gate configuration

## [1.6.5] - 2026-03-27

### Bug Fixes
- **Stats exclude deleted tasks** — All 13 statistics queries now filter out soft-deleted tasks (project stats, global usage, model breakdown, timeline, project list counts)
- **Stop on any status change** — Running tasks now properly stopped when dragged to backlog, testing, or any non-running status (was only stopping from in_progress)
- **No auto-retry on manual stop** — Manually stopping or moving a task no longer triggers auto-retry; retry state (count + delay) fully reset on backlog transition
- **User-stopped detection** — Runner distinguishes user-initiated stops from crashes; stopped tasks skip failure handling entirely
- **Auto-test race condition** — Auto-test results are skipped if user manually changed task status while test was running
- **Timer accuracy** — Timer paused when transitioning to testing; timer resumed on auto-revision restart; prevents duration inflation from auto-test time
- **is_running immediate** — Task shows as running immediately when started (includes "starting" state), not just after process spawns
- **request_changes guard** — Cannot request changes on tasks in backlog/in_progress; only testing/done allowed
- **Cascade timing** — Dependency cascade deferred until auto-test completes (was triggering before test started)
- **Parent auto-complete guard** — Sub-task completion only auto-completes parent if parent is still in_progress (respects manual status changes)
- **Timeout retry guard** — Timed-out tasks only retry if still in in_progress status (respects manual user changes)
- **Delete running task** — Properly stops both running and starting processes before deletion

## [1.6.4] - 2026-03-27

### Features
- **Enhanced Codebase Scan** — Complete rewrite of the scan system with 5 analysis presets (Quick, Detailed, API Docs, Architecture, Custom), .gitignore-aware file filtering, project type auto-detection, pre-scan statistics, progress bar with cancel, and adjustable Claude max-turns based on codebase size
- **Scan History** — All scan results saved to database with full history view, past scan viewing, deletion, and diff comparison between current and historical scans
- **Markdown Preview** — Scan results now render as formatted Markdown with eye/edit toggle; edit mode for raw text, preview mode for rendered output
- **Editable Results** — Scan output is editable before saving to CLAUDE.md, with word count, search (Ctrl+F), and copy-to-clipboard
- **Folder Picker** — Native "Browse" button for working directory selection (Tauri only)
- **Scanner Service** — New Rust service with .gitignore parser, 40+ language detection, file tree generator, and codebase statistics collector

### Bug Fixes
- **Scan Crash Fix** — Fixed `result.trim is not a function` error caused by backend returning JSON object instead of string
- **GitHub Sync "0" Badge** — Fixed `github_sync_enabled` integer `0` being rendered as text by React's `&&` operator
- **Emojis Replaced** — All scan preset emojis replaced with proper Lucide icons (Zap, SearchCode, Radio, Blocks, PenLine)

### Improvements
- **i18n Completeness** — All remaining ProjectModal hardcoded strings (Browse, Detect, Check Connection, GitHub status messages, Randomize) now use translation keys with Turkish translations
- **Column Badge** — Empty board columns no longer show "0" count badge
- **MCP Port Config** — All hardcoded port 4000 values now read from app config
- **Retry Timing** — `get_next_queued` now respects `retry_after` datetime
- **ErrorBoundary on Modals** — All 14 modals wrapped with ErrorBoundary
- **ListView Pagination** — Large task lists paginate at 50 items with "Load more"

## [1.6.3] - 2026-03-27

### Bug Fixes
- **MCP Port Hardcoded** — All 4 hardcoded `port: 4000` values now read from app config, enabling multiple instances
- **Retry Timing Bug** — `get_next_queued` now respects `retry_after` datetime, preventing premature task restarts
- **Column Badge** — Empty columns no longer show "0" badge in board header

### Improvements
- **i18n Completeness** — All remaining hardcoded strings in TaskModal (Prompt, Listening, Dictate), ProjectModal (Task Timeout, Max Retries), and LiveTerminal (Running, Done, Stop, Restart, Pause, Resume, etc.) now use translation keys with Turkish translations
- **Folder Picker** — Working directory input now has a native "Browse" button (Tauri only) using `@tauri-apps/plugin-dialog`
- **ErrorBoundary on Modals** — All 14 modals wrapped with ErrorBoundary to prevent full app crash on modal errors
- **ListView Pagination** — Large task lists now paginate at 50 items with "Load more" button for better performance
- **API Documentation** — Added 12 new API doc pages (Settings, Auth, Attachments, GitHub, Roles, Claude Manager) in English and Turkish; updated existing Projects, Tasks, and Stats docs with correct endpoints and new fields
- **Version Sync** — Root `package.json` version synchronized with `tauri.conf.json`

## [1.6.2] - 2026-03-27

### Bug Fixes
- **Rust Panic/Unwrap Elimination** — Removed all `panic!()` and unsafe `.unwrap()` from production code; replaced with proper `Result` error handling
- **Shell Injection Prevention** — Branch names sanitized + git arguments passed as arrays instead of format strings
- **DB Transaction Safety** — GitHub issue import wrapped in transaction to prevent partial imports and race conditions
- **DB Migration Safety** — Task table migration now uses transaction with rollback on failure, preventing data loss
- **on_failure Dependency Bug** — Fixed condition to check `status='failed'` instead of incorrect `backlog + retry_count` check
- **Silent Catch Blocks** — All 14 empty `catch {}` blocks replaced with proper `console.error` logging
- **Stale Closure Fix** — Task event handler in App.jsx now uses ref pattern to always access latest terminal
- **runner::start() Error Propagation** — Process spawn failures now revert task status instead of leaving it stuck as in_progress
- **Queue Slot Race Condition** — Added `is_starting()` check to prevent exceeding `max_concurrent` limit
- **Orphaned Attachments** — `.claude-attachments` directories now cleaned up on timeout kill, not just normal completion
- **Symlink Attack Prevention** — Attachment directory creation checks for symlinks before copying files
- **Context Menu Overflow** — Right-click menu now stays within viewport bounds
- **Config Corruption Recovery** — Corrupted config files are backed up and defaults restored instead of silent failure
- **Attachment File Cleanup** — Delete now checks file existence before removal, logs warnings on failure

### Improvements
- **Confirmation Dialogs** — Added confirmation before deleting attachments and removing task dependencies
- **Warning Toast Type** — Added amber warning toast alongside existing success/error/info types
- **Loading States** — Added loading spinners to PipelineView and OrchestrationView
- **i18n Completeness** — All ProjectModal hardcoded strings (Auto Test, Repository, etc.) now use translation keys with Turkish translations
- **Turkish Character Fix** — Settings language label corrected from "Turkce" to "Türkçe"
- **Soft Delete** — Tasks now use soft delete (`deleted_at` column) instead of permanent deletion
- **Task Key Uniqueness** — Added partial unique index on `task_key` to prevent duplicate keys
- **useEffect Dependencies** — Fixed missing `githubRepo` dependency in ProjectModal, added justification comments elsewhere
- **Dead Code Removal** — Removed unused SummaryView component (335 lines)
- **CI/CD Pipeline** — Added test execution step, enforced Clippy warnings (removed soft-fail)
- **Web Responsive** — Landing page fully responsive at 480px, 768px, 1024px breakpoints with hamburger menu
- **Socket Cleanup** — Added documentation for singleton socket pattern in useProjects

## [1.6.1] - 2026-03-27

### Bug Fixes
- **Branch Name Mismatch** — Branch now created before prompt so Claude uses the correct branch name (was: prompt says `task-79` but actual branch is `events-page-header`)
- **Auto-PR on Auto-Test Approval** — PR is now created when auto-test approves a task (was: direct DB update bypassed all automation)
- **GitHub Issue Close on Done** — Issues now close in all done transitions including auto-test approval, not just manual approve
- **GitHub Issue Comment** — PR link and task key added as comment before closing issue
- **CMD Window Flash on Windows** — All `gh` and `git` commands now use `CREATE_NO_WINDOW` flag
- **Error Boundary** — Component crashes show error + "Try Again" button instead of grey/white screen
- **PR Timing** — PR created only on done transition, not on Claude process exit (testing)

## [1.6.0] - 2026-03-26

### Features
- **GitHub Issues Sync** — Browse open issues from your repo in a side panel, selectively import as tasks with `github` tag, auto-close issues when tasks are approved. Uses `gh` CLI authentication (no PAT needed). Auto-detect repo from git remote
- **GitHub CLI Check in Setup** — Setup wizard now checks for `gh` CLI (optional) alongside Claude CLI, Git, and port availability
- **GitHub Issue Badge** — Task cards show linked issue number (#42) with click-to-open link

### Improvements
- **Async GitHub API** — All GitHub network calls use async reqwest (non-blocking)
- **Bug Fixes** — Fixed PlanningModal timer stale closure, Board dependency silent catch, task status race condition, OrchestrationView unhandled rejection, Rust process kill logging, 4xx error toast visibility
- **Configurable MCP Port** — Port configurable via VITE_MCP_PORT environment variable
- **Docs UTF-8 Fix** — All Turkish doc menu names and content use proper UTF-8 characters
- **GitHub Issues Documentation** — Full EN + TR documentation for the GitHub Issues feature

## [1.5.16] - 2026-03-26

### Features
- **Landing Page Overhaul**: Orchestration-focused redesign with interactive DAG hero, 4 switchable views (Graph/Timeline/Live/Board), animated capability ticker, 8 HTML-based preview mockups
- **Documentation i18n**: Full Turkish translation for all 51 documentation pages with Mintlify language switcher
- **Landing Page i18n**: TR/EN language toggle with localStorage persistence for the web landing page
- **Documentation Enrichment**: 12 doc pages enhanced with Steps, Tabs, Accordions, Cards, and richer examples

### Improvements
- **Component Decomposition**: 4 monolithic components broken into 32 focused modules — LiveTerminal (746→200), Dashboard (637→150), TaskDetailModal (600→180), PlanningModal (1012→250)
- **Error Handling Cleanup**: Removed redundant console.error calls; API layer handles all user-facing error toasts globally
- **Setup Wizard Docs**: Updated for 6-step wizard with system check details

## [1.5.15] - 2026-03-26

### Features
- **Setup Wizard Overhaul**: 6-step guided setup with system check (Claude CLI, Git, port), language selection (EN/TR), project configuration with collapsible details (permissions, auto-queue, git integration), default model/notification preferences, and animated summary with confetti
- **Failed Status**: New dedicated board column for permanently failed tasks with red indicators across all views (Board, List, Pipeline, Timeline, DependencyGraph, Summary, StatusTransition)
- **Exponential Backoff Retry**: Failed tasks wait before retrying (30s×2^n, max 10min, ±20% jitter). New `retry_after` DB field prevents premature restarts
- **Auto-PR Creation**: Tasks automatically create GitHub PRs via `gh` CLI on completion when `auto_pr` is enabled. Pushes branch and includes task metadata in PR body
- **Auto-Revision on Test Reject**: When auto-test rejects a task, creates revision record with test feedback and auto-restarts (max 3 revisions to prevent infinite loops)
- **Drag-Drop Dependency**: Alt+drag task cards onto each other in Board view to create dependencies. Direction chooser dialog lets you pick parent/child relationship
- **Dependencies Tab**: New tab in TaskDetailModal showing parent/child dependencies with add/remove UI. Dropdown task picker with direction selector (backlog tasks only)
- **Prompt Template Activation**: Templates now inject into actual Claude system prompt via `build_prompt()`. Auto-matched by task_type — create a "bugfix" template and all bugfix tasks use it
- **Webhook Wire-Up**: Connected webhook dispatch to all task lifecycle events (task_started, task_completed, task_failed, test_passed, test_failed, revision_requested, queue_auto_started, task_timeout)
- **Task Timeout**: Per-project configurable timeout with auto-kill. Enforced every 15s via queue poll thread. Timed-out tasks follow retry policy
- **Branch Cleanup**: Completed tasks auto-delete feature branches (local + remote). Skipped when auto_pr is active to preserve open PRs

### Improvements
- **Onboarding Redesign**: Glassmorphism cards with gradient accents, direction-aware slide animations, floating particles on welcome/done screens, feature grid with staggered pop-in, step dots progress indicator
- **Testing Badge**: Purple FlaskConical badge always visible when task is in testing status. Animated when auto-test process is actively running
- **Max Retries UI**: Configurable from project settings (0-10, default 2)
- **is_running Fix**: All `task:updated` events now correctly set `is_running` flag via `emit_task_updated()` helper
- **Dependency Graph Layout**: Done tasks align within dependency wave instead of separate left column

### Engine Hardening (v1.5.12)
- **TOCTOU Race Fix**: Atomic check-and-insert for STARTING_TASKS prevents duplicate task starts
- **Panic-Free DB Layer**: Replaced ~100+ bare `.unwrap()` with `log::error!` + graceful fallbacks across entire database layer
- **Poison-Free Mutexes**: Migrated from `std::sync::Mutex` to `parking_lot::Mutex` in runner and events
- **Transaction Support**: `with_transaction()` helper + atomic `RETURNING` for task key generation
- **Graceful Shutdown**: Queue poll thread responds to `AtomicBool` shutdown signal via `RunEvent::Exit`
- **Memory Leak Fixes**: Per-task cleanup of active_tool_calls, file_access, task_usage on stop/completion
- **HTTP API Cleanup**: All 20 bare `.unwrap()` in http_api.rs replaced with `to_json()` helper

### Database
- `retry_after DATETIME` column for backoff scheduling
- `task_timeout_minutes INTEGER` column on projects
- `language TEXT` column in config
- Tasks table migration to support `failed` CHECK constraint with index recreation

## [1.5.14] - 2026-03-26

See release notes: https://github.com/bahri-hirfanoglu/claude-board/releases/tag/v1.5.14

## [1.5.13] - 2026-03-25

See release notes: https://github.com/bahri-hirfanoglu/claude-board/releases/tag/v1.5.13

## [1.5.12] - 2026-03-25

See release notes: https://github.com/bahri-hirfanoglu/claude-board/releases/tag/v1.5.12

## [1.5.11] - 2026-03-25

### Features
- Onboarding tour, retry system, i18n improvements, lifecycle summary

## [1.5.7] - 2026-03-24

### Features
- **Auto Test**: Automatic verification of completed tasks — runs tests, checks acceptance criteria, auto-approves on success. Configurable per-project with custom test instructions
- **Skill Import from GitHub**: Browse, preview, and install skills from any public GitHub repository. Includes popular repo shortcuts (awesome-claude-code, etc.) with directory navigation
- **Split Terminal**: View multiple agent outputs side by side (vertical) or stacked (horizontal). Split controls always visible in bottom terminal toolbar
- **Diff Viewer**: Full unified diff display in task detail with syntax highlighting — green additions, red deletions, cyan hunk headers. Uses actual commit range
- **Orchestration Edge Creation**: Drag between nodes to create dependency edges (Shift+drag). Visual feedback with dashed line and purple highlight on target
- **Orchestration Node Dragging**: Reposition task nodes freely by dragging. Positions persist in localStorage. Auto-layout button resets to wave-based grid
- **Orchestration Start Button**: Hover over backlog tasks to reveal a play button that starts execution directly from the graph
- **Planning DAG Preview**: Collapsible dependency graph in planning review phase with proper wave-based column layout
- **Planning Rich Logs**: Tool calls in planning mode now render as expandable cards with icons, status indicators, and output preview (same design as live terminal)

### Improvements
- **Enhanced Dashboard**: Summary view now shows priority distribution, model usage breakdown, input/output token split, throughput metric, average cost per task, and top-cost tasks
- **Stats Panel Fix**: Fixed field name mismatch (snake_case vs camelCase) causing all stats to show as 0/empty. Added serde rename_all to all stats structs
- **Custom Max Concurrent**: Project settings now support typing custom concurrency values (1-50) in addition to preset buttons
- **View Menu Reorder**: Summary moved after Orchestration for better workflow order
- **Skill Deletion**: Skills modal now supports deleting installed skills
- **Tab Bar Always Visible**: Terminal bottom panel toolbar shows even with 1 tab, split buttons visible (disabled) for discoverability
- **Documentation Reorganized**: Sidebar categorized into logical groups (Orchestration, Execution, Git, AI Config, etc.) with 4 new feature pages

### Fixes
- **Critical: Process Deadlock**: Fixed stderr pipe buffer deadlock that caused tasks to hang, especially with multiple concurrent tasks. Stderr is now drained in a background thread
- **Stderr Visibility**: Agent warnings, rate limits, and errors from stderr are now visible in task terminal logs (previously invisible and lost)
- **Dependency Error Handling**: Replaced silent .ok()/.unwrap() with proper Result propagation. Validation errors use correct error type
- **Click After Drag**: Fixed task detail opening unintentionally after dragging a node in orchestration view
- **UTF-8 Truncation**: Fixed potential panic when truncating large diffs at multi-byte character boundaries
- **Timeline Cleanup**: Removed orphaned timeline view documentation, i18n strings, and image assets
- **Unused Imports**: Cleaned up unused useEffect, Edit3, Timer imports

## [1.5.6] - 2026-03-24

### Features
- **Multi-Agent Orchestration**: DAG-based task dependency system with cycle detection — tasks can have multiple parent dependencies, wave-based parallel execution
- **Orchestration View**: New board view mode with interactive SVG dependency graph, live agent cards showing real-time token/cost/elapsed, wave progress bar with pipeline stats
- **Dependency Editor**: Visual dependency management in task modal — searchable task picker, parent/child cards with status indicators, cycle detection warnings
- **Session Replay**: Timeline-based replay of Claude's actions during task execution — tool calls, results, usage events with playback controls and scrubber
- **Smart Queue Cascade**: When a task completes, all newly unblocked dependent tasks auto-start respecting `max_concurrent` limit
- **Planning with DAG**: Planning mode now generates dependency relationships between tasks — approved plans create tasks with proper DAG structure
- **Dependency Graph API**: New commands `addDependency`, `removeDependency`, `getTaskDependencies`, `getExecutionWaves`, `getDependencyGraph`

### Improvements
- **Pipeline View**: Now shows multiple parent dependencies per task instead of single `depends_on`
- **Task Delete Cascade**: Deleting a task emits update events for dependent children
- **Dependency Graph Layout**: Adaptive spacing for wide fan-out, orphan task handling, disconnected component support
- **Session Event Recording**: Records tool calls, tool results, final usage, system events, and rate limit events
- **Voice Agent Language Sync**: Auto-detects UI language for initial voice language, fixed stale closure bug in language switching

### Fixes
- **Voice assistant temporarily disabled** pending TTS voice selection fix on Windows/WebView2

## [1.5.5] - 2026-03-24

### Refactoring
- **App.jsx state decomposition**: Extracted `useModalState`, `useTaskHandlers`, `useProjectHandlers` hooks — reduced 24 useState to 7, AppLayout props from 70+ to 25
- **API consolidation**: Unified dual Tauri/HTTP API definitions with single `call()` dispatcher — each method defined once instead of twice
- **TaskModal decomposition**: Split 632-line TaskModal into `TemplateSelector`, `TaskOptionsPanel`, `TokenEstimate` sub-components
- **runner.rs decomposition**: Extracted `copy_task_attachments`, `build_claude_args`, `handle_process_lifecycle` from monolithic `start()` function

### Improvements
- **Rust error handling**: Added `AppError` enum with `NotFound`, `Database`, `Io`, `Process` variants; replaced 8 `.unwrap()` panic points with proper `?` error propagation in CRUD commands
- **JSDoc type definitions**: Added `@typedef` for all entity types (Project, Task, Template, Snippet, Role, Webhook, etc.) enabling IDE autocompletion
- **Constants centralization**: Consolidated scattered constant definitions from 6+ files into single source of truth
- **Shared UI components**: Created reusable `ModalShell`, `EmptyState`, `Spinner`, `InlineDeleteConfirm` components and `useCrudResource` hook — 4 modals refactored with net 580-line reduction

## [1.5.4] - 2026-03-24

### Features
- **Token Counter**: Real-time token estimation and cost preview in task creation modal — shows estimated tokens, input cost per model (Haiku/Sonnet/Opus), and character count
- **Custom Commands Viewer**: Browse and inspect `~/.claude/commands/*.md` files — split-pane modal with command list and content preview
- **Custom Skills Viewer**: Browse and inspect `~/.claude/skills/*.md` files — split-pane modal with skill list and content preview

### Performance
- **Non-blocking dashboard**: Project list now loads instantly from DB; slow CLI-based calls (suggestions, project groups) load in background
- **Eliminated startup Loading screen**: Dashboard no longer blocks on `getSuggestions()` and `getProjectGroups()` which shell out to claude/git

### Fixes
- **CMD window flash on Windows**: Added `CREATE_NO_WINDOW` flag to `git config` check in suggestions, preventing console windows from briefly appearing on startup

## [1.0.0] - 2026-03-23

### Architecture
- **Tauri v2**: Native desktop application built with Tauri v2 and Rust backend
- **Rust Backend**: Database, Claude runner, webhook dispatcher, API handlers — all in Rust
- **rusqlite**: Bundled SQLite for zero-dependency database access
- **Tauri Events**: Real-time frontend updates via Tauri's built-in event system
- **Tauri Commands (IPC)**: Direct frontend-to-backend communication without HTTP overhead
- **Auto-updater**: GitHub Releases integration for seamless updates

### Features
- Kanban board with drag-and-drop task management
- Live terminal — watch Claude code in real-time
- Planning mode — AI-powered task breakdown
- Auto-queue with concurrency control
- Git automation — auto-branch and commit tracking
- Webhook notifications (Discord, Slack, custom)
- Prompt templates and context snippets
- File attachments per task
- Role-based task assignment
- Usage analytics and cost tracking
- CLAUDE.md editor per project
- Task keys (Jira-style identifiers)
- Multi-language UI support (15 languages)
- Voice assistant with speech recognition
- Status transition animations
- Model filter and timeline view

### Platforms
- Windows (x64) — `.exe` and `.msi`
- macOS (Intel & Apple Silicon) — `.dmg`
- Linux — `.AppImage`, `.deb`, `.rpm`
