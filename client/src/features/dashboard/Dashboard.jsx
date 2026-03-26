import { useState, useEffect, useMemo } from 'react';
import { Plus, FolderOpen, Cpu, Coins, Clock, CheckCircle2, Activity, Layers, Zap, AlertTriangle, TrendingUp, BarChart3, Bot, LayoutGrid, List, Lightbulb, Download, X, Loader2, Settings } from 'lucide-react';
import Avatar from 'boring-avatars';
import { api } from '../../lib/api';
import { formatTokens, formatTimeAgo as timeAgo } from '../../lib/formatters';
import { AVATAR_VARIANTS, AVATAR_COLORS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import LanguageSelector from '../../i18n/LanguageSelector';
import { IS_TAURI } from '../../lib/tauriEvents';
import ClaudeManager from '../claude-manager/ClaudeManager';

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

function ProjectCard({ project, onSelect, t }) {
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
          <span>{total} {t('common.tasks')}</span>
        </div>
        {(project.done_tasks || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500">
            <CheckCircle2 size={10} />
            <span>{project.done_tasks} {t('dashboard.done')}</span>
          </div>
        )}
        {(project.active_tasks || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Activity size={10} className="animate-pulse" />
            <span>{project.active_tasks} {t('dashboard.active').toLowerCase()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {tokens && (
          <div className="flex items-center gap-1 text-[10px] text-surface-500">
            <Cpu size={10} />
            <span>{tokens} {t('common.tokens')}</span>
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

function ProjectListRow({ project, onSelect, t }) {
  const total = project.total_tasks || 0;
  const variant = project.icon || 'marble';
  const seed = project.icon_seed || project.name;
  return (
    <button onClick={() => onSelect(project)}
      className="group w-full flex items-center gap-4 px-4 py-3 rounded-lg bg-surface-800/40 border border-surface-700/30 hover:border-claude/30 hover:bg-surface-800/60 transition-all text-left">
      <div className="flex-shrink-0 rounded-lg overflow-hidden ring-1 ring-surface-700 group-hover:ring-claude/30">
        <Avatar size={36} name={seed} variant={variant} colors={AVATAR_COLORS} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-surface-100 group-hover:text-white truncate">{project.name}</span>
          <span className="text-[10px] text-surface-600 font-mono">{project.slug}</span>
        </div>
        <p className="text-[10px] text-surface-600 font-mono truncate">{project.working_dir}</p>
      </div>
      {total > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-surface-500 flex-shrink-0">
          <span>{project.done_tasks || 0}/{total} {t('dashboard.completed').toLowerCase()}</span>
          <span>{project.active_tasks || 0} {t('dashboard.active').toLowerCase()}</span>
          {(project.total_tokens || 0) > 0 && <span className="flex items-center gap-0.5"><Zap size={9} />{formatTokens(project.total_tokens)}</span>}
          {(project.total_cost || 0) > 0 && <span>${project.total_cost.toFixed(2)}</span>}
        </div>
      )}
      {total > 0 && (
        <div className="w-24 flex-shrink-0">
          <MiniStatusBar backlog={project.backlog_tasks||0} active={project.active_tasks||0} testing={project.testing_tasks||0} done={project.done_tasks||0} total={total} />
        </div>
      )}
    </button>
  );
}

const MODEL_COLORS = { opus: 'bg-purple-500', sonnet: 'bg-blue-500', haiku: 'bg-green-500', unknown: 'bg-surface-500' };

function normalizeModelName(raw) {
  if (!raw || !raw.trim()) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';
  return raw;
}

function ClaudeUsageCard({ t }) {
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

function SuggestionBanner({ suggestions, setSuggestions, t }) {
  const [installing, setInstalling] = useState(null);

  const handleAction = async (s) => {
    if (s.action === 'install_plugin') {
      setInstalling(s.id);
      try {
        await api.installPlugin(s.actionArgs);
        setSuggestions(prev => prev.filter(x => x.id !== s.id));
      } catch {}
      setInstalling(null);
    } else if (s.action === 'navigate') {
      // Could navigate to claude manager tab
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
    }
  };

  const dismiss = (id) => setSuggestions(prev => prev.filter(x => x.id !== id));

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Lightbulb size={13} className="text-amber-400" />
        <span className="text-xs font-medium text-surface-400">{t('dashboard.suggestions')}</span>
      </div>
      {suggestions.map(s => (
        <div key={s.id} className="flex items-center gap-3 bg-surface-800/60 border border-surface-700/30 rounded-lg px-4 py-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.priority === 'high' ? 'bg-claude/15' : 'bg-surface-700/50'}`}>
            {s.type === 'plugin' ? <Download size={14} className="text-claude" /> : <Lightbulb size={14} className="text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-200">{s.title}</p>
            <p className="text-[11px] text-surface-500 mt-0.5">{s.description}</p>
          </div>
          {s.action === 'install_plugin' && (
            <button onClick={() => handleAction(s)} disabled={installing === s.id}
              className="px-3 py-1.5 text-xs font-medium bg-claude hover:bg-claude-light rounded-lg disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
              {installing === s.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {t('dashboard.install')}
            </button>
          )}
          <button onClick={() => dismiss(s.id)} className="p-1 text-surface-600 hover:text-surface-400 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// Cache outside component so it survives remounts
let summaryCache = null;
let groupsCache = null;
let suggestionsCache = null;
let suggestionsLoaded = false;
let usageCache = null;

function DashHeader({ t, dashTab, setDashTab, onNewProject, onOpenSettings }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-8">
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-claude text-2xl flex-shrink-0">&#10022;</span>
          <h1 className="text-xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <button onClick={() => setDashTab('projects')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dashTab === 'projects' ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}>
            <Layers size={12} className="inline mr-1.5 -mt-0.5" />{t('dashboard.projects')}
          </button>
          {IS_TAURI && (
            <button onClick={() => setDashTab('claude-manager')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dashTab === 'claude-manager' ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}>
              <Bot size={12} className="inline mr-1.5 -mt-0.5" />{t('cm.title')}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[10px] text-surface-600 font-mono">v{__APP_VERSION__}</span>
        <LanguageSelector />
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-surface-400 hover:text-claude hover:bg-surface-800/60 transition-colors"
            title={t('settings.title')}
          >
            <Settings size={16} />
          </button>
        )}
        {dashTab === 'projects' && (
          <button onClick={onNewProject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap">
            <Plus size={15} />{t('dashboard.newProject')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ projects, onSelectProject, onNewProject, onOpenSettings }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(summaryCache || []);
  const [groups, setGroups] = useState(groupsCache || []);
  const [suggestions, setSuggestions] = useState([]);
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem('dashboard:groupBy') === 'true');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard:viewMode') || 'grid');
  const [loading, setLoading] = useState(!summaryCache);
  const [dashTab, setDashTab] = useState('projects');

  useEffect(() => {
    loadSummary();
  }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = async () => {
    if (!summaryCache) setLoading(true);
    try {
      // Load only the fast DB query first — never block on CLI calls
      const data = await api.getProjectsSummary();
      summaryCache = data;
      setSummary(data);
    } catch {
      setSummary(projects.map(p => ({ ...p, total_tasks: 0, done_tasks: 0, active_tasks: 0, backlog_tasks: 0, testing_tasks: 0, total_tokens: 0, total_cost: 0, last_activity: null })));
    } finally {
      setLoading(false);
    }

    // Load slow CLI-based data in background (non-blocking)
    if (IS_TAURI && !groupsCache) {
      api.getProjectGroups().then(grp => {
        groupsCache = Array.isArray(grp) ? grp : [];
        setGroups(groupsCache);
      }).catch(() => {});
    }
    if (IS_TAURI && !suggestionsLoaded) {
      api.getSuggestions().then(sug => {
        suggestionsCache = Array.isArray(sug) ? sug : [];
        suggestionsLoaded = true;
        setSuggestions(suggestionsCache);
      }).catch(() => { suggestionsLoaded = true; });
    }
  };

  const { totalProjects, totalTasks, totalDone, totalActive, allTokens, allCost } = useMemo(() => {
    let tasks = 0, done = 0, active = 0, tokens = 0, cost = 0;
    for (const p of summary) {
      tasks += p.total_tasks || 0;
      done += p.done_tasks || 0;
      active += p.active_tasks || 0;
      tokens += p.total_tokens || 0;
      cost += p.total_cost || 0;
    }
    return { totalProjects: summary.length, totalTasks: tasks, totalDone: done, totalActive: active, allTokens: tokens, allCost: cost };
  }, [summary]);

  if (dashTab === 'claude-manager' && IS_TAURI) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <DashHeader t={t} dashTab={dashTab} setDashTab={setDashTab} onNewProject={onNewProject} onOpenSettings={onOpenSettings} />
          <ClaudeManager />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <DashHeader t={t} dashTab={dashTab} setDashTab={setDashTab} onNewProject={onNewProject} onOpenSettings={onOpenSettings} />

        {/* Global Stats */}
        {totalProjects > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-8">
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{t('dashboard.projects')}</div>
              <div className="text-lg font-semibold text-surface-200">{totalProjects}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{t('dashboard.totalTasks')}</div>
              <div className="text-lg font-semibold text-surface-200">{totalTasks}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{t('dashboard.completed')}</div>
              <div className="text-lg font-semibold text-emerald-400">{totalDone}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{t('dashboard.active')}</div>
              <div className="text-lg font-semibold text-amber-400">{totalActive}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{t('dashboard.tokens')}</div>
              <div className="text-lg font-semibold text-blue-400">{formatTokens(allTokens) || '0'}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{t('dashboard.cost')}</div>
              <div className="text-lg font-semibold text-surface-200">${allCost.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Claude Usage */}
        {totalProjects > 0 && <ClaudeUsageCard t={t} />}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <SuggestionBanner suggestions={suggestions} setSuggestions={setSuggestions} t={t} />
        )}

        {/* Project Grid */}
        {loading ? (
          <div className="text-center text-surface-600 py-20 text-sm">{t('common.loading')}</div>
        ) : summary.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen size={48} className="mx-auto mb-4 text-surface-700" />
            <h2 className="text-lg font-medium text-surface-400 mb-2">{t('dashboard.noProjects')}</h2>
            <p className="text-sm text-surface-600 mb-6">{t('dashboard.noProjectsDesc')}</p>
            <button
              onClick={onNewProject}
              className="px-5 py-2.5 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors"
            >
              {t('dashboard.createFirst')}
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar: view toggle + group toggle */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex bg-surface-800/50 rounded-lg p-0.5">
                <button onClick={() => { setViewMode('grid'); localStorage.setItem('dashboard:viewMode', 'grid'); }}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}>
                  <LayoutGrid size={14} />
                </button>
                <button onClick={() => { setViewMode('list'); localStorage.setItem('dashboard:viewMode', 'list'); }}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}>
                  <List size={14} />
                </button>
              </div>
              {groups.length > 1 && (
                <>
                  <div className="w-px h-5 bg-surface-700/50" />
                  <button onClick={() => { const v = !groupBy; setGroupBy(v); localStorage.setItem('dashboard:groupBy', v); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupBy ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}>
                    <FolderOpen size={12} />
                    {t('dashboard.groupByNamespace')}
                  </button>
                  {groupBy && <span className="text-[10px] text-surface-600">{groups.length} {t('dashboard.groups')}</span>}
                </>
              )}
            </div>

            {groupBy && groups.length > 1 ? (
              /* Grouped view */
              <div className="space-y-6">
                {groups.map(g => {
                  const groupProjects = summary.filter(p => g.projects.some(gp => gp.id === p.id));
                  if (groupProjects.length === 0) return null;
                  return (
                    <div key={g.namespace}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-claude" />
                        <h3 className="text-sm font-semibold text-surface-300">{g.namespace}</h3>
                        <span className="text-[10px] bg-surface-800 px-1.5 py-0.5 rounded-full text-surface-500">{groupProjects.length}</span>
                      </div>
                      {viewMode === 'list' ? (
                        <div className="space-y-1.5">
                          {groupProjects.map(p => <ProjectListRow key={p.id} project={p} onSelect={onSelectProject} t={t} />)}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupProjects.map(p => <ProjectCard key={p.id} project={p} onSelect={onSelectProject} t={t} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={onNewProject}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all">
                  <Plus size={18} /><span className="text-sm font-medium">{t('dashboard.newProject')}</span>
                </button>
              </div>
            ) : viewMode === 'list' ? (
              /* Flat list */
              <div className="space-y-1.5">
                {summary.map(p => <ProjectListRow key={p.id} project={p} onSelect={onSelectProject} t={t} />)}
                <button onClick={onNewProject}
                  className="w-full p-3 rounded-lg border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all">
                  <Plus size={16} /><span className="text-sm font-medium">{t('dashboard.newProject')}</span>
                </button>
              </div>
            ) : (
              /* Flat grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.map(p => <ProjectCard key={p.id} project={p} onSelect={onSelectProject} t={t} />)}
                <button onClick={onNewProject}
                  className="p-5 rounded-xl border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex flex-col items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all duration-200 min-h-[180px]">
                  <Plus size={24} /><span className="text-sm font-medium">{t('dashboard.newProject')}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

