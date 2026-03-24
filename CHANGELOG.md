# Changelog

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
