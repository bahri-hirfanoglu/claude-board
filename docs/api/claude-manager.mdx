---
title: "Claude Manager API"
description: "Tauri IPC commands for managing Claude CLI, MCP servers, plugins, and skills"
icon: "wand-magic-sparkles"
---

<Note>All Claude Manager endpoints are Tauri IPC only. They require the Claude CLI to be installed.</Note>

## Claude CLI

### Get Version

```javascript
invoke('get_claude_version')
// -> "1.0.16 (Claude Code)"
```

Returns the installed Claude CLI version string.

### Update CLI

```javascript
invoke('update_claude_cli')
// -> "Updated to version 1.0.17"
```

Runs `claude update` to update the Claude CLI to the latest version.

### List Agents

```javascript
invoke('list_agents')
```

Lists all active Claude agent sessions.

### List Sessions

```javascript
invoke('list_sessions')
```

Lists recent Claude CLI sessions with metadata.

---

## Settings

### Get Claude Settings

```javascript
invoke('get_claude_settings')
```

Returns the Claude CLI configuration (`~/.claude/settings.json`).

### Save Claude Settings

```javascript
invoke('save_claude_settings', {
  settings: {
    // Claude CLI settings object
  }
})
```

Writes updated settings to the Claude CLI configuration file.

### Get Permission Rules

```javascript
invoke('get_permission_rules')
```

Returns the current Claude CLI permission rules configuration.

### Get Hooks

```javascript
invoke('get_hooks')
```

Returns configured Claude CLI hooks (pre/post execution hooks).

### Save Hooks

```javascript
invoke('save_hooks', {
  hooks: {
    // Hooks configuration object
  }
})
```

---

## MCP Servers

### List MCP Servers

```javascript
invoke('list_mcp_servers')
```

Returns all configured MCP (Model Context Protocol) servers.

### Add MCP Server

```javascript
invoke('add_mcp_server', {
  name: "my-server",
  commandStr: "npx",
  args: ["-y", "@my/mcp-server"],
  scope: "project",  // "project" | "global"
  env: ["API_KEY=xxx"]
})
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Server display name |
| `commandStr` | Yes | Command to start the server |
| `args` | No | Command arguments |
| `scope` | No | `project` or `global` |
| `env` | No | Environment variables as `KEY=VALUE` strings |

### Remove MCP Server

```javascript
invoke('remove_mcp_server', { name: "my-server", scope: "project" })
```

---

## Plugins

### List Plugins

```javascript
invoke('list_plugins')
```

### Install Plugin

```javascript
invoke('install_plugin', { name: "plugin-name" })
```

### Uninstall Plugin

```javascript
invoke('uninstall_plugin', { name: "plugin-name" })
```

### Toggle Plugin

```javascript
invoke('toggle_plugin', { name: "plugin-name", enabled: true })
```

---

## Marketplaces

### List Marketplaces

```javascript
invoke('list_marketplaces')
```

### Add Marketplace

```javascript
invoke('add_marketplace', { source: "https://marketplace-url", scope: "global" })
```

### Remove Marketplace

```javascript
invoke('remove_marketplace', { name: "marketplace-name" })
```

---

## Codebase Scan

### Scan Codebase

```javascript
invoke('scan_codebase', { projectId: 1, mode: "overwrite" })
```

Runs Claude to analyze the project codebase and generate a CLAUDE.md file with project-specific instructions.

| Field | Default | Description |
|-------|---------|-------------|
| `projectId` | *required* | Target project ID |
| `mode` | `overwrite` | `overwrite` replaces existing, `append` adds to existing |

### Save Scan Result

```javascript
invoke('save_scan_result', {
  projectId: 1,
  content: "# Project Instructions\n...",
  mode: "overwrite"
})
```

Saves generated scan content as the project's CLAUDE.md file.

---

## Custom Commands & Skills

### List Custom Commands

```javascript
invoke('list_custom_commands')
```

Returns all custom slash commands configured in the Claude CLI.

### List Custom Skills

```javascript
invoke('list_custom_skills')
```

Returns all locally saved custom skills.

### Save Custom Skill

```javascript
invoke('save_custom_skill', {
  name: "my-skill",
  content: "Skill definition content..."
})
```

### Delete Custom Skill

```javascript
invoke('delete_custom_skill', { name: "my-skill" })
```

### Fetch GitHub Skills

```javascript
invoke('fetch_github_skills', {
  repoUrl: "https://github.com/owner/skills-repo",
  path: "skills/"  // optional subdirectory
})
```

Fetches skill definitions from a GitHub repository.

### Fetch Skill Content

```javascript
invoke('fetch_skill_content', { url: "https://raw.githubusercontent.com/.../skill.md" })
```

Downloads the content of a single skill file from a URL.

---

## Suggestions

```javascript
invoke('get_suggestions')
```

Returns AI-generated suggestions for improving the Claude CLI configuration and project setup.
