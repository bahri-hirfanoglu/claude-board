import { X, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { STATUS_COLORS } from './taskDetailHelpers';
import { COLUMNS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';

export function TaskDependenciesTab({
  task, deps, setDeps, allTasks, currentStatus,
  addDepId, setAddDepId, addDepDirection, setAddDepDirection,
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Parent dependencies (this task depends on...) */}
      <div>
        <h4 className="text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-2">{t('detail.dependsOn') || 'Depends On'}</h4>
        {deps.parents?.length > 0 ? (
          <div className="space-y-1.5">
            {deps.parents.map(pid => {
              const pt = allTasks.find(t => t.id === pid);
              if (!pt) return null;
              const dotColor = COLUMNS.find(c => c.id === pt.status)?.bg || 'bg-surface-400';
              return (
                <div key={pid} className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 rounded-lg border border-surface-700/30 group">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className="text-[10px] text-surface-500 font-mono flex-shrink-0">{pt.task_key}</span>
                  <span className="text-xs text-surface-300 truncate flex-1">{pt.title}</span>
                  <span className={`text-[9px] ${STATUS_COLORS[pt.status] || 'text-surface-500'}`}>{t('status.' + pt.status)}</span>
                  {currentStatus === 'backlog' && (
                    <button onClick={async () => {
                      await api.removeDependency(task.id, pid);
                      api.getTaskDependencies(task.id).then(setDeps).catch(() => {});
                    }} className="p-0.5 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Remove">
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-surface-600">{t('detail.noDeps') || 'No dependencies'}</p>
        )}
      </div>

      {/* Child dependencies (...depends on this task) */}
      <div>
        <h4 className="text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-2">{t('detail.blockedBy') || 'Blocks'}</h4>
        {deps.children?.length > 0 ? (
          <div className="space-y-1.5">
            {deps.children.map(cid => {
              const ct = allTasks.find(t => t.id === cid);
              if (!ct) return null;
              const dotColor = COLUMNS.find(c => c.id === ct.status)?.bg || 'bg-surface-400';
              return (
                <div key={cid} className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 rounded-lg border border-surface-700/30 group">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className="text-[10px] text-surface-500 font-mono flex-shrink-0">{ct.task_key}</span>
                  <span className="text-xs text-surface-300 truncate flex-1">{ct.title}</span>
                  <span className={`text-[9px] ${STATUS_COLORS[ct.status] || 'text-surface-500'}`}>{t('status.' + ct.status)}</span>
                  {currentStatus === 'backlog' && (
                    <button onClick={async () => {
                      await api.removeDependency(cid, task.id);
                      api.getTaskDependencies(task.id).then(setDeps).catch(() => {});
                    }} className="p-0.5 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Remove">
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-surface-600">{t('detail.noBlocks') || 'No tasks depend on this'}</p>
        )}
      </div>

      {/* Add dependency (only in backlog) */}
      {currentStatus === 'backlog' && (
        <div className="border-t border-surface-700/50 pt-3">
          <h4 className="text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-2">
            <Plus size={10} className="inline mr-1" />
            {t('detail.addDep') || 'Add Dependency'}
          </h4>
          <div className="flex items-center gap-2">
            <select
              value={addDepDirection}
              onChange={e => setAddDepDirection(e.target.value)}
              className="px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-[11px] text-surface-300 focus:outline-none focus:ring-1 focus:ring-claude"
            >
              <option value="parent">{t('detail.thisDepends') || 'This task depends on...'}</option>
              <option value="child">{t('detail.thisBlocks') || 'This task blocks...'}</option>
            </select>
            <select
              value={addDepId}
              onChange={e => setAddDepId(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-[11px] text-surface-300 focus:outline-none focus:ring-1 focus:ring-claude"
            >
              <option value="">{t('detail.selectTask') || 'Select a task...'}</option>
              {allTasks
                .filter(t => t.id !== task.id && !(deps.parents || []).includes(t.id) && !(deps.children || []).includes(t.id))
                .map(t => (
                  <option key={t.id} value={t.id}>{t.task_key} — {t.title}</option>
                ))
              }
            </select>
            <button
              disabled={!addDepId}
              onClick={async () => {
                if (!addDepId) return;
                const targetId = Number(addDepId);
                if (addDepDirection === 'parent') {
                  await api.addDependency(task.id, targetId);
                } else {
                  await api.addDependency(targetId, task.id);
                }
                setAddDepId('');
                api.getTaskDependencies(task.id).then(setDeps).catch(() => {});
              }}
              className="px-3 py-1.5 bg-claude/20 text-claude rounded-lg text-[11px] font-medium hover:bg-claude/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
