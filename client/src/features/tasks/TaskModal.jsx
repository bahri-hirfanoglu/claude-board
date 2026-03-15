import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Sparkles, Cpu, Zap, Layers, ChevronDown } from 'lucide-react';

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

const MODELS = [
  { value: 'haiku', label: 'Haiku', desc: 'Fast & lightweight', color: 'bg-green-500/20 text-green-300' },
  { value: 'sonnet', label: 'Sonnet', desc: 'Balanced', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'opus', label: 'Opus', desc: 'Most capable', color: 'bg-purple-500/20 text-purple-300' },
];

const EFFORTS = [
  { value: 'low', label: 'Low', desc: 'Quick tasks', color: 'bg-green-500/20 text-green-300' },
  { value: 'medium', label: 'Medium', desc: 'Default', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'high', label: 'High', desc: 'Complex tasks', color: 'bg-red-500/20 text-red-300' },
];

export default function TaskModal({ task, onSubmit, onClose, templates = [] }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 0);
  const [taskType, setTaskType] = useState(task?.task_type || 'feature');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(task?.acceptance_criteria || '');
  const [model, setModel] = useState(task?.model || 'sonnet');
  const [thinkingEffort, setThinkingEffort] = useState(task?.thinking_effort || 'medium');
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const titleRef = useRef(null);
  const templateMenuRef = useRef(null);

  const isCreating = !task;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close template menu on outside click
  useEffect(() => {
    if (!showTemplateMenu) return;
    const close = (e) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target)) setShowTemplateMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showTemplateMenu]);

  // Parse template variables
  const parsedVars = useMemo(() => {
    if (!selectedTemplate?.variables) return [];
    try { return JSON.parse(selectedTemplate.variables); } catch { return []; }
  }, [selectedTemplate]);

  // Generate description from template when variables change
  const generatedDescription = useMemo(() => {
    if (!selectedTemplate?.template) return '';
    let text = selectedTemplate.template;
    for (const v of parsedVars) {
      if (v.name) {
        const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
        const value = templateVars[v.name] || v.default || '';
        text = text.replace(regex, value);
      }
    }
    return text;
  }, [selectedTemplate, parsedVars, templateVars]);

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setShowTemplateMenu(false);
    // Pre-fill defaults from template
    setTaskType(tpl.task_type || 'feature');
    setModel(tpl.model || 'sonnet');
    setThinkingEffort(tpl.thinking_effort || 'medium');
    // Initialize variable values with defaults
    const vars = {};
    try {
      const parsed = JSON.parse(tpl.variables || '[]');
      for (const v of parsed) {
        if (v.name) vars[v.name] = v.default || '';
      }
    } catch {}
    setTemplateVars(vars);
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
    setTemplateVars({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const finalDescription = selectedTemplate ? (description.trim() ? description.trim() + '\n\n' + generatedDescription : generatedDescription) : description.trim();
    try {
      await onSubmit({
        title: title.trim(),
        description: finalDescription,
        priority,
        task_type: taskType,
        acceptance_criteria: acceptanceCriteria.trim(),
        model,
        thinking_effort: thinkingEffort,
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
          {/* Template Selector - only when creating */}
          {isCreating && templates.length > 0 && (
            <div>
              {!selectedTemplate ? (
                <div className="relative" ref={templateMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors w-full justify-center"
                  >
                    <Layers size={13} />
                    Use Template
                    <ChevronDown size={12} />
                  </button>
                  {showTemplateMenu && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                      {templates.map(tpl => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleSelectTemplate(tpl)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-surface-700 transition-colors"
                        >
                          <span className="text-surface-200 font-medium">{tpl.name}</span>
                          {tpl.description && <span className="text-surface-500 ml-1.5">- {tpl.description}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-claude/5 border border-claude/20 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-claude flex items-center gap-1.5">
                    <Layers size={12} />
                    Template: <span className="font-medium">{selectedTemplate.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearTemplate}
                    className="text-xs text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Template Variables */}
          {selectedTemplate && parsedVars.length > 0 && (
            <div className="bg-surface-800/30 rounded-lg p-3 border border-surface-700/50 space-y-2.5">
              <label className="text-xs font-medium text-surface-400 block">Template Variables</label>
              {parsedVars.map(v => (
                <div key={v.name}>
                  <label className="text-[11px] text-surface-500 mb-0.5 block">{v.label || v.name}</label>
                  <input
                    value={templateVars[v.name] || ''}
                    onChange={e => setTemplateVars(prev => ({ ...prev, [v.name]: e.target.value }))}
                    placeholder={v.placeholder || ''}
                    className="w-full px-2.5 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600"
                  />
                </div>
              ))}
              {/* Preview of generated description */}
              {generatedDescription && (
                <div>
                  <label className="text-[11px] text-surface-500 mb-0.5 block">Generated Prompt Preview</label>
                  <div className="bg-surface-900 rounded-lg px-2.5 py-2 text-xs text-surface-400 whitespace-pre-wrap max-h-24 overflow-y-auto border border-surface-700/50">
                    {generatedDescription}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Model & Effort Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Model */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1.5">
                <Cpu size={11} />
                Model
              </label>
              <div className="flex flex-col gap-1">
                {MODELS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setModel(m.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      model === m.value
                        ? `${m.color} ring-1 ring-current`
                        : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className={`text-[10px] ${model === m.value ? 'opacity-80' : 'text-surface-600'}`}>{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Thinking Effort */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-surface-400 mb-1.5">
                <Zap size={11} />
                Thinking Effort
              </label>
              <div className="flex flex-col gap-1">
                {EFFORTS.map(e => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setThinkingEffort(e.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      thinkingEffort === e.value
                        ? `${e.color} ring-1 ring-current`
                        : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    <span className="font-medium">{e.label}</span>
                    <span className={`text-[10px] ${thinkingEffort === e.value ? 'opacity-80' : 'text-surface-600'}`}>{e.desc}</span>
                  </button>
                ))}
              </div>
            </div>
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
