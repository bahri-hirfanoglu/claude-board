import { Zap } from 'lucide-react';
import Avatar from 'boring-avatars';
import { formatTokens } from '../../lib/formatters';
import { AVATAR_COLORS } from '../../lib/constants';
import { MiniStatusBar } from './MiniStatusBar';

export function ProjectListRow({ project, onSelect, t }) {
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
