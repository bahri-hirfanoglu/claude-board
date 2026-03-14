import { useState, useRef, useEffect } from 'react';
import { Terminal, Pencil, Trash2, Activity, GripVertical, ChevronRight } from 'lucide-react';

const priorityColors = {
  0: '',
  1: 'border-l-yellow-500',
  2: 'border-l-orange-500',
  3: 'border-l-red-500',
};

const priorityLabels = ['Normal', 'Low', 'Medium', 'High'];

const STATUS_OPTIONS = [
  { id: 'backlog', label: 'Backlog', dot: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', dot: 'bg-claude' },
  { id: 'done', label: 'Done', dot: 'bg-emerald-400' },
];

export default function TaskCard({ task, onDragStart, onDragEnd, onViewLogs, onEdit, onDelete, onStatusChange }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showMenu]);

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onContextMenu={handleContextMenu}
        className={`group relative bg-surface-800 rounded-lg p-3 border border-surface-700/50 hover:border-surface-600 cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-lg hover:shadow-black/20 ${
          task.priority > 0 ? `border-l-2 ${priorityColors[task.priority]}` : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-surface-100 truncate">{task.title}</h3>
            {task.description && (
              <p className="text-xs text-surface-400 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          <GripVertical size={14} className="text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1.5">
            {task.is_running && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <Activity size={10} className="animate-pulse" />
                Running
              </span>
            )}
            {task.priority > 0 && (
              <span className="text-[10px] text-surface-500">{priorityLabels[task.priority]}</span>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onViewLogs(); }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-claude transition-colors"
              title="View Logs"
            >
              <Terminal size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-surface-600 mt-1.5">
          #{task.id}
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          style={{ left: menuPos.x, top: menuPos.y }}
          className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl min-w-[160px]"
        >
          <div className="px-3 py-1.5 text-[10px] text-surface-500 font-medium uppercase tracking-wider">Move to</div>
          {STATUS_OPTIONS.filter(s => s.id !== task.status).map(s => (
            <button
              key={s.id}
              onClick={() => { setShowMenu(false); onStatusChange?.(task.id, s.id); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
              <ChevronRight size={10} className="ml-auto text-surface-600" />
            </button>
          ))}
          <div className="border-t border-surface-700 my-1" />
          <button
            onClick={() => { setShowMenu(false); onViewLogs(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
          >
            <Terminal size={11} />
            View Logs
          </button>
          <button
            onClick={() => { setShowMenu(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            onClick={() => { setShowMenu(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-surface-700 transition-colors"
          >
            <Trash2 size={11} />
            Delete
          </button>
        </div>
      )}
    </>
  );
}
