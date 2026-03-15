import { useState } from 'react';
import Column from './Column';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'text-surface-400', bg: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', color: 'text-claude', bg: 'bg-claude' },
  { id: 'done', label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400' },
];

export default function Board({ tasks, onStatusChange, onViewLogs, onEditTask, onDeleteTask, onReviewTask, onViewDetail }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [mobileTab, setMobileTab] = useState('backlog');

  const columnTasks = (colId) => tasks.filter(t => t.status === colId);

  return (
    <div className="h-full flex flex-col">
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
    </div>
  );
}
