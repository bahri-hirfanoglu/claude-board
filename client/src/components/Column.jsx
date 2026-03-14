import { useState } from 'react';
import TaskCard from './TaskCard';

export default function Column({ column, tasks, draggedTask, onDragStart, onDragEnd, onDrop, onViewLogs, onEditTask, onDeleteTask, onStatusChange }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    onDrop();
  };

  return (
    <div
      className={`flex-1 min-w-[280px] max-w-[360px] flex flex-col rounded-xl bg-surface-900/50 border transition-all duration-200 ${
        dragOver ? 'border-claude/50 bg-claude/5' : 'border-surface-800'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${column.bg}`} />
          <h2 className={`text-sm font-medium ${column.color}`}>{column.label}</h2>
        </div>
        <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onDragStart={() => onDragStart(task)}
            onDragEnd={onDragEnd}
            onViewLogs={() => onViewLogs(task)}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task)}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-surface-600 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
