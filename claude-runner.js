import { spawn } from 'child_process';
import { queries } from './db.js';

const activeProcesses = new Map();

export function getActiveProcess(taskId) {
  return activeProcesses.get(taskId);
}

export function isTaskRunning(taskId) {
  return activeProcesses.has(taskId);
}

export function stopClaude(taskId, io) {
  const proc = activeProcesses.get(taskId);
  if (proc) {
    proc.kill('SIGTERM');
    activeProcesses.delete(taskId);
    addLog(taskId, 'Claude process stopped by user.', 'system', io);
  }
}

function addLog(taskId, message, logType, io) {
  queries.addTaskLog.run(taskId, message, logType);
  io.emit('task:log', { taskId, message, logType, created_at: new Date().toISOString() });
}

// Map UI model names to Claude CLI model flags
const MODEL_MAP = {
  'opus': 'opus',
  'sonnet': 'sonnet',
  'haiku': 'haiku',
};

export function startClaude(task, io, workingDir, project = {}) {
  if (activeProcesses.has(task.id)) {
    addLog(task.id, 'Claude is already running for this task.', 'system', io);
    return;
  }

  const prompt = buildPrompt(task);
  const model = task.model || 'sonnet';
  const effort = task.thinking_effort || 'medium';
  const permissionMode = project.permission_mode || 'auto-accept';

  addLog(task.id, `Starting Claude for task: ${task.title}`, 'system', io);
  addLog(task.id, `Model: ${model} | Effort: ${effort} | Permissions: ${permissionMode} | Dir: ${workingDir}`, 'info', io);

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--no-input',
    '--verbose',
  ];

  // Set model
  if (MODEL_MAP[model]) {
    args.push('--model', MODEL_MAP[model]);
  }

  // Permission handling
  if (permissionMode === 'auto-accept') {
    // Full autonomy - skip all permission prompts
    args.push('--dangerously-skip-permissions');
  } else if (permissionMode === 'allow-tools') {
    // Allow specific tool categories
    const allowedTools = (project.allowed_tools || '').split(',').map(t => t.trim()).filter(Boolean);
    if (allowedTools.length > 0) {
      for (const tool of allowedTools) {
        args.push('--allowedTools', tool);
      }
    } else {
      // No specific tools configured, fall back to auto-accept
      args.push('--dangerously-skip-permissions');
    }
  }
  // permissionMode === 'default' → no extra flags, Claude uses its default permission settings

  const proc = spawn('claude', args, {
    cwd: workingDir,
    shell: true,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  activeProcesses.set(task.id, proc);

  let buffer = '';

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        handleClaudeEvent(task.id, event, io);
      } catch {
        addLog(task.id, line, 'claude', io);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      // Detect rate limit hits
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('429') || msg.toLowerCase().includes('overloaded')) {
        queries.incrementRateLimitHits.run(task.id);
        addLog(task.id, `Rate limit hit: ${msg}`, 'error', io);
      } else {
        addLog(task.id, msg, 'error', io);
      }
    }
  });

  proc.on('close', (code) => {
    activeProcesses.delete(task.id);
    if (code === 0) {
      addLog(task.id, 'Claude finished successfully.', 'success', io);
      queries.updateTaskStatus.run('testing', task.id);
      queries.setTaskCompleted.run(task.id);
      io.emit('task:updated', queries.getTaskById.get(task.id));
    } else {
      addLog(task.id, `Claude exited with code ${code}.`, 'error', io);
    }
    io.emit('claude:finished', { taskId: task.id, exitCode: code });
  });

  proc.on('error', (err) => {
    activeProcesses.delete(task.id);
    addLog(task.id, `Failed to start Claude: ${err.message}`, 'error', io);
    io.emit('claude:finished', { taskId: task.id, exitCode: -1 });
  });
}

function handleClaudeEvent(taskId, event, io) {
  const type = event.type;

  switch (type) {
    case 'assistant': {
      const subtype = event.subtype;
      if (subtype === 'text' && event.text) {
        addLog(taskId, event.text, 'claude', io);
      } else if (subtype === 'tool_use') {
        const toolName = event.tool_name || event.name || 'unknown';
        addLog(taskId, `Tool: ${toolName}`, 'tool', io);
      }
      break;
    }
    case 'user': {
      if (event.subtype === 'tool_result') {
        // tool result - skip verbose output
      }
      break;
    }
    case 'result': {
      // Extract usage statistics from the result event
      const usage = event.usage || {};
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const cacheCreation = usage.cache_creation_input_tokens || 0;
      const totalCost = event.total_cost || 0;
      const numTurns = event.num_turns || 0;
      const modelUsed = event.model || '';
      const sessionId = event.session_id || '';

      if (inputTokens > 0 || outputTokens > 0) {
        queries.updateTaskUsage.run(
          inputTokens, outputTokens, cacheRead, cacheCreation,
          totalCost, numTurns, modelUsed, taskId
        );

        if (sessionId) {
          queries.updateTaskClaudeSession.run(sessionId, taskId);
        }

        // Log usage summary
        const totalTokens = inputTokens + outputTokens;
        const costStr = totalCost > 0 ? ` | Cost: $${totalCost.toFixed(4)}` : '';
        addLog(taskId, `Usage: ${totalTokens.toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out)${costStr} | Turns: ${numTurns} | Model: ${modelUsed}`, 'system', io);

        // Emit updated task with usage data
        const updated = queries.getTaskById.get(taskId);
        if (updated) io.emit('task:updated', updated);
      }

      if (event.result) {
        addLog(taskId, `Result: ${String(event.result).substring(0, 500)}`, 'success', io);
      }
      break;
    }
    case 'system': {
      const msg = event.message || '';
      // Detect rate limits in system messages
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('429') || msg.toLowerCase().includes('overloaded')) {
        queries.incrementRateLimitHits.run(taskId);
      }
      if (msg) {
        addLog(taskId, msg, 'system', io);
      }
      break;
    }
    default: {
      io.emit('claude:event', { taskId, event });
      break;
    }
  }
}

function buildPrompt(task) {
  const parts = [`# Task: ${task.title}`];

  if (task.description) {
    parts.push(`\n## Description\n${task.description}`);
  }

  if (task.acceptance_criteria) {
    parts.push(`\n## Acceptance Criteria\n${task.acceptance_criteria}`);
  }

  parts.push(`\n## Instructions`);
  parts.push(`- Task type: ${task.task_type || 'feature'}`);
  parts.push(`- Complete this task thoroughly and commit your changes.`);
  parts.push(`- Create a new branch named \`${task.task_type || 'feature'}/task-${task.id}\`, commit, and push.`);
  parts.push(`- Write clear commit messages describing what was done.`);
  parts.push(`- If acceptance criteria are provided, ensure all criteria are met.`);

  return parts.join('\n');
}
