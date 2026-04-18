import { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, Columns3, Rows3, Pause, Play, Trash2, ArrowDown, Activity } from 'lucide-react';
import { socket } from '../../lib/socket';
import { tauriListen, IS_TAURI } from '../../lib/tauriEvents';
import { TYPE_COLORS } from '../../lib/constants';

const MAX_LOGS = 3000;
const TRIM_TO = Math.floor(MAX_LOGS * 0.7);

const LOG_COLORS = {
  error: 'text-red-400',
  success: 'text-emerald-400',
  info: 'text-surface-400',
  claude: 'text-surface-300',
  tool: 'text-purple-400',
  tool_result: 'text-purple-300/70',
  system: 'text-surface-500',
};

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function LogLine({ entry, showTaskBadge = true }) {
  const colorClass = LOG_COLORS[entry.log_type] || 'text-surface-400';
  const typeColor = entry.task ? TYPE_COLORS[entry.task.task_type] || TYPE_COLORS.chore : TYPE_COLORS.chore;
  const taskKey = entry.task?.task_key || (entry.task ? `#${entry.task.id}` : `#${entry.taskId}`);

  return (
    <div className="flex items-start gap-2 px-2 py-0.5 font-mono text-[11px] hover:bg-surface-800/30">
      <span className="text-surface-600 flex-shrink-0 w-16">{formatTime(entry.created_at)}</span>
      {showTaskBadge && (
        <span
          className={`px-1.5 py-0 rounded text-[10px] font-semibold flex-shrink-0 font-mono ${typeColor}`}
          title={entry.task?.title}
        >
          {taskKey}
        </span>
      )}
      {entry.log_type === 'tool' && entry.meta?.toolName ? (
        <span className="flex-1 break-words">
          <span className="text-purple-300 font-semibold">{entry.meta.toolName}</span>
          {entry.message ? <span className="text-surface-500"> · {entry.message}</span> : null}
        </span>
      ) : (
        <span className={`flex-1 whitespace-pre-wrap break-words ${colorClass}`}>{entry.message}</span>
      )}
    </div>
  );
}

function TaskPane({ task, logs }) {
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const typeColor = TYPE_COLORS[task.task_type] || TYPE_COLORS.chore;

  return (
    <div className="flex flex-col border border-surface-700/50 rounded-lg bg-surface-900/60 overflow-hidden min-h-0">
      <div className="flex items-center gap-2 px-2 py-1 bg-surface-800/60 border-b border-surface-700/50 flex-shrink-0">
        <span className={`px-1.5 py-0 rounded text-[9px] font-semibold font-mono flex-shrink-0 ${typeColor}`}>
          {task.task_key || `#${task.id}`}
        </span>
        <span className="text-[11px] text-surface-200 truncate flex-1" title={task.title}>
          {task.title}
        </span>
        {task.is_running && (
          <span className="flex items-center gap-0.5 text-[9px] text-amber-400 flex-shrink-0">
            <Activity size={8} className="animate-pulse" /> running
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        onScroll={() => {
          if (!containerRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
          setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
        }}
        className="flex-1 min-h-0 overflow-y-auto text-[10px] leading-relaxed py-1"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-surface-600 text-[10px]">waiting…</div>
        ) : (
          logs.map((e, i) => <LogLine key={i} entry={e} showTaskBadge={false} />)
        )}
      </div>
    </div>
  );
}

function gridColsFor(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

export default function ProjectTerminal({ tasks }) {
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState('unified'); // 'unified' | 'split'
  const [activeOnly, setActiveOnly] = useState(true);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef(null);
  const pausedRef = useRef([]);
  const pausedFlagRef = useRef(false);
  const tasksByIdRef = useRef({});

  // Keep the lookup fresh without re-subscribing to the event bus on every task update —
  // re-subscribing drops events between cleanup and the new listener.
  useEffect(() => {
    const m = {};
    for (const task of tasks || []) m[task.id] = task;
    tasksByIdRef.current = m;
  }, [tasks]);

  useEffect(() => {
    pausedFlagRef.current = paused;
  }, [paused]);

  const visibleTasks = useMemo(() => {
    const list = tasks || [];
    if (!activeOnly) return list;
    return list.filter(
      (t) => t.is_running || t.status === 'in_progress' || t.status === 'review' || t.status === 'verifying',
    );
  }, [tasks, activeOnly]);

  const visibleTaskIds = useMemo(() => new Set(visibleTasks.map((t) => t.id)), [visibleTasks]);

  useEffect(() => {
    const handler = (data) => {
      const task = tasksByIdRef.current[data.taskId];
      if (!task) return; // not a task of this project
      const entry = {
        taskId: data.taskId,
        task,
        message: data.message || '',
        log_type: data.logType,
        created_at: data.created_at || new Date().toISOString(),
        meta: data.meta || null,
      };
      if (pausedFlagRef.current) {
        pausedRef.current.push(entry);
      } else {
        setLogs((prev) => (prev.length >= MAX_LOGS ? [...prev.slice(-TRIM_TO), entry] : [...prev, entry]));
      }
    };
    if (IS_TAURI) {
      return tauriListen('task:log', handler);
    }
    socket.on('task:log', handler);
    return () => socket.off('task:log', handler);
  }, []);

  const resume = () => {
    setPaused(false);
    setLogs((prev) => {
      const merged = [...prev, ...pausedRef.current];
      return merged.length > MAX_LOGS ? merged.slice(-TRIM_TO) : merged;
    });
    pausedRef.current = [];
  };

  const filteredLogs = useMemo(() => {
    if (!activeOnly) return logs;
    return logs.filter((l) => visibleTaskIds.has(l.taskId));
  }, [logs, activeOnly, visibleTaskIds]);

  useEffect(() => {
    if (autoScroll && containerRef.current && mode === 'unified') {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, mode]);

  const onScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  const clearLogs = () => {
    setLogs([]);
    pausedRef.current = [];
  };

  const logsByTask = useMemo(() => {
    const byId = {};
    for (const task of visibleTasks) byId[task.id] = [];
    for (const l of logs) {
      if (byId[l.taskId]) byId[l.taskId].push(l);
    }
    return byId;
  }, [logs, visibleTasks]);

  return (
    <div className="flex flex-col h-full bg-surface-950">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <TerminalIcon size={14} className="text-claude flex-shrink-0" />
        <h2 className="text-sm font-semibold text-surface-100">Terminal</h2>
        <span className="text-[10px] text-surface-500">
          {visibleTasks.length} active · {filteredLogs.length} line{filteredLogs.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center bg-surface-800 rounded p-0.5 mr-1">
          <button
            onClick={() => setMode('unified')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${mode === 'unified' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
            title="Unified view"
          >
            <Rows3 size={10} /> Unified
          </button>
          <button
            onClick={() => setMode('split')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${mode === 'split' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
            title="Split each task into its own pane"
          >
            <Columns3 size={10} /> Split
          </button>
        </div>

        <button
          onClick={() => setActiveOnly((v) => !v)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${activeOnly ? 'bg-amber-500/15 text-amber-400' : 'text-surface-500 hover:text-surface-300'}`}
          title={activeOnly ? 'Showing only running tasks' : 'Showing all tasks in project'}
        >
          {activeOnly ? 'Active only' : 'All tasks'}
        </button>

        <button
          onClick={() => (paused ? resume() : setPaused(true))}
          className={`p-1 rounded transition-colors ${paused ? 'text-amber-400 bg-amber-500/10' : 'text-surface-500 hover:text-surface-300'}`}
          title={paused ? `Resume (${pausedRef.current.length} queued)` : 'Pause stream'}
        >
          {paused ? <Play size={10} /> : <Pause size={10} />}
        </button>
        <button
          onClick={clearLogs}
          className="p-1 text-surface-500 hover:text-surface-300 transition-colors"
          title="Clear logs"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Body */}
      {mode === 'unified' ? (
        <div ref={containerRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto relative">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-surface-600 text-xs gap-2 px-4 text-center">
              {visibleTasks.length === 0 ? (
                <>
                  <Activity size={20} className="opacity-40" />
                  <span>No active tasks in this project.</span>
                  <span className="text-[10px] text-surface-700">
                    {activeOnly
                      ? 'Start a task from the board — or toggle "All tasks" to show logs from every task.'
                      : 'This project has no tasks yet.'}
                  </span>
                </>
              ) : (
                <span>
                  Waiting for log output from {visibleTasks.length} active task
                  {visibleTasks.length === 1 ? '' : 's'}…
                </span>
              )}
            </div>
          ) : (
            <div className="py-1">
              {filteredLogs.map((entry, i) => (
                <LogLine key={i} entry={entry} />
              ))}
            </div>
          )}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
              }}
              className="absolute bottom-3 right-3 p-1.5 rounded-full bg-claude shadow-lg hover:bg-claude-light"
              title="Scroll to bottom"
            >
              <ArrowDown size={12} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden p-2">
          {visibleTasks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-surface-600 text-xs">
              No active tasks to split
            </div>
          ) : (
            <div className={`grid gap-2 h-full auto-rows-fr ${gridColsFor(visibleTasks.length)}`}>
              {visibleTasks.map((task) => (
                <TaskPane key={task.id} task={task} logs={logsByTask[task.id] || []} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
