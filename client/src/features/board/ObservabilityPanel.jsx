import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Eye,
  FileText,
  Pencil,
  Terminal,
  Search,
  FolderOpen,
  Zap,
  Cpu,
  Clock,
  Coins,
  AlertTriangle,
  Radio,
  Pause,
  Play,
  Hash,
} from 'lucide-react';
import { api } from '../../lib/api';
import { IS_TAURI, tauriListen } from '../../lib/tauriEvents';
import { formatTokens } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';

const TOOL_ICONS = {
  Read: Eye,
  Write: FileText,
  Edit: Pencil,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderOpen,
  Agent: Zap,
};
const TOOL_COLORS = {
  Read: 'text-sky-400',
  Write: 'text-emerald-400',
  Edit: 'text-yellow-400',
  Bash: 'text-amber-400',
  Grep: 'text-cyan-400',
  Glob: 'text-teal-400',
};

function formatElapsed(sec) {
  if (!sec || sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${sec % 60}s`;
  return `${sec}s`;
}

function shortenPath(p) {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.length <= 2 ? parts.join('/') : '.../' + parts.slice(-2).join('/');
}

export default function ObservabilityPanel({ projectId }) {
  const { t } = useTranslation();
  const [data, setData] = useState({ agents: [], fileMap: {}, conflicts: [] });
  const [feed, setFeed] = useState([]);
  const [paused, setPaused] = useState(false);
  const feedRef = useRef([]);
  const pausedRef = useRef(false);

  // Poll agent activity
  const loadActivity = useCallback(() => {
    if (!IS_TAURI || !projectId) return;
    api
      .getAgentActivity?.(projectId)
      ?.then(setData)
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    loadActivity();
    const iv = setInterval(loadActivity, 5000);
    return () => clearInterval(iv);
  }, [loadActivity]);

  // Real-time activity feed from task:log events
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:log', (payload) => {
      if (pausedRef.current) return;
      const meta = payload.meta ? (typeof payload.meta === 'string' ? JSON.parse(payload.meta) : payload.meta) : {};
      if (payload.logType !== 'tool' && payload.logType !== 'tool_result') return;

      const entry = {
        id: Date.now() + Math.random(),
        taskId: payload.taskId,
        toolName: meta.toolName || '',
        file: meta.input?.file || meta.input?.command || '',
        isResult: !!meta.isResult,
        isError: !!meta.isError,
        message: payload.message,
        time: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      feedRef.current = [...feedRef.current.slice(-99), entry];
      setFeed([...feedRef.current]);
    });
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Listen for file conflicts
  const [conflicts, setConflicts] = useState([]);
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('agent:file_conflict', (payload) => {
      setConflicts((prev) => [...prev.slice(-19), { ...payload, time: Date.now() }]);
    });
  }, []);

  const { agents, fileMap } = data;
  const activeFiles = Object.entries(fileMap || {});
  const totalToolCalls = agents.reduce((s, a) => s + (a.toolCallCount || 0), 0);
  const totalTokens = agents.reduce((s, a) => s + (a.inputTokens || 0) + (a.outputTokens || 0), 0);
  const totalCost = agents.reduce((s, a) => s + (a.totalCost || 0), 0);

  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-surface-500 text-sm">
        {t('observability.noAgents')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-3 py-2 bg-surface-800/40 rounded-lg border border-surface-700/30 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Radio size={12} className="text-emerald-400 animate-pulse" />
          <span className="text-xs text-surface-400">{t('observability.agents')}</span>
          <span className="text-sm font-semibold text-emerald-400">{agents.length}</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-amber-400" />
          <span className="text-xs text-surface-400">{t('observability.toolCalls')}</span>
          <span className="text-sm font-semibold text-surface-200">{totalToolCalls}</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-blue-400" />
          <span className="text-[10px] text-surface-500">{formatTokens(totalTokens)}</span>
        </div>
        {totalCost > 0 && (
          <>
            <div className="w-px h-4 bg-surface-700" />
            <div className="flex items-center gap-1.5">
              <Coins size={12} className="text-emerald-400" />
              <span className="text-[10px] text-surface-500">${totalCost.toFixed(3)}</span>
            </div>
          </>
        )}
        {conflicts.length > 0 && (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-0.5 rounded">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-[10px] text-red-400 font-medium">{conflicts.length} conflicts</span>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left: Agent cards + File heatmap */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          {/* Agent Activity Cards */}
          <div>
            <div className="text-[11px] font-medium text-surface-400 uppercase tracking-wider px-1 mb-1.5">
              {t('observability.activeAgents')}
            </div>
            <div className="space-y-2">
              {agents.map((agent) => {
                const Icon = TOOL_ICONS[agent.recentTools?.[0]?.meta?.toolName] || Activity;
                return (
                  <div key={agent.taskId} className="bg-surface-800/50 border border-surface-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        <span className="text-xs font-medium text-surface-200 truncate">{agent.title}</span>
                        {agent.taskKey && (
                          <span className="text-[9px] text-surface-600 font-mono flex-shrink-0">{agent.taskKey}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-surface-500 flex-shrink-0">
                        <span>
                          <Cpu size={9} className="inline" /> {agent.model}
                        </span>
                        <span>
                          <Clock size={9} className="inline" /> {formatElapsed(agent.elapsedSec)}
                        </span>
                      </div>
                    </div>
                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[10px] text-surface-500 mb-2">
                      <span>
                        <Hash size={9} className="inline" /> {agent.toolCallCount} tools
                      </span>
                      <span>
                        <Zap size={9} className="inline" />{' '}
                        {formatTokens((agent.inputTokens || 0) + (agent.outputTokens || 0))}
                      </span>
                      {agent.totalCost > 0 && (
                        <span>
                          <Coins size={9} className="inline" /> ${agent.totalCost.toFixed(3)}
                        </span>
                      )}
                      {agent.awaitingSubtasks && (
                        <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                          Awaiting sub-tasks
                        </span>
                      )}
                    </div>
                    {/* Active files */}
                    {agent.activeFiles?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {agent.activeFiles.slice(0, 6).map((f, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-400 font-mono"
                          >
                            {shortenPath(f)}
                          </span>
                        ))}
                        {agent.activeFiles.length > 6 && (
                          <span className="text-[9px] text-surface-600">+{agent.activeFiles.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* File Heatmap */}
          {activeFiles.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-surface-400 uppercase tracking-wider px-1 mb-1.5">
                {t('observability.fileHeatmap')} ({activeFiles.length})
              </div>
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                {activeFiles.map(([path, taskIds]) => {
                  const isConflict = taskIds.length > 1;
                  return (
                    <div
                      key={path}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] ${
                        isConflict ? 'bg-red-500/10 border border-red-500/20' : 'bg-surface-800/30'
                      }`}
                    >
                      <span className="text-surface-400 font-mono truncate flex-1">{shortenPath(path)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {taskIds.map((id) => (
                          <span
                            key={id}
                            className={`w-2 h-2 rounded-full ${isConflict ? 'bg-red-400' : 'bg-emerald-400'}`}
                            title={`Task #${id}`}
                          />
                        ))}
                      </div>
                      {isConflict && <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Activity Feed */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-surface-900/50 rounded-lg border border-surface-700/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700/30">
            <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">
              {t('observability.liveFeed')}
            </span>
            <button
              onClick={() => setPaused(!paused)}
              className="p-1 rounded hover:bg-surface-800 text-surface-500 transition-colors"
            >
              {paused ? <Play size={11} /> : <Pause size={11} />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {feed.length === 0 && (
              <div className="text-center text-surface-600 text-[10px] py-8">{t('observability.noActivity')}</div>
            )}
            {feed.map((entry) => {
              if (entry.isResult) return null; // Only show tool calls, not results
              const ToolIcon = TOOL_ICONS[entry.toolName] || Activity;
              const color = TOOL_COLORS[entry.toolName] || 'text-surface-400';
              return (
                <div key={entry.id} className="flex items-center gap-1.5 text-[9px] py-0.5">
                  <span className="text-surface-600 font-mono w-14 flex-shrink-0">{entry.time}</span>
                  <span className="text-surface-600 w-6 text-right flex-shrink-0">#{entry.taskId}</span>
                  <ToolIcon size={9} className={color} />
                  <span className={`font-medium ${color} w-8 flex-shrink-0`}>{entry.toolName}</span>
                  <span className="text-surface-500 truncate">{shortenPath(entry.file)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
