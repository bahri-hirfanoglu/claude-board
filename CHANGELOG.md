# Changelog

## [5.0.0] - 2026-03-23

### Architecture
- **Tauri v2 Migration**: Complete rewrite from Node.js/Express/Electron to Tauri v2 with a Rust backend. The app is now a native desktop application with significantly smaller bundle size and lower memory footprint.
- **Rust Backend**: All server-side logic (database, Claude runner, webhook dispatcher, API handlers) rewritten in Rust.
- **rusqlite**: Replaced sql.js with rusqlite for native SQLite access without WASM overhead.
- **Tauri Events**: Replaced Socket.IO with Tauri's built-in event system for real-time frontend updates (task logs, usage tracking, status changes).
- **Tauri Commands (IPC)**: All API endpoints replaced with Tauri command handlers invoked directly from the frontend.

### Removed
- Node.js/Express backend (`server.js`, `src/` directory)
- Electron wrapper (`electron/` directory)
- Socket.IO dependency
- Docker support (`Dockerfile`, `docker-compose.yml`)
- Web browser mode (the app is now desktop-only via Tauri)
- sql.js dependency (replaced by rusqlite)

### Changed
- Project structure: backend code now lives in `src-tauri/`, frontend remains in `client/`
- Build tooling: `npx tauri dev` for development, `npx tauri build` for release builds
- Desktop installers now produced by Tauri's bundler instead of electron-builder

### Preserved
- All existing features (Kanban board, live terminal, voice assistant, webhooks, git automation, etc.)
- React + Tailwind frontend (unchanged)
- MCP integration
- SQLite database schema (compatible migration)

## [4.0.0] - 2026-03-19

### Added
- **Task Keys**: Jira-style identifiers (e.g. `FTR-CB-1001`) auto-generated from task type prefix, project key, and per-project counter. Existing tasks backfilled on migration.
- **Voice Assistant**: Modular voice assistant with plugin-based command registry, speech recognition (Web Speech API), text-to-speech, audio waveform visualizer, sound effects, and Alt+V keyboard shortcut.
- **Voice Dictation**: Mic buttons on task creation modal for dictating title and description fields.
- **Status Transition Animations**: Particle effects on status change — amber sparks (In Progress), shimmer wave (Testing), confetti burst (Done), rewind sweep (backward).
- **Model Filter**: Filter tasks by AI model (Haiku/Sonnet/Opus) from the board toolbar, applied across all views.
- **Timeline View Redesign**: Sticky header, zoom controls (Day/Week/Month), collapsible status swimlanes, weekend shading, hover tooltips with rich details, inline gradient bars with glow effects.
- **Test Suite**: Vitest setup with 59 tests covering voice assistant commands, intent parser, entity extractors, and English-only validation.

### Changed
- Database schema: added `task_key` column to tasks, `project_key` and `task_counter` columns to projects.
- Task type changes automatically update the key prefix.
- Timeline view bars use inline styles for correct colors (fixes Tailwind purge issue).

### Documentation
- Added 5 new Mintlify docs pages: Task Keys, Voice Assistant, Status Animations, Model Filter, Timeline.
- Updated README with 7 new features and voice architecture section.
- Added 6 new feature cards to landing page (web/index.html).

## [3.0.0] - 2025-03-15

### Architecture
- Refactored backend into modular `src/` structure (db/, claude/, routes/)
- Refactored frontend into feature-based structure (features/, hooks/, lib/)
- Extracted 579-line god component into slim App + hooks + layout
- Added shared constants, formatters, and custom React hooks

### Added
- **Task Queue & Auto-Chain**: Projects can enable auto-queue to automatically start next backlog task when current finishes
- **Activity Timeline**: Chronological event feed for all project actions with date grouping
- **Claude Usage Dashboard**: Token stats, model breakdown, cost analysis, 30-day sparkline, rate limit status
- **Claude Account Limits**: Live rate limit status, reset countdown, model info on dashboard
- **Review System**: Approve or request changes with revision feedback history
- **Live Terminal**: Rich output panel with grouped tool calls, turn separators, edit diffs, markdown rendering, elapsed timer
- **Live Token Tracking**: Real-time token/cost updates saved to DB on every turn

### Fixed
- `shell: false` for Claude CLI spawn (fixes prompt truncation with special characters)
- Correct stream-json event format parsing (was reading wrong fields)
- Removed invalid `--no-input` CLI flag
- Debounced DB saves (100ms batch instead of per-write)

## [2.0.0] - 2025-03-15

### Added
- Multi-project support with URL-based routing
- Dashboard homepage with project cards and avatar icons
- Claude usage tracking (tokens, cost, model info)
- Model and effort level selection per task
- CLAUDE.md editor
- Project-level permission modes
- Statistics panel with charts
- Time tracking (started_at, completed_at)

### Changed
- Complete rewrite from Turkish "bombom-task-manager" to English "Claude Board"
- Standalone app (removed GitLab integration)

## [1.0.0] - 2025-03-14

### Added
- Initial release as bombom-task-manager
- Kanban board with drag-and-drop
- Claude CLI integration for task execution
- Real-time log streaming via Socket.IO
- Task CRUD with SQLite persistence
