import { useState, useMemo, useRef, useEffect } from 'react';
import { GitBranch, X, Search, AlertTriangle, ArrowRight, Lock, Plus, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nProvider';

const STATUS_DOT = {
  backlog: 'bg-surface-400',
  in_progress: 'bg-amber-400',
  testing: 'bg-purple-400',
  done: 'bg-emerald-400',
};

export default function DependencySelector({ taskId, allTasks, dependencies, onAdd, onRemove }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [cycleError, setCycleError] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const parents = useMemo(() => dependencies?.parents || [], [dependencies]);
  const children = useMemo(() => dependencies?.children || [], [dependencies]);

  const parentTasks = useMemo(() =>
    parents.map(id => allTasks.find(t => t.id === id)).filter(Boolean),
    [parents, allTasks]
  );

  const childTasks = useMemo(() =>
    children.map(id => allTasks.find(t => t.id === id)).filter(Boolean),
    [children, allTasks]
  );

  const availableTasks = useMemo(() => {
    const excluded = new Set([...(typeof taskId === 'number' ? [taskId] : []), ...parents, ...children]);
    return allTasks
      .filter(t => !excluded.has(t.id))
      .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.task_key?.toLowerCase().includes(search.toLowerCase()));
  }, [allTasks, taskId, parents, children, search]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setCycleError(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const handleAdd = async (depId) => {
    setCycleError(null);
    try {
      await onAdd(taskId, depId);
      setSearch('');
    } catch (e) {
      const msg = e?.message || String(e);
      setCycleError(msg.toLowerCase().includes('cycle') ? msg : 'Failed to add dependency');
      return;
    }
  };

  const hasAny = parentTasks.length > 0 || childTasks.length > 0;

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-surface-500 mb-1.5">
        <GitBranch size={10} />
        {t('taskModal.dependencies')}
        {hasAny && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-700 text-surface-400">
            {parentTasks.length + childTasks.length}
          </span>
        )}
      </label>

      {/* Dependency cards */}
      {hasAny && (
        <div className="space-y-1 mb-2">
          {/* Parents — "waits for" */}
          {parentTasks.map(pt => (
            <div key={pt.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/8 border border-blue-500/20 group">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[pt.status] || STATUS_DOT.backlog}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-blue-400/70">{pt.task_key || `#${pt.id}`}</span>
                  <ArrowRight size={8} className="text-surface-600" />
                  <span className="text-[10px] text-blue-300 truncate">{pt.title}</span>
                </div>
              </div>
              <span className="text-[9px] text-blue-400/50 flex-shrink-0 mr-1">
                <Lock size={8} className="inline -mt-px" /> waits for
              </span>
              <button
                type="button"
                onClick={() => onRemove(taskId, pt.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-all flex-shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ))}

          {/* Children — "blocks" */}
          {childTasks.map(ct => (
            <div key={ct.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-800/40 border border-surface-700/30">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[ct.status] || STATUS_DOT.backlog}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-surface-500">{ct.task_key || `#${ct.id}`}</span>
                  <span className="text-[10px] text-surface-400 truncate">{ct.title}</span>
                </div>
              </div>
              <span className="text-[9px] text-surface-500 flex-shrink-0">
                {t('taskModal.blocks')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add dependency button + dropdown */}
      <div className="relative" ref={dropdownRef}>
        {!open ? (
          <button
            type="button"
            onClick={() => { setOpen(true); setCycleError(null); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg border border-dashed border-surface-700 text-[11px] text-surface-400 hover:text-claude hover:border-claude/40 transition-colors justify-center"
          >
            <Plus size={11} />
            {t('taskModal.addDependency')}
          </button>
        ) : (
          <div className="rounded-lg border border-claude/30 bg-surface-800 overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-surface-700/50">
              <Search size={11} className="text-claude flex-shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('taskModal.addDependency')}
                className="flex-1 bg-transparent text-[11px] text-surface-200 placeholder-surface-500 focus:outline-none"
              />
              <button type="button" onClick={() => { setOpen(false); setSearch(''); setCycleError(null); }} className="text-surface-500 hover:text-surface-300">
                <X size={12} />
              </button>
            </div>

            {/* Cycle error */}
            {cycleError && (
              <div className="px-2.5 py-1.5 bg-red-500/10 border-b border-red-500/20 text-[10px] text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={10} className="flex-shrink-0" />
                <span>{cycleError}</span>
              </div>
            )}

            {/* Task list */}
            <div className="max-h-40 overflow-y-auto">
              {availableTasks.length === 0 ? (
                <div className="px-3 py-3 text-center text-[11px] text-surface-500">
                  {search ? 'No matching tasks' : 'No available tasks'}
                </div>
              ) : (
                availableTasks.slice(0, 10).map(task => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleAdd(task.id)}
                    className="w-full text-left px-2.5 py-2 flex items-center gap-2 hover:bg-surface-700/50 transition-colors group/item"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] || STATUS_DOT.backlog}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-surface-200 truncate">{task.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-mono text-surface-500">{task.task_key || `#${task.id}`}</span>
                        {task.task_type && (
                          <span className="text-[9px] text-surface-600">{task.task_type}</span>
                        )}
                        <span className="text-[9px] text-surface-600 capitalize">{task.status?.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <Plus size={12} className="text-surface-600 group-hover/item:text-claude flex-shrink-0 transition-colors" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
