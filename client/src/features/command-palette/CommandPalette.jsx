import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  ArrowRight,
  Plus,
  FolderOpen,
  LayoutGrid,
  Play,
  CheckCircle2,
  RotateCcw,
  Settings,
  FileText,
  Layers,
  FlaskConical,
  Terminal,
  XCircle,
  Clock,
  Workflow,
  BadgeCheck,
} from 'lucide-react';

const CATEGORY_ICONS = {
  task: Clock,
  project: FolderOpen,
  action: Play,
  navigation: LayoutGrid,
};

const STATUS_ICONS = {
  backlog: Clock,
  in_progress: Play,
  testing: FlaskConical,
  done: CheckCircle2,
  failed: XCircle,
  awaiting_approval: BadgeCheck,
};

const STATUS_COLORS = {
  backlog: 'text-surface-400',
  in_progress: 'text-amber-400',
  testing: 'text-claude',
  done: 'text-emerald-400',
  failed: 'text-red-400',
  awaiting_approval: 'text-violet-400',
};

export default function CommandPalette({
  open,
  onClose,
  tasks = [],
  projects = [],
  currentProject,
  onNavigateToProject,
  onNavigateToDashboard,
  onStatusChange,
  onViewLogs,
  onViewDetail,
  openModal,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo(() => {
    const results = [];
    const q = query.toLowerCase().trim();

    // Quick actions (always available, filtered by query)
    const actions = [
      { id: 'new-task', label: 'New Task', hint: 'N', icon: Plus, category: 'action', action: () => openModal('task') },
      {
        id: 'new-project',
        label: 'New Project',
        icon: FolderOpen,
        category: 'action',
        action: () => openModal('project'),
      },
      {
        id: 'dashboard',
        label: 'Go to Dashboard',
        icon: LayoutGrid,
        category: 'navigation',
        action: () => onNavigateToDashboard(),
      },
      {
        id: 'settings',
        label: 'Project Settings',
        icon: Settings,
        category: 'action',
        action: () => openModal('project', currentProject),
        hidden: !currentProject,
      },
      {
        id: 'claude-md',
        label: 'Edit CLAUDE.md',
        icon: FileText,
        category: 'action',
        action: () => openModal('claudeMd'),
        hidden: !currentProject,
      },
      {
        id: 'templates',
        label: 'Prompt Templates',
        icon: Layers,
        category: 'action',
        action: () => openModal('templates'),
        hidden: !currentProject,
      },
      {
        id: 'workflows',
        label: 'Workflow Templates',
        icon: Workflow,
        category: 'action',
        action: () => openModal('workflows'),
        hidden: !currentProject,
      },
      {
        id: 'app-settings',
        label: 'App Settings',
        icon: Settings,
        category: 'action',
        action: () => openModal('appSettings'),
      },
    ];

    // Filter actions
    for (const a of actions) {
      if (a.hidden) continue;
      if (!q || a.label.toLowerCase().includes(q)) {
        results.push(a);
      }
    }

    // Projects
    if (projects.length > 0) {
      const filteredProjects = projects.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q),
      );
      for (const p of filteredProjects.slice(0, 5)) {
        results.push({
          id: `project-${p.id}`,
          label: p.name,
          hint: p.slug,
          icon: FolderOpen,
          category: 'project',
          action: () => onNavigateToProject(p),
        });
      }
    }

    // Tasks (only if in a project)
    if (tasks.length > 0 && q.length > 0) {
      const filteredTasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.task_key?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      );
      for (const t of filteredTasks.slice(0, 8)) {
        const StatusIcon = STATUS_ICONS[t.status] || Clock;
        results.push({
          id: `task-${t.id}`,
          label: t.title,
          hint: t.task_key,
          icon: StatusIcon,
          iconColor: STATUS_COLORS[t.status] || 'text-surface-400',
          category: 'task',
          action: () => onViewDetail?.(t),
          subActions: [
            t.status === 'backlog' && {
              label: 'Start',
              action: () => onStatusChange?.(t, 'in_progress'),
            },
            t.status === 'awaiting_approval' && {
              label: 'Approve',
              action: () => onStatusChange?.(t, 'done'),
            },
            {
              label: 'Logs',
              action: () => onViewLogs?.(t),
            },
          ].filter(Boolean),
        });
      }
    }

    return results;
  }, [
    query,
    tasks,
    projects,
    currentProject,
    openModal,
    onNavigateToProject,
    onNavigateToDashboard,
    onStatusChange,
    onViewLogs,
    onViewDetail,
  ]);

  const executeItem = useCallback(
    (item) => {
      if (item?.action) {
        item.action();
        onClose();
      }
    },
    [onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeItem(items[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, items, selectedIndex, executeItem, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-[560px] mx-4 shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800">
          <Search size={18} className="text-surface-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, or type a command..."
            className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 outline-none"
          />
          <kbd className="hidden sm:flex items-center px-1.5 py-0.5 text-[10px] text-surface-500 bg-surface-800 rounded border border-surface-700 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-surface-500">
              {query ? 'No results found' : 'Start typing to search...'}
            </div>
          )}
          {items.map((item, i) => {
            const Icon = item.icon;
            const isSelected = i === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => executeItem(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-claude/10 text-claude' : 'text-surface-300 hover:bg-surface-800/50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-claude/20' : 'bg-surface-800'
                  }`}
                >
                  <Icon size={14} className={item.iconColor || (isSelected ? 'text-claude' : 'text-surface-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.hint && <div className="text-[10px] text-surface-500 font-mono truncate">{item.hint}</div>}
                </div>
                {item.subActions && item.subActions.length > 0 && isSelected && (
                  <div className="flex items-center gap-1.5">
                    {item.subActions.map((sa, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sa.action();
                          onClose();
                        }}
                        className="px-2 py-0.5 text-[10px] font-medium rounded bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
                      >
                        {sa.label}
                      </button>
                    ))}
                  </div>
                )}
                {isSelected && !item.subActions?.length && (
                  <ArrowRight size={12} className="text-claude/50 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-800 text-[10px] text-surface-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-800 rounded border border-surface-700 font-mono">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-800 rounded border border-surface-700 font-mono">&crarr;</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-800 rounded border border-surface-700 font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
