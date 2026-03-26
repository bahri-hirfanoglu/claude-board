import { useMemo } from 'react';
import { Clock, ChevronDown, ChevronRight, Brain, ListChecks, Trash2, Terminal, GitBranch } from 'lucide-react';
import { TYPE_COLORS } from '../../lib/constants';
import { PRIORITY_COLORS } from './planningConstants';
import { PRIORITY_LABELS } from '../../lib/constants';
import { formatElapsed, computeWaves } from './planningHelpers';
import { PlanLogFeed } from './PlanLogFeed';
import DependencyGraph from '../board/DependencyGraph';
import MDEditor from '@uiw/react-md-editor';

function MdPreview({ content }) {
  if (!content) return null;
  return (
    <div data-color-mode="dark" className="md-preview-compact">
      <MDEditor.Markdown
        source={content}
        style={{ backgroundColor: 'transparent', color: '#a8a29e', fontSize: '11px', lineHeight: '1.5' }}
      />
    </div>
  );
}

export function PlanPhaseReview({
  proposals,
  dependencies,
  stats,
  logs,
  analysis,
  showAnalysis,
  setShowAnalysis,
  showLogs,
  setShowLogs,
  expandedTask,
  setExpandedTask,
  showDag,
  setShowDag,
  handleRemoveProposal,
  t,
}) {
  // Type breakdown for review summary
  const typeBreakdown = useMemo(() => {
    const counts = {};
    for (const p of proposals) {
      const t = p.task_type || 'chore';
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts);
  }, [proposals]);

  const depCount = dependencies.length;

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5 text-surface-300 font-medium">
          <ListChecks size={13} className="text-amber-400" />
          {proposals.length} tasks
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeBreakdown.map(([type, count]) => (
            <span
              key={type}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[type] || 'bg-surface-500/15 text-surface-400'}`}
            >
              {count} {type}
            </span>
          ))}
        </div>
        {depCount > 0 && (
          <div className="flex items-center gap-1 text-surface-400">
            <GitBranch size={11} />
            <span>{depCount} deps</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 text-surface-500">
          <Clock size={10} />
          <span>{formatElapsed(stats.elapsed)}</span>
        </div>
      </div>

      {/* Analysis Collapsible */}
      {analysis && (
        <div>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors"
          >
            {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Brain size={12} className="text-purple-400" />
            {t('planning.analysis')}
          </button>
          {showAnalysis && (
            <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-4 max-h-48 overflow-y-auto">
              <MdPreview content={analysis} />
            </div>
          )}
        </div>
      )}

      {/* Activity Log Collapsible */}
      {logs.length > 0 && (
        <div>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors"
          >
            {showLogs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Terminal size={12} className="text-amber-400" />
            {t('planning.activityLog')}
            <span className="text-surface-600 font-normal">
              ({logs.length} {t('planning.events')})
            </span>
          </button>
          {showLogs && (
            <div className="bg-surface-950/80 border border-surface-800/60 rounded-xl p-2.5 max-h-48 overflow-y-auto">
              <PlanLogFeed logs={logs} isActive={false} />
            </div>
          )}
        </div>
      )}

      {/* Task List */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-surface-300">
            <ListChecks size={13} className="text-amber-400" />
            {t('planning.proposedTasks').replace('{count}', proposals.length)}
          </label>
          <span className="text-[10px] text-surface-600">{t('planning.removeHint')}</span>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {proposals.map((task, i) => {
            const isExpanded = expandedTask === i;
            const typeColor = TYPE_COLORS[task.task_type] || 'bg-surface-500/15 text-surface-400';
            return (
              <div
                key={i}
                className={`rounded-xl border transition-all duration-200 ${
                  isExpanded
                    ? 'bg-surface-800/60 border-surface-600/50 ring-1 ring-surface-600/20'
                    : 'bg-surface-800/30 border-surface-700/30 hover:border-surface-600/50'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer"
                  onClick={() => setExpandedTask(isExpanded ? null : i)}
                >
                  {/* Left: number circle */}
                  <span className="w-5 h-5 rounded-full bg-surface-700/50 flex items-center justify-center text-[10px] text-surface-500 font-mono flex-shrink-0">
                    {i + 1}
                  </span>

                  {/* Center: badges + title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor}`}>
                        {task.task_type}
                      </span>
                      {task.priority > 0 && (
                        <span className={`text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-surface-200 font-medium mt-1 leading-snug">{task.title}</p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProposal(i);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-600 hover:text-red-400 transition-colors"
                      title="Remove this task"
                    >
                      <Trash2 size={12} />
                    </button>
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-surface-500" />
                    ) : (
                      <ChevronRight size={12} className="text-surface-600" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-0 space-y-3 border-t border-surface-700/30 mx-3 mt-0">
                    {task.description && (
                      <div className="mt-3">
                        <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">
                          {t('planning.description')}
                        </span>
                        <div className="mt-1">
                          <MdPreview content={task.description} />
                        </div>
                      </div>
                    )}
                    {task.acceptance_criteria && (
                      <div>
                        <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">
                          {t('planning.acceptanceCriteria')}
                        </span>
                        <div className="mt-1">
                          <MdPreview content={task.acceptance_criteria} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dependency Graph */}
      {dependencies.length > 0 && (
        <div>
          <button
            onClick={() => setShowDag(!showDag)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors"
          >
            {showDag ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <GitBranch size={12} className="text-blue-400" />
            {t('planning.dependencyGraph')}
            <span className="text-surface-600 font-normal">
              ({dependencies.length} {t('planning.edges')})
            </span>
          </button>
          {showDag && (
            <div className="max-h-72 overflow-auto rounded-xl border border-surface-700/30">
              <DependencyGraph
                tasks={proposals.map((p, i) => ({
                  id: i,
                  title: p.title,
                  status: 'backlog',
                  task_key: `#${i + 1}`,
                  model: null,
                }))}
                edges={dependencies.map(([parentIdx, childIdx]) => ({ from: parentIdx, to: childIdx }))}
                waves={computeWaves(proposals, dependencies)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
