import { useState } from 'react';
import Column from './Column';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'text-surface-400', bg: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', color: 'text-claude', bg: 'bg-claude' },
  { id: 'done', label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400' },
];

export default function Board({ tasks, onStatusChange, onViewLogs, onEditTask, onDeleteTask, onReviewTask }) {
  const [draggedTask, setDraggedTask] = useState(null);

  return (
    <div className="h-full flex gap-4 p-4 overflow-x-auto">
      {COLUMNS.map(col => (
        <Column
          key={col.id}
          column={col}
          tasks={tasks.filter(t => t.status === col.id)}
          draggedTask={draggedTask}
          onDragStart={setDraggedTask}
          onDragEnd={() => setDraggedTask(null)}
          onDrop={() => {
            if (draggedTask && draggedTask.status !== col.id) {
              onStatusChange(draggedTask.id, col.id);
            }
            setDraggedTask(null);
          }}
          onViewLogs={onViewLogs}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onStatusChange={onStatusChange}
          onReviewTask={onReviewTask}
        />
      ))}
    </div>
  );
}
