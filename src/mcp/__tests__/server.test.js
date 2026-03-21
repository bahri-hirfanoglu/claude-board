import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Test MCP server module structure ───
describe('MCP server module', () => {
  const serverSource = readFileSync(resolve(__dirname, '..', 'server.js'), 'utf-8');

  it('imports McpServer from SDK', () => {
    expect(serverSource).toContain("from '@modelcontextprotocol/sdk/server/mcp.js'");
  });

  it('imports StdioServerTransport', () => {
    expect(serverSource).toContain("from '@modelcontextprotocol/sdk/server/stdio.js'");
  });

  it('creates server with correct name and version', () => {
    expect(serverSource).toContain("name: 'claude-board'");
    expect(serverSource).toContain("version: '4.0.0'");
  });

  it('registers all 8 required tools', () => {
    const tools = [
      'list_projects',
      'list_tasks',
      'create_task',
      'update_task',
      'change_task_status',
      'get_task_detail',
      'delete_task',
      'list_task_summary',
    ];
    for (const tool of tools) {
      expect(serverSource).toContain(`'${tool}'`);
    }
  });

  it('uses CLAUDE_BOARD_URL env var with localhost fallback', () => {
    expect(serverSource).toContain('CLAUDE_BOARD_URL');
    expect(serverSource).toContain('http://localhost:4000');
  });

  it('calls correct API endpoints', () => {
    expect(serverSource).toContain('/api/projects/summary');
    expect(serverSource).toContain('/api/projects/${project_id}/tasks');
    expect(serverSource).toContain('/api/tasks/${task_id}');
    expect(serverSource).toContain('/api/tasks/${task_id}/status');
    expect(serverSource).toContain('/api/tasks/${task_id}/detail');
  });

  it('create_task sends POST with correct fields', () => {
    expect(serverSource).toContain("method: 'POST'");
    expect(serverSource).toContain('title');
    expect(serverSource).toContain('description');
    expect(serverSource).toContain('task_type');
    expect(serverSource).toContain('priority');
    expect(serverSource).toContain('model');
    expect(serverSource).toContain('acceptance_criteria');
  });

  it('change_task_status sends PATCH', () => {
    expect(serverSource).toContain("method: 'PATCH'");
    expect(serverSource).toContain('backlog');
    expect(serverSource).toContain('in_progress');
    expect(serverSource).toContain('testing');
    expect(serverSource).toContain('done');
  });

  it('delete_task sends DELETE', () => {
    expect(serverSource).toContain("method: 'DELETE'");
  });

  it('update_task sends PUT and merges with current task', () => {
    expect(serverSource).toContain("method: 'PUT'");
    expect(serverSource).toContain('current.title');
    expect(serverSource).toContain('current.description');
  });

  it('list_tasks handles empty project', () => {
    expect(serverSource).toContain('No tasks in this project.');
  });

  it('list_projects handles empty result', () => {
    expect(serverSource).toContain('No projects found.');
  });

  it('get_task_detail parses commits JSON', () => {
    expect(serverSource).toContain('JSON.parse(d.commits');
  });

  it('list_task_summary groups by status', () => {
    expect(serverSource).toContain('backlog: []');
    expect(serverSource).toContain('in_progress: []');
    expect(serverSource).toContain('testing: []');
    expect(serverSource).toContain('done: []');
  });
});

// ─── Test runner MCP integration ───
describe('Runner MCP integration', () => {
  const runnerSource = readFileSync(resolve(__dirname, '../../claude/runner.js'), 'utf-8');

  it('defines MCP_SERVER_PATH', () => {
    expect(runnerSource).toContain('MCP_SERVER_PATH');
    expect(runnerSource).toContain("'mcp', 'server.js'");
  });

  it('passes --mcp-config flag to Claude CLI', () => {
    expect(runnerSource).toContain("'--mcp-config'");
  });

  it('builds mcpConfig JSON with claude-board server', () => {
    expect(runnerSource).toContain('mcpServers');
    expect(runnerSource).toContain("'claude-board'");
    expect(runnerSource).toContain('MCP_SERVER_PATH');
  });

  it('passes CLAUDE_BOARD_URL env to MCP server', () => {
    expect(runnerSource).toContain('CLAUDE_BOARD_URL');
  });
});

// ─── Test prompt MCP instructions ───
describe('Prompt MCP instructions', () => {
  const promptSource = readFileSync(resolve(__dirname, '../../claude/prompt.js'), 'utf-8');

  it('includes Claude Board Integration section', () => {
    expect(promptSource).toContain('Claude Board Integration');
  });

  it('tells Claude about available MCP tools', () => {
    expect(promptSource).toContain('list_tasks');
    expect(promptSource).toContain('create_task');
    expect(promptSource).toContain('change_task_status');
    expect(promptSource).toContain('get_task_detail');
    expect(promptSource).toContain('list_task_summary');
  });

  it('includes project_id in prompt', () => {
    expect(promptSource).toContain('project_id');
  });

  it('instructs Claude to use tools for planning', () => {
    expect(promptSource).toContain('plan');
    expect(promptSource).toContain('break down');
  });
});
