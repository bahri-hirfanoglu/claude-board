import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Clock, Activity, Cpu, GitBranch, CheckCircle2, AlertCircle, ZoomIn, ZoomOut, ChevronDown, ChevronRight, Coins, Calendar, ArrowRight } from 'lucide-react';
import { formatTokens, formatDuration, formatTimeAgo } from '../../lib/formatters';
import { TYPE_COLORS, MODEL_COLORS, PRIORITY_LABELS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';

function parseDate(str) {
  if (!str) return null;
  return new Date(str);
}

const STATUS_STYLES = {
  backlog: { bg: '#94a3b8', gradFrom: '#94a3b8', gradTo: '#64748b', glow: 'rgba(148,163,184,0.15)', labelKey: 'status.backlog', icon: Clock, dotColor: '#94a3b8' },
  in_progress: { bg: '#f59e0b', gradFrom: '#fbbf24', gradTo: '#d97706', glow: 'rgba(245,158,11,0.25)', labelKey: 'status.in_progress', icon: Activity, dotColor: '#f59e0b' },
  testing: { bg: '#DA7756', gradFrom: '#DA7756', gradTo: '#c4624a', glow: 'rgba(218,119,86,0.25)', labelKey: 'status.testing', icon: Cpu, dotColor: '#DA7756' },
  done: { bg: '#34d399', gradFrom: '#6ee7b7', gradTo: '#059669', glow: 'rgba(52,211,153,0.25)', labelKey: 'status.done', icon: CheckCircle2, dotColor: '#34d399' },
};

const ZOOM_LEVELS = [
  { id: 'day', labelKey: 'timeline.day', minWidth: 80 },
  { id: 'week', labelKey: 'timeline.week', minWidth: 40 },
  { id: 'month', labelKey: 'timeline.month', minWidth: 16 },
];

export default function TimelineView({ tasks, onViewDetail }) {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [hoveredTask, setHoveredTask] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);
  const zoom = ZOOM_LEVELS[zoomIdx];

  const toggleGroup = useCallback((key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─── Compute timeline data ───
  const { groups, minDate, maxDate, totalDays } = useMemo(() => {
    const withDates = tasks
      .filter(t => t.started_at)
      .map(t => ({
        ...t,
        start: parseDate(t.started_at),
        end: parseDate(t.completed_at) || new Date(),
      }))
      .sort((a, b) => a.start - b.start);

    if (withDates.length === 0) return { groups: {}, minDate: null, maxDate: null, totalDays: 1 };

    const min = new Date(Math.min(...withDates.map(t => t.start)));
    const max = new Date(Math.max(...withDates.map(t => t.end)));
    // Add 1 day padding on each side
    min.setHours(0, 0, 0, 0);
    min.setDate(min.getDate() - 1);
    max.setHours(23, 59, 59, 999);
    max.setDate(max.getDate() + 1);
    const days = Math.max(1, Math.ceil((max - min) / 86400000));

    // Group by status maintaining order
    const statusOrder = ['in_progress', 'testing', 'backlog', 'done'];
    const grouped = {};
    for (const status of statusOrder) {
      const items = withDates.filter(t => t.status === status);
      if (items.length > 0) grouped[status] = items;
    }

    return { groups: grouped, minDate: min, maxDate: max, totalDays: days };
  }, [tasks]);

  // ─── Day markers ───
  const dayMarkers = useMemo(() => {
    if (!minDate) return [];
    const markers = [];
    const d = new Date(minDate);
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(d);
      date.setDate(date.getDate() + i);
      markers.push(date);
    }
    return markers;
  }, [minDate, totalDays]);

  // ─── Today ───
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayPct = minDate && maxDate
    ? Math.max(0, Math.min(100, ((today - minDate) / (maxDate - minDate || 1)) * 100))
    : null;

  const pendingTasks = tasks.filter(t => !t.started_at);

  // ─── Bar position calc ───
  const getBarStyle = useCallback((task) => {
    if (!minDate) return { left: '0%', width: '2%' };
    const totalMs = maxDate - minDate || 1;
    const startPct = ((task.start - minDate) / totalMs) * 100;
    const widthPct = Math.max(1.5, ((task.end - task.start) / totalMs) * 100);
    return { left: `${startPct}%`, width: `${widthPct}%` };
  }, [minDate, maxDate]);

  // ─── Grid width ───
  const gridWidth = useMemo(() => {
    return Math.max(600, totalDays * zoom.minWidth);
  }, [totalDays, zoom]);

  // ─── Tooltip handler ───
  const handleBarHover = useCallback((e, task) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTask(task);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, []);

  // ─── Empty state ───
  if (Object.keys(groups).length === 0 && pendingTasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-surface-500 gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-surface-800/50 flex items-center justify-center">
          <Clock size={28} className="text-surface-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-surface-400">No timeline data yet</p>
          <p className="text-xs text-surface-600 mt-1">Start a task to see it here</p>
        </div>
      </div>
    );
  }

  const LEFT_W = 240;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-surface-800/50">
        {/* Status legend */}
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {Object.entries(STATUS_STYLES).map(([status, s]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.dotColor }} />
              <span className="text-[10px] text-surface-500 font-medium">{t(s.labelKey)}</span>
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setZoomIdx(Math.max(0, zoomIdx - 1))}
            disabled={zoomIdx === 0}
            className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ZoomIn size={13} />
          </button>
          <span className="text-[10px] text-surface-400 font-medium px-1.5 min-w-[36px] text-center">{t(zoom.labelKey)}</span>
          <button
            onClick={() => setZoomIdx(Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1))}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ZoomOut size={13} />
          </button>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-surface-500">
          <span>{tasks.filter(t => t.started_at).length} tracked</span>
          <span className="text-surface-700">|</span>
          <span>{pendingTasks.length} pending</span>
        </div>
      </div>

      {/* ─── Timeline body ─── */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div style={{ minWidth: `${LEFT_W + gridWidth}px` }}>

          {/* ─── Time header ─── */}
          {minDate && (
            <div className="sticky top-0 z-20 bg-surface-950/95 backdrop-blur-sm border-b border-surface-800/50">
              <div className="flex">
                <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="flex-shrink-0" />
                <div className="flex-1 relative h-10">
                  {dayMarkers.map((d, i) => {
                    const totalMs = maxDate - minDate || 1;
                    const leftPct = ((d - minDate) / totalMs) * 100;
                    const isToday = d.toDateString() === today.toDateString();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const showLabel = zoom.id === 'day' ||
                      (zoom.id === 'week' && d.getDay() === 1) ||
                      (zoom.id === 'month' && d.getDate() === 1);

                    if (!showLabel && zoom.id !== 'day') return null;

                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
                        style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                      >
                        {(zoom.id === 'month' && d.getDate() === 1) && (
                          <span className="text-[9px] text-surface-500 font-semibold uppercase tracking-wider">
                            {d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                          </span>
                        )}
                        <span className={`text-[10px] whitespace-nowrap leading-none ${
                          isToday ? 'text-blue-400 font-bold' : isWeekend ? 'text-surface-600' : 'text-surface-500'
                        }`}>
                          {zoom.id === 'month'
                            ? d.getDate()
                            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {isToday && (
                          <span className="text-[8px] text-blue-400/80 font-medium">TODAY</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── Grouped rows ─── */}
          <div className="relative">
            {Object.entries(groups).map(([status, groupTasks]) => {
              const style = STATUS_STYLES[status];
              const Icon = style.icon;
              const isCollapsed = collapsedGroups[status];

              return (
                <div key={status}>
                  {/* Group header */}
                  <div
                    className="sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-surface-900/80 backdrop-blur-sm border-b border-surface-800/30 cursor-pointer hover:bg-surface-800/60 transition-colors"
                    onClick={() => toggleGroup(status)}
                  >
                    {isCollapsed ? <ChevronRight size={12} className="text-surface-500" /> : <ChevronDown size={12} className="text-surface-500" />}
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dotColor }} />
                    <span className="text-[11px] font-semibold text-surface-300">{t(style.labelKey)}</span>
                    <span className="text-[10px] text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded-full">{groupTasks.length}</span>
                  </div>

                  {/* Tasks */}
                  {!isCollapsed && groupTasks.map((task, idx) => {
                    const barStyle = getBarStyle(task);
                    const taskType = task.task_type || 'feature';
                    const duration = formatDuration(task.started_at, task.completed_at, task.work_duration_ms, task.last_resumed_at);
                    const modelDisplay = task.model_used || task.model || 'sonnet';
                    const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
                    const isEven = idx % 2 === 0;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center group cursor-pointer transition-colors ${
                          isEven ? 'bg-surface-900/20' : ''
                        } hover:bg-surface-800/40`}
                        onClick={() => onViewDetail?.(task)}
                      >
                        {/* ─── Left: task info panel ─── */}
                        <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="flex-shrink-0 px-3 py-2 border-r border-surface-800/30">
                          <div className="flex items-start gap-2">
                            {/* Status bar accent */}
                            <div className="w-0.5 h-8 rounded-full mt-0.5 flex-shrink-0 opacity-60" style={{ backgroundColor: style.bg }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[taskType]}`}>
                                  {taskType}
                                </span>
                                <span className={`text-[9px] font-medium ${MODEL_COLORS[modelDisplay] || 'text-surface-500'}`}>{modelDisplay}</span>
                                {task.priority > 0 && (
                                  <span className="text-[8px] text-surface-500">{PRIORITY_LABELS[task.priority]}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-surface-200 truncate font-medium group-hover:text-surface-50 transition-colors leading-tight">
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-surface-600 font-mono">{task.task_key || `#${task.id}`}</span>
                                {task.branch_name && (
                                  <span className="flex items-center gap-0.5 text-[9px] text-violet-400/50 truncate max-w-[100px]" title={task.branch_name}>
                                    <GitBranch size={8} />
                                    {task.branch_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ─── Right: bar area ─── */}
                        <div className="flex-1 relative h-12 overflow-hidden">
                          {/* Weekend shading */}
                          {dayMarkers.map((d, i) => {
                            if (d.getDay() !== 0 && d.getDay() !== 6) return null;
                            const totalMs = maxDate - minDate || 1;
                            const leftPct = ((d - minDate) / totalMs) * 100;
                            const dayPct = (86400000 / totalMs) * 100;
                            return (
                              <div
                                key={`w${i}`}
                                className="absolute top-0 bottom-0 bg-surface-800/15"
                                style={{ left: `${leftPct}%`, width: `${dayPct}%` }}
                              />
                            );
                          })}

                          {/* Grid lines */}
                          {dayMarkers.map((d, i) => {
                            const totalMs = maxDate - minDate || 1;
                            const leftPct = ((d - minDate) / totalMs) * 100;
                            const showLine = zoom.id === 'day' ||
                              (zoom.id === 'week' && d.getDay() === 1) ||
                              (zoom.id === 'month' && d.getDate() === 1);
                            if (!showLine && zoom.id !== 'day') return null;
                            return <div key={i} className="absolute top-0 bottom-0 w-px bg-surface-700/20" style={{ left: `${leftPct}%` }} />;
                          })}

                          {/* Today line */}
                          {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
                            <div className="absolute top-0 bottom-0 z-10" style={{ left: `${todayPct}%` }}>
                              <div className="w-px h-full bg-blue-400/40" />
                            </div>
                          )}

                          {/* ─── Task bar ─── */}
                          <div
                            className="absolute top-2 bottom-2 group/bar"
                            style={barStyle}
                            onMouseEnter={(e) => handleBarHover(e, task)}
                            onMouseLeave={() => setHoveredTask(null)}
                          >
                            {/* Glow effect on hover */}
                            <div
                              className="absolute inset-0 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity duration-300 blur-md"
                              style={{ backgroundColor: style.glow }}
                            />
                            {/* Main bar */}
                            <div
                              className="relative h-full rounded-lg shadow-sm border border-white/[0.08] group-hover/bar:border-white/[0.15] group-hover/bar:shadow-lg transition-all duration-200 flex items-center gap-1.5 px-2 overflow-hidden"
                              style={{ background: `linear-gradient(to right, ${style.gradFrom}, ${style.gradTo})` }}
                            >
                              {/* Running pulse */}
                              {task.is_running && (
                                <div className="absolute inset-0 rounded-lg overflow-hidden">
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer-wave_2s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                                </div>
                              )}
                              {/* Content */}
                              {task.is_running && <Activity size={10} className="text-white/90 animate-pulse flex-shrink-0 relative z-[1]" />}
                              {task.status === 'done' && <CheckCircle2 size={10} className="text-white/90 flex-shrink-0 relative z-[1]" />}
                              {duration && (
                                <span className="text-[9px] font-bold text-white/90 truncate relative z-[1] drop-shadow-sm">
                                  {duration}
                                </span>
                              )}
                              {totalTokens > 0 && (
                                <span className="text-[9px] text-white/60 truncate hidden sm:inline relative z-[1]">
                                  {formatTokens(totalTokens)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ─── Pending tasks ─── */}
          {pendingTasks.length > 0 && (
            <div className="px-4 py-4 border-t border-surface-800/50">
              <div
                className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => toggleGroup('pending')}
              >
                {collapsedGroups.pending ? <ChevronRight size={13} className="text-surface-500" /> : <ChevronDown size={13} className="text-surface-500" />}
                <AlertCircle size={13} className="text-surface-500" />
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                  Pending
                </span>
                <span className="text-[10px] text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded-full">{pendingTasks.length}</span>
              </div>

              {!collapsedGroups.pending && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {pendingTasks.map(task => {
                    const taskType = task.task_type || 'feature';
                    const modelDisplay = task.model_used || task.model || 'sonnet';
                    return (
                      <div
                        key={task.id}
                        className="group flex items-start gap-3 px-3 py-2.5 bg-surface-800/20 hover:bg-surface-800/50 border border-surface-800/30 hover:border-surface-700/50 rounded-xl cursor-pointer transition-all duration-200"
                        onClick={() => onViewDetail?.(task)}
                      >
                        <div className="w-1 self-stretch rounded-full bg-surface-700 group-hover:bg-surface-500 transition-colors flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[taskType]}`}>
                              {taskType}
                            </span>
                            <span className={`text-[9px] ${MODEL_COLORS[modelDisplay] || 'text-surface-500'}`}>{modelDisplay}</span>
                            {task.priority > 0 && (
                              <span className="text-[8px] text-surface-500">{PRIORITY_LABELS[task.priority]}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-surface-300 group-hover:text-surface-100 truncate font-medium transition-colors">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-surface-600 font-mono">{task.task_key || `#${task.id}`}</span>
                            {task.created_at && (
                              <span className="text-[9px] text-surface-600 flex items-center gap-0.5">
                                <Calendar size={8} />
                                {formatTimeAgo(task.created_at)}
                              </span>
                            )}
                            {task.branch_name && (
                              <span className="flex items-center gap-0.5 text-[9px] text-violet-400/40 truncate max-w-[80px]" title={task.branch_name}>
                                <GitBranch size={8} />
                                {task.branch_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-surface-700 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Floating tooltip ─── */}
      {hoveredTask && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none animate-[fade-in_0.15s_ease-out]"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl shadow-black/40 px-3.5 py-2.5 max-w-[280px]">
            <p className="text-[11px] text-surface-100 font-semibold mb-1.5 truncate">{hoveredTask.title}</p>
            <div className="flex items-center gap-3 text-[10px]">
              {hoveredTask.started_at && (
                <span className="text-surface-400">
                  {new Date(hoveredTask.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {hoveredTask.completed_at && (
                <>
                  <ArrowRight size={9} className="text-surface-600" />
                  <span className="text-surface-400">
                    {new Date(hoveredTask.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-surface-700/50 text-[10px] text-surface-500">
              {formatDuration(hoveredTask.started_at, hoveredTask.completed_at, hoveredTask.work_duration_ms, hoveredTask.last_resumed_at) && (
                <span className="flex items-center gap-1">
                  <Clock size={9} />
                  {formatDuration(hoveredTask.started_at, hoveredTask.completed_at, hoveredTask.work_duration_ms, hoveredTask.last_resumed_at)}
                </span>
              )}
              {(hoveredTask.input_tokens || 0) + (hoveredTask.output_tokens || 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Cpu size={9} />
                  {formatTokens((hoveredTask.input_tokens || 0) + (hoveredTask.output_tokens || 0))}
                </span>
              )}
              {hoveredTask.total_cost > 0 && (
                <span className="flex items-center gap-1">
                  <Coins size={9} />
                  ${hoveredTask.total_cost.toFixed(4)}
                </span>
              )}
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full">
              <div className="w-2 h-2 rotate-45 bg-surface-800 border-r border-b border-surface-700 -mt-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
