import { Square, Cpu, Clock, Wrench } from 'lucide-react';
import { formatTokens } from '../../lib/formatters';
import { TYPE_COLORS } from '../../lib/constants';

function formatElapsed(ms) {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function AgentCard({ task, onStop, onViewLogs }) {
  const tokens = (task.input_tokens || 0) + (task.output_tokens || 0);
  const elapsed = task.started_at ? Date.now() - new Date(task.started_at).getTime() : 0;
  const model = task.model_used || task.model || 'sonnet';
  const typeColor = TYPE_COLORS[task.task_type] || TYPE_COLORS.feature;

  return (
    <div
      className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-3 hover:border-claude/30 transition-colors cursor-pointer group"
      onClick={() => onViewLogs?.(task)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${typeColor?.dot || 'bg-blue-400'}`} />
            <span className="text-xs font-medium text-surface-200 truncate">{task.title}</span>
          </div>
          {task.task_key && (
            <span className="text-[10px] text-surface-500 font-mono">{task.task_key}</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onStop?.(task); }}
          className="p-1 rounded hover:bg-red-500/20 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          title="Stop"
        >
          <Square size={12} />
        </button>
      </div>

      {/* Live status bar */}
      <div className="h-1 rounded-full bg-surface-700 overflow-hidden mb-2">
        <div className="h-full bg-claude rounded-full animate-pulse" style={{ width: '60%' }} />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[10px] text-surface-500">
        <span className="flex items-center gap-0.5">
          <Cpu size={9} />
          {model}
        </span>
        {tokens > 0 && (
          <span className="flex items-center gap-0.5">
            <Wrench size={9} />
            {formatTokens(tokens)}
          </span>
        )}
        <span className="flex items-center gap-0.5 ml-auto">
          <Clock size={9} />
          {formatElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
}
