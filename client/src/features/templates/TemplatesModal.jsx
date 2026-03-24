import { useState } from 'react';
import { Plus, Pencil, Trash2, Layers, Variable, Eye, ChevronLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';
import { TASK_TYPE_OPTIONS, MODEL_OPTIONS, EFFORT_OPTIONS } from '../../lib/constants';
import { useCrudResource } from '../../hooks/useCrudResource';
import ModalShell from '../../components/ModalShell';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import InlineDeleteConfirm from '../../components/InlineDeleteConfirm';

const TASK_TYPES = TASK_TYPE_OPTIONS;
const MODELS = MODEL_OPTIONS;
const EFFORTS = EFFORT_OPTIONS;

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
      taskType: taskType,
      model,
      thinkingEffort: thinkingEffort,
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
  const crud = useCrudResource({
    projectId,
    getAll: api.getTemplates,
    create: api.createTemplate,
    update: api.updateTemplate,
    remove: api.deleteTemplate,
  });

  return (
    <ModalShell title="Prompt Templates" subtitle={`${projectName} — reusable prompts with variables`} icon={Layers} onClose={onClose} maxWidth="max-w-2xl">
      <div className="px-5 py-4">
        {crud.loading ? <Spinner /> : (
            <>
              {/* Template list */}
              {crud.items.length > 0 && !crud.editing && (
                <div className="space-y-2 mb-4">
                  {crud.items.map((t) => {
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
                              onClick={() => crud.setEditing(t)}
                              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => crud.setDeleting(t.id)}
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

              {crud.items.length === 0 && !crud.editing && (
                <EmptyState icon={Layers} title={t('templates.noTemplates')} description={"Create reusable prompts with {{variable}} placeholders"} />
              )}

              {/* Edit/Create form */}
              {crud.editing && (
                <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                  <h3 className="text-xs font-medium text-surface-400 mb-3 flex items-center gap-1.5">
                    {crud.editing !== 'new' && (
                      <button onClick={() => crud.setEditing(null)} className="hover:text-surface-200 transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    {crud.editing === 'new' ? 'New Template' : `Edit: ${crud.editing.name}`}
                  </h3>
                  <TemplateForm
                    template={crud.editing === 'new' ? null : crud.editing}
                    onSave={crud.handleSave}
                    onCancel={() => crud.setEditing(null)}
                  />
                </div>
              )}

              {/* Add button */}
              {!crud.editing && (
                <button
                  onClick={() => crud.setEditing('new')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors"
                >
                  <Plus size={14} />
                  {t('templates.addTemplate')}
                </button>
              )}
            </>
          )}
        </div>

      {crud.deleting && (
        <InlineDeleteConfirm message="Delete this template?" onConfirm={() => crud.handleDelete(crud.deleting)} onCancel={() => crud.setDeleting(null)} />
      )}
    </ModalShell>
  );
}
