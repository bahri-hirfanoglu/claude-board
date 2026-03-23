# Changelog

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
