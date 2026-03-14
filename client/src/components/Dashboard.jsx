import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Cpu, Coins, Clock, CheckCircle2, Activity, Layers } from 'lucide-react';
import Avatar from 'boring-avatars';
import { api } from '../api';

const AVATAR_VARIANTS = ['marble', 'beam', 'pixel', 'sunset', 'ring', 'bauhaus'];
const AVATAR_COLORS = ['#DA7756', '#e5936f', '#c4624a', '#918678', '#564d40'];

function formatTokens(n) {
  if (!n || n === 0) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

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

export { AVATAR_VARIANTS, AVATAR_COLORS };
