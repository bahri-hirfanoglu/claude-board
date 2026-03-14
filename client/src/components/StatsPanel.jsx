import { useState, useEffect } from 'react';
import { X, RefreshCw, BarChart3, Clock, CheckCircle2, TrendingUp, Layers, Cpu, Coins, AlertTriangle, Zap } from 'lucide-react';
import { api } from '../api';

const STATUS_LABELS = { backlog: 'Backlog', in_progress: 'In Progress', testing: 'Testing', done: 'Done' };
const STATUS_COLORS = { backlog: '#918678', in_progress: '#f59e0b', testing: '#DA7756', done: '#34d399' };
const TYPE_COLORS = { feature: '#3b82f6', bugfix: '#ef4444', refactor: '#a855f7', docs: '#22c55e', test: '#eab308', chore: '#6b7280' };
const PRIORITY_LABELS = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High' };
const PRIORITY_COLORS = { 0: '#6b7280', 1: '#eab308', 2: '#f97316', 3: '#ef4444' };
const MODEL_COLORS = { haiku: '#22c55e', sonnet: '#3b82f6', opus: '#a855f7', unknown: '#6b7280' };

function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '-';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatTokens(n) {
  if (!n || n === 0) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function BarChart({ data, colorMap, labelMap, maxVal }) {
  const max = maxVal || Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-1.5">
      {data.map((item, i) => {
        const key = item.key;
        const pct = (item.count / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-surface-400 w-20 text-right truncate">
              {labelMap?.[key] || key}
            </span>
            <div className="flex-1 h-5 bg-surface-800 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: colorMap?.[key] || '#DA7756' }}
              />
            </div>
            <span className="text-[10px] text-surface-400 w-6 text-right">{item.count}</span>
          </div>
        );
      })}
      {data.length === 0 && (
        <div className="text-[10px] text-surface-600 text-center py-2">No data</div>
      )}
    </div>
  );
}

function TimelineChart({ data }) {
  if (data.length === 0) return <div className="text-[10px] text-surface-600 text-center py-4">No completions in the last 14 days</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-24">
      {data.map((item, i) => {
        const pct = (item.count / max) * 100;
        const day = new Date(item.day);
        const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${label}: ${item.count} tasks`}>
            <span className="text-[8px] text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.count}
            </span>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t bg-claude/70 hover:bg-claude transition-colors"
                style={{ height: `${Math.max(pct, 5)}%` }}
              />
            </div>
            <span className="text-[7px] text-surface-600 -rotate-45 origin-top-left whitespace-nowrap">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPanel({ projectId, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStats(projectId);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const totalTasks = stats?.byStatus?.reduce((sum, s) => sum + s.count, 0) || 0;
  const doneCount = stats?.byStatus?.find(s => s.status === 'done')?.count || 0;
  const inProgressCount = stats?.byStatus?.find(s => s.status === 'in_progress')?.count || 0;

  const statusData = (stats?.byStatus || []).map(s => ({ key: s.status, count: s.count }));
  const typeData = (stats?.byType || []).map(s => ({ key: s.task_type || 'feature', count: s.count }));
  const priorityData = (stats?.byPriority || []).map(s => ({ key: String(s.priority), count: s.count }));

  const usage = stats?.claudeUsage || {};
  const totalAllTokens = (usage.total_input_tokens || 0) + (usage.total_output_tokens || 0);

  return (
    <div className="w-[420px] flex-shrink-0 flex flex-col bg-surface-900 border-l border-surface-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-claude" />
          <h3 className="text-sm font-medium">Project Statistics</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading && !stats ? (
          <div className="text-center text-surface-600 py-12 text-sm">Loading...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers size={12} className="text-surface-400" />
                  <span className="text-[10px] text-surface-500 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-xl font-semibold text-surface-100">{totalTasks}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span className="text-[10px] text-surface-500 uppercase tracking-wider">Done</span>
                </div>
                <div className="text-xl font-semibold text-emerald-400">{doneCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={12} className="text-amber-400" />
                  <span className="text-[10px] text-surface-500 uppercase tracking-wider">Active</span>
                </div>
                <div className="text-xl font-semibold text-amber-400">{inProgressCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={12} className="text-claude" />
                  <span className="text-[10px] text-surface-500 uppercase tracking-wider">Avg Time</span>
                </div>
                <div className="text-xl font-semibold text-claude">
                  {formatDuration(stats?.duration?.avg_minutes)}
                </div>
              </div>
            </div>

            {/* Claude Usage Overview */}
            {totalAllTokens > 0 && (
              <div>
                <h4 className="text-xs font-medium text-surface-400 mb-2">Claude Usage</h4>
                <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Cpu size={10} className="text-blue-400" />
                        <span className="text-[10px] text-surface-500">Total Tokens</span>
                      </div>
                      <div className="text-sm font-semibold text-surface-200">{formatTokens(totalAllTokens)}</div>
                      <div className="text-[9px] text-surface-600 mt-0.5">
                        {formatTokens(usage.total_input_tokens || 0)} in / {formatTokens(usage.total_output_tokens || 0)} out
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Coins size={10} className="text-emerald-400" />
                        <span className="text-[10px] text-surface-500">Total Cost</span>
                      </div>
                      <div className="text-sm font-semibold text-emerald-400">
                        ${(usage.total_cost || 0).toFixed(4)}
                      </div>
                      <div className="text-[9px] text-surface-600 mt-0.5">
                        {usage.tasks_with_usage || 0} tasks tracked
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Zap size={10} className="text-amber-400" />
                        <span className="text-[10px] text-surface-500">Turns</span>
                      </div>
                      <div className="text-xs font-medium text-surface-300">{usage.total_turns || 0}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <AlertTriangle size={10} className="text-red-400" />
                        <span className="text-[10px] text-surface-500">Rate Limits</span>
                      </div>
                      <div className={`text-xs font-medium ${(usage.total_rate_limits || 0) > 0 ? 'text-red-400' : 'text-surface-300'}`}>
                        {usage.total_rate_limits || 0}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Cpu size={10} className="text-surface-400" />
                        <span className="text-[10px] text-surface-500">Cache</span>
                      </div>
                      <div className="text-xs font-medium text-surface-300">{formatTokens(usage.total_cache_read || 0)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Model Breakdown */}
            {stats?.modelBreakdown?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-surface-400 mb-2">By Model</h4>
                <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50 space-y-2">
                  {stats.modelBreakdown.map((m, i) => {
                    const name = m.model_name || 'unknown';
                    const displayName = name.includes('claude') ? name.split('-').slice(-1)[0] : name;
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[displayName] || MODEL_COLORS[name] || '#6b7280' }} />
                          <span className="text-xs text-surface-300 font-medium">{name}</span>
                          <span className="text-[10px] text-surface-600">{m.count} tasks</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-surface-500">
                          <span>{formatTokens(m.total_tokens)} tokens</span>
                          {m.total_cost > 0 && <span>${m.total_cost.toFixed(4)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completion Timeline */}
            <div>
              <h4 className="text-xs font-medium text-surface-400 mb-2">Completion Timeline (14 days)</h4>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <TimelineChart data={stats?.timeline || []} />
              </div>
            </div>

            {/* Tasks by Status */}
            <div>
              <h4 className="text-xs font-medium text-surface-400 mb-2">By Status</h4>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <BarChart data={statusData} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} />
              </div>
            </div>

            {/* Tasks by Type */}
            <div>
              <h4 className="text-xs font-medium text-surface-400 mb-2">By Type</h4>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <BarChart data={typeData} colorMap={TYPE_COLORS} />
              </div>
            </div>

            {/* Tasks by Priority */}
            <div>
              <h4 className="text-xs font-medium text-surface-400 mb-2">By Priority</h4>
              <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                <BarChart data={priorityData} colorMap={PRIORITY_COLORS} labelMap={PRIORITY_LABELS} />
              </div>
            </div>

            {/* Recent Completed with usage */}
            {stats?.recentCompleted?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-surface-400 mb-2">Recently Completed</h4>
                <div className="space-y-1.5">
                  {stats.recentCompleted.map((task, i) => {
                    const taskTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
                    return (
                      <div key={i} className="p-2.5 rounded-lg bg-surface-800 border border-surface-700/50">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-surface-200 truncate">{task.title}</div>
                            <div className="text-[10px] text-surface-500 mt-0.5">
                              {task.task_type || 'feature'} &middot; {task.model_used || task.model || 'sonnet'} &middot; {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-surface-400 ml-2 flex-shrink-0">
                            <Clock size={10} />
                            {formatDuration(task.duration_minutes)}
                          </div>
                        </div>
                        {taskTokens > 0 && (
                          <div className="flex items-center gap-3 mt-1.5 text-[9px] text-surface-600">
                            <span>{formatTokens(taskTokens)} tokens</span>
                            <span>{(task.input_tokens || 0).toLocaleString()} in / {(task.output_tokens || 0).toLocaleString()} out</span>
                            {task.total_cost > 0 && <span>${task.total_cost.toFixed(4)}</span>}
                            {task.num_turns > 0 && <span>{task.num_turns} turns</span>}
                            {task.rate_limit_hits > 0 && <span className="text-amber-500">{task.rate_limit_hits} rate limits</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Duration Stats */}
            {stats?.duration?.count > 0 && (
              <div>
                <h4 className="text-xs font-medium text-surface-400 mb-2">Duration Statistics</h4>
                <div className="p-3 rounded-lg bg-surface-800 border border-surface-700/50">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[10px] text-surface-500 mb-0.5">Fastest</div>
                      <div className="text-xs font-medium text-emerald-400">{formatDuration(stats.duration.min_minutes)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-surface-500 mb-0.5">Average</div>
                      <div className="text-xs font-medium text-claude">{formatDuration(stats.duration.avg_minutes)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-surface-500 mb-0.5">Slowest</div>
                      <div className="text-xs font-medium text-red-400">{formatDuration(stats.duration.max_minutes)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-surface-600 text-center mt-2">
                    Based on {stats.duration.count} completed task{stats.duration.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
