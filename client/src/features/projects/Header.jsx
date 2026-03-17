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
} from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_COLORS } from '../../lib/constants';
import { formatTokens as fmtTokens } from '../../lib/formatters';

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
  tasks,
}) {
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showProjectMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowProjectMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showProjectMenu]);

  // Don't show header on dashboard view
  if (!currentProject) return null;

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-surface-900 border-b border-surface-700/50 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Back to dashboard */}
        <button
          onClick={onBackToDashboard}
          className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-claude transition-colors flex-shrink-0"
          title="Back to Dashboard"
        >
          <LayoutGrid size={16} />
        </button>

        <div className="relative min-w-0" ref={menuRef}>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
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
            <ChevronDown size={14} className="text-surface-400 flex-shrink-0" />
          </button>

          {showProjectMenu && (
            <div className="absolute left-0 top-full mt-1 w-72 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden">
              {/* Switch Project */}
              <div className="px-3 pt-2.5 pb-1.5">
                <span className="text-[10px] text-surface-500 font-semibold uppercase tracking-wider">
                  Switch Project
                </span>
              </div>
              <div className="px-1.5 pb-1.5">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProject(p);
                      setShowProjectMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      currentProject?.id === p.id ? 'bg-claude/10 text-claude' : 'text-surface-300 hover:bg-surface-700'
                    }`}
                  >
                    <div className="rounded-md overflow-hidden flex-shrink-0">
                      <Avatar
                        size={20}
                        name={p.icon_seed || p.name}
                        variant={p.icon || 'marble'}
                        colors={AVATAR_COLORS}
                      />
                    </div>
                    <span className="truncate">{p.name}</span>
                    {currentProject?.id === p.id && <span className="ml-auto text-[10px] text-claude/70">active</span>}
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="px-2.5 py-3 text-xs text-surface-500 text-center">No projects yet</div>
                )}
              </div>

              {/* Current Project Settings */}
              {currentProject && (
                <>
                  <div className="border-t border-surface-700" />
                  <div className="px-3 pt-2.5 pb-1.5">
                    <span className="text-[10px] text-surface-500 font-semibold uppercase tracking-wider">
                      Current Project
                    </span>
                  </div>
                  <div className="px-1.5 pb-1.5">
                    <button
                      onClick={() => {
                        onEditProject();
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                    >
                      <Settings size={13} className="text-surface-500" />
                      Project Settings
                    </button>
                    <button
                      onClick={() => {
                        onEditClaudeMd();
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                    >
                      <FileText size={13} className="text-surface-500" />
                      CLAUDE.md
                    </button>
                    <button
                      onClick={() => {
                        onEditSnippets?.();
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                    >
                      <BookOpen size={13} className="text-surface-500" />
                      Context Snippets
                    </button>
                    <button
                      onClick={() => {
                        onEditTemplates?.();
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                    >
                      <Layers size={13} className="text-surface-500" />
                      Prompt Templates
                    </button>
                    <button
                      onClick={() => {
                        onEditRoles?.();
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                    >
                      <Shield size={13} className="text-surface-500" />
                      Roles
                    </button>
                    <button
                      onClick={() => {
                        onEditWebhooks?.();
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                    >
                      <Bell size={13} className="text-surface-500" />
                      Webhooks
                    </button>
                  </div>
                </>
              )}

              {/* Navigation & Actions */}
              <div className="border-t border-surface-700" />
              <div className="px-1.5 py-1.5">
                <button
                  onClick={() => {
                    onBackToDashboard();
                    setShowProjectMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                >
                  <LayoutGrid size={13} className="text-surface-500" />
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    onNewProject();
                    setShowProjectMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                >
                  <FolderPlus size={13} className="text-surface-500" />
                  New Project
                </button>
                {currentProject && (
                  <button
                    onClick={() => {
                      onDeleteProject();
                      setShowProjectMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                    Delete Project
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-surface-400">
          {connected ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="text-red-400" />}
          <span className="hidden lg:inline">{connected ? 'Connected' : 'Offline'}</span>
        </div>
        {!connected && <WifiOff size={13} className="text-red-400 sm:hidden" />}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <div className="relative hidden sm:block">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            id="search-input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search... (/)"
            className="w-32 lg:w-48 pl-8 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600"
          />
        </div>

        {runningCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] sm:text-xs font-medium">
            <Activity size={11} className="animate-pulse" />
            <span>{runningCount}</span>
            <span className="hidden sm:inline">running</span>
          </div>
        )}

        <div className="hidden lg:block">
          <ProjectUsage tasks={tasks} />
        </div>

        <span className="hidden sm:inline text-xs text-surface-500 whitespace-nowrap">{taskCount} tasks</span>

        <button
          onClick={onToggleActivity}
          className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0 ${
            activityActive ? 'bg-claude/20 text-claude-light' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
          }`}
          title="Activity"
        >
          <Clock size={14} />
          <span className="hidden sm:inline">Activity</span>
        </button>

        <button
          onClick={onToggleStats}
          className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0 ${
            statsActive ? 'bg-claude/20 text-claude-light' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
          }`}
          title="Stats"
        >
          <BarChart3 size={14} />
          <span className="hidden sm:inline">Stats</span>
        </button>

        {onNewTask && (
          <button
            onClick={onNewTask}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0"
            title="New Task (N)"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Task</span>
          </button>
        )}
      </div>
    </header>
  );
}
