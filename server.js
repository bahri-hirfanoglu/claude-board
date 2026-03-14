import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { queries, projectQueries, statsQueries } from './db.js';
import { startClaude, stopClaude, isTaskRunning, getActiveProcess } from './claude-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve client build in production
app.use(express.static(join(__dirname, 'client', 'dist')));

// ============ Projects API ============

app.get('/api/projects', (req, res) => {
  const projects = projectQueries.getAll();
  res.json(projects);
});

app.get('/api/projects/summary', (req, res) => {
  const summary = projectQueries.getSummary();
  res.json(summary);
});

app.get('/api/projects/:id', (req, res) => {
  const project = projectQueries.getById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const { name, slug, working_dir, icon, icon_seed } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!slug?.trim()) return res.status(400).json({ error: 'Slug is required' });
  if (!working_dir?.trim()) return res.status(400).json({ error: 'Working directory is required' });

  const existing = projectQueries.getBySlug(slug.trim());
  if (existing) return res.status(400).json({ error: 'Slug already exists' });

  const result = projectQueries.create(name.trim(), slug.trim(), working_dir.trim(), icon, icon_seed);
  const project = projectQueries.getById(result.lastInsertRowid);
  io.emit('project:created', project);
  res.status(201).json(project);
});

app.put('/api/projects/:id', (req, res) => {
  const project = projectQueries.getById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, slug, working_dir, icon, icon_seed } = req.body;
  projectQueries.update(
    project.id,
    name ?? project.name,
    slug ?? project.slug,
    working_dir ?? project.working_dir,
    icon ?? project.icon,
    icon_seed ?? project.icon_seed
  );
  const updated = projectQueries.getById(project.id);
  io.emit('project:updated', updated);
  res.json(updated);
});

app.delete('/api/projects/:id', (req, res) => {
  const project = projectQueries.getById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Stop all running tasks for this project
  const tasks = queries.getTasksByProject.all(project.id);
  tasks.forEach(t => { if (isTaskRunning(t.id)) stopClaude(t.id, io); });

  projectQueries.delete(project.id);
  io.emit('project:deleted', { id: project.id });
  res.json({ ok: true });
});

// ============ Tasks API ============

app.get('/api/projects/:projectId/tasks', (req, res) => {
  const tasks = queries.getTasksByProject.all(req.params.projectId);
  const enriched = tasks.map(t => ({ ...t, is_running: isTaskRunning(t.id) }));
  res.json(enriched);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ ...task, is_running: isTaskRunning(task.id) });
});

app.post('/api/projects/:projectId/tasks', (req, res) => {
  const project = projectQueries.getById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { title, description = '', priority = 0, task_type = 'feature', acceptance_criteria = '', model = 'sonnet', thinking_effort = 'medium' } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

  const result = queries.createTask.run(
    project.id, title.trim(), description.trim(), priority, task_type, acceptance_criteria.trim(), model, thinking_effort
  );
  const task = queries.getTaskById.get(result.lastInsertRowid);
  io.emit('task:created', task);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, description, priority, task_type, acceptance_criteria, model, thinking_effort } = req.body;
  queries.updateTask.run(
    title ?? task.title,
    description ?? task.description,
    priority ?? task.priority,
    task_type ?? task.task_type,
    acceptance_criteria ?? task.acceptance_criteria,
    model ?? task.model,
    thinking_effort ?? task.thinking_effort,
    task.id
  );
  const updated = queries.getTaskById.get(task.id);
  io.emit('task:updated', updated);
  res.json(updated);
});

app.patch('/api/tasks/:id/status', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { status } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'testing', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const prevStatus = task.status;
  queries.updateTaskStatus.run(status, task.id);

  // Track time: set started_at when first moved to in_progress
  if (status === 'in_progress' && !task.started_at) {
    queries.setTaskStarted.run(task.id);
  }

  // Track time: set completed_at when moved to done
  if (status === 'done' && !task.completed_at) {
    queries.setTaskCompleted.run(task.id);
  }

  // Clear completed_at if moved back from done
  if (prevStatus === 'done' && status !== 'done') {
    queries.setTaskCompleted.run(task.id); // will re-stamp, acceptable
  }

  const updated = queries.getTaskById.get(task.id);

  // Auto-start Claude when moved to in_progress
  if (status === 'in_progress' && prevStatus !== 'in_progress') {
    const project = projectQueries.getById(task.project_id);
    const workingDir = project?.working_dir || join(__dirname, '..');
    startClaude(updated, io, workingDir);
  }

  // Stop Claude if moved away from in_progress
  if (prevStatus === 'in_progress' && status !== 'in_progress') {
    stopClaude(task.id, io);
  }

  io.emit('task:updated', { ...updated, is_running: isTaskRunning(updated.id) });
  res.json(updated);
});

app.delete('/api/tasks/:id', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (isTaskRunning(task.id)) stopClaude(task.id, io);
  queries.deleteTask.run(task.id);
  io.emit('task:deleted', { id: task.id });
  res.json({ ok: true });
});

app.get('/api/tasks/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  const logs = queries.getRecentTaskLogs.all(req.params.id, limit).reverse();
  res.json(logs);
});

app.post('/api/tasks/:id/stop', (req, res) => {
  stopClaude(parseInt(req.params.id), io);
  res.json({ ok: true });
});

app.post('/api/tasks/:id/restart', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  stopClaude(task.id, io);
  queries.clearTaskLogs.run(task.id);
  queries.updateTaskStatus.run('in_progress', task.id);
  const updated = queries.getTaskById.get(task.id);
  const project = projectQueries.getById(task.project_id);
  const workingDir = project?.working_dir || join(__dirname, '..');
  startClaude(updated, io, workingDir);
  io.emit('task:updated', { ...updated, is_running: true });
  res.json(updated);
});

// ============ Stats API ============

app.get('/api/projects/:projectId/stats', (req, res) => {
  const projectId = req.params.projectId;
  const project = projectQueries.getById(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const byStatus = statsQueries.getTasksByStatus(projectId);
  const byPriority = statsQueries.getTasksByPriority(projectId);
  const byType = statsQueries.getTasksByType(projectId);
  const duration = statsQueries.getAvgDuration(projectId);
  const timeline = statsQueries.getCompletionTimeline(projectId);
  const recentCompleted = statsQueries.getRecentCompleted(projectId);
  const claudeUsage = statsQueries.getClaudeUsage(projectId);
  const modelBreakdown = statsQueries.getModelBreakdown(projectId);

  res.json({
    byStatus,
    byPriority,
    byType,
    duration,
    timeline,
    recentCompleted,
    claudeUsage,
    modelBreakdown,
  });
});

// ============ CLAUDE.md API ============

app.get('/api/projects/:projectId/claude-md', (req, res) => {
  const project = projectQueries.getById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const filePath = join(project.working_dir, 'CLAUDE.md');
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      res.json({ exists: true, content });
    } else {
      res.json({ exists: false, content: '' });
    }
  } catch (err) {
    res.status(500).json({ error: `Failed to read CLAUDE.md: ${err.message}` });
  }
});

app.put('/api/projects/:projectId/claude-md', (req, res) => {
  const project = projectQueries.getById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required' });

  const filePath = join(project.working_dir, 'CLAUDE.md');
  try {
    writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `Failed to write CLAUDE.md: ${err.message}` });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'client', 'dist', 'index.html'));
});

// ============ Socket.IO ============
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('task:subscribe', (taskId) => {
    socket.join(`task:${taskId}`);
  });

  socket.on('task:unsubscribe', (taskId) => {
    socket.leave(`task:${taskId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Claude Board running at http://localhost:${PORT}\n`);
});
