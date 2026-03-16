import { useMemo, useRef } from 'react';
import { Clock, Activity, Cpu, GitBranch, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatTokens, formatDuration } from '../../lib/formatters';
import { TYPE_COLORS, MODEL_COLORS } from '../../lib/constants';

function parseDate(str) {
  if (!str) return null;
  return new Date(str);
}

const STATUS_BAR = {
  backlog: { bg: 'bg-surface-500', gradient: 'from-surface-500 to-surface-600', text: 'text-surface-200', ring: 'ring-surface-500/30' },
  in_progress: { bg: 'bg-amber-500', gradient: 'from-amber-500 to-amber-600', text: 'text-amber-50', ring: 'ring-amber-500/30' },
  testing: { bg: 'bg-claude', gradient: 'from-claude to-claude-dark', text: 'text-orange-50', ring: 'ring-claude/30' },
  done: { bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-600', text: 'text-emerald-50', ring: 'ring-emerald-500/30' },
};

const STATUS_LABELS = { backlog: 'Backlog', in_progress: 'In Progress', testing: 'Testing', done: 'Done' };

export default function TimelineView({ tasks, onViewDetail }) {
  const scrollRef = useRef(null);

  const { timelineTasks, minDate, maxDate, totalDays } = useMemo(() => {
    const withDates = tasks
      .filter(t => t.started_at)
      .map(t => ({
        ...t,
        start: parseDate(t.started_at),
        end: parseDate(t.completed_at) || new Date(),
      }))
      .sort((a, b) => a.start - b.start);

    if (withDates.length === 0) return { timelineTasks: [], minDate: null, maxDate: null, totalDays: 1 };

    const min = new Date(Math.min(...withDates.map(t => t.start)));
    const max = new Date(Math.max(...withDates.map(t => t.end)));
    min.setHours(0, 0, 0, 0);
    max.setHours(23, 59, 59, 999);
    const days = Math.max(1, Math.ceil((max - min) / 86400000));

    return { timelineTasks: withDates, minDate: min, maxDate: max, totalDays: days };
  }, [tasks]);

  const dayMarkers = useMemo(() => {
    if (!minDate) return [];
    const markers = [];
    const d = new Date(minDate);
    // Show fewer markers if many days
    const step = totalDays > 21 ? 3 : totalDays > 10 ? 2 : 1;
    for (let i = 0; i <= totalDays; i += step) {
      const date = new Date(d);
      date.setDate(date.getDate() + i);
      markers.push(date);
    }
    return markers;
  }, [minDate, totalDays]);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayPct = minDate && maxDate
    ? Math.max(0, Math.min(100, ((today - minDate) / (maxDate - minDate || 1)) * 100))
    : null;

  const pendingTasks = tasks.filter(t => !t.started_at);

  if (timelineTasks.length === 0 && pendingTasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-surface-500 gap-3">
        <Clock size={32} className="text-surface-700" />
        <p className="text-sm">No tasks to display on timeline</p>
        <p className="text-xs text-surface-600">Start a task to see it here</p>
      </div>
    );
  }

  const getBarStyle = (task) => {
    if (!minDate) return { left: '0%', width: '2%' };
    const totalMs = maxDate - minDate || 1;
    const startPct = ((task.start - minDate) / totalMs) * 100;
    const widthPct = Math.max(2, ((task.end - task.start) / totalMs) * 100);
    return { left: `${startPct}%`, width: `${widthPct}%` };
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-2">
        {Object.entries(STATUS_BAR).map(([status, style]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${style.bg}`} />
            <span className="text-[10px] text-surface-500">{STATUS_LABELS[status]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-px h-3 bg-blue-400" />
          <span className="text-[10px] text-surface-500">Today</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div className="min-w-[600px] px-4 pb-4">
          {/* Day headers */}
          {minDate && (
            <div className="relative h-7 mb-1 ml-[180px] sm:ml-[220px]">
              {dayMarkers.map((d, i) => {
                const totalMs = maxDate - minDate || 1;
                const leftPct = ((d - minDate) / totalMs) * 100;
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <div
                    key={i}
                    className={`absolute text-[10px] whitespace-nowrap ${isToday ? 'text-blue-400 font-semibold' : 'text-surface-600'}`}
                    style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                  >
                    {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeline rows */}
          <div className="space-y-1">
            {timelineTasks.map(task => {
              const barStyle = getBarStyle(task);
              const taskType = task.task_type || 'feature';
              const duration = formatDuration(task.started_at, task.completed_at, task.work_duration_ms, task.last_resumed_at);
              const modelDisplay = task.model_used || task.model || 'sonnet';
              const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
              const style = STATUS_BAR[task.status] || STATUS_BAR.backlog;

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 group cursor-pointer hover:bg-surface-800/40 rounded-lg px-2 py-1 transition-colors"
                  onClick={() => onViewDetail?.(task)}
                >
                  {/* Task label */}
                  <div className="w-[164px] sm:w-[204px] flex-shrink-0 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${TYPE_COLORS[taskType]}`}>
                        {taskType}
                      </span>
                      <p className="text-[11px] text-surface-200 truncate font-medium group-hover:text-surface-100 transition-colors">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-surface-600">#{task.id}</span>
                      <span className={`text-[9px] ${MODEL_COLORS[modelDisplay] || 'text-surface-500'}`}>{modelDisplay}</span>
                      {task.branch_name && (
                        <span className="flex items-center gap-0.5 text-[9px] text-violet-400/50 truncate max-w-[80px]">
                          <GitBranch size={8} />
                          {task.branch_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative h-8 rounded-md overflow-hidden bg-surface-800/20">
                    {/* Grid lines */}
                    {dayMarkers.map((d, i) => {
                      const totalMs = maxDate - minDate || 1;
                      const leftPct = ((d - minDate) / totalMs) * 100;
                      return <div key={i} className="absolute top-0 bottom-0 w-px bg-surface-700/30" style={{ left: `${leftPct}%` }} />;
                    })}

                    {/* Today line */}
                    {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute top-0 bottom-0 w-px bg-blue-400/50 z-10" style={{ left: `${todayPct}%` }} />
                    )}

                    {/* Task bar */}
                    <div
                      className={`absolute top-1 bottom-1 rounded-md bg-gradient-to-r ${style.gradient} shadow-sm ring-1 ${style.ring} group-hover:shadow-md group-hover:brightness-110 transition-all flex items-center gap-1.5 px-2 overflow-hidden`}
                      style={barStyle}
                    >
                      {task.is_running && <Activity size={9} className="text-white/80 animate-pulse flex-shrink-0" />}
                      {task.status === 'done' && <CheckCircle2 size={9} className="text-white/80 flex-shrink-0" />}
                      {duration && (
                        <span className={`text-[9px] font-semibold ${style.text} truncate`}>
                          {duration}
                        </span>
                      )}
                      {totalTokens > 0 && (
                        <span className={`text-[9px] ${style.text} opacity-70 truncate hidden sm:inline`}>
                          {formatTokens(totalTokens)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pending tasks */}
          {pendingTasks.length > 0 && (
            <div className="mt-6 pt-4 border-t border-surface-800/50">
              <div className="text-[11px] font-semibold text-surface-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle size={12} />
                Pending — {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {pendingTasks.map(task => {
                  const taskType = task.task_type || 'feature';
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 px-3 py-2 bg-surface-800/30 hover:bg-surface-800/60 rounded-lg cursor-pointer transition-colors group"
                      onClick={() => onViewDetail?.(task)}
                    >
                      <div className="w-1 h-6 rounded-full bg-surface-600 group-hover:bg-surface-500 transition-colors" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${TYPE_COLORS[taskType]}`}>
                            {taskType}
                          </span>
                          <span className="text-[11px] text-surface-300 truncate font-medium">{task.title}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-surface-600 flex-shrink-0">#{task.id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
