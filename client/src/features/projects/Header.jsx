import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  BarChart3,
  Wifi,
  WifiOff,
  Activity,
  Search,
  ChevronDown,
  Settings,
  Trash2,
  FolderPlus,
  FileText,
  LayoutGrid,
  Cpu,
  Coins,
  Clock,
  BookOpen,
  Layers,
  Bell,
  Shield,
  Sparkles,
  ScanSearch,
  Zap,
  Terminal,
  Wand2,
  SlidersHorizontal,
  MessageSquare,
} from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_COLORS } from '../../lib/constants';
import { formatTokens as fmtTokens } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';
import { IS_TAURI, IS_MACOS } from '../../lib/tauriEvents';
import Tooltip from '../../components/Tooltip';

function ProjectUsage({ tasks }) {
  const totals = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    let tokens = 0,
      cost = 0;
    for (const t of tasks) {
      tokens += (t.input_tokens || 0) + (t.output_tokens || 0);
      cost += t.total_cost || 0;
    }
    return tokens > 0 ? { tokens, cost } : null;
  }, [tasks]);

  if (!totals) return null;

  return (
    <div className="flex items-center gap-2 text-[11px] text-surface-500 bg-surface-800/50 px-2.5 py-1 rounded-lg">
      <span className="flex items-center gap-1">
        <Cpu size={10} />
        {fmtTokens(totals.tokens)}
      </span>
      {totals.cost > 0 && (
        <span className="flex items-center gap-1">
          <Coins size={10} />${totals.cost.toFixed(4)}
        </span>
      )}
    </div>
  );
}

const SETTINGS_ITEMS = [
  { key: 'settings', icon: Settings, labelKey: 'header.settings', handler: 'onEditProject' },
  { key: 'claude-md', icon: FileText, labelKey: 'header.claudeMd', handler: 'onEditClaudeMd' },
  { key: 'snippets', icon: BookOpen, labelKey: 'header.snippets', handler: 'onEditSnippets' },
  { key: 'templates', icon: Layers, labelKey: 'header.templates', handler: 'onEditTemplates' },
  { key: 'roles', icon: Shield, labelKey: 'header.roles', handler: 'onEditRoles' },
  { key: 'webhooks', icon: Bell, labelKey: 'header.webhooks', handler: 'onEditWebhooks' },
  { key: 'commands', icon: Terminal, labelKey: 'header.commands', handler: 'onEditCommands' },
  { key: 'skills', icon: Wand2, labelKey: 'header.skills', handler: 'onEditSkills' },
  { key: 'app-settings', icon: SlidersHorizontal, labelKey: 'header.appSettings', handler: 'onOpenAppSettings' },
];

export default function Header({
  connected,
  taskCount,
  runningCount,
  onNewTask,
  onToggleStats,
  statsActive,
  onToggleActivity,
  activityActive,
  search,
  onSearchChange,
  projects,
  currentProject,
  onSelectProject,
  onBackToDashboard,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onEditClaudeMd,
  onEditSnippets,
  onEditTemplates,
  onEditWebhooks,
  onEditRoles,
  onEditCommands,
  onEditSkills,
  onOpenPlanning,
  onOpenScan,
  onOpenAppSettings,
  onToggleChat,
  chatActive,
  tasks,
}) {
  const { t, lang, setLang } = useTranslation();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const menuRef = useRef(null);

  const handlers = {
    onEditProject,
    onEditClaudeMd,
    onEditSnippets,
    onEditTemplates,
    onEditRoles,
    onEditWebhooks,
    onEditCommands,
    onEditSkills,
    onOpenAppSettings,
  };

  useEffect(() => {
    if (!showProjectMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowProjectMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showProjectMenu]);

  if (!currentProject) return null;

  const otherProjects = projects.filter((p) => p.id !== currentProject.id);

  return (
    <header
      data-tauri-drag-region
      className={`flex items-center justify-between py-2 sm:py-3 bg-surface-900 border-b border-surface-700/50 gap-2 ${
        IS_TAURI && IS_MACOS ? 'pl-[78px] pr-3 sm:pr-6' : 'px-3 sm:px-6'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Tooltip text={t('header.backToDashboard')}>
          <button
            onClick={onBackToDashboard}
            className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-claude transition-colors flex-shrink-0"
          >
            <LayoutGrid size={16} />
          </button>
        </Tooltip>

        <div className="relative min-w-0" ref={menuRef}>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            data-tour="project-selector"
            className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-surface-800 transition-colors min-w-0 max-w-full"
          >
            <div className="rounded-lg overflow-hidden flex-shrink-0">
              <Avatar
                size={24}
                name={currentProject.icon_seed || currentProject.name}
                variant={currentProject.icon || 'marble'}
                colors={AVATAR_COLORS}
              />
            </div>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">{currentProject.name}</h1>
            <ChevronDown
              size={14}
              className={`text-surface-400 flex-shrink-0 transition-transform ${showProjectMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {showProjectMenu && (
            <div className="absolute left-0 sm:left-0 top-full mt-1 w-[calc(100vw-1.5rem)] sm:w-64 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
              {/* Settings grid */}
              {currentProject && (
                <div className="p-2">
                  <div className="grid grid-cols-3 gap-1">
                    {SETTINGS_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const fn = handlers[item.handler];
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            fn?.();
                            setShowProjectMenu(false);
                          }}
                          className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                        >
                          <Icon size={14} />
                          <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Switch project */}
              {otherProjects.length > 0 && (
                <>
                  <div className="border-t border-surface-700" />
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] text-surface-500 font-semibold uppercase tracking-wider">
                      {t('header.switchProject')}
                    </span>
                  </div>
                  <div className="px-1.5 pb-1.5 max-h-36 overflow-y-auto">
                    {otherProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p);
                          setShowProjectMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                      >
                        <div className="rounded-md overflow-hidden flex-shrink-0">
                          <Avatar
                            size={18}
                            name={p.icon_seed || p.name}
                            variant={p.icon || 'marble'}
                            colors={AVATAR_COLORS}
                          />
                        </div>
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="border-t border-surface-700" />
              <div className="p-1.5 flex gap-1">
                <button
                  onClick={() => {
                    onBackToDashboard();
                    setShowProjectMenu(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                >
                  <LayoutGrid size={12} />
                  {t('header.dashboard')}
                </button>
                <button
                  onClick={() => {
                    onNewProject();
                    setShowProjectMenu(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                >
                  <FolderPlus size={12} />
                  {t('header.newProject')}
                </button>
                <button
                  onClick={() => {
                    onDeleteProject();
                    setShowProjectMenu(false);
                  }}
                  className="flex items-center justify-center px-2 py-1.5 rounded-lg text-[11px] text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Delete Project"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-surface-400">
          {connected ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="text-red-400" />}
          <span className="hidden lg:inline">{connected ? t('status.connected') : t('status.offline')}</span>
        </div>
        {!connected && <WifiOff size={13} className="text-red-400 sm:hidden" />}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            id="search-input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('header.searchPlaceholder')}
            className="w-32 lg:w-44 pl-8 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600"
          />
        </div>

        {/* Running badge */}
        {runningCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] sm:text-xs font-medium">
            <Activity size={11} className="animate-pulse" />
            <span>{runningCount}</span>
            <span className="hidden sm:inline">{t('header.running')}</span>
          </div>
        )}

        {/* Info: task count + usage */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-surface-500">
          <span className="whitespace-nowrap">
            {taskCount} {t('common.tasks')}
          </span>
          <ProjectUsage tasks={tasks} />
        </div>

        {/* Toolbar — compact icon toggle group */}
        <div className="flex items-center bg-surface-800/60 rounded-lg p-0.5 border border-surface-700/40">
          <ToolbarBtn icon={Clock} active={activityActive} onClick={onToggleActivity} title={t('header.activity')} />
          <ToolbarBtn icon={BarChart3} active={statsActive} onClick={onToggleStats} title={t('header.stats')} />
          {onOpenPlanning && (
            <ToolbarBtn icon={Sparkles} onClick={onOpenPlanning} title="Planning" data-tour="planning-btn" />
          )}
          {IS_TAURI && currentProject && onToggleChat && (
            <ToolbarBtn icon={MessageSquare} active={chatActive} onClick={onToggleChat} title="AI Chat" />
          )}
          {IS_TAURI && currentProject && onOpenScan && (
            <ToolbarBtn icon={ScanSearch} onClick={onOpenScan} title={t('header.scanCodebase')} />
          )}
        </div>

        {/* New Task */}
        {onNewTask && (
          <Tooltip text={t('header.newTask')} shortcut="N">
            <button
              onClick={onNewTask}
              data-tour="new-task"
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t('header.newTask')}</span>
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  );
}

function ToolbarBtn({ icon: Icon, active, onClick, title, shortcut, ...rest }) {
  return (
    <Tooltip text={title} shortcut={shortcut}>
      <button
        onClick={onClick}
        className={`p-1.5 rounded-md transition-colors ${
          active ? 'bg-claude/20 text-claude' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
        }`}
        {...rest}
      >
        <Icon size={14} />
      </button>
    </Tooltip>
  );
}
