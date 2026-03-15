import { useMemo } from 'react';
import { Clock, Activity, Cpu, Coins } from 'lucide-react';
import { formatTokens, formatDuration } from '../../lib/formatters';
import { TYPE_COLORS, PRIORITY_LABELS, MODEL_COLORS } from '../../lib/constants';

function parseDate(str) {
  if (!str) return null;
  return new Date(str);
}

export default function TimelineView({ tasks, onViewDetail }) {
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
    for (let i = 0; i <= totalDays; i++) {
      markers.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return markers;
  }, [minDate, totalDays]);

  const pendingTasks = tasks.filter(t => !t.started_at);

  if (timelineTasks.length === 0 && pendingTasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-surface-500 text-sm">
        No tasks to display on timeline
      </div>
    );
  }

  const getBarStyle = (task) => {
    if (!minDate) return { left: '0%', width: '2%' };
    const totalMs = maxDate - minDate || 1;
    const startPct = ((task.start - minDate) / totalMs) * 100;
    const widthPct = Math.max(1, ((task.end - task.start) / totalMs) * 100);
    return { left: `${startPct}%`, width: `${widthPct}%` };
  };

  const statusColor = {
    backlog: 'bg-surface-500',
    in_progress: 'bg-amber-500',
    testing: 'bg-claude',
    done: 'bg-emerald-500',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        {/* Day headers */}
        {minDate && (
          <div className="relative h-8 mb-2 ml-[200px]">
            {dayMarkers.map((d, i) => {
              const totalMs = maxDate - minDate || 1;
              const leftPct = ((d - minDate) / totalMs) * 100;
              return (
                <div
                  key={i}
                  className="absolute text-[10px] text-surface-500 whitespace-nowrap"
                  style={{ left: `${leftPct}%` }}
                >
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline rows */}
        <div className="space-y-1.5">
          {timelineTasks.map(task => {
            const barStyle = getBarStyle(task);
            const taskType = task.task_type || 'feature';
            const duration = formatDuration(task.started_at, task.completed_at);
            const modelDisplay = task.model_used || task.model || 'sonnet';

            return (
              <div
                key={task.id}
                className="flex items-center gap-3 group cursor-pointer hover:bg-surface-800/50 rounded-lg px-2 py-1.5 transition-colors"
                onClick={() => onViewDetail?.(task)}
              >
                {/* Task label */}
                <div className="w-[188px] flex-shrink-0 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${TYPE_COLORS[taskType]}`}>
                      {taskType}
                    </span>
                    <span className="text-[10px] text-surface-600">#{task.id}</span>
                  </div>
                  <p className="text-xs text-surface-200 truncate">{task.title}</p>
                </div>

                {/* Bar area */}
                <div className="flex-1 relative h-7 bg-surface-800/30 rounded overflow-hidden">
                  {/* Grid lines */}
                  {dayMarkers.map((d, i) => {
                    const totalMs = maxDate - minDate || 1;
                    const leftPct = ((d - minDate) / totalMs) * 100;
                    return <div key={i} className="absolute top-0 bottom-0 w-px bg-surface-800/60" style={{ left: `${leftPct}%` }} />;
                  })}

                  {/* Task bar */}
                  <div
                    className={`absolute top-1 bottom-1 rounded ${statusColor[task.status]} opacity-80 group-hover:opacity-100 transition-opacity flex items-center px-2 overflow-hidden`}
                    style={barStyle}
                  >
                    <span className="text-[10px] text-white font-medium truncate">
                      {duration || ''}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="w-[120px] flex-shrink-0 flex items-center gap-2 text-[10px] text-surface-500">
                  {task.is_running && <Activity size={10} className="text-amber-400 animate-pulse" />}
                  <span className={`${MODEL_COLORS[modelDisplay] || 'text-surface-400'}`}>{modelDisplay}</span>
                  {(task.input_tokens || 0) + (task.output_tokens || 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Cpu size={8} />
                      {formatTokens((task.input_tokens || 0) + (task.output_tokens || 0))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending tasks (no start date) */}
        {pendingTasks.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-medium text-surface-500 mb-2 flex items-center gap-1.5">
              <Clock size={12} />
              Pending ({pendingTasks.length})
            </div>
            <div className="space-y-1">
              {pendingTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-2 py-1.5 hover:bg-surface-800/50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => onViewDetail?.(task)}
                >
                  <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${TYPE_COLORS[task.task_type || 'feature']}`}>
                    {task.task_type || 'feature'}
                  </span>
                  <span className="text-xs text-surface-300 truncate">{task.title}</span>
                  <span className="text-[10px] text-surface-600 ml-auto">#{task.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
