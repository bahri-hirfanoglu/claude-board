import { useState, useMemo } from 'react';
import { LayoutGrid, List, BarChart3, Clock, X } from 'lucide-react';
import Column from './Column';
import ListView from './ListView';
import SummaryView from './SummaryView';
import TimelineView from './TimelineView';
import { MODELS, MODEL_COLORS } from '../../lib/constants';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'text-surface-400', bg: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', color: 'text-claude', bg: 'bg-claude' },
  { id: 'done', label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400' },
];

const VIEWS = [
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'summary', label: 'Summary', icon: BarChart3 },
];

const MODEL_DOT = { haiku: '#4ade80', sonnet: '#60a5fa', opus: '#c084fc' };
const MODEL_BG_ACTIVE = { haiku: 'bg-green-500/15 ring-green-500/30', sonnet: 'bg-blue-500/15 ring-blue-500/30', opus: 'bg-purple-500/15 ring-purple-500/30' };

export default function Board({ tasks, onStatusChange, onViewLogs, onEditTask, onDeleteTask, onReviewTask, onViewDetail }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [mobileTab, setMobileTab] = useState('backlog');
  const [viewMode, setViewMode] = useState('board');
  const [modelFilter, setModelFilter] = useState(null);

  // Models actually present in current tasks
  const activeModels = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => {
      const m = t.model_used || t.model || 'sonnet';
      set.add(m);
    });
    return MODELS.filter(m => set.has(m));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!modelFilter) return tasks;
    return tasks.filter(t => (t.model_used || t.model || 'sonnet') === modelFilter);
  }, [tasks, modelFilter]);

  const columnTasks = (colId) => filteredTasks.filter(t => t.status === colId);

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
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}

        {/* Separator */}
        {activeModels.length > 1 && <div className="w-px h-5 bg-surface-700/50 mx-1.5" />}

        {/* Model filter chips */}
        {activeModels.length > 1 && activeModels.map(m => {
          const isActive = modelFilter === m;
          const count = tasks.filter(t => (t.model_used || t.model || 'sonnet') === m).length;
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

        {/* Clear filter */}
        {modelFilter && (
          <button
            onClick={() => setModelFilter(null)}
            className="flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] text-surface-500 hover:text-surface-300 hover:bg-surface-800/50 transition-colors"
            title="Clear filter"
          >
            <X size={12} />
          </button>
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
                  {col.label}
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

      {/* Timeline view */}
      {viewMode === 'timeline' && (
        <div className="flex-1 overflow-hidden">
          <TimelineView tasks={filteredTasks} onViewDetail={onViewDetail} />
        </div>
      )}

      {/* Summary view */}
      {viewMode === 'summary' && (
        <div className="flex-1 overflow-hidden">
          <SummaryView tasks={filteredTasks} />
        </div>
      )}
    </div>
  );
}
