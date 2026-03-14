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

export function startClaude(task, io, workingDir) {
  if (activeProcesses.has(task.id)) {
    addLog(task.id, 'Claude is already running for this task.', 'system', io);
    return;
  }

  const prompt = buildPrompt(task);

  addLog(task.id, `Starting Claude for task: ${task.title}`, 'system', io);
  addLog(task.id, `Prompt: ${prompt.substring(0, 200)}...`, 'info', io);

  const proc = spawn('claude', [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--no-input',
    '--verbose'
  ], {
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
      addLog(task.id, msg, 'error', io);
    }
  });

  proc.on('close', (code) => {
    activeProcesses.delete(task.id);
    if (code === 0) {
      addLog(task.id, 'Claude finished successfully.', 'success', io);
      queries.updateTaskStatus.run('testing', task.id);
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
        addLog(taskId, `🔧 Tool: ${toolName}`, 'tool', io);
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
      if (event.result) {
        addLog(taskId, `✅ Result: ${String(event.result).substring(0, 500)}`, 'success', io);
      }
      break;
    }
    case 'system': {
      if (event.message) {
        addLog(taskId, event.message, 'system', io);
      }
      break;
    }
    default: {
      // Forward raw event for debugging
      io.emit('claude:event', { taskId, event });
      break;
    }
  }
}

function buildPrompt(task) {
  return `${task.title}\n\n${task.description}\n\nBu görevi tamamla. Geliştirme bitince yeni bir branch aç, commit at ve push yap. Branch adı: feature/task-${task.id}`;
}
