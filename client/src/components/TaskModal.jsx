import { useState, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';

const TASK_TYPES = [
  { value: 'feature', label: 'Feature', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'bugfix', label: 'Bug Fix', color: 'bg-red-500/20 text-red-300' },
  { value: 'refactor', label: 'Refactor', color: 'bg-purple-500/20 text-purple-300' },
  { value: 'docs', label: 'Docs', color: 'bg-green-500/20 text-green-300' },
  { value: 'test', label: 'Test', color: 'bg-yellow-500/20 text-yellow-300' },
  { value: 'chore', label: 'Chore', color: 'bg-surface-500/20 text-surface-300' },
];

const PRIORITIES = [
  { value: 0, label: 'None', style: 'bg-surface-700 text-surface-300' },
  { value: 1, label: 'Low', style: 'bg-yellow-500/20 text-yellow-300' },
  { value: 2, label: 'Medium', style: 'bg-orange-500/20 text-orange-300' },
  { value: 3, label: 'High', style: 'bg-red-500/20 text-red-300' },
];

export default function TaskModal({ task, onSubmit, onClose }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 0);
  const [taskType, setTaskType] = useState(task?.task_type || 'feature');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(task?.acceptance_criteria || '');
  const [loading, setLoading] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        task_type: taskType,
        acceptance_criteria: acceptanceCriteria.trim(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-claude" />
            <h2 className="text-base font-medium">{task ? 'Edit Task' : 'New Task'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Task Type */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTaskType(t.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    taskType === t.value
                      ? `${t.color} ring-1 ring-current`
                      : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Title</label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Add user authentication flow"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600"
              required
            />
          </div>

          {/* Description / Claude Prompt */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">
              Description
              <span className="text-surface-600 font-normal ml-1">- sent to Claude as the prompt</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={"Describe what Claude should implement.\n\nBe specific about:\n- What to build or change\n- Which files or modules are involved\n- Any constraints or requirements"}
              rows={6}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none"
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">
              Acceptance Criteria
              <span className="text-surface-600 font-normal ml-1">- optional</span>
            </label>
            <textarea
              value={acceptanceCriteria}
              onChange={e => setAcceptanceCriteria(e.target.value)}
              placeholder={"Define what 'done' looks like:\n- Tests pass\n- API returns correct response\n- No regressions in existing features"}
              rows={3}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    priority === p.value
                      ? `${p.style} ring-1 ring-current`
                      : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
