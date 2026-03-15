// ─── Tool metadata extraction ───
export function extractToolMeta(toolName, input) {
  const meta = { toolName, input: {} };
  if (input.file_path || input.path) meta.input.file = input.file_path || input.path;
  if (input.pattern) meta.input.pattern = input.pattern;
  if (input.command) meta.input.command = String(input.command).substring(0, 300);
  if (input.content) {
    meta.input.contentLength = input.content.length;
    meta.input.contentPreview = String(input.content).substring(0, 200);
  }
  if (input.old_string) {
    meta.input.editing = true;
    meta.input.oldString = String(input.old_string).substring(0, 150);
    meta.input.newString = String(input.new_string || '').substring(0, 150);
  }
  if (input.description) meta.input.description = String(input.description).substring(0, 200);
  if (input.url) meta.input.url = input.url;
  if (input.query) meta.input.query = String(input.query).substring(0, 200);
  if (input.prompt) meta.input.prompt = String(input.prompt).substring(0, 200);
  if (input.glob) meta.input.glob = input.glob;
  return meta;
}

function buildToolDisplay(toolName, meta) {
  let d = `Tool: ${toolName}`;
  if (meta.input.file) d += ` → ${meta.input.file}`;
  else if (meta.input.command) d += ` → ${meta.input.command}`;
  else if (meta.input.pattern) d += ` → ${meta.input.pattern}`;
  else if (meta.input.description) d += ` → ${meta.input.description}`;
  return d;
}

// ─── Main event handler ───
export function handleClaudeEvent(taskId, event, { addLog, queries, statsQueries, io, taskUsage, activeToolCalls }) {
  const type = event.type;

  switch (type) {
    case 'assistant': {
      const content = event.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            addLog(taskId, block.text, 'claude');
          } else if (block.type === 'tool_use') {
            const toolName = block.name || 'unknown';
            const toolId = block.id || null;
            const meta = extractToolMeta(toolName, block.input || {});
            meta.toolId = toolId;
            if (toolId) activeToolCalls.set(toolId, { taskId, toolName, startTime: Date.now(), meta });
            addLog(taskId, buildToolDisplay(toolName, meta), 'tool', meta);
          }
        }
      }

      // Live usage tracking
      const msgUsage = event.message?.usage;
      if (msgUsage) {
        const tracker = taskUsage.get(taskId);
        if (tracker) {
          tracker.session.input += msgUsage.input_tokens || 0;
          tracker.session.output += msgUsage.output_tokens || 0;
          tracker.session.cacheRead += msgUsage.cache_read_input_tokens || 0;
          tracker.session.cacheCreation += msgUsage.cache_creation_input_tokens || 0;

          const total = {
            input: tracker.baseline.input + tracker.session.input,
            output: tracker.baseline.output + tracker.session.output,
            cacheRead: tracker.baseline.cacheRead + tracker.session.cacheRead,
            cacheCreation: tracker.baseline.cacheCreation + tracker.session.cacheCreation,
            cost: tracker.baseline.cost,
          };

          const modelUsed = event.message?.model || '';
          queries.setTaskUsageLive.run(
            total.input,
            total.output,
            total.cacheRead,
            total.cacheCreation,
            total.cost,
            modelUsed,
            taskId,
          );
          io.emit('task:usage', {
            taskId,
            input_tokens: total.input,
            output_tokens: total.output,
            cache_read_tokens: total.cacheRead,
            cache_creation_tokens: total.cacheCreation,
            total_tokens: total.input + total.output,
            total_cost: total.cost,
          });
        }
      }
      break;
    }

    case 'user': {
      const content = event.message?.content;
      if (!Array.isArray(content)) break;
      for (const block of content) {
        if (block.type === 'tool_result') {
          const toolId = block.tool_use_id || null;
          const tracked = toolId ? activeToolCalls.get(toolId) : null;
          const duration = tracked ? Date.now() - tracked.startTime : null;
          const toolName = tracked?.toolName || 'unknown';

          let resultPreview = '';
          if (typeof block.content === 'string') resultPreview = block.content.substring(0, 500);
          else if (Array.isArray(block.content)) {
            resultPreview = block.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n')
              .substring(0, 500);
          }
          const resultLines = resultPreview.split('\n').length;
          const isError = block.is_error === true;

          const meta = { toolName, toolId, duration, isResult: true, isError, resultPreview, resultLines };
          const durationStr = duration ? ` (${duration}ms)` : '';
          const icon = isError ? '✗' : '✓';
          let display = `${icon} ${toolName}${durationStr}`;
          if (resultPreview) {
            const first = resultPreview.split('\n')[0].substring(0, 120);
            if (first.trim()) display += ` — ${first}`;
          }
          addLog(taskId, display, isError ? 'error' : 'tool_result', meta);
          if (toolId) activeToolCalls.delete(toolId);
        }
      }
      break;
    }

    case 'result': {
      const usage = event.usage || {};
      const sessionInput = usage.input_tokens || 0;
      const sessionOutput = usage.output_tokens || 0;
      const sessionCacheRead = usage.cache_read_input_tokens || 0;
      const sessionCacheCreation = usage.cache_creation_input_tokens || 0;
      const totalCost = event.total_cost || 0;
      const numTurns = event.num_turns || 0;
      const durationMs = event.duration_ms || 0;
      const modelUsed = event.model || '';
      const sessionId = event.session_id || '';

      const tracker = taskUsage.get(taskId);
      const base = tracker?.baseline || { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, cost: 0 };

      const fin = {
        input: base.input + sessionInput,
        output: base.output + sessionOutput,
        cacheRead: base.cacheRead + sessionCacheRead,
        cacheCreation: base.cacheCreation + sessionCacheCreation,
        cost: base.cost + totalCost,
      };

      if (sessionInput > 0 || sessionOutput > 0) {
        queries.setTaskUsageLive.run(
          fin.input,
          fin.output,
          fin.cacheRead,
          fin.cacheCreation,
          fin.cost,
          modelUsed,
          taskId,
        );
        if (numTurns > 0) queries.updateTaskNumTurns.run(numTurns, taskId);
        if (sessionId) queries.updateTaskClaudeSession.run(sessionId, taskId);

        const costStr = totalCost > 0 ? ` | Cost: $${totalCost.toFixed(4)}` : '';
        const durStr = durationMs > 0 ? ` | Duration: ${Math.round(durationMs / 1000)}s` : '';
        addLog(
          taskId,
          `Usage: ${(sessionInput + sessionOutput).toLocaleString()} tokens (${sessionInput.toLocaleString()} in / ${sessionOutput.toLocaleString()} out)${costStr} | Turns: ${numTurns}${durStr} | Model: ${modelUsed}`,
          'system',
        );

        const updated = queries.getTaskById.get(taskId);
        if (updated) {
          io.emit('task:updated', updated);
          io.emit('task:usage', {
            taskId,
            input_tokens: fin.input,
            output_tokens: fin.output,
            cache_read_tokens: fin.cacheRead,
            cache_creation_tokens: fin.cacheCreation,
            total_tokens: fin.input + fin.output,
            total_cost: fin.cost,
          });
        }
      }

      // Save model info to limits table
      const modelUsage = event.modelUsage;
      if (modelUsage) {
        const firstModel = Object.keys(modelUsage)[0];
        const mu = modelUsage[firstModel] || {};
        try {
          statsQueries.upsertClaudeLimits({
            rateLimitType: '',
            status: 'allowed',
            resetsAt: 0,
            overageStatus: '',
            isUsingOverage: false,
            model: firstModel || modelUsed,
            costUsd: event.total_cost_usd || totalCost || 0,
            contextWindow: mu.contextWindow || 0,
            maxOutputTokens: mu.maxOutputTokens || 0,
          });
          io.emit('claude:limits', {
            model: firstModel,
            costUsd: event.total_cost_usd || totalCost,
            contextWindow: mu.contextWindow,
            maxOutputTokens: mu.maxOutputTokens,
          });
        } catch {}
      }

      if (event.result) addLog(taskId, `Result: ${String(event.result).substring(0, 500)}`, 'success');
      break;
    }

    case 'system': {
      const subtype = event.subtype || '';
      if (subtype === 'hook_started' || subtype === 'hook_response') break;
      if (subtype === 'init') {
        addLog(taskId, `Session initialized (${event.tools?.length || 0} tools available)`, 'system');
        break;
      }
      const msg = event.message || '';
      if (
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('429') ||
        msg.toLowerCase().includes('overloaded')
      ) {
        queries.incrementRateLimitHits.run(taskId);
      }
      if (msg) addLog(taskId, msg, 'system');
      break;
    }

    case 'rate_limit_event': {
      const info = event.rate_limit_info || {};

      // Always save latest limit info to DB
      try {
        statsQueries.upsertClaudeLimits({
          rateLimitType: info.rateLimitType || '',
          status: info.status || '',
          resetsAt: info.resetsAt || 0,
          overageStatus: info.overageStatus || '',
          isUsingOverage: info.isUsingOverage || false,
          model: '',
          costUsd: 0,
          contextWindow: 0,
          maxOutputTokens: 0,
        });
        io.emit('claude:limits', {
          rateLimitType: info.rateLimitType,
          status: info.status,
          resetsAt: info.resetsAt,
          overageStatus: info.overageStatus,
          isUsingOverage: info.isUsingOverage,
        });
      } catch {}

      if (info.status !== 'allowed') {
        queries.incrementRateLimitHits.run(taskId);
        const resetAt = info.resetsAt ? new Date(info.resetsAt * 1000).toLocaleTimeString() : '';
        addLog(
          taskId,
          `Rate limited (${info.rateLimitType || 'unknown'})${resetAt ? ` — resets at ${resetAt}` : ''}`,
          'error',
        );
      }
      break;
    }
  }
}
