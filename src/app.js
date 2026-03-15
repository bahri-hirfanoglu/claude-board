import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform, hostname, totalmem, freemem, cpus } from 'os';

import {
  queries,
  projectQueries,
  statsQueries,
  activityLog,
  snippetQueries,
  templateQueries,
  attachmentQueries,
} from './db/index.js';
import { startClaude, stopClaude, isTaskRunning } from './claude/runner.js';
import { authMiddleware, socketAuthMiddleware, generateApiKey, disableAuth, isAuthEnabled } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import statsRoutes from './routes/stats.js';
import snippetRoutes from './routes/snippets.js';
import templateRoutes from './routes/templates.js';
import attachmentRoutes from './routes/attachments.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ─── Logger ───
const LOG_COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};
const c = LOG_COLORS;
function ts() {
  return `${c.gray}${new Date().toLocaleTimeString('tr-TR', { hour12: false })}${c.reset}`;
}
function log(tag, color, msg) {
  console.log(`${ts()} ${color}[${tag}]${c.reset} ${msg}`);
}
const logger = {
  server: (msg) => log('SERVER', c.green, msg),
  socket: (msg) => log('SOCKET', c.cyan, msg),
  task: (msg) => log('TASK', c.yellow, msg),
  claude: (msg) => log('CLAUDE', c.magenta, msg),
  queue: (msg) => log('QUEUE', c.blue, msg),
  auth: (msg) => log('AUTH', c.red, msg),
  api: (msg) => log('API', c.white, msg),
  git: (msg) => log('GIT', c.blue, msg),
};

export function createApp() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
  });

  // Startup info
  const totalMem = (totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeMem = (freemem() / 1024 / 1024 / 1024).toFixed(1);
  const cpuModel = cpus()[0]?.model?.trim() || 'Unknown';
  const cpuCount = cpus().length;
  logger.server(`Platform: ${platform()} | Host: ${hostname()}`);
  logger.server(`CPU: ${cpuModel} (${cpuCount} cores) | RAM: ${freeMem}GB free / ${totalMem}GB total`);
  logger.server(`Node: ${process.version} | PID: ${process.pid}`);

  // DB summary
  const projectCount = projectQueries.getAll().length;
  logger.server(`Database loaded — ${projectCount} project(s)`);
  if (isAuthEnabled()) {
    logger.auth('API authentication is ENABLED');
  } else {
    logger.auth(`Authentication is disabled — open access`);
  }

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    next(err);
  });
  app.use(express.static(join(rootDir, 'client', 'dist')));

  // Request logger for mutations
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.url.startsWith('/api')) {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 400 ? c.red : c.green;
        logger.api(`${req.method} ${req.url} ${color}${status}${c.reset} ${c.gray}${duration}ms${c.reset}`);
      });
    }
    next();
  });

  // Socket.IO auth
  io.use(socketAuthMiddleware);

  // Race condition lock for task starts
  const taskStartLock = new Set();

  // Auto-queue
  function startNextQueued(projectId) {
    try {
      const project = projectQueries.getById(projectId);
      if (!project || !project.auto_queue) return;
      const running = queries.getRunningCount(projectId);
      const maxConc = project.max_concurrent || 1;
      if (running >= maxConc) {
        logger.queue(`${project.name}: ${running}/${maxConc} slots full, waiting`);
        return;
      }
      const next = queries.getNextQueuedTask(projectId);
      if (!next || taskStartLock.has(next.id)) return;

      logger.queue(`${project.name}: Auto-starting "${next.title}" (${running + 1}/${maxConc} slots)`);
      taskStartLock.add(next.id);
      queries.updateTaskStatus.run('in_progress', next.id);
      if (!next.started_at) queries.setTaskStarted.run(next.id);
      const updated = queries.getTaskById.get(next.id);
      const workingDir = project.working_dir || rootDir;
      const revisions = queries.getRevisions.all(next.id);
      const snippets = snippetQueries.getEnabledByProject(project.id);
      const taskAttachments = attachmentQueries.getByTask(next.id) || [];
      startClaude(updated, io, workingDir, project, revisions, snippets, {
        queries,
        statsQueries,
        activityLog,
        attachments: taskAttachments,
        onFinished: (t) => {
          taskStartLock.delete(t.id);
          startNextQueued(t.project_id);
        },
      });
      activityLog.add(projectId, next.id, 'queue_auto_started', `Auto-started: ${next.title}`);
      io.emit('task:updated', { ...updated, is_running: true });
    } catch (e) {
      logger.queue(`Error: ${e.message}`);
    }
  }

  const deps = {
    queries,
    projectQueries,
    statsQueries,
    activityLog,
    snippetQueries,
    templateQueries,
    attachmentQueries,
    io,
    startClaude,
    stopClaude,
    isTaskRunning,
    startNextQueued,
    rootDir,
  };

  // Auth management routes (no auth required)
  app.get('/api/auth/status', (req, res) => {
    res.json({ enabled: isAuthEnabled() });
  });
  app.post('/api/auth/enable', (req, res) => {
    const key = generateApiKey();
    res.json({ enabled: true, api_key: key, message: 'Save this key — it cannot be retrieved later.' });
  });
  app.post('/api/auth/disable', (req, res) => {
    disableAuth();
    res.json({ enabled: false });
  });

  // Apply auth to all /api routes except auth management
  app.use('/api/projects', authMiddleware, projectRoutes(deps));
  app.use('/api', authMiddleware, taskRoutes(deps));
  app.use('/api', authMiddleware, statsRoutes(deps));
  app.use('/api', authMiddleware, snippetRoutes(deps));
  app.use('/api', authMiddleware, templateRoutes(deps));
  app.use('/api', authMiddleware, attachmentRoutes(deps));

  // Serve uploaded files
  app.use('/uploads', express.static(join(rootDir, 'uploads')));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(join(rootDir, 'client', 'dist', 'index.html'));
  });

  // Global error handler
  app.use(errorHandler);

  // Socket.IO
  let connectedClients = 0;
  io.on('connection', (socket) => {
    connectedClients++;
    logger.socket(`Client connected ${c.gray}(${socket.id.slice(0, 8)})${c.reset} — ${connectedClients} active`);
    socket.on('task:subscribe', (taskId) => {
      socket.join(`task:${taskId}`);
    });
    socket.on('task:unsubscribe', (taskId) => socket.leave(`task:${taskId}`));
    socket.on('disconnect', (reason) => {
      connectedClients--;
      logger.socket(`Client disconnected ${c.gray}(${reason})${c.reset} — ${connectedClients} active`);
    });
  });

  return { app, server, io };
}
