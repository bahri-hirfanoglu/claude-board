import { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutGrid, List, X, GitBranch, Workflow, TrendingUp, Tag, ChevronDown } from 'lucide-react';
import Column from './Column';
import ListView from './ListView';
import PipelineView from './PipelineView';
import OrchestrationView from './OrchestrationView';
import AnalyticsView from './AnalyticsView';
import { COLUMNS, MODELS, MODEL_COLORS, MODEL_DOT_COLORS, MODEL_BG_ACTIVE, getTagColor } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import { parseTags } from './TagBadge';

const VIEWS = [
  { id: 'board', labelKey: 'board.board', icon: LayoutGrid },
  { id: 'list', labelKey: 'board.list', icon: List },
  { id: 'pipeline', labelKey: 'board.pipeline', icon: GitBranch },
  { id: 'orchestration', labelKey: 'board.orchestration', icon: Workflow },
  { id: 'analytics', labelKey: 'board.analytics', icon: TrendingUp },
];

const MODEL_DOT = MODEL_DOT_COLORS;

export default function Board({ tasks, projectId, onStatusChange, onViewLogs, onEditTask, onDeleteTask, onReviewTask, onViewDetail }) {
  const { t } = useTranslation();
  const [draggedTask, setDraggedTask] = useState(null);
  const [mobileTab, setMobileTab] = useState('backlog');
  const [viewMode, setViewMode] = useState('board');
  const [modelFilter, setModelFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef(null);

  useEffect(() => {
    if (!tagDropdownOpen) return;
    const close = (e) => { if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) setTagDropdownOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [tagDropdownOpen]);

  // Models actually present in current tasks
  const { activeModels, modelCounts } = useMemo(() => {
    const counts = {};
    tasks.forEach(t => {
      const m = t.model_used || t.model || 'sonnet';
      counts[m] = (counts[m] || 0) + 1;
    });
    return { activeModels: MODELS.filter(m => counts[m]), modelCounts: counts };
  }, [tasks]);

  // Collect all tags across tasks
  const { activeTags, tagCounts } = useMemo(() => {
    const counts = {};
    tasks.forEach(t => {
      const tags = parseTags(t.tags);
      tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
    });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { activeTags: sorted, tagCounts: counts };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (modelFilter) result = result.filter(t => (t.model_used || t.model || 'sonnet') === modelFilter);
    if (tagFilter.length > 0) result = result.filter(t => {
      const tags = parseTags(t.tags);
      return tagFilter.some(f => tags.includes(f));
    });
    return result;
  }, [tasks, modelFilter, tagFilter]);

  const groupedTasks = useMemo(() => {
    const grouped = { backlog: [], in_progress: [], testing: [], done: [] };
    for (const t of filteredTasks) {
      const s = t.status || 'backlog';
      if (grouped[s]) grouped[s].push(t);
    }
    return grouped;
  }, [filteredTasks]);
  const columnTasks = (colId) => groupedTasks[colId] || [];

  return (
    <div className="h-full flex flex-col">
      {/* View toggle + model filter bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1 flex-wrap">
        {VIEWS.map(v => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === v.id
                  ? 'bg-claude/15 text-claude'
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{t(v.labelKey)}</span>
            </button>
          );
        })}

        {/* Separator */}
        {activeModels.length > 1 && <div className="w-px h-5 bg-surface-700/50 mx-1.5" />}

        {/* Model filter chips */}
        {activeModels.length > 1 && activeModels.map(m => {
          const isActive = modelFilter === m;
          const count = modelCounts[m] || 0;
          return (
            <button
              key={m}
              onClick={() => setModelFilter(isActive ? null : m)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? `${MODEL_BG_ACTIVE[m] || 'bg-surface-700/50'} ring-1 ${MODEL_COLORS[m] || 'text-surface-300'}`
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
              }`}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MODEL_DOT[m] || '#94a3b8' }} />
              <span className="capitalize">{m}</span>
              <span className={`text-[10px] px-1 py-px rounded-full ${isActive ? 'bg-white/10' : 'bg-surface-800'}`}>{count}</span>
            </button>
          );
        })}

        {/* Clear model filter */}
        {modelFilter && (
          <button onClick={() => setModelFilter(null)}
            className="flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] text-surface-500 hover:text-surface-300 hover:bg-surface-800/50 transition-colors"
            title={t('board.clearFilter')}>
            <X size={12} />
          </button>
        )}

        {/* Tag filter dropdown */}
        {activeTags.length > 0 && (
          <>
            <div className="w-px h-5 bg-surface-700/50 mx-1.5" />
            <div className="relative" ref={tagDropdownRef}>
              <button onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tagFilter.length > 0 ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
                }`}>
                <Tag size={12} />
                Tags
                {tagFilter.length > 0 && (
                  <span className="text-[10px] bg-claude/20 px-1.5 py-px rounded-full">{tagFilter.length}</span>
                )}
                <ChevronDown size={10} />
              </button>
              {tagDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl z-20 min-w-[280px] max-h-[320px] overflow-y-auto">
                  {tagFilter.length > 0 && (
                    <button onClick={() => { setTagFilter([]); setTagDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-500 hover:bg-surface-700 border-b border-surface-700/50 transition-colors">
                      <X size={10} /> Clear all
                    </button>
                  )}
                  {activeTags.map(tag => {
                    const isActive = tagFilter.includes(tag);
                    const color = getTagColor(tag);
                    return (
                      <button key={tag}
                        onClick={() => setTagFilter(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                          isActive ? 'bg-surface-700/50 text-surface-200' : 'text-surface-400 hover:bg-surface-700/30'
                        }`}>
                        <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                          isActive ? 'bg-claude border-claude' : 'border-surface-600'
                        }`}>
                          {isActive && <span className="text-[8px] text-white font-bold">✓</span>}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${color}`}>{tag}</span>
                        <span className="ml-auto text-[10px] text-surface-600">{tagCounts[tag]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Board view */}
      {viewMode === 'board' && (
        <>
          {/* Mobile tab bar */}
          <div className="flex md:hidden border-b border-surface-800 bg-surface-900/80 overflow-x-auto">
            {COLUMNS.map(col => {
              const count = columnTasks(col.id).length;
              return (
                <button
                  key={col.id}
                  onClick={() => setMobileTab(col.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    mobileTab === col.id
                      ? `${col.color} border-current`
                      : 'text-surface-500 border-transparent'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${col.bg}`} />
                  {t('status.' + col.id)}
                  {count > 0 && <span className="text-[10px] bg-surface-800 px-1.5 py-0.5 rounded-full">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Mobile: single column */}
          <div className="flex-1 overflow-y-auto md:hidden p-3">
            <Column
              column={COLUMNS.find(c => c.id === mobileTab)}
              tasks={columnTasks(mobileTab)}
              draggedTask={draggedTask}
              onDragStart={setDraggedTask}
              onDragEnd={() => setDraggedTask(null)}
              onDrop={() => {
                if (draggedTask && draggedTask.status !== mobileTab) onStatusChange(draggedTask.id, mobileTab);
                setDraggedTask(null);
              }}
              onViewLogs={onViewLogs}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onStatusChange={onStatusChange}
              onReviewTask={onReviewTask}
              onViewDetail={onViewDetail}
              isMobile
            />
          </div>

          {/* Desktop: all columns side by side */}
          <div className="hidden md:flex flex-1 gap-4 p-4 overflow-x-auto">
            {COLUMNS.map(col => (
              <Column
                key={col.id}
                column={col}
                tasks={columnTasks(col.id)}
                draggedTask={draggedTask}
                onDragStart={setDraggedTask}
                onDragEnd={() => setDraggedTask(null)}
                onDrop={() => {
                  if (draggedTask && draggedTask.status !== col.id) onStatusChange(draggedTask.id, col.id);
                  setDraggedTask(null);
                }}
                onViewLogs={onViewLogs}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onStatusChange={onStatusChange}
                onReviewTask={onReviewTask}
                onViewDetail={onViewDetail}
              />
            ))}
          </div>
        </>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-hidden">
          <ListView
            tasks={filteredTasks}
            onStatusChange={onStatusChange}
            onViewLogs={onViewLogs}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onReviewTask={onReviewTask}
            onViewDetail={onViewDetail}
          />
        </div>
      )}

      {viewMode === 'pipeline' && (
        <div className="flex-1 overflow-hidden">
          <PipelineView
            tasks={filteredTasks}
            onStatusChange={onStatusChange}
            onViewLogs={onViewLogs}
            onViewDetail={onViewDetail}
          />
        </div>
      )}

      {viewMode === 'orchestration' && (
        <div className="flex-1 overflow-hidden">
          <OrchestrationView
            tasks={tasks}
            projectId={projectId}
            onViewLogs={onViewLogs}
            onStatusChange={onStatusChange}
            onViewDetail={onViewDetail}
          />
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="flex-1 overflow-hidden">
          <AnalyticsView
            tasks={filteredTasks}
            projectId={projectId}
          />
        </div>
      )}
    </div>
  );
}
