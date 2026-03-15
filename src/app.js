import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { queries, projectQueries, statsQueries, activityLog, snippetQueries } from './db/index.js';
import { startClaude, stopClaude, isTaskRunning } from './claude/runner.js';
import { authMiddleware, socketAuthMiddleware, generateApiKey, disableAuth, isAuthEnabled } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import statsRoutes from './routes/stats.js';
import snippetRoutes from './routes/snippets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

export function createApp() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
  });

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    next(err);
  });
  app.use(express.static(join(rootDir, 'client', 'dist')));

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
      if (running >= (project.max_concurrent || 1)) return;
      const next = queries.getNextQueuedTask(projectId);
      if (!next || taskStartLock.has(next.id)) return;

      taskStartLock.add(next.id);
      queries.updateTaskStatus.run('in_progress', next.id);
      if (!next.started_at) queries.setTaskStarted.run(next.id);
      const updated = queries.getTaskById.get(next.id);
      const workingDir = project.working_dir || rootDir;
      const revisions = queries.getRevisions.all(next.id);
      const snippets = snippetQueries.getEnabledByProject(project.id);
      startClaude(updated, io, workingDir, project, revisions, snippets, {
        queries,
        statsQueries,
        activityLog,
        onFinished: (t) => {
          taskStartLock.delete(t.id);
          startNextQueued(t.project_id);
        },
      });
      activityLog.add(projectId, next.id, 'queue_auto_started', `Auto-started: ${next.title}`);
      io.emit('task:updated', { ...updated, is_running: true });
    } catch (e) {
      console.error('[Queue]', e.message);
    }
  }

  const deps = {
    queries,
    projectQueries,
    statsQueries,
    activityLog,
    snippetQueries,
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

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(join(rootDir, 'client', 'dist', 'index.html'));
  });

  // Global error handler
  app.use(errorHandler);

  // Socket.IO
  io.on('connection', (socket) => {
    socket.on('task:subscribe', (taskId) => socket.join(`task:${taskId}`));
    socket.on('task:unsubscribe', (taskId) => socket.leave(`task:${taskId}`));
  });

  return { app, server, io };
}
