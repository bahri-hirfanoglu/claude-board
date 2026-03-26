import { useMemo } from 'react';
import { getToolIcon, getToolColor } from './terminalConstants';
import { basename } from './terminalHelpers';

// ─── Activity indicator ───
export function ActivityIndicator({ logs, isRunning }) {
  const status = useMemo(() => {
    if (!isRunning) return null;
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.log_type === 'tool' && l.meta?.toolName && !l.meta.isResult) {
        // Check if this tool has a result
        const toolId = l.meta.toolId;
        const hasResult = logs.slice(i + 1).some(r => r.log_type === 'tool_result' && r.meta?.toolId === toolId);
        if (!hasResult) {
          return { phase: 'tool', toolName: l.meta.toolName, file: l.meta.input?.file };
        }
      }
      if (l.log_type === 'tool_result') return { phase: 'thinking' };
      if (l.log_type === 'claude') return { phase: 'thinking' };
    }
    return { phase: 'starting' };
  }, [logs, isRunning]);

  if (!status) return null;

  if (status.phase === 'tool') {
    const Icon = getToolIcon(status.toolName);
    const color = getToolColor(status.toolName);
    return (
      <div className={`flex items-center gap-1.5 text-xs ${color}`}>
        <Icon size={12} className="animate-pulse" />
        <span className="font-medium">{status.toolName}</span>
        {status.file && <span className="text-surface-500 truncate max-w-[150px]">{basename(status.file)}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-surface-500">
      <div className="w-2 h-2 rounded-full bg-claude animate-pulse" />
      {status.phase === 'starting' ? 'Starting...' : 'Thinking...'}
    </div>
  );
}
