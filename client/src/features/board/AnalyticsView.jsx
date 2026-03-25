import { useState, useEffect, useMemo } from 'react';
import {
  Coins, Cpu, Zap, Clock, TrendingUp, ArrowUpDown, ChevronUp, ChevronDown,
  RefreshCw, AlertTriangle, CheckCircle2, RotateCcw, Hash, Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatTokens } from '../../lib/formatters';
import { MODEL_DOT_COLORS, MODEL_COSTS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';

const MODEL_COLORS_HEX = { haiku: '#4ade80', sonnet: '#60a5fa', opus: '#c084fc', unknown: '#6b7280' };

function normalizeModel(raw) {
  if (!raw || !raw.trim()) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';
  return raw;
}

function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '-';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function StatCard({ icon: Icon, label, value, sublabel, color = 'text-surface-200', iconColor = 'text-surface-400' }) {
  return (
    <div className="bg-surface-800/50 rounded-lg px-4 py-3 border border-surface-700/30">
      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
        <Icon size={11} className={iconColor} />
        {label}
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-surface-600 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function BarChart({ data, colorMap, maxVal }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap?.[item.key] || '#DA7756' }} />
                <span className="text-xs text-surface-300 font-medium capitalize">{item.key}</span>
                <span className="text-[10px] text-surface-600">{item.count} tasks</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-surface-500">
                <span>{formatTokens(item.tokens || 0)} tokens</span>
                <span className="text-emerald-400">${(item.cost || 0).toFixed(3)}</span>
              </div>
            </div>
            <div className="h-3 bg-surface-800 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: colorMap?.[item.key] || '#DA7756' }}
              />
            </div>
          </div>
        );
      })}
      {data.length === 0 && <div className="text-[10px] text-surface-600 text-center py-2">No data</div>}
    </div>
  );
}

function CostTimeline({ data }) {
  if (data.length === 0) return <div className="text-[10px] text-surface-600 text-center py-4">No data in the last 14 days</div>;
  const maxCost = Math.max(...data.map(d => d.cost || 0), 0.001);
  const maxTokens = Math.max(...data.map(d => d.tokens || 0), 1);

  return (
    <div>
      <div className="flex items-end gap-1 h-28">
        {data.map((item, i) => {
          const costPct = ((item.cost || 0) / maxCost) * 100;
          const day = new Date(item.day);
          const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${label}: $${(item.cost || 0).toFixed(3)} | ${formatTokens(item.tokens || 0)} tokens | ${item.tasks} tasks`}>
              <span className="text-[8px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                ${(item.cost || 0).toFixed(2)}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 transition-colors"
                  style={{ height: `${Math.max(costPct, 8)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-surface-500">{new Date(data[0].day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span className="text-[9px] text-surface-500">{new Date(data[data.length - 1].day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

export default function AnalyticsView({ tasks, projectId }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('total_cost');
  const [sortDir, setSortDir] = useState('desc');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStats(projectId);
      setStats(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  // Compute analytics from tasks + stats
  const analytics = useMemo(() => {
    if (!tasks.length) return null;

    const totalCost = tasks.reduce((s, t) => s + (t.total_cost || 0), 0);
    const totalTokens = tasks.reduce((s, t) => s + (t.input_tokens || 0) + (t.output_tokens || 0), 0);
    const totalInput = tasks.reduce((s, t) => s + (t.input_tokens || 0), 0);
    const totalOutput = tasks.reduce((s, t) => s + (t.output_tokens || 0), 0);
    const totalCacheRead = tasks.reduce((s, t) => s + (t.cache_read_tokens || 0), 0);
    const tasksWithCost = tasks.filter(t => t.total_cost > 0);
    const avgCost = tasksWithCost.length > 0 ? totalCost / tasksWithCost.length : 0;
    const avgTokens = tasksWithCost.length > 0 ? totalTokens / tasksWithCost.length : 0;

    const completed = tasks.filter(t => t.status === 'done' || t.status === 'testing');
    const retried = tasks.filter(t => (t.retry_count || 0) > 0);
    const successRate = tasks.length > 0 ? (completed.length / tasks.length * 100) : 0;
    const cacheRate = totalInput > 0 ? (totalCacheRead / totalInput * 100) : 0;
    const totalTurns = tasks.reduce((s, t) => s + (t.num_turns || 0), 0);
    const avgTurns = tasksWithCost.length > 0 ? totalTurns / tasksWithCost.length : 0;

    // Throughput: tasks completed per hour (based on total work duration)
    const totalWorkMs = completed.reduce((s, t) => s + (t.work_duration_ms || 0), 0);
    const throughput = totalWorkMs > 0 ? (completed.length / (totalWorkMs / 3600000)) : 0;

    // Model breakdown from tasks
    const modelMap = {};
    tasks.forEach(task => {
      const m = normalizeModel(task.model_used || task.model);
      if (!modelMap[m]) modelMap[m] = { key: m, count: 0, tokens: 0, cost: 0, duration: 0 };
      modelMap[m].count++;
      modelMap[m].tokens += (task.input_tokens || 0) + (task.output_tokens || 0);
      modelMap[m].cost += task.total_cost || 0;
      modelMap[m].duration += task.work_duration_ms || 0;
    });
    const modelData = Object.values(modelMap).sort((a, b) => b.cost - a.cost);

    // Completed tasks for table
    const completedTasks = tasks
      .filter(t => t.started_at && (t.total_cost > 0 || t.input_tokens > 0))
      .map(t => ({
        ...t,
        _tokens: (t.input_tokens || 0) + (t.output_tokens || 0),
        _model: normalizeModel(t.model_used || t.model),
        _durationMin: t.work_duration_ms ? t.work_duration_ms / 60000 : null,
      }));

    return {
      totalCost, totalTokens, totalInput, totalOutput, avgCost, avgTokens,
      successRate, cacheRate, avgTurns, throughput, retried: retried.length,
      modelData, completedTasks, completed: completed.length, total: tasks.length,
    };
  }, [tasks]);

  // Sort completed tasks
  const sortedTasks = useMemo(() => {
    if (!analytics) return [];
    return [...analytics.completedTasks].sort((a, b) => {
      let va, vb;
      if (sortField === 'total_cost') { va = a.total_cost || 0; vb = b.total_cost || 0; }
      else if (sortField === 'tokens') { va = a._tokens; vb = b._tokens; }
      else if (sortField === 'duration') { va = a.work_duration_ms || 0; vb = b.work_duration_ms || 0; }
      else { va = a.total_cost || 0; vb = b.total_cost || 0; }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [analytics, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="text-surface-600" />;
    return sortDir === 'desc' ? <ChevronDown size={10} className="text-claude" /> : <ChevronUp size={10} className="text-claude" />;
  };

  // Cost timeline from recentCompleted
  const costTimeline = useMemo(() => {
    if (!stats?.recentCompleted) return [];
    const dayMap = {};
    stats.recentCompleted.forEach(t => {
      if (!t.completedAt) return;
      const day = t.completedAt.split(/[T ]/)[0];
      if (!dayMap[day]) dayMap[day] = { day, cost: 0, tokens: 0, tasks: 0 };
      dayMap[day].cost += t.totalCost || 0;
      dayMap[day].tokens += (t.inputTokens || 0) + (t.outputTokens || 0);
      dayMap[day].tasks++;
    });
    return Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));
  }, [stats]);

  if (!analytics) {
    return (
      <div className="h-full flex items-center justify-center text-surface-500 text-sm">
        {t('analytics.noData')}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
          <TrendingUp size={15} className="text-claude" />
          {t('analytics.title')}
        </h2>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard icon={Coins} label={t('analytics.totalCost')} value={`$${analytics.totalCost.toFixed(3)}`}
          sublabel={`${analytics.total} tasks`} color="text-emerald-400" iconColor="text-emerald-400" />
        <StatCard icon={Zap} label={t('analytics.totalTokens')} value={formatTokens(analytics.totalTokens)}
          sublabel={`${formatTokens(analytics.totalInput)} in / ${formatTokens(analytics.totalOutput)} out`} color="text-blue-400" iconColor="text-blue-400" />
        <StatCard icon={Coins} label={t('analytics.avgCost')} value={`$${analytics.avgCost.toFixed(3)}`}
          sublabel={t('analytics.perTask')} color="text-amber-400" iconColor="text-amber-400" />
        <StatCard icon={Cpu} label={t('analytics.avgTokens')} value={formatTokens(analytics.avgTokens)}
          sublabel={t('analytics.perTask')} color="text-purple-400" iconColor="text-purple-400" />
      </div>

      {/* Model Comparison */}
      {analytics.modelData.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-surface-400 mb-2">{t('analytics.modelComparison')}</h4>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/30">
            <BarChart data={analytics.modelData.map(m => ({ ...m, value: m.cost }))} colorMap={MODEL_COLORS_HEX} />
          </div>
        </div>
      )}

      {/* Cost Timeline */}
      {costTimeline.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-surface-400 mb-2">{t('analytics.costTrend')}</h4>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/30">
            <CostTimeline data={costTimeline} />
          </div>
        </div>
      )}

      {/* Efficiency Metrics */}
      <div>
        <h4 className="text-xs font-medium text-surface-400 mb-2">{t('analytics.efficiency')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/30 text-center">
            <div className="text-[10px] text-surface-500 mb-0.5 flex items-center justify-center gap-1">
              <TrendingUp size={10} />{t('analytics.throughput')}
            </div>
            <div className="text-sm font-semibold text-surface-200">
              {analytics.throughput > 0 ? analytics.throughput.toFixed(1) : '-'}
            </div>
            <div className="text-[9px] text-surface-600">{t('analytics.tasksPerHour')}</div>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/30 text-center">
            <div className="text-[10px] text-surface-500 mb-0.5 flex items-center justify-center gap-1">
              <CheckCircle2 size={10} className="text-emerald-400" />{t('analytics.successRate')}
            </div>
            <div className={`text-sm font-semibold ${analytics.successRate > 80 ? 'text-emerald-400' : analytics.successRate > 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {analytics.successRate.toFixed(0)}%
            </div>
            <div className="text-[9px] text-surface-600">{analytics.completed}/{analytics.total}</div>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/30 text-center">
            <div className="text-[10px] text-surface-500 mb-0.5 flex items-center justify-center gap-1">
              <Layers size={10} className="text-cyan-400" />{t('analytics.cacheRate')}
            </div>
            <div className="text-sm font-semibold text-cyan-400">{analytics.cacheRate.toFixed(0)}%</div>
            <div className="text-[9px] text-surface-600">cache hit</div>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/30 text-center">
            <div className="text-[10px] text-surface-500 mb-0.5 flex items-center justify-center gap-1">
              <Hash size={10} />{t('analytics.avgTurns')}
            </div>
            <div className="text-sm font-semibold text-surface-200">{analytics.avgTurns.toFixed(1)}</div>
            <div className="text-[9px] text-surface-600">{t('analytics.perTask')}</div>
          </div>
        </div>
      </div>

      {/* Task Performance Table */}
      {sortedTasks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-surface-400 mb-2">{t('analytics.taskPerformance')}</h4>
          <div className="rounded-lg bg-surface-800/50 border border-surface-700/30 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-700/30">
                  <th className="text-left px-3 py-2 text-surface-500 font-medium">{t('analytics.task')}</th>
                  <th className="text-left px-3 py-2 text-surface-500 font-medium">{t('analytics.model')}</th>
                  <th className="text-right px-3 py-2 text-surface-500 font-medium cursor-pointer hover:text-surface-300" onClick={() => toggleSort('duration')}>
                    <span className="flex items-center justify-end gap-1">{t('analytics.duration')} <SortIcon field="duration" /></span>
                  </th>
                  <th className="text-right px-3 py-2 text-surface-500 font-medium cursor-pointer hover:text-surface-300" onClick={() => toggleSort('tokens')}>
                    <span className="flex items-center justify-end gap-1">{t('analytics.tokens')} <SortIcon field="tokens" /></span>
                  </th>
                  <th className="text-right px-3 py-2 text-surface-500 font-medium cursor-pointer hover:text-surface-300" onClick={() => toggleSort('total_cost')}>
                    <span className="flex items-center justify-end gap-1">{t('analytics.cost')} <SortIcon field="total_cost" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.slice(0, 20).map((task, i) => {
                  const isTopCost = i < 3 && sortField === 'total_cost' && sortDir === 'desc';
                  return (
                    <tr key={task.id} className={`border-b border-surface-700/20 hover:bg-surface-700/20 ${isTopCost ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {task.task_key && <span className="text-[9px] text-surface-600 font-mono">{task.task_key}</span>}
                          <span className="text-surface-200 truncate max-w-[200px]">{task.title}</span>
                          {isTopCost && <AlertTriangle size={10} className="text-amber-400 flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS_HEX[task._model] || '#6b7280' }} />
                          <span className="text-surface-300 capitalize">{task._model}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-surface-400">
                        {task._durationMin != null ? formatDuration(task._durationMin) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-surface-400">{formatTokens(task._tokens)}</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-medium">
                        ${(task.total_cost || 0).toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
