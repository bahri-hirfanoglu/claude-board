// ─── Helpers ───
export function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function fmtMs(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

export function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function basename(p) {
  if (!p) return null;
  return p.replace(/\\/g, '/').split('/').pop();
}

export function shortenPath(p) {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return parts.join('/');
  return '\u2026/' + parts.slice(-3).join('/');
}

// ─── Grouped tool call + result into a single card ───
export function groupToolEntries(logs) {
  const entries = [];
  let turnNumber = 0;
  let lastType = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Insert turn separator when Claude speaks after tool results
    if (
      log.log_type === 'claude' &&
      lastType &&
      lastType !== 'claude' &&
      lastType !== 'system' &&
      lastType !== 'info'
    ) {
      turnNumber++;
      entries.push({ type: 'turn_separator', turn: turnNumber, time: log.created_at });
    }

    if (log.log_type === 'tool' && log.meta && !log.meta.isResult) {
      // Look ahead for matching result
      const toolId = log.meta.toolId;
      let result = null;
      if (toolId) {
        for (let j = i + 1; j < logs.length && j < i + 20; j++) {
          if (logs[j].log_type === 'tool_result' && logs[j].meta?.toolId === toolId) {
            result = logs[j];
            break;
          }
        }
      }
      entries.push({ type: 'tool_group', call: log, result, index: i });
    } else if (log.log_type === 'tool_result' && log.meta) {
      // Skip if already consumed by a group
      const toolId = log.meta.toolId;
      const alreadyGrouped = entries.some((e) => e.type === 'tool_group' && e.result?.meta?.toolId === toolId);
      if (!alreadyGrouped) {
        entries.push({ type: 'tool_group', call: null, result: log, index: i });
      }
    } else {
      entries.push({ type: 'log', log, index: i });
    }

    lastType = log.log_type;
  }
  return entries;
}
