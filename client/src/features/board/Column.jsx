import { useState, useRef, useCallback } from 'react';
import TaskCard from './TaskCard';
import { useTranslation } from '../../i18n/I18nProvider';

export default function Column({
  column,
  tasks,
  draggedTask,
  onDragStart,
  onDragEnd,
  onDrop,
  onReorder,
  onViewLogs,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onReviewTask,
  onViewDetail,
  onDepDrop,
  isMobile,
}) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState(null);
  const cardRefs = useRef({});

  const getDropIndex = useCallback(
    (e) => {
      for (let i = 0; i < tasks.length; i++) {
        const el = cardRefs.current[tasks[i].id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) return i;
      }
      return tasks.length;
    },
    [tasks],
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Only show reorder indicator for same-column drags
      if (draggedTask && draggedTask.status === column.id) {
        setDropIndex(getDropIndex(e));
      }
      setDragOver(true);
    },
    [draggedTask, column.id, getDropIndex],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      setDropIndex(null);

      if (!draggedTask) return;

      // Same column: reorder
      if (draggedTask.status === column.id && onReorder) {
        const targetIdx = getDropIndex(e);
        const currentIdx = tasks.findIndex((t) => t.id === draggedTask.id);
        if (currentIdx !== -1 && currentIdx !== targetIdx && currentIdx !== targetIdx - 1) {
          const reordered = tasks.filter((t) => t.id !== draggedTask.id);
          const insertAt = targetIdx > currentIdx ? targetIdx - 1 : targetIdx;
          reordered.splice(insertAt, 0, draggedTask);
          onReorder(reordered.map((t) => t.id));
        }
        onDragEnd();
      } else {
        // Cross-column: status change
        onDrop();
      }
    },
    [draggedTask, column.id, tasks, onReorder, onDrop, onDragEnd, getDropIndex],
  );

  return (
    <div
      className={`flex flex-col rounded-xl bg-surface-900/50 border transition-all duration-200 ${
        dragOver ? 'border-claude/50 bg-claude/5' : 'border-surface-800'
      } ${isMobile ? 'flex-1' : 'flex-1 min-w-[260px] max-w-[360px]'}`}
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setDragOver(false);
        setDropIndex(null);
      }}
      onDrop={handleDrop}
    >
      {!isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${column.bg}`} />
            <h2 className={`text-sm font-medium ${column.color}`}>{t('status.' + column.id)}</h2>
          </div>
          {tasks.length > 0 && (
            <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full">{tasks.length}</span>
          )}
        </div>
      )}

      <div className={`flex-1 overflow-y-auto space-y-2 ${isMobile ? '' : 'p-3'}`}>
        {tasks.map((task, idx) => (
          <div key={task.id} ref={(el) => (cardRefs.current[task.id] = el)}>
            {dropIndex === idx && draggedTask?.status === column.id && draggedTask?.id !== task.id && (
              <div className="h-0.5 bg-claude/60 rounded-full mx-2 mb-1" />
            )}
            <TaskCard
              task={task}
              draggedTask={draggedTask}
              onDragStart={() => onDragStart(task)}
              onDragEnd={onDragEnd}
              onViewLogs={() => onViewLogs(task)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task)}
              onStatusChange={onStatusChange}
              onReview={() => onReviewTask(task)}
              onViewDetail={() => onViewDetail(task)}
              onDepDrop={onDepDrop}
            />
          </div>
        ))}
        {dropIndex === tasks.length && draggedTask?.status === column.id && (
          <div className="h-0.5 bg-claude/60 rounded-full mx-2" />
        )}
        {tasks.length === 0 && <div className="text-center py-8 text-surface-600 text-sm">{t('board.noTasks')}</div>}
      </div>
    </div>
  );
}
