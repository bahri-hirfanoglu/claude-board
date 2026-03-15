import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, BarChart3, Wifi, WifiOff, Activity, Search, ChevronDown, Settings, Trash2, FolderPlus, FileText, LayoutGrid, Cpu, Coins, Clock } from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_COLORS } from '../../lib/constants';

function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function ProjectUsage({ tasks }) {
  const totals = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    let tokens = 0, cost = 0;
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
          <Coins size={10} />
          ${totals.cost.toFixed(4)}
        </span>
      )}
    </div>
  );
}

export default function Header({
  connected, taskCount, runningCount, onNewTask, onToggleStats, statsActive,
  onToggleActivity, activityActive,
  search, onSearchChange, projects, currentProject, onSelectProject, onBackToDashboard, onNewProject, onEditProject, onDeleteProject, onEditClaudeMd,
  tasks
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
    <header className="flex items-center justify-between px-6 py-3 bg-surface-900 border-b border-surface-700/50">
      <div className="flex items-center gap-3">
        {/* Back to dashboard */}
        <button
          onClick={onBackToDashboard}
          className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-claude transition-colors"
          title="Back to Dashboard"
        >
          <LayoutGrid size={16} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-surface-800 transition-colors"
          >
            <div className="rounded-lg overflow-hidden flex-shrink-0">
              <Avatar
                size={24}
                name={currentProject.icon_seed || currentProject.name}
                variant={currentProject.icon || 'marble'}
                colors={AVATAR_COLORS}
              />
            </div>
            <h1 className="text-base font-semibold tracking-tight">
              {currentProject.name}
            </h1>
            <ChevronDown size={14} className="text-surface-400" />
          </button>

          {showProjectMenu && (
            <div className="absolute left-0 top-full mt-1 w-72 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              <div className="px-3 py-2 text-[10px] text-surface-500 font-medium uppercase tracking-wider">Projects</div>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSelectProject(p); setShowProjectMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                    currentProject?.id === p.id
                      ? 'bg-claude/10 text-claude'
                      : 'text-surface-300 hover:bg-surface-700'
                  }`}
                >
                  <div className="rounded-md overflow-hidden flex-shrink-0">
                    <Avatar size={20} name={p.icon_seed || p.name} variant={p.icon || 'marble'} colors={AVATAR_COLORS} />
                  </div>
                  <span className="truncate">{p.name}</span>
                  {currentProject?.id === p.id && <span className="ml-auto text-[10px] text-claude">active</span>}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-3 text-xs text-surface-500 text-center">No projects yet</div>
              )}
              <div className="border-t border-surface-700 mt-1 pt-1">
                <button
                  onClick={() => { onBackToDashboard(); setShowProjectMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                >
                  <LayoutGrid size={12} />
                  Dashboard
                </button>
                <button
                  onClick={() => { onNewProject(); setShowProjectMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                >
                  <FolderPlus size={12} />
                  New Project
                </button>
                {currentProject && (
                  <>
                    <button
                      onClick={() => { onEditProject(); setShowProjectMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                    >
                      <Settings size={12} />
                      Project Settings
                    </button>
                    <button
                      onClick={() => { onEditClaudeMd(); setShowProjectMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
                    >
                      <FileText size={12} />
                      CLAUDE.md
                    </button>
                    <button
                      onClick={() => { onDeleteProject(); setShowProjectMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-surface-700 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete Project
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          {connected ? (
            <Wifi size={13} className="text-emerald-400" />
          ) : (
            <WifiOff size={13} className="text-red-400" />
          )}
          <span>{connected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            id="search-input"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search tasks... (/)"
            className="w-48 pl-8 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600"
          />
        </div>

        {runningCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
            <Activity size={12} className="animate-pulse" />
            {runningCount} running
          </div>
        )}

        <ProjectUsage tasks={tasks} />

        <span className="text-xs text-surface-500">{taskCount} tasks</span>

        <button
          onClick={onToggleActivity}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            activityActive
              ? 'bg-claude/20 text-claude-light'
              : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
          }`}
        >
          <Clock size={14} />
          Activity
        </button>

        <button
          onClick={onToggleStats}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            statsActive
              ? 'bg-claude/20 text-claude-light'
              : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
          }`}
        >
          <BarChart3 size={14} />
          Stats
        </button>

        {onNewTask && (
          <button
            onClick={onNewTask}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-claude hover:bg-claude-light text-sm font-medium transition-colors"
            title="New Task (N)"
          >
            <Plus size={14} />
            New Task
          </button>
        )}
      </div>
    </header>
  );
}
