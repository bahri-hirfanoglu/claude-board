import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, Square, RotateCcw, ArrowDown, Pause, Play, Trash2,
  ChevronDown, ChevronRight, Search, FileText, Terminal,
  Cpu, Coins, Activity, Maximize2, Minimize2,
  FolderOpen, Code, Eye, Pencil, Zap, Globe, Hash,
  GitBranch, AlertTriangle, CheckCircle2, Timer, Layers
} from 'lucide-react';
import { socket } from '../../lib/socket';
import { tauriListen, IS_TAURI } from '../../lib/tauriEvents';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

// ─── Tool icon registry ───
const TOOL_ICONS = {
  Read: Eye, Write: FileText, Edit: Pencil, Bash: Terminal,
  Grep: Search, Glob: FolderOpen, WebFetch: Globe, WebSearch: Globe,
  Agent: Zap, Notebook: Code, Task: Layers, TodoWrite: GitBranch,
};
function getToolIcon(name) {
  if (!name) return Code;
  for (const [k, I] of Object.entries(TOOL_ICONS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return I;
  }
  return Code;
}

// ─── Tool-specific color ───
const TOOL_COLORS = {
  Read: 'text-sky-400', Write: 'text-emerald-400', Edit: 'text-yellow-400',
  Bash: 'text-amber-400', Grep: 'text-cyan-400', Glob: 'text-teal-400',
  WebFetch: 'text-blue-400', WebSearch: 'text-blue-400', Agent: 'text-violet-400',
};
function getToolColor(name) {
  if (!name) return 'text-purple-400';
  for (const [k, c] of Object.entries(TOOL_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return c;
  }
  return 'text-purple-400';
}

// ─── Helpers ───
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtMs(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function basename(p) {
  if (!p) return null;
  return p.replace(/\\/g, '/').split('/').pop();
}
function shortenPath(p) {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return parts.join('/');
  return '…/' + parts.slice(-3).join('/');
}

// ─── Grouped tool call + result into a single card ───
function groupToolEntries(logs) {
  const entries = [];
  let turnNumber = 0;
  let lastType = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Insert turn separator when Claude speaks after tool results
    if (log.log_type === 'claude' && lastType && lastType !== 'claude' && lastType !== 'system' && lastType !== 'info') {
      turnNumber++;
      entries.push({ type: 'turn_separator', turn: turnNumber, time: log.created_at });
    }

    if (log.log_type === 'tool' && log.meta && !log.meta.isResult) {
      // Look ahead for matching result
      const toolId = log.meta.toolId;
      let result = null;
      if (toolId) {
        for (let j = i + 1; j < logs.length && j < i + 20; j++) {
          if (logs[j].log_type === 'tool_result' && logs[j].meta?.toolId === toolId) {
            result = logs[j];
            break;
          }
        }
      }
      entries.push({ type: 'tool_group', call: log, result, index: i });
    } else if (log.log_type === 'tool_result' && log.meta) {
      // Skip if already consumed by a group
      const toolId = log.meta.toolId;
      const alreadyGrouped = entries.some(e => e.type === 'tool_group' && e.result?.meta?.toolId === toolId);
      if (!alreadyGrouped) {
        entries.push({ type: 'tool_group', call: null, result: log, index: i });
      }
    } else {
      entries.push({ type: 'log', log, index: i });
    }

    lastType = log.log_type;
  }
  return entries;
}

// ─── Turn separator ───
function TurnSeparator({ turn, time, t }) {
  return (
    <div className="flex items-center gap-2 my-3 select-none">
      <div className="flex-1 border-t border-surface-700/50" />
      <span className="text-[11px] text-surface-500 flex items-center gap-1.5 font-medium">
        <Hash size={10} />
        {t('terminal.turn')} {turn}
        {time && <span className="text-surface-600 font-normal">{fmtTime(time)}</span>}
      </span>
      <div className="flex-1 border-t border-surface-700/50" />
    </div>
  );
}

// ─── Unified tool card ───
function ToolCard({ call, result, isExpanded, onToggle }) {
  const meta = call?.meta || result?.meta || {};
  const toolName = meta.toolName || 'unknown';
  const Icon = getToolIcon(toolName);
  const color = getToolColor(toolName);
  const input = call?.meta?.input || {};
  const resMeta = result?.meta || {};
  const isError = resMeta.isError;
  const duration = resMeta.duration;
  const hasResult = !!result;

  // Status indicator
  let statusEl = null;
  if (!hasResult) {
    statusEl = <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Running" />;
  } else if (isError) {
    statusEl = <AlertTriangle size={11} className="text-red-400" />;
  } else {
    statusEl = <CheckCircle2 size={11} className="text-emerald-500/70" />;
  }

  // Compact summary line
  let summary = '';
  if (input.file) summary = shortenPath(input.file);
  else if (input.command) summary = input.command;
  else if (input.pattern) summary = input.pattern;
  else if (input.description) summary = input.description;
  else if (input.prompt) summary = input.prompt;
  else if (input.query) summary = input.query;

  return (
    <div className={`my-1 rounded-lg border transition-colors ${
      isError ? 'border-red-500/20 bg-red-500/5' :
      !hasResult ? 'border-amber-500/20 bg-amber-500/5' :
      'border-surface-700/30 bg-surface-800/30 hover:border-surface-700/60'
    }`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs"
      >
        <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none">
          {fmtTime(call?.created_at || result?.created_at)}
        </span>
        {statusEl}
        <Icon size={14} className={`${color} flex-shrink-0`} />
        <span className={`font-semibold ${color}`}>{toolName}</span>

        {summary && (
          <span className="text-surface-400 truncate text-[11px] min-w-0 flex-1">{summary}</span>
        )}

        <span className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {duration && (
            <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
              <Timer size={9} />
              {fmtMs(duration)}
            </span>
          )}
          {isExpanded ? <ChevronDown size={12} className="text-surface-600" /> : <ChevronRight size={12} className="text-surface-600" />}
        </span>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-1 text-[11px] space-y-2 border-t border-surface-700/20">
          {/* Input details */}
          {call && (
            <div className="space-y-1">
              {input.file && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">path</span>
                  <span className="text-surface-300 font-mono break-all">{input.file}</span>
                </div>
              )}
              {input.command && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">cmd</span>
                  <code className="text-amber-400/80 font-mono break-all">{input.command}</code>
                </div>
              )}
              {input.pattern && !input.file && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">grep</span>
                  <code className="text-cyan-400/80 font-mono">{input.pattern}</code>
                  {input.glob && <span className="text-surface-500 ml-1">in {input.glob}</span>}
                </div>
              )}
              {input.editing && (
                <div className="mt-1 rounded-md bg-surface-900/80 border border-surface-700/30 overflow-hidden">
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] text-red-400/70 border-b border-surface-700/30 bg-red-500/5">
                    <span>-</span>
                    <span className="font-mono truncate">{input.oldString}</span>
                  </div>
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400/70 bg-emerald-500/5">
                    <span>+</span>
                    <span className="font-mono truncate">{input.newString}</span>
                  </div>
                </div>
              )}
              {input.contentLength && !input.editing && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">size</span>
                  <span className="text-surface-400">{input.contentLength.toLocaleString()} chars</span>
                </div>
              )}
              {input.description && !summary.includes(input.description) && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">desc</span>
                  <span className="text-surface-400">{input.description}</span>
                </div>
              )}
              {input.url && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">url</span>
                  <span className="text-blue-400/70 font-mono break-all">{input.url}</span>
                </div>
              )}
              {input.prompt && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">task</span>
                  <span className="text-violet-400/70">{input.prompt}</span>
                </div>
              )}
            </div>
          )}

          {/* Result output */}
          {resMeta.resultPreview && (
            <div className="mt-1.5">
              <div className="text-[10px] text-surface-500 mb-1 flex items-center gap-1 font-medium">
                output
                {resMeta.resultLines > 1 && <span className="text-surface-600 font-normal">({resMeta.resultLines} lines)</span>}
              </div>
              <pre className={`rounded-md bg-surface-900/80 border border-surface-700/30 px-3 py-2 text-[11px] font-mono overflow-x-auto max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed ${
                isError ? 'text-red-400/80' : 'text-surface-400'
              }`}>{resMeta.resultPreview}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Claude text block (with inline code/bold rendering) ───
function ClaudeText({ message, time }) {
  // Simple inline rendering: **bold**, `code`, ```codeblock```
  const rendered = useMemo(() => {
    if (!message) return null;

    // Check for code blocks
    if (message.includes('```')) {
      const parts = message.split(/(```[\s\S]*?```)/);
      return parts.map((part, i) => {
        if (part.startsWith('```')) {
          const inner = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          return (
            <pre key={i} className="my-1.5 rounded-md bg-surface-900/80 border border-surface-700/30 px-3 py-2 text-[11px] font-mono text-surface-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {inner}
            </pre>
          );
        }
        return <InlineText key={i} text={part} />;
      });
    }

    return <InlineText text={message} />;
  }, [message]);

  return (
    <div className="flex items-start gap-2 py-1.5 text-[13px] text-surface-200">
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none mt-0.5">
        {fmtTime(time)}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">{rendered}</div>
    </div>
  );
}

function InlineText({ text }) {
  if (!text?.trim()) return null;
  // Bold and inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} className="text-surface-100 font-semibold">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={i} className="px-1.5 py-0.5 rounded bg-surface-800 text-amber-300/80 text-[11px] font-mono">{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// ─── System message (compact) ───
function SystemLine({ log }) {
  const msg = log.message;
  const isUsage = msg.startsWith('Usage:');
  const isInit = msg.startsWith('Session initialized');
  const isResult = msg.startsWith('Result:');

  if (isUsage) {
    return (
      <div className="my-2 rounded-lg bg-claude/5 border border-claude/20 px-3 py-2 text-[11px] text-claude/80 flex items-center gap-3 flex-wrap">
        <Cpu size={12} className="flex-shrink-0" />
        <span>{msg}</span>
      </div>
    );
  }

  if (isInit) {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] text-surface-600">
        <span className="w-[48px] flex-shrink-0" />
        <span className="w-1.5 h-1.5 rounded-full bg-claude/50" />
        <span>{msg}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 py-1 text-[11px] ${
      log.log_type === 'error' ? 'text-red-400' :
      log.log_type === 'success' ? 'text-emerald-400' :
      'text-claude/70'
    }`}>
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none">
        {fmtTime(log.created_at)}
      </span>
      <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${
        log.log_type === 'error' ? 'bg-red-400' :
        log.log_type === 'success' ? 'bg-emerald-400' :
        'bg-claude/50'
      }`} />
      <span className="whitespace-pre-wrap break-words min-w-0">{msg}</span>
    </div>
  );
}

// ─── Activity indicator ───
function ActivityIndicator({ logs, isRunning }) {
  const status = useMemo(() => {
    if (!isRunning) return null;
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.log_type === 'tool' && l.meta?.toolName && !l.meta.isResult) {
        // Check if this tool has a result
        const toolId = l.meta.toolId;
        const hasResult = logs.slice(i + 1).some(r => r.log_type === 'tool_result' && r.meta?.toolId === toolId);
        if (!hasResult) {
          return { phase: 'tool', toolName: l.meta.toolName, file: l.meta.input?.file };
        }
      }
      if (l.log_type === 'tool_result') return { phase: 'thinking' };
      if (l.log_type === 'claude') return { phase: 'thinking' };
    }
    return { phase: 'starting' };
  }, [logs, isRunning]);

  if (!status) return null;

  if (status.phase === 'tool') {
    const Icon = getToolIcon(status.toolName);
    const color = getToolColor(status.toolName);
    return (
      <div className={`flex items-center gap-1.5 text-xs ${color}`}>
        <Icon size={12} className="animate-pulse" />
        <span className="font-medium">{status.toolName}</span>
        {status.file && <span className="text-surface-500 truncate max-w-[150px]">{basename(status.file)}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-surface-500">
      <div className="w-2 h-2 rounded-full bg-claude animate-pulse" />
      {status.phase === 'starting' ? 'Starting...' : 'Thinking...'}
    </div>
  );
}

// ─── Elapsed time counter ───
function ElapsedTime({ startedAt, isRunning, workDurationMs = 0, lastResumedAt = null }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      let diff;
      if (workDurationMs > 0 || lastResumedAt) {
        diff = workDurationMs || 0;
        if (lastResumedAt) {
          diff += Date.now() - new Date(lastResumedAt).getTime();
        }
      } else {
        diff = Date.now() - new Date(startedAt).getTime();
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    };
    update();
    if (isRunning || lastResumedAt) {
      const iv = setInterval(update, 1000);
      return () => clearInterval(iv);
    }
  }, [startedAt, isRunning, workDurationMs, lastResumedAt]);

  if (!elapsed) return null;
  return (
    <span className="flex items-center gap-0.5" title="Elapsed time">
      <Timer size={9} />
      {elapsed}
    </span>
  );
}

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
    api.getTaskLogs(task.id).then(data => {
      setLogs(data.map(l => ({ ...l, meta: l.meta || null })));
    }).catch(() => {});
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
        setLogs(prev => prev.length > 2000 ? [...prev.slice(-1500), entry] : [...prev, entry]);
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
    setLogs(prev => { const merged = [...prev, ...pausedLogsRef.current]; return merged.length > 2000 ? merged.slice(-1500) : merged; });
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

  const handleStop = async () => { try { await api.stopTask(task.id); } catch {} };
  const handleRestart = async () => { try { setLogs([]); await api.restartTask(task.id); } catch {} };

  const toggleToolExpand = useCallback((index) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }, []);

  const toggleExpandAll = useCallback(() => {
    setExpandAll(prev => {
      if (!prev) {
        const idxs = new Set();
        logs.forEach((l, i) => { if (l.log_type === 'tool' && l.meta) idxs.add(i); });
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
      if (e.key === 'Escape' && showSearch) { setShowSearch(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch]);

  // ─── Filtering ───
  const filteredLogs = useMemo(() => {
    let r = logs;
    if (filter === 'claude') r = r.filter(l => l.log_type === 'claude');
    else if (filter === 'tools') r = r.filter(l => l.log_type === 'tool' || l.log_type === 'tool_result');
    else if (filter === 'system') r = r.filter(l => l.log_type === 'system' || l.log_type === 'info');
    else if (filter === 'errors') r = r.filter(l => l.log_type === 'error');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(l => l.message.toLowerCase().includes(q));
    }
    return r;
  }, [logs, filter, searchQuery]);

  // Group entries
  const groupedEntries = useMemo(() => groupToolEntries(filteredLogs), [filteredLogs]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const tools = logs.filter(l => l.log_type === 'tool' && !l.meta?.isResult).length;
    const errors = logs.filter(l => l.log_type === 'error').length;
    const turns = logs.filter(l => l.log_type === 'claude').length;
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
            <span className="text-[9px] text-surface-600 font-mono flex-shrink-0">{task.task_key || `#${task.id}`}</span>
            {task.is_running && (
              <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                <Activity size={9} className="animate-pulse" />
                <span className="hidden sm:inline">Running</span>
              </span>
            )}
            {!task.is_running && logs.some(l => l.log_type === 'success') && (
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
              <ElapsedTime startedAt={task.started_at} isRunning={task.is_running} workDurationMs={task.work_duration_ms || 0} lastResumedAt={task.last_resumed_at} />
              {totalTokens > 0 && <span className="flex items-center gap-0.5"><Cpu size={9} />{fmtTokens(totalTokens)}</span>}
            </div>
          </div>
        </div>

        {/* Live stats bar - desktop only */}
        <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-surface-500 flex-shrink-0">
          <ElapsedTime startedAt={task.started_at} isRunning={task.is_running} workDurationMs={task.work_duration_ms || 0} lastResumedAt={task.last_resumed_at} />
          {totalTokens > 0 && <span className="flex items-center gap-0.5"><Cpu size={9} />{fmtTokens(totalTokens)}</span>}
          {task.total_cost > 0 && <span className="flex items-center gap-0.5"><Coins size={9} />${task.total_cost.toFixed(4)}</span>}
          {stats.tools > 0 && <span className={`flex items-center gap-0.5 text-purple-400/60`}><Code size={9} />{stats.tools}</span>}
          {stats.errors > 0 && <span className="text-red-400/70">{stats.errors} err</span>}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => { setShowSearch(s => !s); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-surface-700 text-claude' : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800'}`}
            title="Search (Ctrl+F)"
          ><Search size={12} /></button>
          {onToggleLayout && (
            <button onClick={onToggleLayout} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-200 transition-colors"
              title={isBottom ? 'Side panel' : 'Bottom panel'}>
              {isBottom ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          )}
          {task.is_running && (
            <button onClick={handleStop} className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-colors" title="Stop"><Square size={12} /></button>
          )}
          <button onClick={handleRestart} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-amber-400 transition-colors" title="Restart"><RotateCcw size={12} /></button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 transition-colors" title="Close"><X size={12} /></button>
        </div>
      </div>

      {/* ═══ Search ═══ */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-800 bg-surface-800/50">
          <Search size={11} className="text-surface-500" />
          <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search logs..." className="flex-1 bg-transparent text-xs text-surface-200 placeholder-surface-600 outline-none" />
          {searchQuery && <span className="text-[10px] text-surface-500">{filteredLogs.length} matches</span>}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-surface-500 hover:text-surface-300"><X size={11} /></button>
        </div>
      )}

      {/* ═══ Filters ═══ */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-surface-800">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
              filter === f.id ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'
            }`}>
            {f.label}
            {f.count && <span className={`${f.alert ? 'text-red-400' : 'text-surface-600'}`}>{f.count}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={toggleExpandAll}
          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${expandAll ? 'text-purple-400 bg-purple-500/10' : 'text-surface-500 hover:text-surface-300'}`}
          title={expandAll ? 'Collapse all' : 'Expand all'}>
          {expandAll ? 'Collapse' : 'Expand'}
        </button>
        <button onClick={() => paused ? resumeLogs() : setPaused(true)}
          className={`p-1 rounded transition-colors ${paused ? 'text-amber-400 bg-amber-500/10' : 'text-surface-500 hover:text-surface-300'}`}
          title={paused ? `Resume (${pausedLogsRef.current.length})` : 'Pause'}>
          {paused ? <Play size={10} /> : <Pause size={10} />}
        </button>
        {paused && pausedLogsRef.current.length > 0 && <span className="text-[10px] text-amber-400">{pausedLogsRef.current.length}</span>}
        <button onClick={() => setLogs([])} className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors" title="Clear"><Trash2 size={10} /></button>
      </div>

      {/* ═══ Content ═══ */}
      <div ref={containerRef} onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-xs leading-relaxed">

        {groupedEntries.length === 0 ? (
          <div className="text-center text-surface-600 py-12">
            {task.is_running ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
                </div>
                <span className="text-surface-500">Waiting for Claude...</span>
              </div>
            ) : <span>No output yet</span>}
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
          onClick={() => { setAutoScroll(true); containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' }); }}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-claude shadow-lg hover:bg-claude-light transition-colors z-10">
          <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}
