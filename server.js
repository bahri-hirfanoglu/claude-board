import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { queries, projectQueries } from './db.js';
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

app.get('/api/projects/:id', (req, res) => {
  const project = projectQueries.getById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const { name, slug, working_dir, gitlab_token, gitlab_url, gitlab_project_ids } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!slug?.trim()) return res.status(400).json({ error: 'Slug is required' });
  if (!working_dir?.trim()) return res.status(400).json({ error: 'Working directory is required' });

  const existing = projectQueries.getBySlug(slug.trim());
  if (existing) return res.status(400).json({ error: 'Slug already exists' });

  const result = projectQueries.create(
    name.trim(), slug.trim(), working_dir.trim(),
    gitlab_token || '', gitlab_url || 'https://gitlab.com',
    JSON.stringify(gitlab_project_ids || [])
  );
  const project = projectQueries.getById(result.lastInsertRowid);
  io.emit('project:created', project);
  res.status(201).json(project);
});

app.put('/api/projects/:id', (req, res) => {
  const project = projectQueries.getById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, slug, working_dir, gitlab_token, gitlab_url, gitlab_project_ids } = req.body;
  projectQueries.update(
    project.id,
    name ?? project.name,
    slug ?? project.slug,
    working_dir ?? project.working_dir,
    gitlab_token ?? project.gitlab_token,
    gitlab_url ?? project.gitlab_url,
    gitlab_project_ids ? JSON.stringify(gitlab_project_ids) : project.gitlab_project_ids
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

// GET tasks by project
app.get('/api/projects/:projectId/tasks', (req, res) => {
  const tasks = queries.getTasksByProject.all(req.params.projectId);
  const enriched = tasks.map(t => ({ ...t, is_running: isTaskRunning(t.id) }));
  res.json(enriched);
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ ...task, is_running: isTaskRunning(task.id) });
});

// POST create task for project
app.post('/api/projects/:projectId/tasks', (req, res) => {
  const project = projectQueries.getById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { title, description = '', priority = 0 } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

  const result = queries.createTask.run(project.id, title.trim(), description.trim(), priority);
  const task = queries.getTaskById.get(result.lastInsertRowid);
  io.emit('task:created', task);
  res.status(201).json(task);
});

// PUT update task
app.put('/api/tasks/:id', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, description, priority } = req.body;
  queries.updateTask.run(
    title ?? task.title,
    description ?? task.description,
    priority ?? task.priority,
    task.id
  );
  const updated = queries.getTaskById.get(task.id);
  io.emit('task:updated', updated);
  res.json(updated);
});

// PATCH update task status
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

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  const task = queries.getTaskById.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (isTaskRunning(task.id)) stopClaude(task.id, io);
  queries.deleteTask.run(task.id);
  io.emit('task:deleted', { id: task.id });
  res.json({ ok: true });
});

// GET task logs
app.get('/api/tasks/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  const logs = queries.getRecentTaskLogs.all(req.params.id, limit).reverse();
  res.json(logs);
});

// POST stop claude for task
app.post('/api/tasks/:id/stop', (req, res) => {
  stopClaude(parseInt(req.params.id), io);
  res.json({ ok: true });
});

// POST restart claude for task
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

// GET GitLab MRs for a project
app.get('/api/projects/:projectId/merge-requests', async (req, res) => {
  const project = projectQueries.getById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const token = project.gitlab_token;
  const gitlabUrl = project.gitlab_url || 'https://gitlab.com';

  if (!token) {
    return res.json([]);
  }

  try {
    let projectIds = [];
    try { projectIds = JSON.parse(project.gitlab_project_ids); } catch { projectIds = []; }

    const allMRs = [];
    for (const pid of projectIds) {
      const encodedId = encodeURIComponent(pid);
      const response = await fetch(
        `${gitlabUrl}/api/v4/projects/${encodedId}/merge_requests?state=opened&per_page=20`,
        { headers: { 'PRIVATE-TOKEN': token } }
      );
      if (response.ok) {
        const mrs = await response.json();
        allMRs.push(...mrs.map(mr => ({
          id: mr.iid,
          title: mr.title,
          source_branch: mr.source_branch,
          target_branch: mr.target_branch,
          web_url: mr.web_url,
          state: mr.state,
          author: mr.author?.name || 'Unknown',
          created_at: mr.created_at,
          project: pid.split('/').pop(),
        })));
      }
    }
    res.json(allMRs);
  } catch (err) {
    console.error('GitLab API error:', err.message);
    res.json([]);
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
  console.log(`\n  Task Manager running at http://localhost:${PORT}\n`);
});
