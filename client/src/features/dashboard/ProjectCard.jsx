import { Cpu, Coins, Clock, CheckCircle2, Activity, Layers } from 'lucide-react';
import Avatar from 'boring-avatars';
import { formatTokens, formatTimeAgo as timeAgo } from '../../lib/formatters';
import { AVATAR_COLORS } from '../../lib/constants';
import { MiniStatusBar } from './MiniStatusBar';

export function ProjectCard({ project, onSelect, t }) {
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
          <span>{total} {t('common.tasks')}</span>
        </div>
        {(project.done_tasks || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500">
            <CheckCircle2 size={10} />
            <span>{project.done_tasks} {t('dashboard.done')}</span>
          </div>
        )}
        {(project.active_tasks || 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Activity size={10} className="animate-pulse" />
            <span>{project.active_tasks} {t('dashboard.active').toLowerCase()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {tokens && (
          <div className="flex items-center gap-1 text-[10px] text-surface-500">
            <Cpu size={10} />
            <span>{tokens} {t('common.tokens')}</span>
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
