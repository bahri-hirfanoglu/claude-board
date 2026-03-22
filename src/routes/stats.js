import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { asyncHandler } from '../middleware/errorHandler.js';

function normalizeModelName(raw) {
  if (!raw || !raw.trim()) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';
  return raw;
}

function mergeModelRows(rows, modelKey, fieldsToSum) {
  const map = {};
  for (const row of rows) {
    const name = normalizeModelName(row[modelKey]);
    if (!map[name]) {
      map[name] = { ...row, [modelKey]: name };
    } else {
      for (const f of fieldsToSum) {
        map[name][f] = (map[name][f] || 0) + (row[f] || 0);
      }
    }
  }
  return Object.values(map);
}

export default function statsRoutes({ projectQueries, statsQueries, activityLog }) {
  const router = Router();

  router.get(
    '/projects/:projectId/stats',
    asyncHandler(async (req, res) => {
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
        modelBreakdown: mergeModelRows(statsQueries.getModelBreakdown(pid), 'model_name', [
          'count',
          'total_tokens',
          'total_cost',
        ]),
      });
    }),
  );

  router.get(
    '/stats/claude-usage',
    asyncHandler(async (req, res) => {
      res.json({
        usage: statsQueries.getGlobalUsage(),
        models: mergeModelRows(statsQueries.getGlobalModelBreakdown(), 'model', [
          'tasks',
          'input_tokens',
          'output_tokens',
          'cost',
        ]),
        timeline: statsQueries.getUsageTimeline(),
        limits: statsQueries.getClaudeLimits(),
      });
    }),
  );

  router.get(
    '/projects/:projectId/activity',
    asyncHandler(async (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      res.json(activityLog.getByProject(req.params.projectId, limit, offset));
    }),
  );

  router.get(
    '/projects/:projectId/claude-md',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const filePath = join(project.working_dir, 'CLAUDE.md');
      if (existsSync(filePath)) {
        res.json({ exists: true, content: readFileSync(filePath, 'utf-8') });
      } else {
        res.json({ exists: false, content: '' });
      }
    }),
  );

  router.put(
    '/projects/:projectId/claude-md',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const { content } = req.body;
      if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required' });
      writeFileSync(join(project.working_dir, 'CLAUDE.md'), content, 'utf-8');
      res.json({ ok: true });
    }),
  );

  return router;
}
