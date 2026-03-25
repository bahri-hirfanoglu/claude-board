import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Sparkles, Cpu, CheckCircle2, AlertCircle, StopCircle,
  Clock, Zap, Terminal, ChevronDown, ChevronRight, FileCode, Hash,
  Loader2, Search, Brain, ListChecks, Trash2, RotateCcw,
  Check, ArrowRight, GitBranch, Eye, Pencil, FolderOpen, Globe, Code,
} from 'lucide-react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import { tauriListen, IS_TAURI } from '../../lib/tauriEvents';
import { formatTokens } from '../../lib/formatters';
import { TYPE_COLORS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import { MODEL_OPTIONS, EFFORT_OPTIONS, PRIORITY_LABELS } from '../../lib/constants';
import MDEditor from '@uiw/react-md-editor';
import DependencyGraph from '../board/DependencyGraph';

function MdPreview({ content }) {
  if (!content) return null;
  return (
    <div data-color-mode="dark" className="md-preview-compact">
      <MDEditor.Markdown source={content} style={{ backgroundColor: 'transparent', color: '#a8a29e', fontSize: '11px', lineHeight: '1.5' }} />
    </div>
  );
}

const MODELS = MODEL_OPTIONS;
const EFFORTS = EFFORT_OPTIONS;

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

const PRIORITY_COLORS = ['text-surface-500', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

/** Compute execution waves from index-based dependency pairs for DAG layout */
function computeWaves(proposals, deps) {
  const n = proposals.length;
  if (n === 0) return [];
  // Build parent set for each task index
  const parents = Array.from({ length: n }, () => new Set());
  for (const [parentIdx, childIdx] of deps) {
    if (childIdx >= 0 && childIdx < n && parentIdx >= 0 && parentIdx < n) {
      parents[childIdx].add(parentIdx);
    }
  }
  const assigned = new Set();
  const waves = [];
  // Iteratively find tasks whose parents are all assigned
  for (let iter = 0; iter < n; iter++) {
    const wave = [];
    for (let i = 0; i < n; i++) {
      if (assigned.has(i)) continue;
      const allMet = [...parents[i]].every(p => assigned.has(p));
      if (allMet) wave.push(i);
    }
    if (wave.length === 0) break; // remaining tasks form a cycle — skip
    for (const id of wave) assigned.add(id);
    waves.push(wave.map(id => ({ id })));
  }
  // Any unassigned (cyclic) tasks go into last wave
  const remaining = [];
  for (let i = 0; i < n; i++) {
    if (!assigned.has(i)) remaining.push({ id: i });
  }
  if (remaining.length > 0) waves.push(remaining);
  return waves;
}

// ─── Tool icon/color matching (same logic as LiveTerminal) ───
const TOOL_ICONS = { Read: Eye, Write: FileCode, Edit: Pencil, Bash: Terminal, Grep: Search, Glob: FolderOpen, WebFetch: Globe, WebSearch: Globe, Agent: Zap };
function getToolIcon(name) {
  if (!name) return Code;
  for (const [k, I] of Object.entries(TOOL_ICONS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return I;
  }
  return Code;
}
const TOOL_COLORS = { Read: 'text-sky-400', Write: 'text-emerald-400', Edit: 'text-yellow-400', Bash: 'text-amber-400', Grep: 'text-cyan-400', Glob: 'text-teal-400', WebFetch: 'text-blue-400', WebSearch: 'text-blue-400', Agent: 'text-violet-400' };
function getToolColor(name) {
  if (!name) return 'text-purple-400';
  for (const [k, c] of Object.entries(TOOL_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return c;
  }
  return 'text-purple-400';
}

function PlanLogFeed({ logs, isActive }) {
  const endRef = useRef(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  // Group tool + result pairs
  const entries = useMemo(() => {
    const out = [];
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.type === 'tool') {
        // Parse tool name: "Read → src/file.rs" or just "Bash"
        const parts = log.message.split(' → ');
        const toolName = parts[0].trim();
        const detail = parts[1] || '';
        // Look ahead for matching result
        let result = null;
        if (i + 1 < logs.length && (logs[i + 1].type === 'result' || logs[i + 1].type === 'error')) {
          result = logs[i + 1];
          i++; // skip next
        }
        out.push({ type: 'tool_group', toolName, detail, result, ts: log.ts, index: out.length });
      } else if (log.type === 'result' || log.type === 'error') {
        // Orphan result (no matching tool)
        out.push({ type: 'standalone', log, index: out.length });
      }
    }
    return out;
  }, [logs]);

  const toggle = (idx) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    return next;
  });

  if (entries.length === 0 && isActive) {
    return (
      <div className="flex items-center gap-2.5 text-[11px] text-surface-500 py-4 px-3">
        <Loader2 size={13} className="animate-spin text-claude" />
        <span>Claude is analyzing the codebase...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        if (entry.type === 'tool_group') {
          const Icon = getToolIcon(entry.toolName);
          const color = getToolColor(entry.toolName);
          const isError = entry.result?.type === 'error';
          const hasResult = !!entry.result;
          const isOpen = expanded.has(entry.index);
          const resultText = entry.result?.message?.replace(/^[✓✗]\s*/, '') || '';

          let statusEl;
          if (!hasResult) statusEl = <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />;
          else if (isError) statusEl = <AlertCircle size={11} className="text-red-400 flex-shrink-0" />;
          else statusEl = <CheckCircle2 size={11} className="text-emerald-500/70 flex-shrink-0" />;

          return (
            <div key={entry.index} className={`rounded-lg border transition-all duration-200 ${
              isError ? 'border-red-500/20 bg-red-500/5' :
              !hasResult ? 'border-amber-500/15 bg-amber-500/5' :
              isOpen ? 'border-surface-600/40 bg-surface-800/50' :
              'border-surface-700/20 bg-surface-800/20 hover:border-surface-700/40'
            }`}>
              <button onClick={() => toggle(entry.index)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[11px]">
                {statusEl}
                <Icon size={12} className={`${color} flex-shrink-0`} />
                <span className={`font-semibold ${color}`}>{entry.toolName}</span>
                {entry.detail && <span className="text-surface-500 truncate text-[10px] min-w-0 flex-1 font-mono">{entry.detail}</span>}
                <span className="flex-shrink-0 ml-auto">
                  {isOpen ? <ChevronDown size={10} className="text-surface-500" /> : <ChevronRight size={10} className="text-surface-600" />}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-0 text-[10px] space-y-1.5 border-t border-surface-700/20">
                  {entry.detail && (
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-surface-600 w-10 flex-shrink-0 text-[9px] uppercase tracking-wide font-medium">path</span>
                      <span className="text-surface-300 font-mono break-all">{entry.detail}</span>
                    </div>
                  )}
                  {resultText && (
                    <div className="mt-1">
                      <div className="text-[9px] text-surface-600 mb-1 uppercase tracking-wide font-medium">output</div>
                      <pre className={`rounded-md bg-surface-950/80 border border-surface-700/20 px-2.5 py-2 text-[10px] font-mono overflow-x-auto max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed ${
                        isError ? 'text-red-400/80' : 'text-surface-400'
                      }`}>{resultText}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }
        // Standalone result/error
        const log = entry.log;
        const isError = log.type === 'error';
        return (
          <div key={entry.index} className={`flex items-start gap-2 text-[11px] px-3 py-1.5 ${isError ? 'text-red-400/80' : 'text-surface-500'}`}>
            {isError ? <AlertCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={10} className="text-emerald-400/60 flex-shrink-0 mt-0.5" />}
            <span className="truncate">{log.message}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Persist planning state across modal open/close
const planCache = {};
function getCache(pid) {
  if (!planCache[pid]) planCache[pid] = { phase: 'idle', planPhase: 'starting', logs: [], analysis: '', proposals: [], dependencies: [], stats: { elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 }, error: null, topic: '', context: '', model: 'sonnet', effort: 'medium', granularity: 'balanced' };
  return planCache[pid];
}

// ─── Step indicator helpers ───
const STEPS = [
  { num: 1, labelKey: 'planning.stepDefine' },
  { num: 2, labelKey: 'planning.stepAnalyze' },
  { num: 3, labelKey: 'planning.stepReview' },
  { num: 4, labelKey: 'planning.stepComplete' },
];

function getStepIndex(phase) {
  if (phase === 'idle' || phase === 'error') return 0;
  if (phase === 'thinking') return 1;
  if (phase === 'review') return 2;
  if (phase === 'approved') return 3;
  return 0;
}

function StepIndicator({ phase, t }) {
  const activeStep = getStepIndex(phase);

  return (
    <div className="flex items-center w-full px-6 py-4">
      {STEPS.map((step, i) => {
        const isComplete = i < activeStep;
        const isCurrent = i === activeStep;
        const isFuture = i > activeStep;

        return (
          <div key={step.num} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
                ${isComplete
                  ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30'
                  : isCurrent
                    ? 'bg-claude/15 text-claude ring-2 ring-claude/40 animate-[pulse_2s_ease-in-out_infinite]'
                    : 'bg-surface-800/60 text-surface-600 ring-1 ring-surface-700/30'
                }
              `}>
                {isComplete ? <Check size={14} className="text-emerald-400" /> : step.num}
              </div>
              <span className={`text-[10px] font-medium transition-colors duration-200 ${
                isComplete ? 'text-emerald-400' : isCurrent ? 'text-claude' : 'text-surface-600'
              }`}>
                {t(step.labelKey)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-[2px] mx-3 rounded-full transition-colors duration-300 ${
                isComplete ? 'bg-emerald-500/40' : 'bg-surface-800'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-phase indicator for Analyze step ───
const SUB_PHASES = [
  { key: 'starting', label: 'Starting' },
  { key: 'exploring', label: 'Exploring' },
  { key: 'writing', label: 'Planning' },
  { key: 'done', label: 'Finalizing' },
];

function SubPhaseIndicator({ planPhase }) {
  const currentIdx = SUB_PHASES.findIndex(p => p.key === planPhase);

  return (
    <div className="flex items-center gap-2 justify-center py-2">
      {SUB_PHASES.map((sp, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={sp.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isComplete
                  ? 'bg-emerald-400'
                  : isCurrent
                    ? 'bg-claude animate-[pulse_1.5s_ease-in-out_infinite]'
                    : 'bg-surface-700'
              }`} />
              <span className={`text-[10px] font-medium transition-colors duration-200 ${
                isComplete ? 'text-emerald-400' : isCurrent ? 'text-claude' : 'text-surface-600'
              }`}>{sp.label}</span>
            </div>
            {i < SUB_PHASES.length - 1 && (
              <div className={`w-4 h-px ${isComplete ? 'bg-emerald-500/40' : 'bg-surface-700/50'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
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
  const [dependencies, setDependencies] = useState(c.dependencies);
  const [stats, setStats] = useState(c.stats);
  const [error, setError] = useState(c.error);
  const [showLogs, setShowLogs] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [approving, setApproving] = useState(false);
  const [showDag, setShowDag] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Save state to cache on every change
  useEffect(() => {
    Object.assign(getCache(projectId), { phase, planPhase, logs, analysis, proposals, dependencies, stats, error, topic, context, model, effort, granularity });
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

  // Elapsed timer — restore from cached elapsed on remount
  useEffect(() => {
    if (phase === 'thinking') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - (stats.elapsed || 0);
      }
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
        setDependencies(data.dependencies || []);
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


  const handleStart = async () => {
    if (!topic.trim()) return;
    setPhase('thinking');
    setPlanPhase('starting');
    setLogs([]);
    setAnalysis('');
    setProposals([]);
    setDependencies([]);
    setError(null);
    setStats({ elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 });
    startTimeRef.current = Date.now();
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
    // Adjust dependency indices: remove edges referencing idx, shift indices above idx
    setDependencies((prev) => prev
      .filter(([a, b]) => a !== idx && b !== idx)
      .map(([a, b]) => [a > idx ? a - 1 : a, b > idx ? b - 1 : b])
    );
  };

  const handleApprove = async () => {
    if (proposals.length === 0) return;
    setApproving(true);
    try {
      await api.approvePlan(projectId, proposals, model, dependencies.length > 0 ? dependencies : null, topic || null);
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
    setDependencies([]);
    setLogs([]);
    setAnalysis('');
    // Keep topic and context so user can modify
  };

  const isActive = phase === 'thinking';
  const totalTokens = stats.tokens.input + stats.tokens.output;

  // Type breakdown for review summary
  const typeBreakdown = useMemo(() => {
    const counts = {};
    for (const p of proposals) {
      const t = p.task_type || 'chore';
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts);
  }, [proposals]);

  const depCount = dependencies.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700/50 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-claude" />
            <h2 className="text-sm font-semibold">{t('planning.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step Indicator */}
        <StepIndicator phase={phase} t={t} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4 min-h-0">

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  STEP 1: Define Phase (idle / error)                      */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {(phase === 'idle' || phase === 'error') && (
            <div className="space-y-4">

              {/* Error Alert */}
              {error && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-400 font-medium">{t('planning.planningFailed')}</p>
                      <p className="text-[11px] text-red-400/70 mt-0.5">{error}</p>
                    </div>
                  </div>
                  {/* Show Claude's output so user can see what went wrong */}
                  {analysis && (
                    <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl overflow-hidden">
                      <button onClick={() => setShowAnalysis(!showAnalysis)}
                        className="flex items-center gap-1.5 w-full text-left px-4 py-2.5 text-xs font-medium text-surface-400 hover:text-surface-300 transition-colors">
                        {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <Brain size={12} /> Claude Output
                      </button>
                      {showAnalysis && (
                        <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                          <MdPreview content={analysis} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Topic Card */}
              <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-4">
                <label className="flex items-center gap-2 text-xs font-medium text-surface-300 mb-2.5">
                  <Sparkles size={13} className="text-claude" />
                  {t('planning.whatToBuild')}
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('planning.topicPlaceholder')}
                  rows={3}
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-surface-900/60 border border-surface-700/40 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude/50 focus:border-claude/30 placeholder-surface-600 resize-none transition-all duration-200"
                />
              </div>

              {/* Context Toggle */}
              <div>
                <button
                  onClick={() => setShowContext(!showContext)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showContext ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {t('planning.context')}
                  <span className="text-surface-600 font-normal">({t('common.optional')})</span>
                </button>
                {showContext && (
                  <div className="mt-2 bg-surface-800/40 border border-surface-700/30 rounded-xl p-4">
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder={t('planning.contextPlaceholder')}
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-surface-900/60 border border-surface-700/40 rounded-lg text-xs text-surface-300 focus:outline-none focus:ring-1 focus:ring-claude/50 focus:border-claude/30 placeholder-surface-600 resize-none transition-all duration-200"
                    />
                  </div>
                )}
              </div>

              {/* Configuration Cards — 3 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                {/* Granularity Card */}
                <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
                  <label className="block text-[11px] font-medium text-surface-400 mb-2">{t('planning.taskBreakdown')}</label>
                  <div className="space-y-1">
                    {GRANULARITIES.map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setGranularity(g.value)}
                        className={`w-full px-2.5 py-2 rounded-lg text-left transition-all duration-200 border ${
                          granularity === g.value
                            ? `${g.color} ring-1 ring-current/30 border-current/20`
                            : 'bg-transparent text-surface-500 hover:text-surface-300 border-transparent hover:bg-surface-800/60'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">{g.label}</div>
                        <div className="text-[9px] opacity-70 mt-0.5">{g.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Card */}
                <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
                  <label className="flex items-center gap-1 text-[11px] font-medium text-surface-400 mb-2">
                    <Cpu size={11} /> {t('planning.model')}
                  </label>
                  <div className="space-y-1">
                    {MODELS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setModel(m.value)}
                        className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-semibold text-left transition-all duration-200 border ${
                          model === m.value
                            ? `${m.color} ring-1 ring-current/30 border-current/20`
                            : 'bg-transparent text-surface-500 hover:text-surface-300 border-transparent hover:bg-surface-800/60'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Effort Card */}
                <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
                  <label className="flex items-center gap-1 text-[11px] font-medium text-surface-400 mb-2">
                    <Zap size={11} /> {t('planning.effort')}
                  </label>
                  <div className="space-y-1">
                    {EFFORTS.map((e) => (
                      <button
                        key={e.value}
                        onClick={() => setEffort(e.value)}
                        className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-semibold text-left transition-all duration-200 border ${
                          effort === e.value
                            ? `${e.color} ring-1 ring-current/30 border-current/20`
                            : 'bg-transparent text-surface-500 hover:text-surface-300 border-transparent hover:bg-surface-800/60'
                        }`}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  STEP 2: Analyze Phase (thinking)                         */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {isActive && (
            <div className="space-y-3">

              {/* Stats Bar */}
              <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl px-4 py-2.5 flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Clock size={12} />
                  <span className="font-medium">{formatElapsed(stats.elapsed)}</span>
                </div>
                {totalTokens > 0 && (
                  <div className="flex items-center gap-1.5 text-surface-400">
                    <Zap size={12} />
                    <span>{formatTokens(totalTokens)}</span>
                  </div>
                )}
                {stats.toolCalls > 0 && (
                  <div className="flex items-center gap-1.5 text-surface-400">
                    <Terminal size={12} />
                    <span>{stats.toolCalls} {t('planning.tools')}</span>
                  </div>
                )}
                {stats.turns > 0 && (
                  <div className="flex items-center gap-1.5 text-surface-400">
                    <Hash size={12} />
                    <span>{stats.turns} {t('planning.turns')}</span>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] text-surface-500">Active</span>
                </div>
              </div>

              {/* Topic Reminder */}
              {topic && (
                <div className="bg-surface-800/30 border border-surface-700/20 rounded-lg px-3.5 py-2.5">
                  <p className="text-[10px] text-surface-600 font-medium uppercase tracking-wide">{t('planning.planning')}</p>
                  <p className="text-xs text-surface-300 mt-1 line-clamp-2">{topic}</p>
                </div>
              )}

              {/* Sub-phase indicator */}
              <SubPhaseIndicator planPhase={planPhase} />

              {/* Live Activity Feed */}
              <div className="bg-surface-950/80 border border-surface-800/60 rounded-xl overflow-hidden">
                <div className="p-2.5 max-h-64 overflow-y-auto">
                  <PlanLogFeed logs={logs} isActive={isActive} />
                </div>
              </div>

              {/* Analysis Preview */}
              {analysis && (
                <div>
                  <button onClick={() => setShowAnalysis(!showAnalysis)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors">
                    {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Brain size={12} className="text-purple-400" />
                    {t('planning.claudeOutput')}
                  </button>
                  {showAnalysis && (
                    <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-4 max-h-40 overflow-y-auto">
                      <MdPreview content={analysis} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  STEP 3: Review Phase                                     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {phase === 'review' && (
            <div className="space-y-3">

              {/* Summary Bar */}
              <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap text-[11px]">
                <div className="flex items-center gap-1.5 text-surface-300 font-medium">
                  <ListChecks size={13} className="text-amber-400" />
                  {proposals.length} tasks
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {typeBreakdown.map(([type, count]) => (
                    <span key={type} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[type] || 'bg-surface-500/15 text-surface-400'}`}>
                      {count} {type}
                    </span>
                  ))}
                </div>
                {depCount > 0 && (
                  <div className="flex items-center gap-1 text-surface-400">
                    <GitBranch size={11} />
                    <span>{depCount} deps</span>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-1 text-surface-500">
                  <Clock size={10} />
                  <span>{formatElapsed(stats.elapsed)}</span>
                </div>
              </div>

              {/* Analysis Collapsible */}
              {analysis && (
                <div>
                  <button onClick={() => setShowAnalysis(!showAnalysis)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors">
                    {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Brain size={12} className="text-purple-400" />
                    {t('planning.analysis')}
                  </button>
                  {showAnalysis && (
                    <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-4 max-h-48 overflow-y-auto">
                      <MdPreview content={analysis} />
                    </div>
                  )}
                </div>
              )}

              {/* Activity Log Collapsible */}
              {logs.length > 0 && (
                <div>
                  <button onClick={() => setShowLogs(!showLogs)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors">
                    {showLogs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Terminal size={12} className="text-amber-400" />
                    {t('planning.activityLog')}
                    <span className="text-surface-600 font-normal">({logs.length} {t('planning.events')})</span>
                  </button>
                  {showLogs && (
                    <div className="bg-surface-950/80 border border-surface-800/60 rounded-xl p-2.5 max-h-48 overflow-y-auto">
                      <PlanLogFeed logs={logs} isActive={false} />
                    </div>
                  )}
                </div>
              )}

              {/* Task List */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-300">
                    <ListChecks size={13} className="text-amber-400" />
                    {t('planning.proposedTasks').replace('{count}', proposals.length)}
                  </label>
                  <span className="text-[10px] text-surface-600">{t('planning.removeHint')}</span>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {proposals.map((task, i) => {
                    const isExpanded = expandedTask === i;
                    const typeColor = TYPE_COLORS[task.task_type] || 'bg-surface-500/15 text-surface-400';
                    return (
                      <div key={i}
                        className={`rounded-xl border transition-all duration-200 ${
                          isExpanded
                            ? 'bg-surface-800/60 border-surface-600/50 ring-1 ring-surface-600/20'
                            : 'bg-surface-800/30 border-surface-700/30 hover:border-surface-600/50'
                        }`}>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : i)}>
                          {/* Left: number circle */}
                          <span className="w-5 h-5 rounded-full bg-surface-700/50 flex items-center justify-center text-[10px] text-surface-500 font-mono flex-shrink-0">
                            {i + 1}
                          </span>

                          {/* Center: badges + title */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor}`}>{task.task_type}</span>
                              {task.priority > 0 && (
                                <span className={`text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}>
                                  {PRIORITY_LABELS[task.priority]}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-surface-200 font-medium mt-1 leading-snug">{task.title}</p>
                          </div>

                          {/* Right: actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveProposal(i); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-600 hover:text-red-400 transition-colors"
                              title="Remove this task"
                            >
                              <Trash2 size={12} />
                            </button>
                            {isExpanded
                              ? <ChevronDown size={12} className="text-surface-500" />
                              : <ChevronRight size={12} className="text-surface-600" />
                            }
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-0 space-y-3 border-t border-surface-700/30 mx-3 mt-0">
                            {task.description && (
                              <div className="mt-3">
                                <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">{t('planning.description')}</span>
                                <div className="mt-1"><MdPreview content={task.description} /></div>
                              </div>
                            )}
                            {task.acceptance_criteria && (
                              <div>
                                <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">{t('planning.acceptanceCriteria')}</span>
                                <div className="mt-1"><MdPreview content={task.acceptance_criteria} /></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dependency Graph */}
              {dependencies.length > 0 && (
                <div>
                  <button onClick={() => setShowDag(!showDag)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors">
                    {showDag ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <GitBranch size={12} className="text-blue-400" />
                    {t('planning.dependencyGraph')}
                    <span className="text-surface-600 font-normal">({dependencies.length} {t('planning.edges')})</span>
                  </button>
                  {showDag && (
                    <div className="max-h-72 overflow-auto rounded-xl border border-surface-700/30">
                      <DependencyGraph
                        tasks={proposals.map((p, i) => ({ id: i, title: p.title, status: 'backlog', task_key: `#${i + 1}`, model: null }))}
                        edges={dependencies.map(([parentIdx, childIdx]) => ({ from: parentIdx, to: childIdx }))}
                        waves={computeWaves(proposals, dependencies)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  STEP 4: Complete Phase (approved)                        */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {phase === 'approved' && (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-5 ring-2 ring-emerald-500/20">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-surface-200 mb-2">
                {t('planning.tasksCreated').replace('{count}', proposals.length)}
              </h3>
              <p className="text-xs text-surface-500 text-center max-w-sm">
                {t('planning.allCreated')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-surface-800 flex-shrink-0">
          {isActive ? (
            <button onClick={handleCancel} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors">
              <StopCircle size={14} /> {t('planning.cancelBtn')}
            </button>
          ) : phase === 'review' ? (
            <>
              <button onClick={handleRevise} className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-xl transition-colors">
                <RotateCcw size={14} /> {t('planning.revise')}
              </button>
              <button onClick={handleApprove} disabled={proposals.length === 0 || approving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-colors">
                {approving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {approving ? t('planning.creating') : t('planning.approveCreate').replace('{count}', proposals.length)}
              </button>
            </>
          ) : phase === 'approved' ? (
            <>
              <button onClick={() => { setPhase('idle'); setProposals([]); setLogs([]); setAnalysis(''); }}
                className="px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-xl transition-colors">
                {t('planning.planAgain')}
              </button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors">
                <ArrowRight size={14} /> {t('planning.doneViewBoard')}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-xl transition-colors">
                {t('planning.cancelBtn')}
              </button>
              <button onClick={handleStart} disabled={!topic.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors">
                <Sparkles size={14} /> {t('planning.startPlanning')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
