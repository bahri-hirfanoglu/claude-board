import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight,
  GripVertical, Link2, Unlink, RotateCcw, Zap, Timer, Coins,
  ChevronDown, ChevronRight, ChevronUp,
} from 'lucide-react';
import { api } from '../../lib/api';
import { IS_TAURI } from '../../lib/tauriEvents';
import { useTranslation } from '../../i18n/I18nProvider';
import { TYPE_COLORS } from '../../lib/constants';
import { formatTokens } from '../../lib/formatters';
import { TagList } from './TagBadge';

const STATUS_CONFIG = {
  in_progress: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Running' },
  backlog: { color: 'text-surface-400', bg: 'bg-surface-800/50', border: 'border-surface-700/30', label: 'Queued' },
  testing: { color: 'text-claude', bg: 'bg-claude/10', border: 'border-claude/30', label: 'Testing' },
  done: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Done' },
};

export default function PipelineView({ tasks, onStatusChange, onViewLogs, onViewDetail }) {
  const { t } = useTranslation();
  const [depMap, setDepMap] = useState({});

  // Load all dependency data
  useEffect(() => {
    if (!IS_TAURI || tasks.length === 0) return;
    const loadDeps = async () => {
      const map = {};
      for (const task of tasks) {
        try {
          const deps = await api.getTaskDependencies(task.id);
          if (deps.parents?.length > 0) map[task.id] = deps.parents;
        } catch {}
      }
      setDepMap(map);
    };
    loadDeps();
  }, [tasks]);

  const enrichedTasks = useMemo(() =>
    tasks.map(t => ({ ...t, _parentIds: depMap[t.id] || [] })),
    [tasks, depMap]
  );
  const [dragId, setDragId] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [localQueue, setLocalQueue] = useState(null);

  const running = enrichedTasks.filter(t => t.status === 'in_progress' || t.is_running);
  const queued = enrichedTasks.filter(t => (t.status || 'backlog') === 'backlog')
    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0) || (a.priority || 0) - (b.priority || 0));
  const failed = enrichedTasks.filter(t => t.status === 'failed');
  const completed = enrichedTasks.filter(t => t.status === 'testing' || t.status === 'done')
    .sort((a, b) => {
      const da = b.completed_at || b.updated_at || '';
      const db2 = a.completed_at || a.updated_at || '';
      return da.localeCompare(db2);
    });

  const totalCost = tasks.reduce((s, t) => s + (t.total_cost || 0), 0);
  const totalTokens = tasks.reduce((s, t) => s + (t.input_tokens || 0) + (t.output_tokens || 0), 0);
  const avgDuration = (() => {
    const durs = completed.filter(t => t.work_duration_ms > 0).map(t => t.work_duration_ms);
    return durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 1000) : 0;
  })();

  const effectiveQueue = localQueue || queued;

  const reorder = async (newOrder) => {
    setLocalQueue(newOrder);
    try {
      await api.reorderQueue(tasks[0]?.project_id, newOrder.map(t => t.id));
    } catch (e) { console.error(e); }
  };

  const handleQueueDrop = (targetIdx) => {
    if (dragId === null) return;
    const newOrder = [...effectiveQueue];
    const fromIdx = newOrder.findIndex(t => t.id === dragId);
    if (fromIdx === -1 || fromIdx === targetIdx) { setDragId(null); setDragOverIdx(null); return; }
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    setDragId(null);
    setDragOverIdx(null);
    reorder(newOrder);
  };

  const moveTask = (idx, direction) => {
    const newOrder = [...effectiveQueue];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    reorder(newOrder);
  };

  // Reset local queue when tasks change externally
  useEffect(() => { setLocalQueue(null); }, [tasks]);

  const fmtDuration = (ms) => {
    if (!ms) return '--';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Pipeline stats bar */}
      <div className="flex items-center gap-4 px-3 py-2 bg-surface-800/50 rounded-lg border border-surface-700/30">
        <div className="flex items-center gap-1.5">
          <Play size={12} className="text-amber-400" />
          <span className="text-xs text-surface-400">{t('pipeline.running')}</span>
          <span className="text-sm font-semibold text-amber-400">{running.length}</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-surface-400" />
          <span className="text-xs text-surface-400">{t('pipeline.queued')}</span>
          <span className="text-sm font-semibold text-surface-300">{queued.length}</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <span className="text-xs text-surface-400">{t('pipeline.completed')}</span>
          <span className="text-sm font-semibold text-emerald-400">{completed.length}</span>
        </div>
        <div className="flex-1" />
        {avgDuration > 0 && (
          <div className="flex items-center gap-1.5">
            <Timer size={11} className="text-surface-500" />
            <span className="text-[10px] text-surface-500">{t('pipeline.avgTime')}: {fmtDuration(avgDuration * 1000)}</span>
          </div>
        )}
        {totalTokens > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-surface-500" />
            <span className="text-[10px] text-surface-500">{formatTokens(totalTokens)}</span>
          </div>
        )}
        {totalCost > 0 && (
          <div className="flex items-center gap-1.5">
            <Coins size={11} className="text-surface-500" />
            <span className="text-[10px] text-surface-500">${totalCost.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Running */}
      {running.length > 0 && (
        <Section title={t('pipeline.running')} count={running.length} color="text-amber-400">
          {running.map(task => (
            <PipelineCard key={task.id} task={task} onViewLogs={onViewLogs} onViewDetail={onViewDetail} />
          ))}
        </Section>
      )}

      {/* Queue */}
      <Section title={t('pipeline.queue')} count={effectiveQueue.length} color="text-surface-300">
        {effectiveQueue.length === 0 ? (
          <p className="text-xs text-surface-600 py-4 text-center">{t('pipeline.emptyQueue')}</p>
        ) : effectiveQueue.map((task, idx) => (
          <div key={task.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(task.id); }}
            onDragEnd={() => { setDragId(null); setDragOverIdx(null); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
            onDrop={() => handleQueueDrop(idx)}
            className={dragOverIdx === idx && dragId !== task.id ? 'border-t-2 border-claude' : ''}
          >
            <PipelineCard
              task={task}
              position={idx + 1}
              draggable
              onViewLogs={onViewLogs}
              onViewDetail={onViewDetail}
              onMoveUp={idx > 0 ? () => moveTask(idx, -1) : null}
              onMoveDown={idx < effectiveQueue.length - 1 ? () => moveTask(idx, 1) : null}
            />
          </div>
        ))}
      </Section>

      {/* Failed */}
      {failed.length > 0 && (
        <Section title={t('status.failed')} count={failed.length} color="text-red-400" collapsible>
          {failed.map(task => (
            <PipelineCard key={task.id} task={task} onViewLogs={onViewLogs} onViewDetail={onViewDetail} />
          ))}
        </Section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <Section title={t('pipeline.completed')} count={completed.length} color="text-emerald-400" collapsible>
          {completed.map(task => (
            <PipelineCard key={task.id} task={task} onViewLogs={onViewLogs} onViewDetail={onViewDetail} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, color, children, collapsible }) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div>
      <button onClick={() => collapsible && setOpen(!open)}
        className={`flex items-center gap-2 mb-2 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}>
        {collapsible && (open ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />)}
        <span className={`text-xs font-semibold ${color}`}>{title}</span>
        <span className="text-[10px] bg-surface-800 px-1.5 py-0.5 rounded-full text-surface-500">{count}</span>
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function PipelineCard({ task, position, draggable, onViewLogs, onViewDetail, onMoveUp, onMoveDown }) {
  const status = task.status || 'backlog';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;
  const typeColor = TYPE_COLORS[task.task_type] || 'bg-surface-500/15 text-surface-400';
  const tokens = (task.input_tokens || 0) + (task.output_tokens || 0);
  const depName = task.depends_on ? `#${task.depends_on}` : null;
  const depIds = task._parentIds || [];

  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${config.border} ${config.bg} cursor-pointer hover:brightness-110 transition-all`}
      onClick={() => onViewDetail?.(task)}>
      {draggable && (
        <GripVertical size={14} className="text-surface-600 cursor-grab flex-shrink-0" />
      )}
      {position && (
        <span className="text-[10px] text-surface-600 font-mono w-5 text-right flex-shrink-0">{position}</span>
      )}
      {status === 'in_progress' && (
        <Loader2 size={14} className="text-amber-400 animate-spin flex-shrink-0" />
      )}
      {status === 'done' && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
      {status === 'testing' && <AlertCircle size={14} className="text-claude flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${typeColor}`}>{task.task_type}</span>
          {task.task_key && <span className="text-[9px] text-surface-600 font-mono">{task.task_key}</span>}
          <span className="text-xs text-surface-200 font-medium truncate">{task.title}</span>
          <TagList tags={task.tags} max={2} size="xs" />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.model && <span className="text-[9px] text-surface-500">{task.model}</span>}
          {tokens > 0 && <span className="text-[9px] text-surface-600">{formatTokens(tokens)}</span>}
          {task.work_duration_ms > 0 && <span className="text-[9px] text-surface-600">{Math.round(task.work_duration_ms / 1000)}s</span>}
          {task.total_cost > 0 && <span className="text-[9px] text-surface-600">${task.total_cost.toFixed(3)}</span>}
          {depIds.length > 0 ? (
            <span className="text-[9px] text-blue-400 flex items-center gap-0.5">
              <Link2 size={8} />{depIds.map(id => `#${id}`).join(', ')}
            </span>
          ) : depName ? (
            <span className="text-[9px] text-blue-400 flex items-center gap-0.5"><Link2 size={8} />{depName}</span>
          ) : null}
          {task.retry_count > 0 && (
            <span className="text-[9px] text-amber-400 flex items-center gap-0.5"><RotateCcw size={8} />{t('pipeline.retryCount')} {task.retry_count}</span>
          )}
        </div>
      </div>
      {draggable && (onMoveUp || onMoveDown) && (
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} disabled={!onMoveUp}
            className={`p-0.5 rounded ${onMoveUp ? 'text-surface-400 hover:text-surface-200 hover:bg-surface-700' : 'text-surface-800'}`}>
            <ChevronUp size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }} disabled={!onMoveDown}
            className={`p-0.5 rounded ${onMoveDown ? 'text-surface-400 hover:text-surface-200 hover:bg-surface-700' : 'text-surface-800'}`}>
            <ChevronDown size={12} />
          </button>
        </div>
      )}
      {status === 'in_progress' && (
        <button onClick={(e) => { e.stopPropagation(); onViewLogs?.(task); }}
          className="text-[10px] text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-amber-500/10">
          {t('pipeline.terminal')}
        </button>
      )}
    </div>
  );
}
