# Changelog

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
