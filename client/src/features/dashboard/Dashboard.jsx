import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  FolderOpen,
  Layers,
  Bot,
  LayoutGrid,
  List,
  Settings,
  Search,
  Activity,
  CheckCircle2,
  Cpu,
  Coins,
  Zap,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatTokens } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';
import LanguageSelector from '../../i18n/LanguageSelector';
import { IS_TAURI, IS_MACOS } from '../../lib/tauriEvents';
import ClaudeManager from '../claude-manager/ClaudeManager';
import { MiniStatusBar } from './MiniStatusBar';
import { ProjectCard } from './ProjectCard';
import { ProjectListRow } from './ProjectListRow';
import { ClaudeUsageCard } from './ClaudeUsageCard';
import { SuggestionBanner, filterDismissed } from './SuggestionBanner';

// Cache outside component so it survives remounts
let summaryCache = null;
let groupsCache = null;
let suggestionsCache = null;
let suggestionsLoaded = false;

function DashHeader({ t, dashTab, setDashTab, onNewProject, onOpenSettings }) {
  return (
    <div
      data-tauri-drag-region
      className={`flex items-center justify-between gap-4 mb-8 ${IS_TAURI && IS_MACOS ? 'pt-3' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-claude text-2xl flex-shrink-0">&#10022;</span>
          <h1 className="text-xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => setDashTab('projects')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dashTab === 'projects' ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}
          >
            <Layers size={12} className="inline mr-1.5 -mt-0.5" />
            {t('dashboard.projects')}
          </button>
          {IS_TAURI && (
            <button
              onClick={() => setDashTab('claude-manager')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dashTab === 'claude-manager' ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}
            >
              <Bot size={12} className="inline mr-1.5 -mt-0.5" />
              {t('cm.title')}
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
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <Plus size={15} />
            {t('dashboard.newProject')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ projects, onSelectProject, onNewProject, onOpenSettings, onDeleteProject }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(summaryCache || []);
  const [groups, setGroups] = useState(groupsCache || []);
  const [suggestions, setSuggestions] = useState([]);
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem('dashboard:groupBy') === 'true');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard:viewMode') || 'grid');
  const [loading, setLoading] = useState(!summaryCache);
  const [dashTab, setDashTab] = useState('projects');

  const handleDeleteProject = (project) => {
    if (!onDeleteProject) return;
    onDeleteProject(project, () => {
      summaryCache = null;
      groupsCache = null;
      loadSummary();
    });
  };

  useEffect(() => {
    loadSummary();
  }, [projects]); // loadSummary is intentionally omitted — it's not wrapped in useCallback and adding it would cause infinite re-renders

  const loadSummary = async () => {
    if (!summaryCache) setLoading(true);
    try {
      // Load only the fast DB query first — never block on CLI calls
      const data = await api.getProjectsSummary();
      summaryCache = data;
      setSummary(data);
    } catch {
      setSummary(
        projects.map((p) => ({
          ...p,
          total_tasks: 0,
          done_tasks: 0,
          active_tasks: 0,
          backlog_tasks: 0,
          testing_tasks: 0,
          total_tokens: 0,
          total_cost: 0,
          last_activity: null,
        })),
      );
    } finally {
      setLoading(false);
    }

    // Load slow CLI-based data in background (non-blocking)
    if (IS_TAURI && !groupsCache) {
      api
        .getProjectGroups()
        .then((grp) => {
          groupsCache = Array.isArray(grp) ? grp : [];
          setGroups(groupsCache);
        })
        .catch((e) => console.error('Failed to load project groups:', e));
    }
    if (IS_TAURI && !suggestionsLoaded) {
      api
        .getSuggestions()
        .then((sug) => {
          suggestionsCache = filterDismissed(Array.isArray(sug) ? sug : []);
          suggestionsLoaded = true;
          setSuggestions(suggestionsCache);
        })
        .catch((e) => {
          suggestionsLoaded = true;
          console.error('Failed to load suggestions:', e);
        });
    }
  };

  const { totalProjects, totalTasks, totalDone, totalActive, allTokens, allCost } = useMemo(() => {
    let tasks = 0,
      done = 0,
      active = 0,
      tokens = 0,
      cost = 0;
    for (const p of summary) {
      tasks += p.total_tasks || 0;
      done += p.done_tasks || 0;
      active += p.active_tasks || 0;
      tokens += p.total_tokens || 0;
      cost += p.total_cost || 0;
    }
    return {
      totalProjects: summary.length,
      totalTasks: tasks,
      totalDone: done,
      totalActive: active,
      allTokens: tokens,
      allCost: cost,
    };
  }, [summary]);

  if (dashTab === 'claude-manager' && IS_TAURI) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <DashHeader
            t={t}
            dashTab={dashTab}
            setDashTab={setDashTab}
            onNewProject={onNewProject}
            onOpenSettings={onOpenSettings}
          />
          <ClaudeManager />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <DashHeader
          t={t}
          dashTab={dashTab}
          setDashTab={setDashTab}
          onNewProject={onNewProject}
          onOpenSettings={onOpenSettings}
        />

        {/* Quick Actions Bar */}
        {totalProjects > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800/60 border border-surface-700/30 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all flex-1 max-w-sm"
            >
              <Search size={14} />
              <span className="text-sm">{t('dashboard.searchPlaceholder') || 'Search tasks, projects...'}</span>
              <kbd className="ml-auto px-1.5 py-0.5 text-[10px] bg-surface-700 rounded border border-surface-600 font-mono text-surface-400">
                Ctrl+K
              </kbd>
            </button>
          </div>
        )}

        {/* Global Stats */}
        {totalProjects > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <StatCard icon={FolderOpen} label={t('dashboard.projects')} value={totalProjects} color="text-claude" />
            <StatCard icon={Layers} label={t('dashboard.totalTasks')} value={totalTasks} color="text-surface-200" />
            <StatCard
              icon={CheckCircle2}
              label={t('dashboard.completed')}
              value={totalDone}
              color="text-emerald-400"
              glow="emerald"
            />
            <StatCard
              icon={Activity}
              label={t('dashboard.active')}
              value={totalActive}
              color="text-amber-400"
              glow="amber"
              pulse={totalActive > 0}
            />
            <StatCard
              icon={Cpu}
              label={t('dashboard.tokens')}
              value={formatTokens(allTokens) || '0'}
              color="text-blue-400"
            />
            <StatCard
              icon={Coins}
              label={t('dashboard.cost')}
              value={`$${allCost.toFixed(2)}`}
              color="text-surface-200"
            />
          </div>
        )}

        {/* Claude Usage */}
        {totalProjects > 0 && <ClaudeUsageCard t={t} />}

        {/* Suggestions */}
        {suggestions.length > 0 && <SuggestionBanner suggestions={suggestions} setSuggestions={setSuggestions} t={t} />}

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
                <button
                  onClick={() => {
                    setViewMode('grid');
                    localStorage.setItem('dashboard:viewMode', 'grid');
                  }}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => {
                    setViewMode('list');
                    localStorage.setItem('dashboard:viewMode', 'list');
                  }}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
                >
                  <List size={14} />
                </button>
              </div>
              {groups.length > 1 && (
                <>
                  <div className="w-px h-5 bg-surface-700/50" />
                  <button
                    onClick={() => {
                      const v = !groupBy;
                      setGroupBy(v);
                      localStorage.setItem('dashboard:groupBy', v);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupBy ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}
                  >
                    <FolderOpen size={12} />
                    {t('dashboard.groupByNamespace')}
                  </button>
                  {groupBy && (
                    <span className="text-[10px] text-surface-600">
                      {groups.length} {t('dashboard.groups')}
                    </span>
                  )}
                </>
              )}
            </div>

            {groupBy && groups.length > 1 ? (
              /* Grouped view */
              <div className="space-y-6">
                {groups.map((g) => {
                  const groupProjects = summary.filter((p) => g.projects.some((gp) => gp.id === p.id));
                  if (groupProjects.length === 0) return null;
                  return (
                    <div key={g.namespace}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-claude" />
                        <h3 className="text-sm font-semibold text-surface-300">{g.namespace}</h3>
                        <span className="text-[10px] bg-surface-800 px-1.5 py-0.5 rounded-full text-surface-500">
                          {groupProjects.length}
                        </span>
                      </div>
                      {viewMode === 'list' ? (
                        <div className="space-y-1.5">
                          {groupProjects.map((p) => (
                            <ProjectListRow
                              key={p.id}
                              project={p}
                              onSelect={onSelectProject}
                              onDelete={handleDeleteProject}
                              t={t}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupProjects.map((p) => (
                            <ProjectCard
                              key={p.id}
                              project={p}
                              onSelect={onSelectProject}
                              onDelete={handleDeleteProject}
                              t={t}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={onNewProject}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all"
                >
                  <Plus size={18} />
                  <span className="text-sm font-medium">{t('dashboard.newProject')}</span>
                </button>
              </div>
            ) : viewMode === 'list' ? (
              /* Flat list */
              <div className="space-y-1.5">
                {summary.map((p) => (
                  <ProjectListRow
                    key={p.id}
                    project={p}
                    onSelect={onSelectProject}
                    onDelete={handleDeleteProject}
                    t={t}
                  />
                ))}
                <button
                  onClick={onNewProject}
                  className="w-full p-3 rounded-lg border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all"
                >
                  <Plus size={16} />
                  <span className="text-sm font-medium">{t('dashboard.newProject')}</span>
                </button>
              </div>
            ) : (
              /* Flat grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.map((p) => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelectProject} onDelete={handleDeleteProject} t={t} />
                ))}
                <button
                  onClick={onNewProject}
                  className="p-5 rounded-xl border-2 border-dashed border-surface-700/50 hover:border-claude/40 flex flex-col items-center justify-center gap-2 text-surface-500 hover:text-claude transition-all duration-200 min-h-[180px]"
                >
                  <Plus size={24} />
                  <span className="text-sm font-medium">{t('dashboard.newProject')}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const GLOW_COLORS = {
  emerald: 'shadow-emerald-500/10',
  amber: 'shadow-amber-500/10',
  blue: 'shadow-blue-500/10',
  claude: 'shadow-claude/10',
};

function StatCard({ icon: Icon, label, value, color, glow, pulse }) {
  return (
    <div
      className={`relative p-3.5 rounded-xl bg-surface-800/60 border border-surface-700/30 hover:border-surface-600/50 transition-all group ${glow ? `shadow-lg ${GLOW_COLORS[glow] || ''}` : ''}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-lg bg-surface-700/50 flex items-center justify-center group-hover:bg-surface-700 transition-colors">
          <Icon size={12} className={color} />
        </div>
        <div className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</div>
      </div>
      <div className={`text-xl font-bold ${color} ${pulse ? 'animate-pulse' : ''}`}>{value}</div>
    </div>
  );
}
