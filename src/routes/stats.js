import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export default function statsRoutes({ projectQueries, statsQueries, activityLog }) {
  const router = Router();

  // Project stats
  router.get('/projects/:projectId/stats', (req, res) => {
    const project = projectQueries.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const pid = req.params.projectId;
    res.json({
      byStatus: statsQueries.getTasksByStatus(pid),
      byPriority: statsQueries.getTasksByPriority(pid),
      byType: statsQueries.getTasksByType(pid),
      duration: statsQueries.getAvgDuration(pid),
      timeline: statsQueries.getCompletionTimeline(pid),
      recentCompleted: statsQueries.getRecentCompleted(pid),
      claudeUsage: statsQueries.getClaudeUsage(pid),
      modelBreakdown: statsQueries.getModelBreakdown(pid),
    });
  });

  // Activity timeline
  router.get('/projects/:projectId/activity', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    res.json(activityLog.getByProject(req.params.projectId, limit, offset));
  });

  // CLAUDE.md
  router.get('/projects/:projectId/claude-md', (req, res) => {
    const project = projectQueries.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const filePath = join(project.working_dir, 'CLAUDE.md');
    try {
      if (existsSync(filePath)) {
        res.json({ exists: true, content: readFileSync(filePath, 'utf-8') });
      } else {
        res.json({ exists: false, content: '' });
      }
    } catch (err) {
      res.status(500).json({ error: `Failed to read CLAUDE.md: ${err.message}` });
    }
  });

  router.put('/projects/:projectId/claude-md', (req, res) => {
    const project = projectQueries.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required' });
    try {
      writeFileSync(join(project.working_dir, 'CLAUDE.md'), content, 'utf-8');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Failed to write CLAUDE.md: ${err.message}` });
    }
  });

  return router;
}
