import { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Pencil,
  Trash2,
  Activity,
  GripVertical,
  ChevronRight,
  Clock,
  Cpu,
  Coins,
  CheckCircle,
  RotateCcw,
  GitBranch,
  ArrowRight,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react';
import { formatDuration, formatTokens } from '../../lib/formatters';
import {
  PRIORITY_COLORS as priorityColors,
  PRIORITY_LABELS as priorityLabels,
  TYPE_COLORS as typeColors,
  MODEL_COLORS as modelColors,
  COLUMNS,
} from '../../lib/constants';
import { useStatusTransition } from './StatusTransitionContext';
import StatusTransitionEffect from './StatusTransitionEffect';
import { useTranslation } from '../../i18n/I18nProvider';
import { TagList } from './TagBadge';

const STATUS_OPTIONS_RAW = COLUMNS.map((c) => ({ id: c.id, dot: c.bg, color: c.color }));

// Status flow order for "next" transition
const STATUS_FLOW = ['backlog', 'in_progress', 'testing', 'done'];
const FAILED_NEXT = 'backlog'; // failed tasks can move to backlog
const FLOW_LABEL_KEYS = {
  backlog: 'card.startWorking',
  in_progress: 'card.sendToTesting',
  testing: 'card.markDone',
  done: null,
  failed: 'card.moveToBacklog',
};
const NEXT_BG = {
  in_progress: 'bg-amber-500 active:bg-amber-600 text-white',
  testing: 'bg-claude active:bg-claude-dark text-white',
  done: 'bg-emerald-500 active:bg-emerald-600 text-white',
  backlog: 'bg-surface-500 active:bg-surface-600 text-white',
};

function MobileStatusTransition({ task, onStatusChange }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const currentIdx = STATUS_FLOW.indexOf(task.status);
  const nextStatus =
    task.status === 'failed'
      ? FAILED_NEXT
      : currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
        ? STATUS_FLOW[currentIdx + 1]
        : null;
  const prevStatus = currentIdx > 0 ? STATUS_FLOW[currentIdx - 1] : null;
  const flowLabelKey = FLOW_LABEL_KEYS[task.status];
  const otherStatuses = STATUS_OPTIONS_RAW.filter((s) => s.id !== task.status && s.id !== nextStatus);

  return (
    <div className="flex md:hidden flex-col gap-2 mt-2.5 pt-2.5 border-t border-surface-700/50">
      {/* Flow indicator: current position in workflow */}
      <div className="flex items-center gap-1 px-0.5">
        {STATUS_FLOW.map((s, i) => {
          const col = COLUMNS.find((c) => c.id === s);
          const isCurrent = s === task.status;
          const isPast = i < currentIdx;
          return (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center h-1.5 flex-1 rounded-full transition-colors ${
                  isCurrent ? col.bg : isPast ? `${col.bg} opacity-40` : 'bg-surface-700/50'
                }`}
              />
              {i < STATUS_FLOW.length - 1 && (
                <ChevronRight
                  size={10}
                  className={`flex-shrink-0 mx-0.5 ${isPast || isCurrent ? 'text-surface-400' : 'text-surface-700'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Primary action: next step in workflow */}
      <div className="flex items-center gap-2">
        {/* Back button */}
        {prevStatus && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange?.(task.id, prevStatus);
            }}
            className="flex items-center gap-1 text-[11px] px-2.5 py-2 rounded-lg bg-surface-700/60 active:bg-surface-600 text-surface-300 transition-colors"
          >
            <ArrowRight size={12} className="rotate-180" />
            <span className="hidden min-[400px]:inline">{t('status.' + prevStatus)}</span>
          </button>
        )}

        {/* Main forward button */}
        {nextStatus && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange?.(task.id, nextStatus);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold px-3 py-2.5 rounded-lg transition-colors ${NEXT_BG[nextStatus]}`}
          >
            {flowLabelKey ? t(flowLabelKey) : ''}
            <ArrowRight size={14} />
          </button>
        )}

        {/* More options toggle */}
        {otherStatuses.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(!showAll);
            }}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              showAll ? 'bg-surface-600 text-surface-200' : 'bg-surface-700/60 text-surface-400 active:bg-surface-600'
            }`}
          >
            <span className="text-[14px]">•••</span>
          </button>
        )}
      </div>

      {/* Expanded: all other statuses */}
      {showAll && (
        <div className="flex items-center gap-1.5">
          {otherStatuses.map((s) => (
            <button
              key={s.id}
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(false);
                onStatusChange?.(task.id, s.id);
              }}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-surface-700/50 active:bg-surface-600 ${s.color} transition-colors`}
            >
              <div className={`w-2 h-2 rounded-full ${s.dot}`} />
              {t('status.' + s.id)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  onViewLogs,
  onEdit,
  onDelete,
  onStatusChange,
  onReview,
  onViewDetail,
  onDepDrop,
  draggedTask,
}) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const transitionCtx = useStatusTransition();
  const transition = transitionCtx?.getTransition(task.id);
  const [depDropHover, setDepDropHover] = useState(false);
  const isDepTarget = draggedTask && draggedTask.id !== task.id;

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
    window.addEventListener('touchstart', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('touchstart', close);
    };
  }, [showMenu]);

  const duration = formatDuration(task.started_at, task.completed_at, task.work_duration_ms, task.last_resumed_at);
  const taskType = task.task_type || 'feature';
  const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
  const hasUsage = totalTokens > 0;
  const modelDisplay = task.model_used || task.model || 'sonnet';
  const modelColorClass = modelColors[modelDisplay] || modelColors[task.model] || 'text-surface-400';

  const moveTargets = STATUS_OPTIONS_RAW.filter((s) => s.id !== (task.status || 'backlog'));

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
          onDragStart();
        }}
        onDragEnd={() => {
          setDepDropHover(false);
          onDragEnd();
        }}
        onDragOver={(e) => {
          if (!isDepTarget || !e.altKey) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'link';
          setDepDropHover(true);
        }}
        onDragLeave={() => setDepDropHover(false)}
        onDrop={(e) => {
          if (!isDepTarget || !e.altKey) return;
          e.preventDefault();
          e.stopPropagation();
          setDepDropHover(false);
          onDepDrop?.(draggedTask, task);
        }}
        onClick={() => onViewDetail?.()}
        onContextMenu={handleContextMenu}
        className={`group relative bg-surface-800 rounded-lg p-3 border transition-all duration-150 hover:shadow-lg hover:shadow-black/20 ${
          depDropHover
            ? 'border-blue-400 bg-blue-500/5 ring-1 ring-blue-400/30'
            : 'border-surface-700/50 hover:border-surface-600'
        } ${
          task.priority > 0 ? `border-l-2 ${priorityColors[task.priority]}` : ''
        } ${transition ? 'animate-card-pop' : ''} ${isDepTarget ? 'cursor-pointer' : 'active:cursor-grabbing cursor-pointer'}`}
      >
        {transition && <StatusTransitionEffect from={transition.from} to={transition.to} />}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${typeColors[taskType]}`}>
                {t('type.' + taskType)}
              </span>
              {task.priority > 0 && (
                <span className="text-[9px] text-surface-500">
                  {t('priority.' + ['none', 'low', 'medium', 'high'][task.priority])}
                </span>
              )}
              <span className={`text-[9px] ${modelColorClass}`}>{modelDisplay}</span>
              {task.revision_count > 0 && (
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400"
                  title={`${task.revision_count} revision(s)`}
                >
                  {t('card.rev')} {task.revision_count}
                </span>
              )}
              <TagList tags={task.tags} max={2} size="xs" />
              {task.retry_count > 0 && (
                <span
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                    task.retry_count > 2 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {task.retry_count > 2 ? <AlertTriangle size={8} /> : <RotateCcw size={8} />}
                  {task.retry_count > 2 ? t('card.failed') : `${t('card.retryCount')} ${task.retry_count}`}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-surface-100 truncate">{task.title}</h3>
            {task.description && <p className="text-xs text-surface-400 mt-1 line-clamp-2">{task.description}</p>}
          </div>
          <GripVertical
            size={14}
            className="text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 hidden md:block"
          />
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.status === 'testing' && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                <FlaskConical size={10} className={task.is_running ? 'animate-pulse' : ''} />
                {t('status.testing')}
              </span>
            )}
            {task.is_running && task.status !== 'testing' && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <Activity size={10} className="animate-pulse" />
                {t('status.running')}
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-1 text-[10px] text-surface-500">
                <Clock size={9} />
                {duration}
              </span>
            )}
            {hasUsage && (
              <span
                className="flex items-center gap-1 text-[10px] text-surface-500"
                title={`${(task.input_tokens || 0).toLocaleString()} in / ${(task.output_tokens || 0).toLocaleString()} out`}
              >
                <Cpu size={9} />
                {formatTokens(totalTokens)}
              </span>
            )}
            {task.total_cost > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-surface-500">
                <Coins size={9} />${task.total_cost.toFixed(4)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {task.status === 'testing' && onReview && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReview();
                }}
                className="p-1 rounded hover:bg-emerald-500/20 text-surface-400 hover:text-emerald-400 transition-colors"
                title={t('card.reviewTask')}
              >
                <CheckCircle size={13} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs();
              }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-claude transition-colors"
              title={t('card.viewLogs')}
            >
              <Terminal size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
              title={t('common.edit')}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Mobile status transition — Jira-style workflow */}
        <MobileStatusTransition task={task} onStatusChange={onStatusChange} />

        {/* Usage stats bar for completed tasks */}
        {task.status === 'done' && hasUsage && (
          <div className="mt-2 pt-2 border-t border-surface-700/50">
            <div className="flex items-center gap-3 text-[9px] text-surface-500">
              <span>{(task.input_tokens || 0).toLocaleString()} in</span>
              <span>{(task.output_tokens || 0).toLocaleString()} out</span>
              {task.num_turns > 0 && <span>{task.num_turns} turns</span>}
              {task.rate_limit_hits > 0 && <span className="text-amber-500">{task.rate_limit_hits} rate limits</span>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-surface-600 mt-1.5">
          <span>{task.task_key || `#${task.id}`}</span>
          {task.branch_name && (
            <span
              className="flex items-center gap-0.5 text-violet-400/60 truncate max-w-[160px]"
              title={task.branch_name}
            >
              <GitBranch size={9} />
              {task.branch_name}
            </span>
          )}
          {task.github_issue_number && (
            <a
              href={task.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#24292e]/20 text-[#8b949e] hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              #{task.github_issue_number}
            </a>
          )}
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          style={{ left: menuPos.x, top: menuPos.y }}
          className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl min-w-[160px]"
        >
          <div className="px-3 py-1.5 text-[10px] text-surface-500 font-medium uppercase tracking-wider">
            {t('card.moveTo')}
          </div>
          {STATUS_OPTIONS_RAW.filter((s) => s.id !== task.status).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setShowMenu(false);
                onStatusChange?.(task.id, s.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {t('status.' + s.id)}
              <ChevronRight size={10} className="ml-auto text-surface-600" />
            </button>
          ))}
          <div className="border-t border-surface-700 my-1" />
          {task.status === 'testing' && onReview && (
            <button
              onClick={() => {
                setShowMenu(false);
                onReview();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-400 hover:bg-surface-700 transition-colors"
            >
              <CheckCircle size={11} />
              {t('card.reviewTask')}
            </button>
          )}
          <button
            onClick={() => {
              setShowMenu(false);
              onViewLogs();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
          >
            <Terminal size={11} />
            {t('card.viewLogs')}
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onEdit();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
          >
            <Pencil size={11} />
            {t('common.edit')}
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-surface-700 transition-colors"
          >
            <Trash2 size={11} />
            {t('common.delete')}
          </button>
        </div>
      )}
    </>
  );
}
