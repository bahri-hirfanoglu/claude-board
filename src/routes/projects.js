import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function projectRoutes({ projectQueries, queries, io, activityLog, stopClaude, isTaskRunning }) {
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(projectQueries.getAll());
  }));

  router.get('/summary', asyncHandler(async (req, res) => {
    res.json(projectQueries.getSummary());
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const project = projectQueries.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { name, slug, working_dir, icon, icon_seed, permission_mode, allowed_tools } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!slug?.trim()) return res.status(400).json({ error: 'Slug is required' });
    if (!working_dir?.trim()) return res.status(400).json({ error: 'Working directory is required' });
    if (projectQueries.getBySlug(slug.trim())) return res.status(400).json({ error: 'Slug already exists' });

    const result = projectQueries.create(name.trim(), slug.trim(), working_dir.trim(), icon, icon_seed, permission_mode, allowed_tools);
    const project = projectQueries.getById(result.lastInsertRowid);
    io.emit('project:created', project);
    activityLog.add(project.id, null, 'project_created', `Project created: ${project.name}`);
    res.status(201).json(project);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const project = projectQueries.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, slug, working_dir, icon, icon_seed, permission_mode, allowed_tools, auto_queue, max_concurrent } = req.body;
    projectQueries.update(
      project.id, name ?? project.name, slug ?? project.slug, working_dir ?? project.working_dir,
      icon ?? project.icon, icon_seed ?? project.icon_seed,
      permission_mode ?? project.permission_mode, allowed_tools ?? project.allowed_tools
    );
    if (auto_queue !== undefined || max_concurrent !== undefined) {
      projectQueries.updateQueue(project.id, auto_queue ?? project.auto_queue, max_concurrent ?? project.max_concurrent);
    }
    const updated = projectQueries.getById(project.id);
    io.emit('project:updated', updated);
    res.json(updated);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const project = projectQueries.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = queries.getTasksByProject.all(project.id);
    tasks.forEach(t => { if (isTaskRunning(t.id)) stopClaude(t.id, io, queries); });
    projectQueries.delete(project.id);
    io.emit('project:deleted', { id: project.id });
    res.json({ ok: true });
  }));

  return router;
}
