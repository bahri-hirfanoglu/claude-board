import { useState, useEffect, useMemo } from 'react';
import { Plus, FolderOpen, Cpu, Coins, Clock, CheckCircle2, Activity, Layers, Zap, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import Avatar from 'boring-avatars';
import { api } from '../../lib/api';
import { formatTokens, formatTimeAgo as timeAgo } from '../../lib/formatters';
import { AVATAR_VARIANTS, AVATAR_COLORS } from '../../lib/constants';

function MiniStatusBar({ backlog, active, testing, done, total }) {
  if (total === 0) return null;
  const segments = [
    { count: done, color: 'bg-emerald-400', label: 'Done' },
    { count: testing, color: 'bg-claude', label: 'Testing' },
    { count: active, color: 'bg-amber-400', label: 'Active' },
    { count: backlog, color: 'bg-surface-500', label: 'Backlog' },
  ];
  return (
    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-surface-700">
      {segments.map((s, i) => s.count > 0 && (
        <div
          key={i}
          className={`${s.color} transition-all duration-500`}
          style={{ width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${s.count}`}
        />
      ))}
    </div>
  );
}

function ProjectCard({ project, onSelect }) {
  const total = project.total_tasks || 0;
  const tokens = formatTokens(project.total_tokens || 0);
  const variant = project.icon || 'marble';
  const seed = project.icon_seed || project.name;

  return (
    <button
      onClick={() => onSelect(project)}
      className="group text-left p-5 rounded-xl bg-surface-800 border border-surface-700/50 hover:border-claude/40 hover:shadow-xl hover:shadow-black/20 transition-all duration-200 flex flex-col"
    >
      <div className="flex items-start gap-3.5 mb-3">
        <div className="flex-shrink-0 rounded-xl overflow-hidden ring-2 ring-surface-700 group-hover:ring-claude/30 transition-all">
          <Avatar size={48} name={seed} variant={variant} colors={AVATAR_COLORS} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-surface-100 group-hover:text-white truncate transition-colors">
            {project.name}
          </h3>
          <p className="text-[11px] text-surface-500 font-mono truncate mt-0.5">{project.slug}</p>
        </div>
      </div>

      <p className="text-[10px] text-surface-600 font-mono truncate mb-3" title={project.working_dir}>
        {project.working_dir}
      </p>

      {total > 0 && (
        <MiniStatusBar
          backlog={project.backlog_tasks || 0}
          active={project.active_tasks || 0}
          testing={project.testing_tasks || 0}
          done={project.done_tasks || 0}
          total={total}
        />
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1 text-[10px] text-surface-500">
          <Layers size={10} />
          <span>{total} tasks</span>
        </div>
        {(project.done_tasks || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500">
            <CheckCircle2 size={10} />
            <span>{project.done_tasks} done</span>
          </div>
        )}
        {(project.active_tasks || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Activity size={10} className="animate-pulse" />
            <span>{project.active_tasks} active</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {tokens && (
          <div className="flex items-center gap-1 text-[10px] text-surface-500">
            <Cpu size={10} />
            <span>{tokens} tokens</span>
          </div>
        )}
        {(project.total_cost || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-surface-500">
            <Coins size={10} />
            <span>${project.total_cost.toFixed(4)}</span>
          </div>
        )}
        {project.last_activity && (
          <div className="flex items-center gap-1 text-[10px] text-surface-600 ml-auto">
            <Clock size={10} />
            <span>{timeAgo(project.last_activity)}</span>
          </div>
        )}
      </div>
    </button>
  );
}

const MODEL_COLORS = { opus: 'bg-purple-500', sonnet: 'bg-blue-500', haiku: 'bg-green-500', unknown: 'bg-surface-500' };

function ClaudeUsageCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getClaudeUsage().then(setData).catch(err => console.error('Claude usage fetch failed:', err));
  }, []);

  if (!data?.usage) return null;

  const u = data.usage;

  if (!u.tasks_with_usage) {
    return (
      <div className="mb-8 rounded-xl bg-gradient-to-br from-surface-800/80 to-surface-900 border border-surface-700/50 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-700/30">
          <Zap size={14} className="text-claude" />
          <h2 className="text-sm font-semibold">Claude Usage</h2>
        </div>
        <div className="p-5 text-center text-surface-600 text-sm py-8">
          No Claude usage data yet. Start a task to see token statistics here.
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
        <h2 className="text-sm font-semibold">Claude Usage</h2>
        <div className="flex items-center gap-3 ml-auto">
          {limits?.last_model && (
            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-medium">
              {limits.last_model.replace('claude-', '').replace(/\[.*\]/, '')}
            </span>
          )}
          {limits?.context_window > 0 && (
            <span className="text-[10px] text-surface-500">{formatTokens(limits.context_window)} ctx</span>
          )}
          {limits?.rate_limit_type && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              limits.status === 'allowed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {limits.status === 'allowed' ? 'Active' : 'Rate Limited'}
            </span>
          )}
          {resetLabel && (
            <span className="text-[10px] text-surface-500">resets in {resetLabel}</span>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Top stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Total Tokens</div>
            <div className="text-xl font-bold text-surface-100">{formatTokens(totalTokens)}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${inputPct}%` }} />
              </div>
              <span className="text-[9px] text-surface-600">{inputPct.toFixed(0)}% in</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Total Cost</div>
            <div className="text-xl font-bold text-surface-100">${(u.total_cost || 0).toFixed(2)}</div>
            <div className="text-[10px] text-surface-600 mt-1">
              ~${totalTokens > 0 ? ((u.total_cost || 0) / (totalTokens / 1e6)).toFixed(2) : '0'}/M tokens
            </div>
          </div>
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Turns</div>
            <div className="text-xl font-bold text-surface-100">{(u.total_turns || 0).toLocaleString()}</div>
            <div className="text-[10px] text-surface-600 mt-1">
              ~{u.tasks_with_usage > 0 ? Math.round((u.total_turns || 0) / u.tasks_with_usage) : 0} avg/task
            </div>
          </div>
          <div>
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Rate Limits</div>
            <div className={`text-xl font-bold ${(u.rate_limit_hits || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {u.rate_limit_hits || 0}
            </div>
            <div className="text-[10px] text-surface-600 mt-1">
              {(u.rate_limit_hits || 0) > 0 ? 'hits encountered' : 'no limits hit'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Model breakdown */}
          {models.length > 0 && (
            <div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Model Breakdown</div>
              <div className="space-y-2">
                {models.map(m => {
                  const modelTotal = (m.input_tokens || 0) + (m.output_tokens || 0);
                  const pct = totalTokens > 0 ? (modelTotal / totalTokens * 100) : 0;
                  const colorClass = MODEL_COLORS[m.model] || MODEL_COLORS.unknown;
                  return (
                    <div key={m.model} className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${colorClass} flex-shrink-0`} />
                      <span className="text-xs text-surface-300 w-16">{m.model}</span>
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
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">30-Day Usage</div>
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
            <span>Cache read: {formatTokens(u.cache_read)}</span>
            <span>Cache created: {formatTokens(u.cache_creation)}</span>
            <span className="text-emerald-500/70">
              {totalTokens > 0 ? `${((u.cache_read / (totalTokens + u.cache_read)) * 100).toFixed(0)}% cache hit` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ projects, onSelectProject, onNewProject }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [projects]);

  const loadSummary = async () => {
    try {
      const data = await api.getProjectsSummary();
      setSummary(data);
    } catch {
      setSummary(projects.map(p => ({ ...p, total_tasks: 0, done_tasks: 0, active_tasks: 0, backlog_tasks: 0, testing_tasks: 0, total_tokens: 0, total_cost: 0, last_activity: null })));
    } finally {
      setLoading(false);
    }
  };

  const totalProjects = summary.length;
  const totalTasks = summary.reduce((s, p) => s + (p.total_tasks || 0), 0);
  const totalDone = summary.reduce((s, p) => s + (p.done_tasks || 0), 0);
  const totalActive = summary.reduce((s, p) => s + (p.active_tasks || 0), 0);
  const allTokens = summary.reduce((s, p) => s + (p.total_tokens || 0), 0);
  const allCost = summary.reduce((s, p) => s + (p.total_cost || 0), 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-claude text-2xl">&#10022;</span>
              <h1 className="text-xl font-bold tracking-tight">Claude Board</h1>
            </div>
            <p className="text-sm text-surface-500">Manage your projects and AI-powered tasks</p>
          </div>
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            New Project
          </button>
        </div>

        {/* Global Stats */}
        {totalProjects > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-8">
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">Projects</div>
              <div className="text-lg font-semibold text-surface-200">{totalProjects}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">Total Tasks</div>
              <div className="text-lg font-semibold text-surface-200">{totalTasks}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">Completed</div>
              <div className="text-lg font-semibold text-emerald-400">{totalDone}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">Active</div>
              <div className="text-lg font-semibold text-amber-400">{totalActive}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">Tokens</div>
              <div className="text-lg font-semibold text-blue-400">{formatTokens(allTokens) || '0'}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">Cost</div>
              <div className="text-lg font-semibold text-surface-200">${allCost.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Claude Usage */}
        {totalProjects > 0 && <ClaudeUsageCard />}

        {/* Project Grid */}
        {loading ? (
          <div className="text-center text-surface-600 py-20 text-sm">Loading projects...</div>
        ) : summary.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen size={48} className="mx-auto mb-4 text-surface-700" />
            <h2 className="text-lg font-medium text-surface-400 mb-2">No projects yet</h2>
            <p className="text-sm text-surface-600 mb-6">Create your first project to start managing tasks with Claude</p>
            <button
              onClick={onNewProject}
              className="px-5 py-2.5 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map(p => (
              <ProjectCard key={p.id} project={p} onSelect={onSelectProject} />
            ))}

            {/* Add project card */}
            <button
              onClick={onNewProject}
              className="p-5 rounded-xl border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex flex-col items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all duration-200 min-h-[180px]"
            >
              <Plus size={24} />
              <span className="text-sm font-medium">New Project</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

