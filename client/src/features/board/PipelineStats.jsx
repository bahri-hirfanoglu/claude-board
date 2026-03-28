import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Coins,
  Clock,
  Layers,
  CheckCircle2,
  ShieldBan,
  BadgeCheck,
  XCircle,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { formatTokens } from '../../lib/formatters';
import { api } from '../../lib/api';
import { IS_TAURI } from '../../lib/tauriEvents';

export default function PipelineStats({ tasks, waves, projectId, project }) {
  const [pipelineData, setPipelineData] = useState(null);

  useEffect(() => {
    if (!IS_TAURI || !projectId) return;
    api
      .getPipelineStatus(projectId)
      .then(setPipelineData)
      .catch(() => {});
    const interval = setInterval(() => {
      api
        .getPipelineStatus(projectId)
        .then(setPipelineData)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  const running = tasks.filter((t) => t.status === 'in_progress' || t.is_running);
  const completed = tasks.filter((t) => t.status === 'done' || t.status === 'testing');
  const queued = tasks.filter((t) => t.status === 'backlog');
  const failed = tasks.filter((t) => t.status === 'failed');
  const awaitingApproval = tasks.filter((t) => t.status === 'awaiting_approval');
  const totalTokens = tasks.reduce((sum, t) => sum + (t.input_tokens || 0) + (t.output_tokens || 0), 0);
  const totalCost = tasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);

  const circuitBreakerActive = pipelineData?.circuitBreakerActive || false;
  const burnRate = pipelineData?.burnRate || 0;
  const bottlenecks = pipelineData?.bottlenecks || [];

  const handleResetCircuitBreaker = async () => {
    if (!IS_TAURI || !projectId) return;
    try {
      await api.resetCircuitBreaker(projectId);
      setPipelineData((prev) => (prev ? { ...prev, circuitBreakerActive: false, consecutiveFailures: 0 } : prev));
    } catch (e) {
      console.error('Failed to reset circuit breaker:', e);
    }
  };

  // Wave progress
  const waveProgress = waves.map((wave, i) => {
    const done = wave.filter((t) => t.status === 'done' || t.status === 'testing').length;
    const active = wave.filter((t) => t.status === 'in_progress' || t.is_running).length;
    return { index: i, total: wave.length, done, active };
  });

  return (
    <div className="space-y-2">
      {/* Circuit Breaker Alert */}
      {circuitBreakerActive && (
        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldBan size={14} className="text-red-400" />
            <span className="text-xs font-medium text-red-300">
              Circuit breaker active — queue paused after {pipelineData?.consecutiveFailures || 0} consecutive failures
            </span>
          </div>
          <button
            onClick={handleResetCircuitBreaker}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      )}

      {/* Awaiting Approval Banner */}
      {awaitingApproval.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <BadgeCheck size={14} className="text-amber-400" />
          <span className="text-xs font-medium text-amber-300">
            {awaitingApproval.length} task{awaitingApproval.length > 1 ? 's' : ''} awaiting approval
          </span>
          <span className="text-[10px] text-amber-400/70 ml-1">
            {awaitingApproval.map((t) => t.task_key || t.title).join(', ')}
          </span>
        </div>
      )}

      <div className="bg-surface-800/40 border border-surface-700/30 rounded-lg px-4 py-2.5">
        {/* Wave progress bar */}
        {waveProgress.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <Layers size={12} className="text-surface-500 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
              {waveProgress.map((w) => (
                <div key={w.index} className="flex items-center gap-1">
                  <span className="text-[10px] text-surface-500">W{w.index}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: w.total }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < w.done
                            ? 'bg-emerald-400'
                            : i < w.done + w.active
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-surface-600'
                        }`}
                      />
                    ))}
                  </div>
                  {w.index < waveProgress.length - 1 && (
                    <span className="text-surface-600 text-[10px] mx-0.5">&rarr;</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] flex-wrap">
          <span className="flex items-center gap-1 text-surface-400">
            <Activity size={11} className="text-claude" />
            <span className="text-surface-200 font-medium">{running.length}</span> running
          </span>
          <span className="flex items-center gap-1 text-surface-400">
            <Clock size={11} />
            <span className="text-surface-200 font-medium">{queued.length}</span> queued
          </span>
          <span className="flex items-center gap-1 text-surface-400">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-surface-200 font-medium">{completed.length}</span>/{tasks.length}
          </span>
          {failed.length > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle size={11} />
              <span className="font-medium">{failed.length}</span> failed
            </span>
          )}
          {awaitingApproval.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <BadgeCheck size={11} />
              <span className="font-medium">{awaitingApproval.length}</span> pending
            </span>
          )}
          {totalTokens > 0 && (
            <span className="flex items-center gap-1 text-surface-400">
              <Cpu size={11} />
              {formatTokens(totalTokens)}
            </span>
          )}
          {totalCost > 0 && (
            <span className="flex items-center gap-1 text-surface-400">
              <Coins size={11} />${totalCost.toFixed(3)}
            </span>
          )}
          {burnRate > 0 && (
            <span className="flex items-center gap-1 text-surface-400">
              <TrendingUp size={11} className="text-violet-400" />
              <span className="text-violet-300 font-medium">{Math.round(burnRate)}</span> tok/min
            </span>
          )}
        </div>

        {/* Bottlenecks row */}
        {bottlenecks.length > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-700/30">
            <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
            <span className="text-[10px] text-surface-500">Bottlenecks:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {bottlenecks.slice(0, 3).map((b) => (
                <span
                  key={b.taskId}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-300"
                >
                  {b.title?.substring(0, 25)}
                  {b.title?.length > 25 ? '...' : ''}
                  <span className="text-amber-400/60">({b.blockerCount})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
