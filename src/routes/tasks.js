import { Router } from 'express';
import { join } from 'path';

export default function taskRoutes({ queries, projectQueries, statsQueries, io, activityLog, startClaude, stopClaude, isTaskRunning, startNextQueued, rootDir }) {
  const router = Router();

  // Get tasks by project
  router.get('/projects/:projectId/tasks', (req, res) => {
    const tasks = queries.getTasksByProject.all(req.params.projectId);
    res.json(tasks.map(t => ({ ...t, is_running: isTaskRunning(t.id) })));
  });

  // Get single task
  router.get('/tasks/:id', (req, res) => {
    const task = queries.getTaskById.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ ...task, is_running: isTaskRunning(task.id) });
  });

  // Create task
  router.post('/projects/:projectId/tasks', (req, res) => {
    const project = projectQueries.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { title, description = '', priority = 0, task_type = 'feature', acceptance_criteria = '', model = 'sonnet', thinking_effort = 'medium' } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const result = queries.createTask.run(project.id, title.trim(), description.trim(), priority, task_type, acceptance_criteria.trim(), model, thinking_effort);
    const task = queries.getTaskById.get(result.lastInsertRowid);
    io.emit('task:created', task);
    activityLog.add(project.id, task.id, 'task_created', `Task created: ${title.trim()}`);
    res.status(201).json(task);
  });

  // Update task
  router.put('/tasks/:id', (req, res) => {
    const task = queries.getTaskById.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { title, description, priority, task_type, acceptance_criteria, model, thinking_effort } = req.body;
    queries.updateTask.run(
      title ?? task.title, description ?? task.description, priority ?? task.priority,
      task_type ?? task.task_type, acceptance_criteria ?? task.acceptance_criteria,
      model ?? task.model, thinking_effort ?? task.thinking_effort, task.id
    );
    const updated = queries.getTaskById.get(task.id);
    io.emit('task:updated', updated);
    res.json(updated);
  });

  // Change status
  router.patch('/tasks/:id/status', (req, res) => {
    const task = queries.getTaskById.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { status } = req.body;
    const validStatuses = ['backlog', 'in_progress', 'testing', 'done'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const prevStatus = task.status;
    queries.updateTaskStatus.run(status, task.id);

    if (status === 'in_progress' && !task.started_at) queries.setTaskStarted.run(task.id);
    if (status === 'done' && !task.completed_at) {
      queries.setTaskCompleted.run(task.id);
      activityLog.add(task.project_id, task.id, 'task_approved', `Task approved: ${task.title}`);
    }

    const updated = queries.getTaskById.get(task.id);

    if (status === 'in_progress' && prevStatus !== 'in_progress') {
      const project = projectQueries.getById(task.project_id);
      const workingDir = project?.working_dir || rootDir;
      const revisions = queries.getRevisions.all(task.id);
      startClaude(updated, io, workingDir, project, revisions, { queries, statsQueries, activityLog, onFinished: (t, code) => startNextQueued(t.project_id) });
      activityLog.add(task.project_id, task.id, 'task_started', `Task started: ${task.title}`);
    }

    if (prevStatus === 'in_progress' && status !== 'in_progress') {
      stopClaude(task.id, io, queries);
    }

    // Auto-queue: if task moved to done/testing, try start next
    if ((status === 'done' || status === 'testing') && prevStatus === 'in_progress') {
      startNextQueued(task.project_id);
    }

    io.emit('task:updated', { ...updated, is_running: isTaskRunning(updated.id) });
    res.json(updated);
  });

  // Delete task
  router.delete('/tasks/:id', (req, res) => {
    const task = queries.getTaskById.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (isTaskRunning(task.id)) stopClaude(task.id, io, queries);
    queries.deleteTask.run(task.id);
    io.emit('task:deleted', { id: task.id });
    res.json({ ok: true });
  });

  // Get logs
  router.get('/tasks/:id/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 500;
    res.json(queries.getRecentTaskLogs.all(req.params.id, limit).reverse());
  });

  // Stop task
  router.post('/tasks/:id/stop', (req, res) => {
    stopClaude(parseInt(req.params.id), io, queries);
    res.json({ ok: true });
  });

  // Restart task
  router.post('/tasks/:id/restart', (req, res) => {
    const task = queries.getTaskById.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    stopClaude(task.id, io, queries);
    queries.clearTaskLogs.run(task.id);
    queries.updateTaskStatus.run('in_progress', task.id);
    const updated = queries.getTaskById.get(task.id);
    const project = projectQueries.getById(task.project_id);
    const workingDir = project?.working_dir || rootDir;
    const revisions = queries.getRevisions.all(task.id);
    startClaude(updated, io, workingDir, project, revisions, { queries, statsQueries, activityLog, onFinished: (t, code) => startNextQueued(t.project_id) });
    io.emit('task:updated', { ...updated, is_running: true });
    res.json(updated);
  });

  // Request changes (revision)
  router.post('/tasks/:id/request-changes', (req, res) => {
    const task = queries.getTaskById.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { feedback } = req.body;
    if (!feedback?.trim()) return res.status(400).json({ error: 'Feedback is required' });

    queries.incrementRevisionCount.run(task.id);
    const updatedTask = queries.getTaskById.get(task.id);
    const revisionNumber = updatedTask.revision_count || 1;
    queries.addRevision.run(task.id, revisionNumber, feedback.trim());
    queries.updateTaskStatus.run('in_progress', task.id);
    const updated = queries.getTaskById.get(task.id);

    const project = projectQueries.getById(task.project_id);
    const workingDir = project?.working_dir || rootDir;
    const revisions = queries.getRevisions.all(task.id);
    startClaude(updated, io, workingDir, project, revisions, { queries, statsQueries, activityLog, onFinished: (t, code) => startNextQueued(t.project_id) });

    activityLog.add(task.project_id, task.id, 'revision_requested', `Revision #${revisionNumber} requested: ${task.title}`, { feedback: feedback.trim() });
    io.emit('task:updated', { ...updated, is_running: isTaskRunning(updated.id) });
    res.json(updated);
  });

  // Get revisions
  router.get('/tasks/:id/revisions', (req, res) => {
    res.json(queries.getRevisions.all(req.params.id));
  });

  return router;
}
