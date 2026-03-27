import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Square,
  RotateCcw,
  ArrowDown,
  Pause,
  Play,
  Trash2,
  Search,
  Cpu,
  Coins,
  Activity,
  Maximize2,
  Minimize2,
  Code,
  CheckCircle2,
} from 'lucide-react';
import { socket } from '../../lib/socket';
import { tauriListen, IS_TAURI } from '../../lib/tauriEvents';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

import { fmtTokens, groupToolEntries } from './terminalHelpers';
import { ToolCard } from './ToolCard';
import { ClaudeText } from './ClaudeText';
import { SystemLine } from './SystemLine';
import { TurnSeparator } from './TurnSeparator';
import { ActivityIndicator } from './ActivityIndicator';
import { ElapsedTime } from './ElapsedTime';

// ═══════════════════════════════════════════════════════════
// ─── Main component ───
// ═══════════════════════════════════════════════════════════
export default function LiveTerminal({ task, onClose, layout = 'side', onToggleLayout }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('all');
  const [paused, setPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedTools, setExpandedTools] = useState(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const containerRef = useRef(null);
  const pausedLogsRef = useRef([]);
  const searchInputRef = useRef(null);

  // ─── Data loading ───
  useEffect(() => {
    api
      .getTaskLogs(task.id)
      .then((data) => {
        setLogs(data.map((l) => ({ ...l, meta: l.meta || null })));
      })
      .catch((e) => console.error('Failed to load task logs:', e));
  }, [task.id]);

  useEffect(() => {
    const handler = (data) => {
      if (data.taskId !== task.id) return;
      const entry = {
        message: data.message,
        log_type: data.logType,
        created_at: data.created_at,
        meta: data.meta || null,
      };
      if (paused) {
        pausedLogsRef.current.push(entry);
      } else {
        setLogs((prev) => (prev.length > 2000 ? [...prev.slice(-1500), entry] : [...prev, entry]));
      }
    };
    if (IS_TAURI) {
      return tauriListen('task:log', handler);
    } else {
      socket.on('task:log', handler);
      return () => socket.off('task:log', handler);
    }
  }, [task.id, paused]);

  const resumeLogs = useCallback(() => {
    setPaused(false);
    setLogs((prev) => {
      const merged = [...prev, ...pausedLogsRef.current];
      return merged.length > 2000 ? merged.slice(-1500) : merged;
    });
    pausedLogsRef.current = [];
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  const handleStop = async () => {
    try {
      await api.stopTask(task.id);
    } catch {}
  };
  const handleRestart = async () => {
    try {
      setLogs([]);
      await api.restartTask(task.id);
    } catch {}
  };

  const toggleToolExpand = useCallback((index) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }, []);

  const toggleExpandAll = useCallback(() => {
    setExpandAll((prev) => {
      if (!prev) {
        const idxs = new Set();
        logs.forEach((l, i) => {
          if (l.log_type === 'tool' && l.meta) idxs.add(i);
        });
        setExpandedTools(idxs);
      } else {
        setExpandedTools(new Set());
      }
      return !prev;
    });
  }, [logs]);

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch]);

  // ─── Filtering ───
  const filteredLogs = useMemo(() => {
    let r = logs;
    if (filter === 'claude') r = r.filter((l) => l.log_type === 'claude');
    else if (filter === 'tools') r = r.filter((l) => l.log_type === 'tool' || l.log_type === 'tool_result');
    else if (filter === 'system') r = r.filter((l) => l.log_type === 'system' || l.log_type === 'info');
    else if (filter === 'errors') r = r.filter((l) => l.log_type === 'error');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((l) => l.message.toLowerCase().includes(q));
    }
    return r;
  }, [logs, filter, searchQuery]);

  // Group entries
  const groupedEntries = useMemo(() => groupToolEntries(filteredLogs), [filteredLogs]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const tools = logs.filter((l) => l.log_type === 'tool' && !l.meta?.isResult).length;
    const errors = logs.filter((l) => l.log_type === 'error').length;
    const turns = logs.filter((l) => l.log_type === 'claude').length;
    return { tools, errors, turns };
  }, [logs]);

  const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
  const isBottom = layout === 'bottom';
  const panelClass = isBottom
    ? 'relative flex flex-col bg-surface-900 border-t border-surface-800 h-full overflow-hidden'
    : 'relative w-full md:w-[540px] h-full flex-shrink-0 flex flex-col bg-surface-900 md:border-l border-surface-800 overflow-hidden';

  const FILTERS = [
    { id: 'all', label: 'All', count: null },
    { id: 'claude', label: 'Claude', count: stats.turns || null },
    { id: 'tools', label: 'Tools', count: stats.tools || null },
    { id: 'system', label: 'System', count: null },
    { id: 'errors', label: 'Errors', count: stats.errors || null, alert: stats.errors > 0 },
  ];

  return (
    <div className={panelClass}>
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-800 bg-surface-900">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold truncate text-surface-100">{task.title}</h3>
            <span className="text-[9px] text-surface-600 font-mono flex-shrink-0">
              {task.task_key || `#${task.id}`}
            </span>
            {task.is_running && (
              <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                <Activity size={9} className="animate-pulse" />
                <span className="hidden sm:inline">Running</span>
              </span>
            )}
            {!task.is_running && logs.some((l) => l.log_type === 'success') && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                <CheckCircle2 size={9} />
                <span className="hidden sm:inline">Done</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ActivityIndicator logs={logs} isRunning={task.is_running} />
            {/* Inline stats on mobile */}
            <div className="flex items-center gap-1.5 text-[10px] text-surface-500 sm:hidden">
              <ElapsedTime
                startedAt={task.started_at}
                isRunning={task.is_running}
                workDurationMs={task.work_duration_ms || 0}
                lastResumedAt={task.last_resumed_at}
              />
              {totalTokens > 0 && (
                <span className="flex items-center gap-0.5">
                  <Cpu size={9} />
                  {fmtTokens(totalTokens)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live stats bar - desktop only */}
        <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-surface-500 flex-shrink-0">
          <ElapsedTime
            startedAt={task.started_at}
            isRunning={task.is_running}
            workDurationMs={task.work_duration_ms || 0}
            lastResumedAt={task.last_resumed_at}
          />
          {totalTokens > 0 && (
            <span className="flex items-center gap-0.5">
              <Cpu size={9} />
              {fmtTokens(totalTokens)}
            </span>
          )}
          {task.total_cost > 0 && (
            <span className="flex items-center gap-0.5">
              <Coins size={9} />${task.total_cost.toFixed(4)}
            </span>
          )}
          {stats.tools > 0 && (
            <span className={`flex items-center gap-0.5 text-purple-400/60`}>
              <Code size={9} />
              {stats.tools}
            </span>
          )}
          {stats.errors > 0 && <span className="text-red-400/70">{stats.errors} err</span>}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => {
              setShowSearch((s) => !s);
              if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-surface-700 text-claude' : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800'}`}
            title="Search (Ctrl+F)"
          >
            <Search size={12} />
          </button>
          {onToggleLayout && (
            <button
              onClick={onToggleLayout}
              className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-200 transition-colors"
              title={isBottom ? 'Side panel' : 'Bottom panel'}
            >
              {isBottom ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          )}
          {task.is_running && (
            <button
              onClick={handleStop}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-colors"
              title="Stop"
            >
              <Square size={12} />
            </button>
          )}
          <button
            onClick={handleRestart}
            className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-amber-400 transition-colors"
            title="Restart"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 transition-colors"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ═══ Search ═══ */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-800 bg-surface-800/50">
          <Search size={11} className="text-surface-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="flex-1 bg-transparent text-xs text-surface-200 placeholder-surface-600 outline-none"
          />
          {searchQuery && <span className="text-[10px] text-surface-500">{filteredLogs.length} matches</span>}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="text-surface-500 hover:text-surface-300"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ═══ Filters ═══ */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-surface-800">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
              filter === f.id ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            {f.label}
            {f.count && <span className={`${f.alert ? 'text-red-400' : 'text-surface-600'}`}>{f.count}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggleExpandAll}
          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${expandAll ? 'text-purple-400 bg-purple-500/10' : 'text-surface-500 hover:text-surface-300'}`}
          title={expandAll ? 'Collapse all' : 'Expand all'}
        >
          {expandAll ? 'Collapse' : 'Expand'}
        </button>
        <button
          onClick={() => (paused ? resumeLogs() : setPaused(true))}
          className={`p-1 rounded transition-colors ${paused ? 'text-amber-400 bg-amber-500/10' : 'text-surface-500 hover:text-surface-300'}`}
          title={paused ? `Resume (${pausedLogsRef.current.length})` : 'Pause'}
        >
          {paused ? <Play size={10} /> : <Pause size={10} />}
        </button>
        {paused && pausedLogsRef.current.length > 0 && (
          <span className="text-[10px] text-amber-400">{pausedLogsRef.current.length}</span>
        )}
        <button
          onClick={() => setLogs([])}
          className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
          title="Clear"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* ═══ Content ═══ */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-xs leading-relaxed"
      >
        {groupedEntries.length === 0 ? (
          <div className="text-center text-surface-600 py-12">
            {task.is_running ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
                </div>
                <span className="text-surface-500">Waiting for Claude...</span>
              </div>
            ) : (
              <span>No output yet</span>
            )}
          </div>
        ) : (
          groupedEntries.map((entry, i) => {
            if (entry.type === 'turn_separator') {
              return <TurnSeparator key={`turn-${i}`} turn={entry.turn} time={entry.time} t={t} />;
            }

            if (entry.type === 'tool_group') {
              return (
                <ToolCard
                  key={`tool-${entry.index}`}
                  call={entry.call}
                  result={entry.result}
                  isExpanded={expandAll || expandedTools.has(entry.index)}
                  onToggle={() => toggleToolExpand(entry.index)}
                />
              );
            }

            // Regular log entries
            const log = entry.log;
            if (log.log_type === 'claude') {
              return <ClaudeText key={`log-${entry.index}`} message={log.message} time={log.created_at} />;
            }
            return <SystemLine key={`log-${entry.index}`} log={log} />;
          })
        )}
      </div>

      {/* ═══ Scroll button ═══ */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
          }}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-claude shadow-lg hover:bg-claude-light transition-colors z-10"
        >
          <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}
