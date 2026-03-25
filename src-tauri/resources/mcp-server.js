#!/usr/bin/env node

/**
 * Claude Board MCP Server
 *
 * Exposes task management tools to Claude via the Model Context Protocol.
 * Runs as a stdio server — Claude Code spawns it as a subprocess.
 *
 * Tools: list_projects, list_tasks, create_task, update_task, change_task_status,
 *        get_task_detail, delete_task, list_task_summary
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = process.env.CLAUDE_BOARD_URL || 'http://localhost:4000';

async function api(path, options = {}) {
  // eslint-disable-next-line no-undef
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

const server = new McpServer({
  name: 'claude-board',
  version: '4.0.0',
});

// ─── list_projects ───
server.tool('list_projects', 'List all projects with task counts and stats', {}, async () => {
  const projects = await api('/api/projects/summary');
  const text = projects
    .map(
      (p) =>
        `[${p.id}] ${p.name} (${p.slug}) — ${p.total_tasks} tasks (${p.active_tasks} active, ${p.done_tasks} done, ${p.backlog_tasks} backlog)`,
    )
    .join('\n');
  return { content: [{ type: 'text', text: text || 'No projects found.' }] };
});

// ─── list_tasks ───
server.tool(
  'list_tasks',
  'List all tasks for a project. Returns task keys, titles, status, type, and model.',
  { project_id: z.number().describe('Project ID') },
  async ({ project_id }) => {
    const tasks = await api(`/api/projects/${project_id}/tasks`);
    if (tasks.length === 0) return { content: [{ type: 'text', text: 'No tasks in this project.' }] };

    const lines = tasks.map(
      (t) =>
        `[${t.task_key || '#' + t.id}] ${t.title} — status: ${t.status}, type: ${t.task_type}, model: ${t.model || 'sonnet'}${t.is_running ? ' (RUNNING)' : ''}`,
    );
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// ─── create_task ───
server.tool(
  'create_task',
  'Create a new task in a project. Use parent_task_id to create sub-tasks that are linked to a parent — the parent will automatically wait for all sub-tasks to complete.',
  {
    project_id: z.number().describe('Project ID to create the task in'),
    title: z.string().describe('Task title — clear and concise'),
    description: z.string().optional().describe('Detailed description or prompt for Claude'),
    task_type: z
      .enum(['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'])
      .optional()
      .default('feature')
      .describe('Task type'),
    priority: z.number().min(0).max(3).optional().default(0).describe('Priority: 0=none, 1=low, 2=medium, 3=high'),
    model: z.enum(['haiku', 'sonnet', 'opus']).optional().default('sonnet').describe('Claude model to use'),
    acceptance_criteria: z.string().optional().describe('Definition of done — what must be true when task completes'),
    parent_task_id: z.number().optional().describe('Parent task ID — creates a sub-task linked to the parent. The parent will wait for all sub-tasks to complete before finishing.'),
  },
  async ({ project_id, title, description, task_type, priority, model, acceptance_criteria, parent_task_id }) => {
    const task = await api(`/api/projects/${project_id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || '',
        task_type: task_type || 'feature',
        priority: priority || 0,
        model: model || 'sonnet',
        acceptance_criteria: acceptance_criteria || '',
        parent_task_id: parent_task_id || null,
      }),
    });
    const parentInfo = parent_task_id ? ` (sub-task of #${parent_task_id})` : '';
    return {
      content: [
        {
          type: 'text',
          text: `Task created: ${task.task_key || '#' + task.id} — "${task.title}" (${task.task_type}, ${task.model}, priority: ${task.priority})${parentInfo}`,
        },
      ],
    };
  },
);

// ─── update_task ───
server.tool(
  'update_task',
  'Update an existing task (title, description, type, priority, model).',
  {
    task_id: z.number().describe('Task ID to update'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description'),
    task_type: z.enum(['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore']).optional().describe('New type'),
    priority: z.number().min(0).max(3).optional().describe('New priority'),
    model: z.enum(['haiku', 'sonnet', 'opus']).optional().describe('New model'),
    acceptance_criteria: z.string().optional().describe('New acceptance criteria'),
  },
  async ({ task_id, ...updates }) => {
    // Get current task to merge with updates
    const current = await api(`/api/tasks/${task_id}`);
    const data = {
      title: updates.title || current.title,
      description: updates.description !== undefined ? updates.description : current.description,
      task_type: updates.task_type || current.task_type,
      priority: updates.priority !== undefined ? updates.priority : current.priority,
      model: updates.model || current.model,
      acceptance_criteria:
        updates.acceptance_criteria !== undefined ? updates.acceptance_criteria : current.acceptance_criteria,
    };
    await api(`/api/tasks/${task_id}`, { method: 'PUT', body: JSON.stringify(data) });
    return { content: [{ type: 'text', text: `Task #${task_id} updated.` }] };
  },
);

// ─── change_task_status ───
server.tool(
  'change_task_status',
  'Move a task to a different status column (backlog, in_progress, testing, done).',
  {
    task_id: z.number().describe('Task ID'),
    status: z
      .enum(['backlog', 'in_progress', 'testing', 'done'])
      .describe('New status. WARNING: moving to in_progress will start Claude automatically.'),
  },
  async ({ task_id, status }) => {
    await api(`/api/tasks/${task_id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const labels = { backlog: 'Backlog', in_progress: 'In Progress', testing: 'Testing', done: 'Done' };
    return { content: [{ type: 'text', text: `Task #${task_id} moved to ${labels[status]}.` }] };
  },
);

// ─── get_task_detail ───
server.tool(
  'get_task_detail',
  'Get full details of a task including commits, revisions, attachments, and usage stats.',
  { task_id: z.number().describe('Task ID') },
  async ({ task_id }) => {
    const d = await api(`/api/tasks/${task_id}/detail`);
    const lines = [
      `# ${d.task_key || '#' + d.id} — ${d.title}`,
      `Status: ${d.status} | Type: ${d.task_type} | Model: ${d.model} | Priority: ${d.priority}`,
      d.description ? `\nDescription:\n${d.description}` : '',
      d.acceptance_criteria ? `\nAcceptance Criteria:\n${d.acceptance_criteria}` : '',
      d.branch_name ? `Branch: ${d.branch_name}` : '',
      d.is_running ? '⚡ Currently running' : '',
      `\nTokens: ${(d.input_tokens || 0).toLocaleString()} in / ${(d.output_tokens || 0).toLocaleString()} out`,
      d.total_cost > 0 ? `Cost: $${d.total_cost.toFixed(4)}` : '',
      d.commits && JSON.parse(d.commits || '[]').length > 0 ? `Commits: ${JSON.parse(d.commits).join(', ')}` : '',
      d.revisions?.length > 0
        ? `\nRevisions (${d.revisions.length}):\n${d.revisions.map((r) => `  #${r.revision_number}: ${r.feedback}`).join('\n')}`
        : '',
    ].filter(Boolean);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// ─── delete_task ───
server.tool(
  'delete_task',
  'Permanently delete a task. This cannot be undone.',
  { task_id: z.number().describe('Task ID to delete') },
  async ({ task_id }) => {
    await api(`/api/tasks/${task_id}`, { method: 'DELETE' });
    return { content: [{ type: 'text', text: `Task #${task_id} deleted.` }] };
  },
);

// ─── list_task_summary ───
server.tool(
  'list_task_summary',
  'Get a summary of tasks grouped by status for a project.',
  { project_id: z.number().describe('Project ID') },
  async ({ project_id }) => {
    const tasks = await api(`/api/projects/${project_id}/tasks`);
    const groups = { backlog: [], in_progress: [], testing: [], done: [] };
    tasks.forEach((t) => {
      if (groups[t.status]) groups[t.status].push(t);
    });

    const lines = [];
    for (const [status, items] of Object.entries(groups)) {
      const label = { backlog: 'Backlog', in_progress: 'In Progress', testing: 'Testing', done: 'Done' }[status];
      lines.push(`\n## ${label} (${items.length})`);
      items.forEach((t) => {
        lines.push(`  - [${t.task_key || '#' + t.id}] ${t.title} (${t.task_type}, ${t.model})`);
      });
    }
    return { content: [{ type: 'text', text: `# Project Tasks\nTotal: ${tasks.length}${lines.join('\n')}` }] };
  },
);

// ─── Start server ───
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
