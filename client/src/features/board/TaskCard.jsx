import { useState, useRef, useEffect } from 'react';
import { Terminal, Pencil, Trash2, Activity, GripVertical, ChevronRight, Clock, Cpu, Coins, CheckCircle, RotateCcw } from 'lucide-react';

const priorityColors = {
  0: '',
  1: 'border-l-yellow-500',
  2: 'border-l-orange-500',
  3: 'border-l-red-500',
};

const priorityLabels = ['', 'Low', 'Medium', 'High'];

const typeColors = {
  feature: 'bg-blue-500/15 text-blue-400',
  bugfix: 'bg-red-500/15 text-red-400',
  refactor: 'bg-purple-500/15 text-purple-400',
  docs: 'bg-green-500/15 text-green-400',
  test: 'bg-yellow-500/15 text-yellow-400',
  chore: 'bg-surface-500/15 text-surface-400',
};

const modelColors = {
  haiku: 'text-green-400',
  sonnet: 'text-blue-400',
  opus: 'text-purple-400',
};

const STATUS_OPTIONS = [
  { id: 'backlog', label: 'Backlog', dot: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', dot: 'bg-claude' },
  { id: 'done', label: 'Done', dot: 'bg-emerald-400' },
];

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end - start;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return '<1m';
}

function formatTokens(n) {
  if (!n || n === 0) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function TaskCard({ task, onDragStart, onDragEnd, onViewLogs, onEdit, onDelete, onStatusChange, onReview }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showMenu]);

  const duration = formatDuration(task.started_at, task.completed_at);
  const taskType = task.task_type || 'feature';
  const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
  const hasUsage = totalTokens > 0;
  const modelDisplay = task.model_used || task.model || 'sonnet';
  const modelColorClass = modelColors[modelDisplay] || modelColors[task.model] || 'text-surface-400';

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onContextMenu={handleContextMenu}
        className={`group relative bg-surface-800 rounded-lg p-3 border border-surface-700/50 hover:border-surface-600 cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-lg hover:shadow-black/20 ${
          task.priority > 0 ? `border-l-2 ${priorityColors[task.priority]}` : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${typeColors[taskType]}`}>
                {taskType}
              </span>
              {task.priority > 0 && (
                <span className="text-[9px] text-surface-500">{priorityLabels[task.priority]}</span>
              )}
              <span className={`text-[9px] ${modelColorClass}`}>
                {modelDisplay}
              </span>
              {task.revision_count > 0 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400" title={`${task.revision_count} revision(s)`}>
                  Rev {task.revision_count}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-surface-100 truncate">{task.title}</h3>
            {task.description && (
              <p className="text-xs text-surface-400 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          <GripVertical size={14} className="text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.is_running && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <Activity size={10} className="animate-pulse" />
                Running
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-1 text-[10px] text-surface-500">
                <Clock size={9} />
                {duration}
              </span>
            )}
            {hasUsage && (
              <span className="flex items-center gap-1 text-[10px] text-surface-500" title={`${(task.input_tokens || 0).toLocaleString()} in / ${(task.output_tokens || 0).toLocaleString()} out`}>
                <Cpu size={9} />
                {formatTokens(totalTokens)}
              </span>
            )}
            {task.total_cost > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-surface-500">
                <Coins size={9} />
                ${task.total_cost.toFixed(4)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status === 'testing' && onReview && (
              <button
                onClick={(e) => { e.stopPropagation(); onReview(); }}
                className="p-1 rounded hover:bg-emerald-500/20 text-surface-400 hover:text-emerald-400 transition-colors"
                title="Review Task"
              >
                <CheckCircle size={13} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onViewLogs(); }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-claude transition-colors"
              title="View Logs"
            >
              <Terminal size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Usage stats bar for completed tasks */}
        {task.status === 'done' && hasUsage && (
          <div className="mt-2 pt-2 border-t border-surface-700/50">
            <div className="flex items-center gap-3 text-[9px] text-surface-500">
              <span>{(task.input_tokens || 0).toLocaleString()} in</span>
              <span>{(task.output_tokens || 0).toLocaleString()} out</span>
              {task.num_turns > 0 && <span>{task.num_turns} turns</span>}
              {task.rate_limit_hits > 0 && (
                <span className="text-amber-500">{task.rate_limit_hits} rate limits</span>
              )}
            </div>
          </div>
        )}

        <div className="text-[10px] text-surface-600 mt-1.5">
          #{task.id}
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          style={{ left: menuPos.x, top: menuPos.y }}
          className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl min-w-[160px]"
        >
          <div className="px-3 py-1.5 text-[10px] text-surface-500 font-medium uppercase tracking-wider">Move to</div>
          {STATUS_OPTIONS.filter(s => s.id !== task.status).map(s => (
            <button
              key={s.id}
              onClick={() => { setShowMenu(false); onStatusChange?.(task.id, s.id); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
              <ChevronRight size={10} className="ml-auto text-surface-600" />
            </button>
          ))}
          <div className="border-t border-surface-700 my-1" />
          {task.status === 'testing' && onReview && (
            <button
              onClick={() => { setShowMenu(false); onReview(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-400 hover:bg-surface-700 transition-colors"
            >
              <CheckCircle size={11} />
              Review
            </button>
          )}
          <button
            onClick={() => { setShowMenu(false); onViewLogs(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
          >
            <Terminal size={11} />
            View Logs
          </button>
          <button
            onClick={() => { setShowMenu(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            onClick={() => { setShowMenu(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-surface-700 transition-colors"
          >
            <Trash2 size={11} />
            Delete
          </button>
        </div>
      )}
    </>
  );
}
