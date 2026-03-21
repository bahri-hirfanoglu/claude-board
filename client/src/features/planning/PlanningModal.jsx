import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Cpu, Loader2, CheckCircle2, AlertCircle, StopCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';

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

const PHASES = {
  idle: { label: null, color: '' },
  thinking: { label: 'Claude is analyzing...', color: 'text-amber-400' },
  creating: { label: 'Creating tasks...', color: 'text-claude' },
  done: { label: 'Planning complete', color: 'text-emerald-400' },
  error: { label: 'Planning failed', color: 'text-red-400' },
};

export default function PlanningModal({ projectId, onClose }) {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [model, setModel] = useState('sonnet');
  const [effort, setEffort] = useState('medium');
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState('');
  const [createdTasks, setCreatedTasks] = useState([]);
  const [error, setError] = useState(null);
  const progressRef = useRef(null);

  // Listen for planning events
  useEffect(() => {
    const onProgress = (data) => {
      if (data.projectId !== projectId) return;
      setPhase('thinking');
      setProgress((prev) => prev + data.text);
    };
    const onCompleted = (data) => {
      if (data.projectId !== projectId) return;
      if (data.tasks?.length > 0) {
        setPhase('done');
        setCreatedTasks(data.tasks);
      } else {
        setPhase('error');
        setError('Claude could not generate tasks. Try rephrasing the topic.');
      }
    };
    const onCancelled = (data) => {
      if (data.projectId !== projectId) return;
      setPhase('idle');
      setProgress('');
    };

    socket.on('plan:progress', onProgress);
    socket.on('plan:completed', onCompleted);
    socket.on('plan:cancelled', onCancelled);
    return () => {
      socket.off('plan:progress', onProgress);
      socket.off('plan:completed', onCompleted);
      socket.off('plan:cancelled', onCancelled);
    };
  }, [projectId]);

  // Auto-scroll progress
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [progress]);

  const handleStart = async () => {
    if (!topic.trim()) return;
    setPhase('thinking');
    setProgress('');
    setCreatedTasks([]);
    setError(null);
    try {
      await api.startPlanning(projectId, { topic: topic.trim(), model, effort, context: context.trim() });
    } catch (e) {
      setPhase('error');
      setError(e.message);
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelPlanning(projectId);
    } catch {}
    setPhase('idle');
    setProgress('');
  };

  const isActive = phase === 'thinking' || phase === 'creating';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-claude" />
            <h2 className="text-sm font-semibold">Planning Mode</h2>
            {PHASES[phase].label && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-800 ${PHASES[phase].color}`}>
                {PHASES[phase].label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Topic input */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">
              What do you want to build?
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Build an authentication system with OAuth2, JWT tokens, role-based access control, and password reset flow"
              rows={3}
              disabled={isActive}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none disabled:opacity-50"
            />
          </div>

          {/* Context (optional) */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">
              Additional context
              <span className="text-surface-600 font-normal ml-1">— optional</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. We use Express.js backend with React frontend. Database is PostgreSQL with Prisma ORM."
              rows={2}
              disabled={isActive}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none disabled:opacity-50"
            />
          </div>

          {/* Model + Effort */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1">
                <Cpu size={11} />
                Model
              </label>
              <div className="flex gap-1">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModel(m.value)}
                    disabled={isActive}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 text-center ${
                      model === m.value
                        ? `${m.color} ring-1 ring-current`
                        : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1">
                Effort
              </label>
              <div className="flex gap-1">
                {EFFORTS.map((e) => (
                  <button
                    key={e.value}
                    onClick={() => setEffort(e.value)}
                    disabled={isActive}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 text-center ${
                      effort === e.value
                        ? `${e.color} ring-1 ring-current`
                        : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress output */}
          {progress && (
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Claude's analysis</label>
              <div
                ref={progressRef}
                className="bg-surface-950 border border-surface-800 rounded-lg p-3 text-xs text-surface-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed"
              >
                {progress}
                {isActive && <span className="inline-block w-1.5 h-3 bg-claude animate-pulse ml-0.5 align-text-bottom" />}
              </div>
            </div>
          )}

          {/* Created tasks */}
          {createdTasks.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 mb-2">
                <CheckCircle2 size={12} />
                {createdTasks.length} tasks created in Backlog
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {createdTasks.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-2 bg-surface-800/40 rounded-lg px-3 py-2 border border-surface-700/30">
                    <span className="text-[10px] text-surface-600 font-mono mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">{t.task_type}</span>
                        <span className="text-[10px] text-surface-500 font-mono">{t.task_key}</span>
                      </div>
                      <p className="text-[12px] text-surface-200 font-medium mt-0.5">{t.title}</p>
                      {t.description && (
                        <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-surface-800 flex-shrink-0">
          {isActive ? (
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <StopCircle size={14} />
              Cancel Planning
            </button>
          ) : phase === 'done' ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Done — View Board
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!topic.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
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
