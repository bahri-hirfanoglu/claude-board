import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Sparkles, Cpu, CheckCircle2, AlertCircle, StopCircle,
  Clock, Zap, Terminal, ChevronDown, ChevronRight, FileCode, Hash,
} from 'lucide-react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import { formatTokens } from '../../lib/formatters';
import { TYPE_COLORS } from '../../lib/constants';

const MODELS = [
  { value: 'haiku', label: 'Haiku', color: 'bg-green-500/20 text-green-300' },
  { value: 'sonnet', label: 'Sonnet', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'opus', label: 'Opus', color: 'bg-purple-500/20 text-purple-300' },
];

const EFFORTS = [
  { value: 'low', label: 'Low', color: 'bg-green-500/20 text-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'high', label: 'High', color: 'bg-red-500/20 text-red-300' },
];

const GRANULARITIES = [
  { value: 'high-level', label: 'High-level', desc: '3-5 big tasks with checklists', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'balanced', label: 'Balanced', desc: '5-10 medium tasks', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'detailed', label: 'Detailed', desc: '10-20 atomic tasks', color: 'bg-purple-500/20 text-purple-300' },
];

const PRIORITY_LABELS = ['—', 'Low', 'Medium', 'High'];
const PRIORITY_COLORS = ['text-surface-500', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function PlanningModal({ projectId, onClose }) {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [model, setModel] = useState('sonnet');
  const [effort, setEffort] = useState('medium');
  const [granularity, setGranularity] = useState('balanced');
  const [phase, setPhase] = useState('idle'); // idle | thinking | done | error
  const [logs, setLogs] = useState([]);       // { type, message, ts }
  const [textChunks, setTextChunks] = useState('');
  const [createdTasks, setCreatedTasks] = useState([]);
  const [stats, setStats] = useState({ elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 });
  const [error, setError] = useState(null);
  const [showOutput, setShowOutput] = useState(true);
  const [expandedTask, setExpandedTask] = useState(null);
  const logsEndRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Elapsed timer
  useEffect(() => {
    if (phase === 'thinking') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setStats((s) => ({ ...s, elapsed: Date.now() - startTimeRef.current }));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Socket events
  useEffect(() => {
    const pid = projectId;

    const onProgress = (data) => {
      if (data.projectId !== pid) return;
      setPhase('thinking');
      if (data.type === 'text') {
        setTextChunks((prev) => prev + data.content);
      }
    };

    const onLog = (data) => {
      if (data.projectId !== pid) return;
      setLogs((prev) => [...prev, { type: data.type, message: data.message, tool: data.tool, ts: Date.now() }]);
    };

    const onStats = (data) => {
      if (data.projectId !== pid) return;
      setStats((prev) => ({ ...prev, tokens: data.tokens, toolCalls: data.toolCalls, turns: data.turns }));
    };

    const onCompleted = (data) => {
      if (data.projectId !== pid) return;
      clearInterval(timerRef.current);
      if (data.stats) setStats((prev) => ({ ...prev, ...data.stats }));
      if (data.tasks?.length > 0) {
        setPhase('done');
        setCreatedTasks(data.tasks);
      } else {
        setPhase('error');
        setError('Claude could not generate structured tasks. Try rephrasing or adding more context.');
      }
    };

    const onCancelled = (data) => {
      if (data.projectId !== pid) return;
      clearInterval(timerRef.current);
      setPhase('idle');
      setLogs([]);
      setTextChunks('');
    };

    socket.on('plan:progress', onProgress);
    socket.on('plan:log', onLog);
    socket.on('plan:stats', onStats);
    socket.on('plan:completed', onCompleted);
    socket.on('plan:cancelled', onCancelled);
    return () => {
      socket.off('plan:progress', onProgress);
      socket.off('plan:log', onLog);
      socket.off('plan:stats', onStats);
      socket.off('plan:completed', onCompleted);
      socket.off('plan:cancelled', onCancelled);
    };
  }, [projectId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, textChunks]);

  const handleStart = async () => {
    if (!topic.trim()) return;
    setPhase('thinking');
    setLogs([]);
    setTextChunks('');
    setCreatedTasks([]);
    setError(null);
    setStats({ elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 });
    try {
      await api.startPlanning(projectId, { topic: topic.trim(), model, effort, granularity, context: context.trim() });
    } catch (e) {
      setPhase('error');
      setError(e.message);
    }
  };

  const handleCancel = async () => {
    try { await api.cancelPlanning(projectId); } catch {}
    clearInterval(timerRef.current);
    setPhase('idle');
  };

  const isActive = phase === 'thinking';
  const totalTokens = stats.tokens.input + stats.tokens.output;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-claude" />
            <h2 className="text-sm font-semibold">Planning Mode</h2>
          </div>

          {/* Live stats bar */}
          {phase !== 'idle' && (
            <div className="flex items-center gap-3 text-[10px] text-surface-500">
              <span className="flex items-center gap-1">
                <Clock size={10} className={isActive ? 'text-amber-400' : ''} />
                {formatElapsed(stats.elapsed)}
              </span>
              {totalTokens > 0 && (
                <span className="flex items-center gap-1">
                  <Zap size={10} />
                  {formatTokens(totalTokens)}
                </span>
              )}
              {stats.toolCalls > 0 && (
                <span className="flex items-center gap-1">
                  <Terminal size={10} />
                  {stats.toolCalls} tools
                </span>
              )}
              {stats.turns > 0 && (
                <span className="flex items-center gap-1">
                  <Hash size={10} />
                  {stats.turns} turns
                </span>
              )}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              {phase === 'done' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </div>
          )}

          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Input section — only when idle/error */}
          {(phase === 'idle' || phase === 'error') && (
            <>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">What do you want to build?</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Build an authentication system with OAuth2, JWT tokens, role-based access control, and password reset flow"
                  rows={3}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Additional context <span className="text-surface-600 font-normal">— optional</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Express.js backend, React frontend, PostgreSQL with Prisma ORM"
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none"
                />
              </div>

              {/* Granularity */}
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Task breakdown</label>
                <div className="flex gap-1.5">
                  {GRANULARITIES.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setGranularity(g.value)}
                      className={`flex-1 px-2 py-2 rounded-lg text-center transition-all border ${
                        granularity === g.value
                          ? `${g.color} ring-1 ring-current border-current/20`
                          : 'bg-surface-800 text-surface-500 hover:text-surface-300 border-transparent'
                      }`}
                    >
                      <div className="text-xs font-semibold">{g.label}</div>
                      <div className="text-[9px] opacity-70 mt-0.5">{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model + Effort */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1">
                    <Cpu size={11} /> Model
                  </label>
                  <div className="flex gap-1">
                    {MODELS.map((m) => (
                      <button key={m.value} onClick={() => setModel(m.value)} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${model === m.value ? `${m.color} ring-1 ring-current` : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1">
                    <Zap size={11} /> Effort
                  </label>
                  <div className="flex gap-1">
                    {EFFORTS.map((e) => (
                      <button key={e.value} onClick={() => setEffort(e.value)} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${effort === e.value ? `${e.color} ring-1 ring-current` : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Live output ─── */}
          {(isActive || phase === 'done') && (logs.length > 0 || textChunks) && (
            <div>
              <button
                onClick={() => setShowOutput(!showOutput)}
                className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors"
              >
                {showOutput ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Terminal size={12} />
                Claude Output
                {logs.length > 0 && <span className="text-surface-600">({logs.length} events)</span>}
              </button>

              {showOutput && (
                <div className="bg-surface-950 border border-surface-800 rounded-lg overflow-hidden">
                  {/* Tool calls */}
                  {logs.length > 0 && (
                    <div className="border-b border-surface-800/50 p-2 space-y-0.5 max-h-32 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] font-mono py-0.5">
                          {log.type === 'tool' && (
                            <>
                              <FileCode size={10} className="text-violet-400 flex-shrink-0 mt-0.5" />
                              <span className="text-violet-400/80">{log.message}</span>
                            </>
                          )}
                          {log.type === 'result' && (
                            <>
                              <CheckCircle2 size={10} className="text-emerald-400/60 flex-shrink-0 mt-0.5" />
                              <span className="text-surface-600 truncate">{log.message}</span>
                            </>
                          )}
                          {log.type === 'error' && (
                            <>
                              <AlertCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />
                              <span className="text-red-400/80">{log.message}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text output */}
                  <div className="p-3 text-xs text-surface-400 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                    {textChunks}
                    {isActive && <span className="inline-block w-1.5 h-3.5 bg-claude animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Created tasks ─── */}
          {createdTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 size={13} />
                  {createdTasks.length} tasks created in Backlog
                </label>
                <span className="text-[10px] text-surface-600">Click to expand</span>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {createdTasks.map((t, i) => {
                  const isExpanded = expandedTask === t.id;
                  const typeColor = TYPE_COLORS[t.task_type] || 'bg-surface-500/15 text-surface-400';
                  return (
                    <div
                      key={t.id}
                      className={`rounded-lg border transition-all cursor-pointer ${isExpanded ? 'bg-surface-800/60 border-surface-600' : 'bg-surface-800/30 border-surface-700/30 hover:border-surface-600/50'}`}
                      onClick={() => setExpandedTask(isExpanded ? null : t.id)}
                    >
                      <div className="flex items-start gap-2.5 px-3 py-2">
                        <span className="text-[10px] text-surface-600 font-mono mt-1 w-4 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${typeColor}`}>{t.task_type}</span>
                            <span className="text-[10px] text-surface-500 font-mono">{t.task_key}</span>
                            {t.priority > 0 && (
                              <span className={`text-[9px] font-medium ${PRIORITY_COLORS[t.priority]}`}>
                                {PRIORITY_LABELS[t.priority]}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-surface-200 font-medium mt-0.5 leading-snug">{t.title}</p>

                          {isExpanded && (
                            <div className="mt-2 space-y-2 text-[11px] text-surface-400 border-t border-surface-700/30 pt-2">
                              {t.description && (
                                <div>
                                  <span className="text-[10px] font-medium text-surface-500">Description</span>
                                  <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{t.description}</p>
                                </div>
                              )}
                              {t.acceptance_criteria && (
                                <div>
                                  <span className="text-[10px] font-medium text-surface-500">Acceptance Criteria</span>
                                  <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{t.acceptance_criteria}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isExpanded ? <ChevronDown size={12} className="text-surface-500 mt-1" /> : <ChevronRight size={12} className="text-surface-600 mt-1" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-medium">Planning failed</p>
                <p className="text-[11px] text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex gap-2 px-5 py-3 border-t border-surface-800 flex-shrink-0">
          {isActive ? (
            <button onClick={handleCancel} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
              <StopCircle size={14} />
              Cancel
            </button>
          ) : phase === 'done' ? (
            <>
              <button onClick={() => { setPhase('idle'); setCreatedTasks([]); setLogs([]); setTextChunks(''); }} className="px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                Plan Again
              </button>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors">
                Done — View Board
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!topic.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Sparkles size={14} />
                Start Planning
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
