import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Sparkles, Cpu, CheckCircle2, AlertCircle, StopCircle,
  Clock, Zap, Terminal, ChevronDown, ChevronRight, FileCode, Hash,
  Loader2, Search, Brain, ListChecks, Trash2, Edit3, RotateCcw,
  Check, ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import { tauriListen, IS_TAURI } from '../../lib/tauriEvents';
import { formatTokens } from '../../lib/formatters';
import { TYPE_COLORS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';

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
  { value: 'high-level', label: 'High-level', desc: '3-5 big tasks', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'balanced', label: 'Balanced', desc: '5-10 medium tasks', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'detailed', label: 'Detailed', desc: '10-20 atomic tasks', color: 'bg-purple-500/20 text-purple-300' },
];

const PHASES = [
  { key: 'starting', label: 'Analyzing', icon: Loader2, color: 'text-amber-400' },
  { key: 'exploring', label: 'Exploring', icon: Search, color: 'text-blue-400' },
  { key: 'writing', label: 'Planning', icon: Brain, color: 'text-purple-400' },
  { key: 'done', label: 'Review', icon: ListChecks, color: 'text-emerald-400' },
];

const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'];
const PRIORITY_COLORS = ['text-surface-500', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Persist planning state across modal open/close
const planCache = {};
function getCache(pid) {
  if (!planCache[pid]) planCache[pid] = { phase: 'idle', planPhase: 'starting', logs: [], analysis: '', proposals: [], stats: { elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 }, error: null, topic: '', context: '', model: 'sonnet', effort: 'medium', granularity: 'balanced' };
  return planCache[pid];
}

export default function PlanningModal({ projectId, onClose }) {
  const { t } = useTranslation();
  const c = getCache(projectId);
  const [topic, setTopic] = useState(c.topic);
  const [context, setContext] = useState(c.context);
  const [model, setModel] = useState(c.model);
  const [effort, setEffort] = useState(c.effort);
  const [granularity, setGranularity] = useState(c.granularity);
  const [phase, setPhase] = useState(c.phase);
  const [planPhase, setPlanPhase] = useState(c.planPhase);
  const [logs, setLogs] = useState(c.logs);
  const [analysis, setAnalysis] = useState(c.analysis);
  const [proposals, setProposals] = useState(c.proposals);
  const [stats, setStats] = useState(c.stats);
  const [error, setError] = useState(c.error);
  const [showLogs, setShowLogs] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [approving, setApproving] = useState(false);
  const logsEndRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Save state to cache on every change
  useEffect(() => {
    Object.assign(getCache(projectId), { phase, planPhase, logs, analysis, proposals, stats, error, topic, context, model, effort, granularity });
  });

  // Resume active session
  useEffect(() => {
    let cancelled = false;
    api.getPlanningStatus(projectId).then((data) => {
      if (cancelled) return;
      if (data.active) {
        startTimeRef.current = Date.now() - (data.elapsed || 0);
        setPhase('thinking');
        setPlanPhase(data.phase || 'starting');
      } else {
        sessionStorage.removeItem('planning:active');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  // Elapsed timer
  useEffect(() => {
    if (phase === 'thinking') {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setStats((s) => ({ ...s, elapsed: Date.now() - startTimeRef.current }));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Events
  useEffect(() => {
    const pid = projectId;

    const onProgress = (data) => {
      if (data.projectId !== pid) return;
      setPhase('thinking');
      if (data.type === 'text') setAnalysis((prev) => prev + data.content);
    };

    const onLog = (data) => {
      if (data.projectId !== pid || data.type === 'phase') return;
      setLogs((prev) => [...prev, { type: data.type, message: data.message, ts: Date.now() }]);
    };

    const onPhase = (data) => {
      if (data.projectId !== pid) return;
      setPlanPhase(data.phase);
    };

    const onStats = (data) => {
      if (data.projectId !== pid) return;
      setStats((prev) => ({ ...prev, tokens: data.tokens, toolCalls: data.toolCalls, turns: data.turns }));
    };

    const onCompleted = (data) => {
      if (data.projectId !== pid) return;
      clearInterval(timerRef.current);
      sessionStorage.removeItem('planning:active');
      if (data.stats) setStats((prev) => ({ ...prev, ...data.stats }));
      if (data.analysis) setAnalysis(data.analysis);
      if (data.proposals?.length > 0) {
        setProposals(data.proposals);
        setPhase('review');
        setPlanPhase('done');
      } else {
        setPhase('error');
        setError('Claude could not generate structured tasks. Try rephrasing or adding more context.');
      }
    };

    const onCancelled = (data) => {
      if (data.projectId !== pid) return;
      clearInterval(timerRef.current);
      sessionStorage.removeItem('planning:active');
      setPhase('idle');
      setPlanPhase('starting');
      setLogs([]);
      setAnalysis('');
    };

    if (IS_TAURI) {
      const unsubs = [
        tauriListen('plan:progress', onProgress),
        tauriListen('plan:log', onLog),
        tauriListen('plan:phase', onPhase),
        tauriListen('plan:stats', onStats),
        tauriListen('plan:completed', onCompleted),
        tauriListen('plan:cancelled', onCancelled),
      ];
      return () => unsubs.forEach(fn => fn());
    } else {
      socket.on('plan:progress', onProgress);
      socket.on('plan:log', onLog);
      socket.on('plan:phase', onPhase);
      socket.on('plan:stats', onStats);
      socket.on('plan:completed', onCompleted);
      socket.on('plan:cancelled', onCancelled);
      return () => {
        socket.off('plan:progress', onProgress);
        socket.off('plan:log', onLog);
        socket.off('plan:phase', onPhase);
        socket.off('plan:stats', onStats);
        socket.off('plan:completed', onCompleted);
        socket.off('plan:cancelled', onCancelled);
      };
    }
  }, [projectId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStart = async () => {
    if (!topic.trim()) return;
    setPhase('thinking');
    setPlanPhase('starting');
    setLogs([]);
    setAnalysis('');
    setProposals([]);
    setError(null);
    setStats({ elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 });
    try {
      sessionStorage.setItem('planning:active', 'true');
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

  const handleRemoveProposal = (idx) => {
    setProposals((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApprove = async () => {
    if (proposals.length === 0) return;
    setApproving(true);
    try {
      await api.approvePlan(projectId, proposals, model);
      setPhase('approved');
    } catch (e) {
      setError(e.message);
    }
    setApproving(false);
  };

  const handleRevise = () => {
    setPhase('idle');
    setPlanPhase('starting');
    setProposals([]);
    setLogs([]);
    setAnalysis('');
    // Keep topic and context so user can modify
  };

  const isActive = phase === 'thinking';
  const totalTokens = stats.tokens.input + stats.tokens.output;
  const currentPhaseIdx = PHASES.findIndex((p) => p.key === (phase === 'review' || phase === 'approved' ? 'done' : planPhase));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-claude" />
            <h2 className="text-sm font-semibold">{t('planning.title')}</h2>
            {phase === 'review' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">Review</span>}
            {phase === 'approved' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">Approved</span>}
          </div>

          {phase !== 'idle' && (
            <div className="flex items-center gap-3 text-[10px] text-surface-500 ml-auto mr-3">
              <span className="flex items-center gap-1">
                <Clock size={10} className={isActive ? 'text-amber-400' : ''} />
                {formatElapsed(stats.elapsed)}
              </span>
              {totalTokens > 0 && <span className="flex items-center gap-1"><Zap size={10} />{formatTokens(totalTokens)}</span>}
              {stats.toolCalls > 0 && <span className="flex items-center gap-1"><Terminal size={10} />{stats.toolCalls}</span>}
              {stats.turns > 0 && <span className="flex items-center gap-1"><Hash size={10} />{stats.turns}</span>}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            </div>
          )}

          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Input — idle/error */}
          {(phase === 'idle' || phase === 'error') && (
            <>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">{t('planning.whatToBuild')}</label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('planning.topicPlaceholder')} rows={3} autoFocus
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  {t('planning.context')} <span className="text-surface-600 font-normal">— {t('common.optional')}</span>
                </label>
                <textarea value={context} onChange={(e) => setContext(e.target.value)}
                  placeholder={t('planning.contextPlaceholder')} rows={2}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">{t('planning.taskBreakdown')}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {GRANULARITIES.map((g) => (
                    <button key={g.value} onClick={() => setGranularity(g.value)}
                      className={`px-2 py-2.5 rounded-lg text-center transition-all border ${granularity === g.value ? `${g.color} ring-1 ring-current border-current/20` : 'bg-surface-800 text-surface-500 hover:text-surface-300 border-transparent'}`}>
                      <div className="text-xs font-semibold">{g.label}</div>
                      <div className="text-[9px] opacity-70 mt-0.5 hidden sm:block">{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1.5"><Cpu size={11} /> {t('planning.model')}</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MODELS.map((m) => (
                      <button key={m.value} onClick={() => setModel(m.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-center ${model === m.value ? `${m.color} ring-1 ring-current` : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1.5"><Zap size={11} /> {t('planning.effort')}</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {EFFORTS.map((e) => (
                      <button key={e.value} onClick={() => setEffort(e.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-center ${effort === e.value ? `${e.color} ring-1 ring-current` : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Phase stepper */}
          {(isActive || phase === 'review' || phase === 'approved') && (
            <div className="flex items-center gap-1 px-1">
              {PHASES.map((p, i) => {
                const isComplete = i < currentPhaseIdx;
                const isCurrent = i === currentPhaseIdx;
                const Icon = p.icon;
                return (
                  <div key={p.key} className="flex items-center gap-1 flex-1">
                    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${isCurrent ? `${p.color} bg-current/10` : isComplete ? 'text-surface-500' : 'text-surface-700'}`}>
                      {isComplete ? <CheckCircle2 size={12} className="text-emerald-500" /> : isCurrent ? <Icon size={12} className={`${p.color} ${p.key !== 'done' ? 'animate-spin' : ''}`} /> : <Icon size={12} />}
                      <span>{p.label}</span>
                    </div>
                    {i < PHASES.length - 1 && <div className={`flex-1 h-px ${isComplete ? 'bg-emerald-500/30' : 'bg-surface-800'}`} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Live activity during thinking */}
          {isActive && (
            <div className="space-y-2">
              {topic && (
                <div className="bg-surface-800/40 border border-surface-800 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-surface-500 font-medium">Planning</p>
                  <p className="text-xs text-surface-300 mt-0.5 line-clamp-2">{topic}</p>
                </div>
              )}

              {/* Live log feed */}
              <div className="bg-surface-950 border border-surface-800 rounded-lg overflow-hidden">
                <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
                  {logs.length === 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-surface-600 py-2 px-1">
                      <Loader2 size={12} className="animate-spin" /> Claude is analyzing the codebase...
                    </div>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] font-mono py-0.5">
                      {log.type === 'tool' && <><FileCode size={10} className="text-violet-400 flex-shrink-0 mt-0.5" /><span className="text-violet-400/80 truncate">{log.message}</span></>}
                      {log.type === 'result' && <><CheckCircle2 size={10} className="text-emerald-400/60 flex-shrink-0 mt-0.5" /><span className="text-surface-600 truncate">{log.message}</span></>}
                      {log.type === 'error' && <><AlertCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" /><span className="text-red-400/80 truncate">{log.message}</span></>}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

              {/* Live analysis text */}
              {analysis && (
                <div>
                  <button onClick={() => setShowAnalysis(!showAnalysis)}
                    className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1 hover:text-surface-300">
                    {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Claude's analysis
                  </button>
                  {showAnalysis && (
                    <div className="bg-surface-950 border border-surface-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <pre className="text-[11px] text-surface-400 whitespace-pre-wrap font-sans leading-relaxed">{analysis}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Review phase — proposals */}
          {(phase === 'review' || phase === 'approved') && (
            <div className="space-y-3">
              {/* Analysis collapsible */}
              {analysis && (
                <div>
                  <button onClick={() => setShowAnalysis(!showAnalysis)}
                    className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1 hover:text-surface-300">
                    {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Brain size={12} /> Claude's Analysis
                  </button>
                  {showAnalysis && (
                    <div className="bg-surface-950 border border-surface-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <pre className="text-[11px] text-surface-400 whitespace-pre-wrap font-sans leading-relaxed">{analysis}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* Logs collapsible */}
              {logs.length > 0 && (
                <div>
                  <button onClick={() => setShowLogs(!showLogs)}
                    className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1 hover:text-surface-300">
                    {showLogs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Terminal size={12} /> Activity Log <span className="text-surface-600">({logs.length})</span>
                  </button>
                  {showLogs && (
                    <div className="bg-surface-950 border border-surface-800 rounded-lg p-2 max-h-32 overflow-y-auto space-y-0.5">
                      {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] font-mono py-0.5">
                          {log.type === 'tool' && <><FileCode size={10} className="text-violet-400 flex-shrink-0 mt-0.5" /><span className="text-violet-400/80 truncate">{log.message}</span></>}
                          {log.type === 'result' && <><CheckCircle2 size={10} className="text-emerald-400/60 flex-shrink-0 mt-0.5" /><span className="text-surface-600 truncate">{log.message}</span></>}
                          {log.type === 'error' && <><AlertCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" /><span className="text-red-400/80 truncate">{log.message}</span></>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Proposed tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-300">
                    {phase === 'approved' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <ListChecks size={13} className="text-amber-400" />}
                    {phase === 'approved' ? `${proposals.length} tasks created` : `${proposals.length} proposed tasks`}
                  </label>
                  {phase === 'review' && <span className="text-[10px] text-surface-600">Remove tasks you don't want</span>}
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {proposals.map((task, i) => {
                    const isExpanded = expandedTask === i;
                    const typeColor = TYPE_COLORS[task.task_type] || 'bg-surface-500/15 text-surface-400';
                    return (
                      <div key={i}
                        className={`rounded-lg border transition-all ${isExpanded ? 'bg-surface-800/60 border-surface-600' : 'bg-surface-800/30 border-surface-700/30 hover:border-surface-600/50'}`}>
                        <div className="flex items-start gap-2.5 px-3 py-2 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : i)}>
                          <span className="text-[10px] text-surface-600 font-mono mt-1 w-4 text-right flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${typeColor}`}>{task.task_type}</span>
                              {task.priority > 0 && <span className={`text-[9px] font-medium ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>}
                            </div>
                            <p className="text-[12px] text-surface-200 font-medium mt-0.5 leading-snug">{task.title}</p>
                            {isExpanded && (
                              <div className="mt-2 space-y-2 text-[11px] text-surface-400 border-t border-surface-700/30 pt-2">
                                {task.description && <div><span className="text-[10px] font-medium text-surface-500">Description</span><p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{task.description}</p></div>}
                                {task.acceptance_criteria && <div><span className="text-[10px] font-medium text-surface-500">Acceptance Criteria</span><p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{task.acceptance_criteria}</p></div>}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            {phase === 'review' && (
                              <button onClick={(e) => { e.stopPropagation(); handleRemoveProposal(i); }}
                                className="p-1 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 transition-colors"
                                title="Remove this task">
                                <Trash2 size={12} />
                              </button>
                            )}
                            {isExpanded ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-600" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-medium">{t('planning.planningFailed')}</p>
                <p className="text-[11px] text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-surface-800 flex-shrink-0">
          {isActive ? (
            <button onClick={handleCancel} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
              <StopCircle size={14} /> {t('planning.cancelBtn')}
            </button>
          ) : phase === 'review' ? (
            <>
              <button onClick={handleRevise} className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                <RotateCcw size={14} /> Revise
              </button>
              <button onClick={handleApprove} disabled={proposals.length === 0 || approving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors">
                {approving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {approving ? 'Creating...' : `Approve & Create ${proposals.length} Tasks`}
              </button>
            </>
          ) : phase === 'approved' ? (
            <>
              <button onClick={() => { setPhase('idle'); setProposals([]); setLogs([]); setAnalysis(''); }}
                className="px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                Plan Again
              </button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors">
                <ArrowRight size={14} /> View Board
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                {t('planning.cancelBtn')}
              </button>
              <button onClick={handleStart} disabled={!topic.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                <Sparkles size={14} /> {t('planning.startPlanning')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
