import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { queries, projectQueries, statsQueries, activityLog } from './db/index.js';
import { startClaude, stopClaude, isTaskRunning } from './claude/runner.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import statsRoutes from './routes/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

export function createApp() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
  });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(join(rootDir, 'client', 'dist')));

  // Auto-queue: start next backlog task when a task finishes
  function startNextQueued(projectId) {
    try {
      const project = projectQueries.getById(projectId);
      if (!project || !project.auto_queue) return;

      const running = queries.getRunningCount(projectId);
      const maxConcurrent = project.max_concurrent || 1;
      if (running >= maxConcurrent) return;

      const next = queries.getNextQueuedTask(projectId);
      if (!next) return;

      queries.updateTaskStatus.run('in_progress', next.id);
      if (!next.started_at) queries.setTaskStarted.run(next.id);
      const updated = queries.getTaskById.get(next.id);

      const workingDir = project.working_dir || rootDir;
      const revisions = queries.getRevisions.all(next.id);
      startClaude(updated, io, workingDir, project, revisions, {
        queries, activityLog,
        onFinished: (t, code) => startNextQueued(t.project_id),
      });

      activityLog.add(projectId, next.id, 'queue_auto_started', `Auto-started from queue: ${next.title}`);
      io.emit('task:updated', { ...updated, is_running: true });
    } catch (e) {
      console.error('[Queue]', e.message);
    }
  }

  // Shared deps for routes
  const deps = {
    queries, projectQueries, statsQueries, activityLog, io,
    startClaude, stopClaude, isTaskRunning, startNextQueued, rootDir,
  };

  // Mount routes
  app.use('/api/projects', projectRoutes(deps));
  app.use('/api', taskRoutes(deps));
  app.use('/api', statsRoutes(deps));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(join(rootDir, 'client', 'dist', 'index.html'));
  });

  // Socket.IO
  io.on('connection', (socket) => {
    socket.on('task:subscribe', (taskId) => socket.join(`task:${taskId}`));
    socket.on('task:unsubscribe', (taskId) => socket.leave(`task:${taskId}`));
  });

  return { app, server, io };
}
