import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Activity,
  Clock,
  Cpu,
  Coins,
  Terminal,
  Pencil,
  Trash2,
  CheckCircle,
  FlaskConical,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { formatDuration, formatTokens } from '../../lib/formatters';
import { TYPE_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, MODEL_COLORS, COLUMNS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import { TagList } from './TagBadge';

const PAGE_SIZE = 50;

const STATUS_DOT = {
  backlog: 'bg-surface-400',
  in_progress: 'bg-amber-400',
  testing: 'bg-claude',
  done: 'bg-emerald-400',
  failed: 'bg-red-400',
};
export default function ListView({
  tasks,
  onStatusChange,
  onViewLogs,
  onEditTask,
  onDeleteTask,
  onBulkDelete,
  onReviewTask,
  onViewDetail,
}) {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Reset pagination and selection when tasks change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [tasks]);

  const toggleSelect = useCallback((taskId, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === tasks.length) return new Set();
      return new Set(tasks.map((t) => t.id));
    });
  }, [tasks]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av = a[sortField],
        bv = b[sortField];
      if (sortField === 'status') {
        const order = { backlog: 0, in_progress: 1, testing: 2, done: 3 };
        av = order[av] ?? 0;
        bv = order[bv] ?? 0;
      }
      if (sortField === 'tokens') {
        av = (a.input_tokens || 0) + (a.output_tokens || 0);
        bv = (b.input_tokens || 0) + (b.output_tokens || 0);
      }
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av || 0) - (bv || 0)) * dir;
    });
    return arr;
  }, [tasks, sortField, sortDir]);

  const visibleTasks = sorted.slice(0, page * PAGE_SIZE);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp size={10} className="text-surface-700" />;
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  const columns = [
    { key: 'id', label: '#', w: 'w-12' },
    { key: 'title', label: t('list.title'), w: 'flex-1 min-w-[150px]' },
    { key: 'task_type', label: t('list.type'), w: 'w-20' },
    { key: 'status', label: t('list.status'), w: 'w-24' },
    { key: 'priority', label: t('list.priority'), w: 'w-20' },
    { key: 'model', label: t('list.model'), w: 'w-16' },
    { key: 'tokens', label: t('list.tokens'), w: 'w-20' },
    { key: 'total_cost', label: t('list.cost'), w: 'w-20' },
    { key: 'started_at', label: t('list.duration'), w: 'w-20' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex-shrink-0">
          <span className="text-xs text-red-300 font-medium">
            {selectedIds.size} {t('common.selected')}
          </span>
          <button
            onClick={() => {
              const selected = tasks.filter((t) => selectedIds.has(t.id));
              if (onBulkDelete) onBulkDelete(selected);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            <Trash2 size={12} />
            {t('common.deleteSelected')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-surface-400 hover:text-surface-200 transition-colors ml-auto"
          >
            {t('common.clearSelection')}
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-surface-900">
            <tr className="border-b border-surface-800">
              <th className="w-8 px-2 py-2.5 text-center">
                <button onClick={toggleAll} className="text-surface-500 hover:text-surface-300 transition-colors">
                  {selectedIds.size === 0 ? (
                    <Square size={14} />
                  ) : selectedIds.size === tasks.length ? (
                    <CheckSquare size={14} className="text-claude" />
                  ) : (
                    <MinusSquare size={14} className="text-claude" />
                  )}
                </button>
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${col.w} px-3 py-2.5 text-left font-medium text-surface-500 cursor-pointer hover:text-surface-300 select-none transition-colors`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </span>
                </th>
              ))}
              <th className="w-24 px-3 py-2.5 text-right font-medium text-surface-500">{t('list.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map((task) => {
              const taskType = task.task_type || 'feature';
              const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
              const modelDisplay = task.model_used || task.model || 'sonnet';
              const duration = formatDuration(
                task.started_at,
                task.completed_at,
                task.work_duration_ms,
                task.last_resumed_at,
              );

              return (
                <tr
                  key={task.id}
                  className={`border-b border-surface-800/50 hover:bg-surface-800/40 cursor-pointer transition-colors group ${selectedIds.has(task.id) ? 'bg-claude/5' : ''}`}
                  onClick={() => onViewDetail?.(task)}
                >
                  <td className="px-2 py-2 text-center" onClick={(e) => toggleSelect(task.id, e)}>
                    {selectedIds.has(task.id) ? (
                      <CheckSquare size={14} className="text-claude" />
                    ) : (
                      <Square size={14} className="text-surface-600 group-hover:text-surface-400" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-surface-600 font-mono text-[11px]">{task.task_key || `#${task.id}`}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {task.is_running && task.status === 'testing' && (
                        <FlaskConical size={10} className="text-purple-400 animate-pulse flex-shrink-0" />
                      )}
                      {task.is_running && task.status !== 'testing' && (
                        <Activity size={10} className="text-amber-400 animate-pulse flex-shrink-0" />
                      )}
                      <span className="text-surface-200 truncate">{task.title}</span>
                      <TagList tags={task.tags} max={2} size="xs" />
                      {task.revision_count > 0 && (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 flex-shrink-0">
                          {t('card.rev')} {task.revision_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[taskType]}`}>
                      {taskType}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                      <span className="text-surface-300">{t('status.' + task.status)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-surface-400">
                    {task.priority > 0 ? PRIORITY_LABELS[task.priority] : '-'}
                  </td>
                  <td className={`px-3 py-2 ${MODEL_COLORS[modelDisplay] || 'text-surface-400'}`}>{modelDisplay}</td>
                  <td className="px-3 py-2 text-surface-400">{totalTokens > 0 ? formatTokens(totalTokens) : '-'}</td>
                  <td className="px-3 py-2 text-surface-400">
                    {task.total_cost > 0 ? `$${task.total_cost.toFixed(4)}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-surface-400">{duration || '-'}</td>
                  <td className="px-3 py-2">
                    <div
                      className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.status === 'testing' && onReviewTask && (
                        <button
                          onClick={() => onReviewTask(task)}
                          className="p-1 rounded hover:bg-emerald-500/20 text-surface-400 hover:text-emerald-400"
                          title="Review"
                        >
                          <CheckCircle size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => onViewLogs(task)}
                        className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-claude"
                        title="Logs"
                      >
                        <Terminal size={13} />
                      </button>
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length > visibleTasks.length && (
          <div className="flex justify-center py-3">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
            >
              {t('common.loadMore')} ({sorted.length - visibleTasks.length} {t('common.remaining')})
            </button>
          </div>
        )}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-16 text-surface-500 text-sm">{t('board.noTasks')}</div>
        )}
      </div>
    </div>
  );
}
