<div align="center">

# Claude Board

**AI-powered task management platform that orchestrates Claude to autonomously execute development tasks.**

[![Version](https://img.shields.io/badge/version-1.0.0-DA7756?style=flat-square)](https://github.com/bahri-hirfanoglu/claude-board/releases)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/tauri-v2-FFC131?style=flat-square)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/rust-backend-DEA584?style=flat-square)](https://www.rust-lang.org)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green?style=flat-square)](https://nodejs.org)

[Features](#features) &bull; [Download](#download) &bull; [Quick Start](#quick-start) &bull; [Documentation](#documentation) &bull; [Contributing](#contributing)

</div>

<p align="center">
  <img src="web/demo.gif" alt="Claude Board Demo" width="100%" />
</p>

---

## What is Claude Board?

Claude Board is a self-hosted Kanban-style project management tool that integrates directly with [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code). Create tasks, drag them to "In Progress", and Claude autonomously writes code, creates branches, and commits changes &mdash; all while you watch the live terminal output.

Think of it as **Jira meets AI pair programming**: you define what needs to be done, Claude does the coding, you review and approve.

## Download

### Desktop App

Download the latest version for your platform:

| Platform | Download | Notes |
|----------|----------|-------|
| **Windows** | [ClaudeBoard-Setup.exe](https://github.com/bahri-hirfanoglu/claude-board/releases/latest) | NSIS installer |
| **macOS (Intel)** | [ClaudeBoard-x64.dmg](https://github.com/bahri-hirfanoglu/claude-board/releases/latest) | Intel Macs |
| **macOS (Apple Silicon)** | [ClaudeBoard-arm64.dmg](https://github.com/bahri-hirfanoglu/claude-board/releases/latest) | M1/M2/M3/M4 Macs |
| **Linux** | [ClaudeBoard.AppImage](https://github.com/bahri-hirfanoglu/claude-board/releases/latest) | Universal Linux |
| **Linux (Debian)** | [ClaudeBoard.deb](https://github.com/bahri-hirfanoglu/claude-board/releases/latest) | Ubuntu/Debian |

> **Note:** Claude Code CLI must be installed and authenticated on your system for task execution to work.

## Features

- **Planning Mode** &mdash; AI-powered task breakdown with review/approve/revise workflow &mdash; describe what to build and Claude explores your codebase, then generates structured tasks you can refine before execution
- **Kanban Board** &mdash; Drag-and-drop tasks across Backlog, In Progress, Testing, Done
- **Multiple Views** &mdash; Switch between Board, List, Timeline, and Summary views
- **Autonomous Execution** &mdash; Claude CLI auto-starts when tasks move to In Progress
- **Live Terminal** &mdash; Watch Claude's tool calls, file edits, and bash commands in real-time
- **Review System** &mdash; Approve completed work or request changes with revision feedback
- **Claude Manager** &mdash; Dashboard for managing MCP servers, plugins, agents, hooks, sessions, permissions, and settings
- **Claude Usage Dashboard** &mdash; Token stats, model breakdown, cost analysis, 30-day sparkline, rate limit status
- **Context Snippets & Prompt Templates** &mdash; Reusable rules, context, and templates with variable substitution
- **Webhook Notifications** &mdash; Send task events to Slack, Discord, Microsoft Teams, or custom endpoints
- **Task Queue** &mdash; Auto-queue to chain tasks &mdash; when one finishes, the next starts automatically
- **Git Automation** &mdash; Auto-create feature branches and optional auto-PR creation
- **Live Token Tracking** &mdash; Real-time token consumption and cost updates
- **Multi-Project** &mdash; Manage multiple projects with custom avatars and working directories
- **Model Selection** &mdash; Choose Opus, Sonnet, or Haiku per task with thinking effort levels
- **Voice Assistant** &mdash; Speech recognition and text-to-speech for hands-free task management
- **Desktop App** &mdash; Native Windows, macOS, and Linux builds via Tauri v2 with loading splash screen and auto-updater via GitHub Releases
- **Mobile Responsive** &mdash; Full mobile support with touch-friendly controls

See the [Documentation](https://docs.claboard.dev) for detailed guides with visual walkthroughs.

## Quick Start

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable toolchain)
- [Node.js](https://nodejs.org) >= 18.0.0
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

### Install from Source

```bash
git clone https://github.com/bahri-hirfanoglu/claude-board.git
cd claude-board
npm install
cd client && npm install && cd ..
npx tauri dev
```

### Build Desktop Installers

```bash
npx tauri build
```

Built artifacts are saved to `src-tauri/target/release/bundle/`.

## Documentation

For detailed guides, concepts, and feature documentation, visit the **[Claude Board Docs](https://docs.claboard.dev/)**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">
  Built with Claude Code
</div>
