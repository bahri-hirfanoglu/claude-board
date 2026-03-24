# Changelog

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
