import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function snippetRoutes({ snippetQueries, projectQueries, io }) {
  const router = Router();

  router.get(
    '/projects/:projectId/snippets',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(snippetQueries.getByProject(project.id));
    }),
  );

  router.post(
    '/projects/:projectId/snippets',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const { title, content } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
      if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
      const result = snippetQueries.create(project.id, title.trim(), content.trim());
      const snippet = snippetQueries.getById(result.lastInsertRowid);
      io.emit('snippet:created', snippet);
      res.status(201).json(snippet);
    }),
  );

  router.put(
    '/snippets/:id',
    asyncHandler(async (req, res) => {
      const snippet = snippetQueries.getById(req.params.id);
      if (!snippet) return res.status(404).json({ error: 'Snippet not found' });
      const { title, content, enabled } = req.body;
      snippetQueries.update(
        snippet.id,
        title ?? snippet.title,
        content ?? snippet.content,
        enabled !== undefined ? enabled : snippet.enabled,
      );
      const updated = snippetQueries.getById(snippet.id);
      io.emit('snippet:updated', updated);
      res.json(updated);
    }),
  );

  router.delete(
    '/snippets/:id',
    asyncHandler(async (req, res) => {
      const snippet = snippetQueries.getById(req.params.id);
      if (!snippet) return res.status(404).json({ error: 'Snippet not found' });
      snippetQueries.delete(snippet.id);
      io.emit('snippet:deleted', { id: snippet.id });
      res.json({ ok: true });
    }),
  );

  return router;
}
