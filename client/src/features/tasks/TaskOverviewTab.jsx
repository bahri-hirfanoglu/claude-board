import { Clock, Cpu, Coins, Activity, Tag, Calendar } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import { StatCard } from './StatCard';
import { formatTokens, formatDuration } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';

export function TaskOverviewTab({ d, detail, task }) {
  const { t } = useTranslation();
  const totalTokens = (d.input_tokens || 0) + (d.output_tokens || 0);
  const duration = formatDuration(d.started_at, d.completed_at, d.work_duration_ms, d.last_resumed_at);

  return (
    <div className="space-y-4">
      {/* Description */}
      {d.description && <MarkdownContent content={d.description} />}

      {/* Acceptance Criteria */}
      {d.acceptance_criteria && (
        <div className="bg-surface-800/30 rounded-lg px-4 py-3 border border-surface-700/30">
          <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">{t('detail.acceptanceCriteria')}</span>
          <div className="mt-1.5"><MarkdownContent content={d.acceptance_criteria} /></div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {duration && (
          <StatCard icon={Clock} label={t('detail.duration')} value={duration} />
        )}
        {totalTokens > 0 && (
          <StatCard icon={Cpu} label={t('detail.tokens')} value={formatTokens(totalTokens)}
            sub={`${(d.input_tokens || 0).toLocaleString()} in / ${(d.output_tokens || 0).toLocaleString()} out`} />
        )}
        {d.total_cost > 0 && (
          <StatCard icon={Coins} label={t('detail.cost')} value={`$${d.total_cost.toFixed(4)}`} />
        )}
        {d.num_turns > 0 && (
          <StatCard icon={Activity} label={t('detail.turns')} value={d.num_turns} />
        )}
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 pt-2 border-t border-surface-800 text-[10px] text-surface-600 flex-wrap">
        {d.model_used && <span className="flex items-center gap-1"><Tag size={9} />Model: {d.model_used}</span>}
        {d.started_at && <span className="flex items-center gap-1"><Calendar size={9} />Started: {new Date(d.started_at).toLocaleString()}</span>}
        {d.completed_at && <span className="flex items-center gap-1"><Calendar size={9} />Completed: {new Date(d.completed_at).toLocaleString()}</span>}
        {d.rate_limit_hits > 0 && <span className="text-amber-500">{d.rate_limit_hits} rate limit hits</span>}
      </div>
    </div>
  );
}
