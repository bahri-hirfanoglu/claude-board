/* global fetch, AbortSignal */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function webhookRoutes({ webhookQueries }) {
  const router = Router();

  // List webhooks for a project
  router.get(
    '/projects/:projectId/webhooks',
    asyncHandler(async (req, res) => {
      const webhooks = webhookQueries.getByProject(req.params.projectId);
      res.json(webhooks);
    }),
  );

  // Create webhook
  router.post(
    '/projects/:projectId/webhooks',
    asyncHandler(async (req, res) => {
      const { name, url, platform, events } = req.body;
      if (!name?.trim() || !url?.trim()) {
        return res.status(400).json({ error: 'Name and URL are required' });
      }
      const result = webhookQueries.create(req.params.projectId, name.trim(), url.trim(), platform, events);
      const webhook = webhookQueries.getById(result.lastInsertRowid);
      res.status(201).json(webhook);
    }),
  );

  // Update webhook
  router.put(
    '/webhooks/:id',
    asyncHandler(async (req, res) => {
      const webhook = webhookQueries.getById(req.params.id);
      if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
      const { name, url, platform, events, enabled } = req.body;
      webhookQueries.update(
        webhook.id,
        name ?? webhook.name,
        url ?? webhook.url,
        platform ?? webhook.platform,
        events ?? webhook.events,
        enabled !== undefined ? enabled : webhook.enabled,
      );
      const updated = webhookQueries.getById(webhook.id);
      res.json(updated);
    }),
  );

  // Delete webhook
  router.delete(
    '/webhooks/:id',
    asyncHandler(async (req, res) => {
      const webhook = webhookQueries.getById(req.params.id);
      if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
      webhookQueries.delete(webhook.id);
      res.json({ ok: true });
    }),
  );

  // Test webhook
  router.post(
    '/webhooks/:id/test',
    asyncHandler(async (req, res) => {
      const webhook = webhookQueries.getById(req.params.id);
      if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

      const { dispatch } = req.app.get('webhookDispatcher') || {};
      if (!dispatch) return res.status(500).json({ error: 'Webhook dispatcher not configured' });

      // Send test notification directly to this webhook
      try {
        const _payload = {
          event: 'test',
          message: 'This is a test notification from Claude Board',
          timestamp: new Date().toISOString(),
          project: 'Test Project',
        };

        // Platform-specific test payloads
        let body;
        if (webhook.platform === 'slack') {
          body = {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':white_check_mark: *Test Notification*\nClaude Board webhook is working!',
                },
              },
            ],
          };
        } else if (webhook.platform === 'discord') {
          body = {
            embeds: [
              {
                title: 'Test Notification',
                description: 'Claude Board webhook is working!',
                color: 0x22c55e,
                timestamp: new Date().toISOString(),
                footer: { text: 'Claude Board' },
              },
            ],
          };
        } else if (webhook.platform === 'teams') {
          body = {
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            themeColor: '22c55e',
            summary: 'Test Notification',
            sections: [{ activityTitle: 'Test Notification', text: 'Claude Board webhook is working!' }],
          };
        } else {
          body = _payload;
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          res.json({ ok: true, status: response.status });
        } else {
          const text = await response.text().catch(() => '');
          res.json({ ok: false, status: response.status, error: text.slice(0, 200) });
        }
      } catch (err) {
        res.json({ ok: false, error: err.message });
      }
    }),
  );

  return router;
}
