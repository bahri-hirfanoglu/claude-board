import { spawn, execSync } from 'child_process';
import { platform } from 'os';
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildPrompt } from './prompt.js';
import { handleClaudeEvent } from './events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');

const activeProcesses = new Map();
const activeToolCalls = new Map();
const taskUsage = new Map();
const startingTasks = new Set();

const IS_WIN = platform() === 'win32';
const MODEL_MAP = { opus: 'opus', sonnet: 'sonnet', haiku: 'haiku' };

// Server-side logger
const CLR = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};
function ts() {
  return `${CLR.gray}${new Date().toLocaleTimeString('tr-TR', { hour12: false })}${CLR.reset}`;
}
const slog = {
  claude: (msg) => console.log(`${ts()} ${CLR.magenta}[CLAUDE]${CLR.reset} ${msg}`),
  task: (msg) => console.log(`${ts()} ${CLR.yellow}[TASK]${CLR.reset} ${msg}`),
  git: (msg) => console.log(`${ts()} ${CLR.blue}[GIT]${CLR.reset} ${msg}`),
};

// Generate a short, meaningful branch name from task title
function generateBranchSlug(title) {
  return title
    .toLowerCase()
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
}

// Auto-create git branch for a task before Claude starts
function ensureTaskBranch(task, workingDir, project, queries, io) {
  if (!project.auto_branch) return null;
  const isRevision = (task.revision_count || 0) > 0;
  const slug = generateBranchSlug(task.title) || `task-${task.id}`;
  const branchName = task.branch_name || `${task.task_type || 'feature'}/${slug}`;

  try {
    const exec = (cmd) => execSync(cmd, { cwd: workingDir, stdio: 'pipe', timeout: 10000 }).toString().trim();

    // Check if we're in a git repo
    exec('git rev-parse --is-inside-work-tree');

    if (isRevision && task.branch_name) {
      // For revisions, just checkout the existing branch
      try {
        const currentBranch = exec('git branch --show-current');
        if (currentBranch !== task.branch_name) {
          exec(`git checkout ${task.branch_name}`);
          addLog(task.id, `Switched to branch: ${task.branch_name}`, 'system', queries, io);
        }
      } catch {
        addLog(task.id, `Branch ${task.branch_name} not found, creating fresh`, 'info', queries, io);
        exec(`git checkout -b ${branchName}`);
      }
    } else {
      // For new tasks, create and checkout branch
      try {
        // Determine base branch
        const baseBranch = project.pr_base_branch || 'main';
        try {
          exec(`git rev-parse --verify ${baseBranch}`);
        } catch {
          // fallback: stay on current branch as base
        }

        // Check if branch already exists
        try {
          exec(`git rev-parse --verify ${branchName}`);
          // Branch exists, just checkout
          exec(`git checkout ${branchName}`);
          addLog(task.id, `Switched to existing branch: ${branchName}`, 'system', queries, io);
        } catch {
          // Branch doesn't exist, create from base
          try {
            exec(`git checkout -b ${branchName} ${baseBranch}`);
          } catch {
            exec(`git checkout -b ${branchName}`);
          }
          addLog(task.id, `Created branch: ${branchName}`, 'system', queries, io);
        }
      } catch (e) {
        addLog(task.id, `Git branch setup failed: ${e.message}`, 'error', queries, io);
        return null;
      }
    }

    // Store branch name in task
    queries.updateTaskBranch.run(branchName, task.id);
    return branchName;
  } catch {
    return null;
  }
}

// Auto-create PR after task completes
function createPullRequest(task, workingDir, project, queries, io) {
  if (!project.auto_pr || !task.branch_name) return null;

  try {
    const exec = (cmd) => execSync(cmd, { cwd: workingDir, stdio: 'pipe', timeout: 15000 }).toString().trim();
    const baseBranch = project.pr_base_branch || 'main';
    const branch = task.branch_name;

    // Check if PR already exists
    try {
      const existing = exec(`gh pr view ${branch} --json url --jq .url`);
      if (existing.startsWith('http')) {
        addLog(task.id, `PR already exists: ${existing}`, 'system', queries, io);
        return existing;
      }
    } catch {
      // No existing PR, create one
    }

    // Check if there are commits to PR
    try {
      const diff = exec(`git log ${baseBranch}..${branch} --oneline`);
      if (!diff) {
        addLog(task.id, 'No commits to create PR for', 'info', queries, io);
        return null;
      }
    } catch {
      return null;
    }

    // Create PR
    const title = task.title;
    const body = `## Task #${task.id}: ${task.title}\n\n${task.description || 'No description provided.'}\n\n---\n*Auto-generated by Claude Board*`;
    const prUrl = exec(
      `gh pr create --base ${baseBranch} --head ${branch} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`,
    );

    if (prUrl.startsWith('http')) {
      addLog(task.id, `PR created: ${prUrl}`, 'success', queries, io);
      queries.updateTaskGitInfo.run(task.commits || '[]', prUrl, task.diff_stat, task.id);
      return prUrl;
    }
    return null;
  } catch (e) {
    addLog(task.id, `Auto-PR failed: ${e.message}`, 'error', queries, io);
    return null;
  }
}

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
    try {
      proc.kill('SIGKILL');
    } catch {}
  }
}

export function isTaskRunning(taskId) {
  return activeProcesses.has(taskId);
}
export function getActiveProcess(taskId) {
  return activeProcesses.get(taskId);
}

export function stopClaude(taskId, io, queries) {
  const proc = activeProcesses.get(taskId);
  if (proc) {
    slog.claude(`Stopping task #${taskId} (PID: ${proc.pid})`);
    killProcess(proc);
    activeProcesses.delete(taskId);
    startingTasks.delete(taskId);
    taskUsage.delete(taskId);
    addLog(taskId, 'Claude process stopped by user.', 'system', queries, io);
  }
}

function addLog(taskId, message, logType, queries, io, meta = null) {
  try {
    queries.addTaskLog.run(taskId, message, logType, meta);
  } catch (e) {
    console.error('[Log]', e.message);
  }
  const payload = { taskId, message, logType, created_at: new Date().toISOString() };
  if (meta) payload.meta = meta;
  io.emit('task:log', payload);
}

// Scan git for recent commits and PR URLs after task completes
function scanGitInfo(workingDir, taskId, queries) {
  try {
    const exec = (cmd) => execSync(cmd, { cwd: workingDir, stdio: 'pipe', timeout: 5000 }).toString().trim();

    // Get recent commits (last 10, on current branch)
    const logOutput = exec('git log --oneline -10 --no-merges --format="%H|%h|%s|%an|%ai"');
    const commits = logOutput
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, short, message, author, date] = line.split('|');
        return { hash, short, message, author, date };
      });

    // Try to find remote URL for commit links
    let repoUrl = '';
    try {
      const remote = exec('git remote get-url origin');
      repoUrl = remote
        .replace(/\.git$/, '')
        .replace(/^git@github\.com:/, 'https://github.com/')
        .replace(/^git@(.+):/, 'https://$1/');
    } catch {}

    if (repoUrl) {
      commits.forEach((c) => {
        c.url = `${repoUrl}/commit/${c.hash}`;
      });
    }

    // Capture diff stat
    let diffStat = null;
    try {
      const branch = exec('git branch --show-current');
      if (branch && branch !== 'main' && branch !== 'master') {
        // Diff against the base branch (main or master)
        let baseBranch = 'main';
        try {
          exec('git rev-parse --verify main');
        } catch {
          baseBranch = 'master';
        }
        diffStat = exec(`git diff --stat ${baseBranch}...HEAD`);
      } else if (commits.length > 0) {
        diffStat = exec(`git diff --stat HEAD~${Math.min(commits.length, 10)}..HEAD`);
      }
    } catch {}

    // Try to find PR URL (if gh CLI is available)
    let prUrl = null;
    try {
      const branch = exec('git branch --show-current');
      if (branch && branch !== 'main' && branch !== 'master') {
        const prOutput = exec(`gh pr view ${branch} --json url --jq .url`);
        if (prOutput.startsWith('http')) prUrl = prOutput;
      }
    } catch {}

    queries.updateTaskGitInfo.run(commits, prUrl, diffStat, taskId);
    return { commits, prUrl, diffStat };
  } catch {
    return { commits: [], prUrl: null };
  }
}

export function startClaude(
  task,
  io,
  workingDir,
  project = {},
  revisions = [],
  snippets = [],
  { queries, statsQueries, activityLog, onFinished, attachments = [], role = null } = {},
) {
  if (activeProcesses.has(task.id) || startingTasks.has(task.id)) {
    addLog(task.id, 'Claude is already running for this task.', 'system', queries, io);
    return;
  }
  startingTasks.add(task.id);
  slog.task(`Starting #${task.id} "${task.title}" [${task.task_type}]`);

  // Copy attachments to working directory
  const attachDir = join(workingDir, '.claude-attachments');
  if (attachments.length > 0) {
    try {
      if (!existsSync(attachDir)) mkdirSync(attachDir, { recursive: true });
      for (const a of attachments) {
        const src = join(UPLOADS_DIR, a.filename);
        const dest = join(attachDir, a.filename);
        if (existsSync(src)) {
          copyFileSync(src, dest);
          slog.task(`Attached: ${a.original_name} → .claude-attachments/${a.filename}`);
        }
      }
    } catch (e) {
      slog.task(`${CLR.red}Attachment copy failed:${CLR.reset} ${e.message}`);
    }
  }

  const prompt = buildPrompt(task, revisions, snippets, attachments, role);
  const model = task.model || 'sonnet';
  const effort = task.thinking_effort || 'medium';
  const permissionMode = project.permission_mode || 'auto-accept';
  slog.claude(`Config: model=${model} effort=${effort} permissions=${permissionMode}`);

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

  // Auto-create git branch if enabled
  const branchName = ensureTaskBranch(task, workingDir, project, queries, io);
  if (branchName) {
    task.branch_name = branchName;
    slog.git(`Task #${task.id} → branch: ${branchName}`);
  }

  addLog(task.id, `Starting Claude for task: ${task.title}`, 'system', queries, io);
  addLog(
    task.id,
    `Model: ${model} | Effort: ${effort} | Permissions: ${permissionMode}${task.branch_name ? ` | Branch: ${task.branch_name}` : ''}`,
    'info',
    queries,
    io,
  );

  if (activityLog) {
    activityLog.add(task.project_id, task.id, 'claude_started', `Claude started: ${task.title}`, { model, effort });
  }

  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
  if (MODEL_MAP[model]) args.push('--model', MODEL_MAP[model]);

  if (permissionMode === 'auto-accept') {
    args.push('--dangerously-skip-permissions');
  } else if (permissionMode === 'allow-tools') {
    const tools = (project.allowed_tools || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
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
  slog.claude(`Task #${task.id} spawned (PID: ${proc.pid}) — ${activeProcesses.size} active process(es)`);
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
          queries,
          statsQueries,
          io,
          taskUsage,
          activeToolCalls,
        });
      } catch {
        taskAddLog(task.id, line, 'claude');
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (!msg) return;
    if (
      msg.toLowerCase().includes('rate limit') ||
      msg.toLowerCase().includes('429') ||
      msg.toLowerCase().includes('overloaded')
    ) {
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
      // Scan git for commits and PRs
      const gitInfo = scanGitInfo(workingDir, task.id, queries);
      if (gitInfo.commits.length > 0) {
        const commitCount = gitInfo.commits.length;
        const prInfo = gitInfo.prUrl ? ` | PR: ${gitInfo.prUrl}` : '';
        taskAddLog(task.id, `Git: ${commitCount} commit(s) found${prInfo}`, 'system');
        slog.git(`Task #${task.id}: ${commitCount} commit(s)${prInfo}`);
      }

      // Auto-create PR if enabled
      const updatedTask = queries.getTaskById.get(task.id);
      if (project.auto_pr && updatedTask.branch_name) {
        slog.git(`Task #${task.id}: Creating PR for ${updatedTask.branch_name}`);
        createPullRequest(updatedTask, workingDir, project, queries, io);
      }

      // Calculate duration
      const taskData = queries.getTaskById.get(task.id);
      let durationStr = '';
      if (taskData?.started_at) {
        const dur = Math.round((Date.now() - new Date(taskData.started_at).getTime()) / 1000);
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        durationStr = m > 0 ? ` in ${m}m ${s}s` : ` in ${s}s`;
      }
      const tokens = (taskData?.input_tokens || 0) + (taskData?.output_tokens || 0);
      const cost = taskData?.total_cost || 0;
      slog.task(
        `${CLR.green}✓${CLR.reset} #${task.id} "${task.title}" completed${durationStr} | ${tokens.toLocaleString()} tokens | $${cost.toFixed(4)}`,
      );

      taskAddLog(task.id, 'Claude finished successfully.', 'success');
      queries.updateTaskStatus.run('testing', task.id);
      queries.setTaskCompleted.run(task.id);
      const updated = queries.getTaskById.get(task.id);
      io.emit('task:updated', updated);
      if (activityLog) activityLog.add(task.project_id, task.id, 'task_completed', `Task completed: ${task.title}`);
    } else {
      slog.task(`${CLR.red}✗${CLR.reset} #${task.id} "${task.title}" failed (exit code: ${code})`);
      taskAddLog(task.id, `Claude exited with code ${code}.`, 'error');
      if (activityLog)
        activityLog.add(task.project_id, task.id, 'task_failed', `Task failed (exit ${code}): ${task.title}`);
    }

    // Cleanup attachments dir
    if (attachments.length > 0 && existsSync(attachDir)) {
      try {
        rmSync(attachDir, { recursive: true, force: true });
      } catch {}
    }

    io.emit('claude:finished', { taskId: task.id, exitCode: code });
    if (onFinished) onFinished(task, code);
  });

  proc.on('error', (err) => {
    activeProcesses.delete(task.id);
    startingTasks.delete(task.id);
    taskUsage.delete(task.id);
    slog.claude(`${CLR.red}ERROR${CLR.reset} Task #${task.id}: Failed to start — ${err.message}`);
    taskAddLog(task.id, `Failed to start Claude: ${err.message}`, 'error');
    io.emit('claude:finished', { taskId: task.id, exitCode: -1 });
    if (activityLog) activityLog.add(task.project_id, task.id, 'task_failed', `Failed to start: ${err.message}`);
  });
}
