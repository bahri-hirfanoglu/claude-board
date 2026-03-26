import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { formatTokens } from '../../lib/formatters';
import { MODEL_COLORS } from './dashboardConstants';
import { normalizeModelName } from './dashboardHelpers';

// Cache outside component so it survives remounts — shared with Dashboard
export let usageCache = null;
export function setUsageCache(val) { usageCache = val; }

export function ClaudeUsageCard({ t }) {
  const [data, setData] = useState(usageCache);

  useEffect(() => {
    // Show cache immediately, refresh in background
    if (usageCache) setData(usageCache);
    api.getClaudeUsage().then(d => { usageCache = d; setData(d); }).catch(() => {});
  }, []);

  if (!data?.usage) return null;

  const u = data.usage;

  if (!u.tasks_with_usage) {
    return (
      <div className="mb-8 rounded-xl bg-gradient-to-br from-surface-800/80 to-surface-900 border border-surface-700/50 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-700/30">
          <Zap size={14} className="text-claude" />
          <h2 className="text-sm font-semibold">{t('usage.title')}</h2>
        </div>
        <div className="p-5 text-center text-surface-600 text-sm py-8">
          {t('usage.noData')}
        </div>
      </div>
    );
  }
  const totalTokens = (u.input_tokens || 0) + (u.output_tokens || 0);
  const inputPct = totalTokens > 0 ? ((u.input_tokens || 0) / totalTokens * 100) : 0;
  const models = data.models || [];
  const timeline = data.timeline || [];
  const limits = data.limits || null;

  // Sparkline
  const maxTokens = Math.max(...timeline.map(d => d.tokens || 0), 1);

  // Reset countdown
  const resetTime = limits?.resets_at ? new Date(limits.resets_at * 1000) : null;
  const resetsIn = resetTime ? Math.max(0, Math.floor((resetTime - Date.now()) / 60000)) : null;
  const resetLabel = resetsIn != null
    ? resetsIn > 60 ? `${Math.floor(resetsIn / 60)}h ${resetsIn % 60}m` : `${resetsIn}m`
    : null;

  return (
    <div className="mb-8 rounded-xl bg-gradient-to-br from-surface-800/80 to-surface-900 border border-surface-700/50 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-700/30">
        <Zap size={14} className="text-claude" />
        <h2 className="text-sm font-semibold">{t('usage.title')}</h2>
        <div className="flex items-center gap-3 ml-auto">
          {limits?.last_model && (
            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-medium">
              {limits.last_model.replace('claude-', '').replace(/\[.*\]/, '')}
            </span>
          )}
          {limits?.context_window > 0 && (
            <span className="text-[10px] text-surface-500">{formatTokens(limits.context_window)} {t('usage.context')}</span>
          )}
          {limits?.rate_limit_type && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              limits.status === 'allowed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {limits.status === 'allowed' ? t('status.active') : t('usage.rateLimited')}
            </span>
          )}
          {resetLabel && (
            <span className="text-[10px] text-surface-500">{t('usage.resetsIn')} {resetLabel}</span>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Top stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">{t('usage.totalTokens')}</div>
            <div className="text-xl font-bold text-surface-100">{formatTokens(totalTokens)}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${inputPct}%` }} />
              </div>
              <span className="text-[9px] text-surface-600">{inputPct.toFixed(0)}% {t('usage.input')}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">{t('usage.totalCost')}</div>
            <div className="text-xl font-bold text-surface-100">${(u.total_cost || 0).toFixed(2)}</div>
            <div className="text-[10px] text-surface-600 mt-1">
              ~${totalTokens > 0 ? ((u.total_cost || 0) / (totalTokens / 1e6)).toFixed(2) : '0'}{t('usage.perMTokens')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">{t('usage.turns')}</div>
            <div className="text-xl font-bold text-surface-100">{(u.total_turns || 0).toLocaleString()}</div>
            <div className="text-[10px] text-surface-600 mt-1">
              ~{u.tasks_with_usage > 0 ? Math.round((u.total_turns || 0) / u.tasks_with_usage) : 0} {t('usage.avgPerTask')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">{t('usage.rateLimits')}</div>
            <div className={`text-xl font-bold ${(u.rate_limit_hits || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {u.rate_limit_hits || 0}
            </div>
            <div className="text-[10px] text-surface-600 mt-1">
              {(u.rate_limit_hits || 0) > 0 ? t('usage.hitsEncountered') : t('usage.noLimitsHit')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Model breakdown */}
          {models.length > 0 && (
            <div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">{t('usage.modelBreakdown')}</div>
              <div className="space-y-2">
                {models.map(m => {
                  const modelTotal = (m.input_tokens || 0) + (m.output_tokens || 0);
                  const pct = totalTokens > 0 ? (modelTotal / totalTokens * 100) : 0;
                  const displayName = normalizeModelName(m.model);
                  const colorClass = MODEL_COLORS[displayName] || MODEL_COLORS.unknown;
                  return (
                    <div key={m.model || 'unknown'} className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${colorClass} flex-shrink-0`} />
                      <span className="text-xs text-surface-300 w-16 capitalize">{displayName}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-surface-500 w-12 text-right">{formatTokens(modelTotal)}</span>
                      <span className="text-[10px] text-surface-600 w-16 text-right">${(m.cost || 0).toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Usage sparkline (last 30 days) */}
          {timeline.length > 1 && (
            <div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">{t('usage.30day')}</div>
              <div className="flex items-end gap-px h-16">
                {timeline.slice(-30).map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-claude/40 hover:bg-claude/70 rounded-t-sm transition-colors cursor-default"
                    style={{ height: `${Math.max(2, (d.tokens / maxTokens) * 100)}%` }}
                    title={`${d.day}: ${formatTokens(d.tokens)} tokens, $${(d.cost || 0).toFixed(3)}`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-surface-700">{timeline[0]?.day?.slice(5)}</span>
                <span className="text-[8px] text-surface-700">{timeline[timeline.length - 1]?.day?.slice(5)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Cache stats */}
        {(u.cache_read || 0) > 0 && (
          <div className="mt-4 pt-3 border-t border-surface-700/30 flex items-center gap-4 text-[10px] text-surface-500">
            <span>{t('usage.cacheRead')}: {formatTokens(u.cache_read)}</span>
            <span>{t('usage.cacheCreated')}: {formatTokens(u.cache_creation)}</span>
            <span className="text-emerald-500/70">
              {totalTokens > 0 ? `${((u.cache_read / (totalTokens + u.cache_read)) * 100).toFixed(0)}% ${t('usage.cacheHit')}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
