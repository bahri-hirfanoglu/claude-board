import { useState } from 'react';
import TaskCard from './TaskCard';
import { useTranslation } from '../../i18n/I18nProvider';

export default function Column({
  column,
  tasks,
  draggedTask,
  onDragStart,
  onDragEnd,
  onDrop,
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

  return (
    <div
      className={`flex flex-col rounded-xl bg-surface-900/50 border transition-all duration-200 ${
        dragOver ? 'border-claude/50 bg-claude/5' : 'border-surface-800'
      } ${isMobile ? 'flex-1' : 'flex-1 min-w-[260px] max-w-[360px]'}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop();
      }}
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
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
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
        ))}
        {tasks.length === 0 && <div className="text-center py-8 text-surface-600 text-sm">{t('board.noTasks')}</div>}
      </div>
    </div>
  );
}
