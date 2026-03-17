import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function roleRoutes({ roleQueries, projectQueries, io }) {
  const router = Router();

  // List roles for a project (includes global roles)
  router.get(
    '/projects/:projectId/roles',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(roleQueries.getByProject(project.id));
    }),
  );

  // List global (shared) roles only
  router.get(
    '/roles/global',
    asyncHandler(async (req, res) => {
      res.json(roleQueries.getGlobal());
    }),
  );

  // Create role (project_id can be null for global)
  router.post(
    '/projects/:projectId/roles',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const { name, description = '', prompt = '', color = '#6B7280', global: isGlobal = false } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
      const pid = isGlobal ? null : project.id;
      const result = roleQueries.create(pid, name.trim(), description.trim(), prompt.trim(), color);
      const role = roleQueries.getById(result.lastInsertRowid);
      io.emit('role:created', role);
      res.status(201).json(role);
    }),
  );

  // Update role
  router.put(
    '/roles/:id',
    asyncHandler(async (req, res) => {
      const role = roleQueries.getById(req.params.id);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      const { name, description, prompt, color } = req.body;
      roleQueries.update(
        role.id,
        name ?? role.name,
        description ?? role.description,
        prompt ?? role.prompt,
        color ?? role.color,
      );
      const updated = roleQueries.getById(role.id);
      io.emit('role:updated', updated);
      res.json(updated);
    }),
  );

  // Delete role
  router.delete(
    '/roles/:id',
    asyncHandler(async (req, res) => {
      const role = roleQueries.getById(req.params.id);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      roleQueries.delete(role.id);
      io.emit('role:deleted', { id: role.id });
      res.json({ ok: true });
    }),
  );

  return router;
}
