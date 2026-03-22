import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, Layers, Variable, Eye, ChevronLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

const TASK_TYPES = [
  { value: 'feature', label: 'Feature' },
  { value: 'bugfix', label: 'Bug Fix' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'docs', label: 'Docs' },
  { value: 'test', label: 'Test' },
  { value: 'chore', label: 'Chore' },
];

const MODELS = [
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
];

const EFFORTS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function VariableEditor({ variables, onChange }) {
  const addVariable = () => {
    onChange([...variables, { name: '', label: '', placeholder: '', default: '' }]);
  };

  const updateVariable = (index, field, value) => {
    const updated = variables.map((v, i) => (i === index ? { ...v, [field]: value } : v));
    onChange(updated);
  };

  const removeVariable = (index) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="text-xs text-surface-400 mb-1.5 block">Variables</label>
      {variables.length > 0 && (
        <div className="space-y-2 mb-2">
          {variables.map((v, i) => (
            <div key={i} className="bg-surface-800 rounded-lg p-2.5 border border-surface-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-surface-500 font-medium uppercase tracking-wider">
                  Variable {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeVariable(i)}
                  className="p-0.5 rounded hover:bg-surface-700 text-surface-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={v.name}
                  onChange={(e) => updateVariable(i, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="name (e.g. file)"
                  className="px-2 py-1.5 bg-surface-900 border border-surface-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-claude"
                />
                <input
                  value={v.label}
                  onChange={(e) => updateVariable(i, 'label', e.target.value)}
                  placeholder="Label (e.g. File Path)"
                  className="px-2 py-1.5 bg-surface-900 border border-surface-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-claude"
                />
                <input
                  value={v.placeholder}
                  onChange={(e) => updateVariable(i, 'placeholder', e.target.value)}
                  placeholder="Placeholder"
                  className="px-2 py-1.5 bg-surface-900 border border-surface-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-claude"
                />
                <input
                  value={v.default || ''}
                  onChange={(e) => updateVariable(i, 'default', e.target.value)}
                  placeholder="Default value"
                  className="px-2 py-1.5 bg-surface-900 border border-surface-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-claude"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addVariable}
        className="flex items-center gap-1 text-xs text-surface-400 hover:text-claude transition-colors"
      >
        <Plus size={12} />
        Add Variable
      </button>
    </div>
  );
}

function TemplatePreview({ template, variables }) {
  let preview = template || '';
  for (const v of variables) {
    if (v.name) {
      const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
      const replacement = v.default || v.placeholder || `[${v.label || v.name}]`;
      preview = preview.replace(regex, replacement);
    }
  }

  return (
    <div>
      <label className="text-xs text-surface-400 mb-1.5 flex items-center gap-1 block">
        <Eye size={11} />
        Preview
      </label>
      <div className="bg-surface-800 rounded-lg p-3 border border-surface-700/50 text-xs text-surface-300 whitespace-pre-wrap min-h-[60px] max-h-[120px] overflow-y-auto">
        {preview || <span className="text-surface-600 italic">Enter a template to see preview...</span>}
      </div>
    </div>
  );
}

function HighlightedTextarea({ value, onChange, placeholder, rows }) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude resize-y font-mono"
      />
      <p className="text-[10px] text-surface-600 mt-1">Use {'{{variable_name}}'} syntax for placeholders</p>
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel }) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateText, setTemplateText] = useState(template?.template || '');
  const [variables, setVariables] = useState(() => {
    try {
      return template?.variables ? JSON.parse(template.variables) : [];
    } catch {
      return [];
    }
  });
  const [taskType, setTaskType] = useState(template?.task_type || 'feature');
  const [model, setModel] = useState(template?.model || 'sonnet');
  const [thinkingEffort, setThinkingEffort] = useState(template?.thinking_effort || 'medium');
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !templateText.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      template: templateText.trim(),
      variables: JSON.stringify(variables.filter((v) => v.name.trim())),
      task_type: taskType,
      model,
      thinking_effort: thinkingEffort,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-surface-400 mb-1 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. API Endpoint"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-surface-400 mb-1 block">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Create a new REST API endpoint"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude"
        />
      </div>

      <div>
        <label className="text-xs text-surface-400 mb-1 block">Template</label>
        <HighlightedTextarea
          value={templateText}
          onChange={(e) => setTemplateText(e.target.value)}
          placeholder={
            'Create a new {{method}} endpoint at {{path}} that:\n- {{description}}\n- Returns proper error responses\n- Includes input validation'
          }
          rows={5}
        />
      </div>

      <VariableEditor variables={variables} onChange={setVariables} />

      {/* Defaults row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Task Type</label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude"
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Thinking</label>
          <select
            value={thinkingEffort}
            onChange={(e) => setThinkingEffort(e.target.value)}
            className="w-full px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude"
          >
            {EFFORTS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-surface-400 hover:text-claude flex items-center gap-1 transition-colors"
        >
          <Eye size={12} />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
        {showPreview && (
          <div className="mt-2">
            <TemplatePreview template={templateText} variables={variables} />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !templateText.trim()}
          className="px-3 py-1.5 text-xs bg-claude hover:bg-claude-light text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {template?.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function TemplatesModal({ projectId, projectName, onClose }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | template object
  const [deleting, setDeleting] = useState(null);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api.getTemplates(projectId);
      setTemplates(data);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSave = async (data) => {
    if (editing === 'new') {
      await api.createTemplate(projectId, data);
    } else if (editing?.id) {
      await api.updateTemplate(editing.id, data);
    }
    setEditing(null);
    loadTemplates();
  };

  const handleDelete = async (id) => {
    await api.deleteTemplate(id);
    setDeleting(null);
    loadTemplates();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-2xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div>
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              <Layers size={16} className="text-claude" />
              Prompt Templates
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">{projectName} — reusable prompts with variables</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
            </div>
          ) : (
            <>
              {/* Template list */}
              {templates.length > 0 && !editing && (
                <div className="space-y-2 mb-4">
                  {templates.map((t) => {
                    let vars = [];
                    try {
                      vars = JSON.parse(t.variables || '[]');
                    } catch {}
                    return (
                      <div key={t.id} className="bg-surface-800/50 rounded-lg px-4 py-3 border border-surface-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-surface-200">{t.name}</h3>
                            {vars.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-surface-500 bg-surface-700/50 px-1.5 py-0.5 rounded">
                                <Variable size={10} />
                                {vars.length}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-surface-600 mr-1">
                              {t.task_type} / {t.model}
                            </span>
                            <button
                              onClick={() => setEditing(t)}
                              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleting(t.id)}
                              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {t.description && <p className="text-xs text-surface-500 mb-1">{t.description}</p>}
                        <p className="text-xs text-surface-400 whitespace-pre-wrap line-clamp-2 font-mono">
                          {t.template}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {templates.length === 0 && !editing && (
                <div className="text-center py-8 text-surface-500">
                  <Layers size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('templates.noTemplates')}</p>
                  <p className="text-xs mt-1">Create reusable prompts with {'{{variable}}'} placeholders</p>
                </div>
              )}

              {/* Edit/Create form */}
              {editing && (
                <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                  <h3 className="text-xs font-medium text-surface-400 mb-3 flex items-center gap-1.5">
                    {editing !== 'new' && (
                      <button onClick={() => setEditing(null)} className="hover:text-surface-200 transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    {editing === 'new' ? 'New Template' : `Edit: ${editing.name}`}
                  </h3>
                  <TemplateForm
                    template={editing === 'new' ? null : editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              )}

              {/* Add button */}
              {!editing && (
                <button
                  onClick={() => setEditing('new')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors"
                >
                  <Plus size={14} />
                  {t('templates.addTemplate')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation */}
        {deleting && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
            <div className="bg-surface-800 rounded-lg p-4 border border-surface-700 shadow-xl mx-4">
              <p className="text-sm text-surface-200 mb-3">Delete this template?</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleting(null)}
                  className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleting)}
                  className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
