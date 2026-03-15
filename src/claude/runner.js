import { spawn } from 'child_process';
import { platform } from 'os';
import { buildPrompt } from './prompt.js';
import { handleClaudeEvent } from './events.js';

const activeProcesses = new Map();
const activeToolCalls = new Map();
const taskUsage = new Map();
const startingTasks = new Set();

const IS_WIN = platform() === 'win32';
const MODEL_MAP = { opus: 'opus', sonnet: 'sonnet', haiku: 'haiku' };

// Cross-platform: resolve claude executable
function getClaudeCommand() {
  // On Windows, spawn with shell:false needs exact executable.
  // 'claude' works if it's a .exe in PATH.
  // Some installs use .cmd wrapper — shell:true handles that but has escaping issues.
  // We use shell:false with the bare command; Node resolves .exe on Windows via PATHEXT.
  return 'claude';
}

// Cross-platform process kill
function killProcess(proc) {
  try {
    if (IS_WIN) {
      // Windows: SIGTERM doesn't reliably kill child trees. Use taskkill.
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      // Unix: send SIGTERM to process group
      proc.kill('SIGTERM');
    }
  } catch {
    try { proc.kill('SIGKILL'); } catch {}
  }
}

export function isTaskRunning(taskId) { return activeProcesses.has(taskId); }
export function getActiveProcess(taskId) { return activeProcesses.get(taskId); }

export function stopClaude(taskId, io, queries) {
  const proc = activeProcesses.get(taskId);
  if (proc) {
    killProcess(proc);
    activeProcesses.delete(taskId);
    startingTasks.delete(taskId);
    taskUsage.delete(taskId);
    addLog(taskId, 'Claude process stopped by user.', 'system', queries, io);
  }
}

function addLog(taskId, message, logType, queries, io, meta = null) {
  try {
    queries.addTaskLog.run(taskId, message, logType);
  } catch (e) {
    console.error('[Log]', e.message);
  }
  const payload = { taskId, message, logType, created_at: new Date().toISOString() };
  if (meta) payload.meta = meta;
  io.emit('task:log', payload);
}

export function startClaude(task, io, workingDir, project = {}, revisions = [], { queries, statsQueries, activityLog, onFinished } = {}) {
  if (activeProcesses.has(task.id) || startingTasks.has(task.id)) {
    addLog(task.id, 'Claude is already running for this task.', 'system', queries, io);
    return;
  }
  startingTasks.add(task.id);

  const prompt = buildPrompt(task, revisions);
  const model = task.model || 'sonnet';
  const effort = task.thinking_effort || 'medium';
  const permissionMode = project.permission_mode || 'auto-accept';

  // Snapshot baseline usage for live tracking
  const currentTask = queries.getTaskById.get(task.id);
  taskUsage.set(task.id, {
    baseline: {
      input: currentTask?.input_tokens || 0,
      output: currentTask?.output_tokens || 0,
      cacheRead: currentTask?.cache_read_tokens || 0,
      cacheCreation: currentTask?.cache_creation_tokens || 0,
      cost: currentTask?.total_cost || 0,
    },
    session: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
  });

  addLog(task.id, `Starting Claude for task: ${task.title}`, 'system', queries, io);
  addLog(task.id, `Model: ${model} | Effort: ${effort} | Permissions: ${permissionMode}`, 'info', queries, io);

  if (activityLog) {
    activityLog.add(task.project_id, task.id, 'claude_started', `Claude started: ${task.title}`, { model, effort });
  }

  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
  if (MODEL_MAP[model]) args.push('--model', MODEL_MAP[model]);

  if (permissionMode === 'auto-accept') {
    args.push('--dangerously-skip-permissions');
  } else if (permissionMode === 'allow-tools') {
    const tools = (project.allowed_tools || '').split(',').map(t => t.trim()).filter(Boolean);
    if (tools.length > 0) {
      for (const t of tools) args.push('--allowedTools', t);
    } else {
      args.push('--dangerously-skip-permissions');
    }
  }

  const proc = spawn(getClaudeCommand(), args, {
    cwd: workingDir,
    shell: false,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(IS_WIN && { windowsHide: true }),
  });

  activeProcesses.set(task.id, proc);
  startingTasks.delete(task.id);
  let buffer = '';

  const taskAddLog = (tid, msg, type, meta = null) => addLog(tid, msg, type, queries, io, meta);

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        handleClaudeEvent(task.id, event, {
          addLog: taskAddLog,
          queries, statsQueries, io, taskUsage, activeToolCalls,
        });
      } catch {
        taskAddLog(task.id, line, 'claude');
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (!msg) return;
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('429') || msg.toLowerCase().includes('overloaded')) {
      queries.incrementRateLimitHits.run(task.id);
      taskAddLog(task.id, `Rate limit hit: ${msg}`, 'error');
    } else {
      taskAddLog(task.id, msg, 'error');
    }
  });

  proc.on('close', (code) => {
    activeProcesses.delete(task.id);
    startingTasks.delete(task.id);
    taskUsage.delete(task.id);

    if (code === 0) {
      taskAddLog(task.id, 'Claude finished successfully.', 'success');
      queries.updateTaskStatus.run('testing', task.id);
      queries.setTaskCompleted.run(task.id);
      const updated = queries.getTaskById.get(task.id);
      io.emit('task:updated', updated);
      if (activityLog) activityLog.add(task.project_id, task.id, 'task_completed', `Task completed: ${task.title}`);
    } else {
      taskAddLog(task.id, `Claude exited with code ${code}.`, 'error');
      if (activityLog) activityLog.add(task.project_id, task.id, 'task_failed', `Task failed (exit ${code}): ${task.title}`);
    }

    io.emit('claude:finished', { taskId: task.id, exitCode: code });
    if (onFinished) onFinished(task, code);
  });

  proc.on('error', (err) => {
    activeProcesses.delete(task.id);
    startingTasks.delete(task.id);
    taskUsage.delete(task.id);
    taskAddLog(task.id, `Failed to start Claude: ${err.message}`, 'error');
    io.emit('claude:finished', { taskId: task.id, exitCode: -1 });
    if (activityLog) activityLog.add(task.project_id, task.id, 'task_failed', `Failed to start: ${err.message}`);
  });
}
