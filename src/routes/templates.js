import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function templateRoutes({ templateQueries, projectQueries, io }) {
  const router = Router();

  router.get(
    '/projects/:projectId/templates',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(templateQueries.getByProject(project.id));
    }),
  );

  router.post(
    '/projects/:projectId/templates',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const { name, description, template, variables, task_type, model, thinking_effort } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
      if (!template?.trim()) return res.status(400).json({ error: 'Template is required' });
      const result = templateQueries.create(
        project.id,
        name.trim(),
        description?.trim() || '',
        template.trim(),
        variables || '[]',
        task_type || 'feature',
        model || 'sonnet',
        thinking_effort || 'medium',
      );
      const created = templateQueries.getById(result.lastInsertRowid);
      io.emit('template:created', created);
      res.status(201).json(created);
    }),
  );

  router.put(
    '/templates/:id',
    asyncHandler(async (req, res) => {
      const tpl = templateQueries.getById(req.params.id);
      if (!tpl) return res.status(404).json({ error: 'Template not found' });
      const { name, description, template, variables, task_type, model, thinking_effort } = req.body;
      templateQueries.update(
        tpl.id,
        name ?? tpl.name,
        description !== undefined ? description : tpl.description,
        template ?? tpl.template,
        variables ?? tpl.variables,
        task_type ?? tpl.task_type,
        model ?? tpl.model,
        thinking_effort ?? tpl.thinking_effort,
      );
      const updated = templateQueries.getById(tpl.id);
      io.emit('template:updated', updated);
      res.json(updated);
    }),
  );

  router.delete(
    '/templates/:id',
    asyncHandler(async (req, res) => {
      const tpl = templateQueries.getById(req.params.id);
      if (!tpl) return res.status(404).json({ error: 'Template not found' });
      templateQueries.delete(tpl.id);
      io.emit('template:deleted', { id: tpl.id });
      res.json({ ok: true });
    }),
  );

  return router;
}
