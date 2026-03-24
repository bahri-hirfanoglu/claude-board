import { Activity, Cpu, Coins, Clock, Layers, CheckCircle2 } from 'lucide-react';
import { formatTokens } from '../../lib/formatters';

export default function PipelineStats({ tasks, waves }) {
  const running = tasks.filter(t => t.status === 'in_progress' || t.is_running);
  const completed = tasks.filter(t => t.status === 'done' || t.status === 'testing');
  const queued = tasks.filter(t => t.status === 'backlog');
  const totalTokens = tasks.reduce((sum, t) => sum + (t.input_tokens || 0) + (t.output_tokens || 0), 0);
  const totalCost = tasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);

  // Wave progress
  const waveProgress = waves.map((wave, i) => {
    const done = wave.filter(t => t.status === 'done' || t.status === 'testing').length;
    const active = wave.filter(t => t.status === 'in_progress' || t.is_running).length;
    return { index: i, total: wave.length, done, active };
  });

  return (
    <div className="bg-surface-800/40 border border-surface-700/30 rounded-lg px-4 py-2.5">
      {/* Wave progress bar */}
      {waveProgress.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Layers size={12} className="text-surface-500 flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {waveProgress.map(w => (
              <div key={w.index} className="flex items-center gap-1">
                <span className="text-[10px] text-surface-500">W{w.index}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: w.total }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < w.done ? 'bg-emerald-400' :
                        i < w.done + w.active ? 'bg-amber-400 animate-pulse' :
                        'bg-surface-600'
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
      <div className="flex items-center gap-4 text-[11px]">
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
        {totalTokens > 0 && (
          <span className="flex items-center gap-1 text-surface-400">
            <Cpu size={11} />
            {formatTokens(totalTokens)}
          </span>
        )}
        {totalCost > 0 && (
          <span className="flex items-center gap-1 text-surface-400">
            <Coins size={11} />
            ${totalCost.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}
