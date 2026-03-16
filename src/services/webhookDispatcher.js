/* global fetch, AbortSignal */

const EVENT_LABELS = {
  task_created: 'Task Created',
  task_started: 'Task Started',
  task_approved: 'Task Completed',
  task_failed: 'Task Failed',
  revision_requested: 'Revision Requested',
  queue_auto_started: 'Auto-Queue Started',
};

const EVENT_COLORS = {
  task_created: 0x3b82f6,
  task_started: 0xf59e0b,
  task_approved: 0x22c55e,
  task_failed: 0xef4444,
  revision_requested: 0xf97316,
  queue_auto_started: 0x06b6d4,
};

const EVENT_EMOJI = {
  task_created: ':heavy_plus_sign:',
  task_started: ':arrow_forward:',
  task_approved: ':white_check_mark:',
  task_failed: ':x:',
  revision_requested: ':repeat:',
  queue_auto_started: ':zap:',
};

function buildSlackPayload(eventType, message, metadata) {
  const emoji = EVENT_EMOJI[eventType] || ':bell:';
  const label = EVENT_LABELS[eventType] || eventType;
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${label}*\n${message}`,
      },
    },
  ];

  const fields = [];
  if (metadata.project) fields.push({ type: 'mrkdwn', text: `*Project:* ${metadata.project}` });
  if (metadata.task_type) fields.push({ type: 'mrkdwn', text: `*Type:* ${metadata.task_type}` });
  if (metadata.model) fields.push({ type: 'mrkdwn', text: `*Model:* ${metadata.model}` });
  if (metadata.feedback) fields.push({ type: 'mrkdwn', text: `*Feedback:* ${metadata.feedback}` });

  if (fields.length > 0) {
    blocks.push({ type: 'section', fields });
  }

  return { blocks };
}

function buildDiscordPayload(eventType, message, metadata) {
  const label = EVENT_LABELS[eventType] || eventType;
  const color = EVENT_COLORS[eventType] || 0x918678;
  const fields = [];

  if (metadata.project) fields.push({ name: 'Project', value: metadata.project, inline: true });
  if (metadata.task_type) fields.push({ name: 'Type', value: metadata.task_type, inline: true });
  if (metadata.model) fields.push({ name: 'Model', value: metadata.model, inline: true });
  if (metadata.feedback) fields.push({ name: 'Feedback', value: metadata.feedback, inline: false });

  return {
    embeds: [
      {
        title: label,
        description: message,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'Claude Board' },
      },
    ],
  };
}

function buildTeamsPayload(eventType, message, metadata) {
  const label = EVENT_LABELS[eventType] || eventType;
  const facts = [];
  if (metadata.project) facts.push({ name: 'Project', value: metadata.project });
  if (metadata.task_type) facts.push({ name: 'Type', value: metadata.task_type });
  if (metadata.model) facts.push({ name: 'Model', value: metadata.model });
  if (metadata.feedback) facts.push({ name: 'Feedback', value: metadata.feedback });

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: (EVENT_COLORS[eventType] || 0x918678).toString(16).padStart(6, '0'),
    summary: label,
    sections: [
      {
        activityTitle: label,
        activitySubtitle: 'Claude Board',
        text: message,
        facts,
      },
    ],
  };
}

function buildCustomPayload(eventType, message, metadata) {
  return {
    event: eventType,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
}

function buildPayload(platform, eventType, message, metadata) {
  switch (platform) {
    case 'slack':
      return buildSlackPayload(eventType, message, metadata);
    case 'discord':
      return buildDiscordPayload(eventType, message, metadata);
    case 'teams':
      return buildTeamsPayload(eventType, message, metadata);
    default:
      return buildCustomPayload(eventType, message, metadata);
  }
}

export function createWebhookDispatcher(webhookQueries, logger) {
  return {
    async dispatch(projectId, eventType, message, metadata = {}) {
      try {
        const webhooks = webhookQueries.getEnabledByProject(projectId);
        if (webhooks.length === 0) return;

        for (const webhook of webhooks) {
          // Check if webhook is subscribed to this event
          if (webhook.events.length > 0 && !webhook.events.includes(eventType)) continue;

          const payload = buildPayload(webhook.platform, eventType, message, metadata);

          try {
            const res = await fetch(webhook.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) {
              logger?.(`Webhook "${webhook.name}" failed: ${res.status}`);
            }
          } catch (err) {
            logger?.(`Webhook "${webhook.name}" error: ${err.message}`);
          }
        }
      } catch (err) {
        logger?.(`Webhook dispatch error: ${err.message}`);
      }
    },
  };
}
