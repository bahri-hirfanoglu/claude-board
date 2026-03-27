import { useState, useEffect, useMemo } from 'react';
import { Plus, FolderOpen, Layers, Bot, LayoutGrid, List, Settings } from 'lucide-react';
import { api } from '../../lib/api';
import { formatTokens } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';
import LanguageSelector from '../../i18n/LanguageSelector';
import { IS_TAURI } from '../../lib/tauriEvents';
import ClaudeManager from '../claude-manager/ClaudeManager';
import { MiniStatusBar } from './MiniStatusBar';
import { ProjectCard } from './ProjectCard';
import { ProjectListRow } from './ProjectListRow';
import { ClaudeUsageCard } from './ClaudeUsageCard';
import { SuggestionBanner } from './SuggestionBanner';

// Cache outside component so it survives remounts
let summaryCache = null;
let groupsCache = null;
let suggestionsCache = null;
let suggestionsLoaded = false;

function DashHeader({ t, dashTab, setDashTab, onNewProject, onOpenSettings }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-8">
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
          suggestionsCache = Array.isArray(sug) ? sug : [];
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

        {/* Global Stats */}
        {totalProjects > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-8">
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">
                {t('dashboard.projects')}
              </div>
              <div className="text-lg font-semibold text-surface-200">{totalProjects}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">
                {t('dashboard.totalTasks')}
              </div>
              <div className="text-lg font-semibold text-surface-200">{totalTasks}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">
                {t('dashboard.completed')}
              </div>
              <div className="text-lg font-semibold text-emerald-400">{totalDone}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">
                {t('dashboard.active')}
              </div>
              <div className="text-lg font-semibold text-amber-400">{totalActive}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/30">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">
                {t('dashboard.tokens')}
              </div>
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
                            <ProjectListRow key={p.id} project={p} onSelect={onSelectProject} t={t} />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupProjects.map((p) => (
                            <ProjectCard key={p.id} project={p} onSelect={onSelectProject} t={t} />
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
                  <ProjectListRow key={p.id} project={p} onSelect={onSelectProject} t={t} />
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
                  <ProjectCard key={p.id} project={p} onSelect={onSelectProject} t={t} />
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
