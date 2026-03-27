import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Sparkles, ChevronDown, ChevronRight, Settings2, Mic, MicOff } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useTranslation } from '../../i18n/I18nProvider';
import { TASK_TYPE_OPTIONS, PRIORITY_OPTIONS, MODEL_OPTIONS, EFFORT_OPTIONS } from '../../lib/constants';
import { api } from '../../lib/api';
import { IS_TAURI } from '../../lib/tauriEvents';
import TemplateSelector from './TemplateSelector';
import TaskOptionsPanel from './TaskOptionsPanel';
import TokenEstimate from './TokenEstimate';

const TASK_TYPES = TASK_TYPE_OPTIONS;
const PRIORITIES = PRIORITY_OPTIONS;
const MODELS = MODEL_OPTIONS;
const EFFORTS = EFFORT_OPTIONS;

export default function TaskModal({ task, onSubmit, onClose, templates = [], roles = [], allTasks = [] }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 0);
  const [taskType, setTaskType] = useState(task?.task_type || 'feature');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(task?.acceptance_criteria || '');
  const [model, setModel] = useState(task?.model || 'sonnet');
  const [thinkingEffort, setThinkingEffort] = useState(task?.thinking_effort || 'medium');
  const [loading, setLoading] = useState(false);
  const [roleId, setRoleId] = useState(task?.role_id || null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [showOptions, setShowOptions] = useState(
    !!(task && (task.acceptance_criteria || task.role_id || task.priority > 0)),
  );
  const [dependencies, setDependencies] = useState({ parents: [], children: [] });
  const [tags, setTags] = useState(() => {
    if (!task?.tags) return [];
    try {
      return typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags;
    } catch {
      return [];
    }
  });
  const titleRef = useRef(null);
  const typeMenuRef = useRef(null);

  const isCreating = !task;

  // Load dependencies when editing existing task
  useEffect(() => {
    if (!task?.id || !IS_TAURI) return;
    api
      .getTaskDependencies(task.id)
      .then((deps) => setDependencies(deps))
      .catch(() => setDependencies({ parents: [], children: [] }));
  }, [task?.id]);

  // Voice input
  const titleVoice = useVoiceInput({
    lang: 'en-US',
    onResult: useCallback((text) => setTitle((prev) => (prev ? prev + ' ' + text : text)), []),
  });
  const descVoice = useVoiceInput({
    lang: 'en-US',
    continuous: true,
    onResult: useCallback((text) => setDescription((prev) => (prev ? prev + ' ' + text : text)), []),
  });

  // Options summary for collapsed state
  const optionsSummary = useMemo(() => {
    const parts = [];
    const m = MODELS.find((x) => x.value === model);
    if (m) parts.push(m.label);
    const e = EFFORTS.find((x) => x.value === thinkingEffort);
    if (e) parts.push(e.label);
    const r = roles.find((x) => x.id === roleId);
    if (r) parts.push(r.name);
    if (attachedFiles.length > 0) parts.push(`${attachedFiles.length} file(s)`);
    if (acceptanceCriteria.trim()) parts.push('AC');
    return parts;
  }, [model, thinkingEffort, roleId, roles, attachedFiles, acceptanceCriteria]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Template-generated description
  const generatedDescription = useMemo(() => {
    if (!selectedTemplate?.template) return '';
    let text = selectedTemplate.template;
    let vars = [];
    try {
      vars = JSON.parse(selectedTemplate.variables || '[]');
    } catch {}
    for (const v of vars) {
      if (v.name) {
        const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
        text = text.replace(regex, templateVars[v.name] || v.default || '');
      }
    }
    return text;
  }, [selectedTemplate, templateVars]);

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setTaskType(tpl.task_type || 'feature');
    setModel(tpl.model || 'sonnet');
    setThinkingEffort(tpl.thinking_effort || 'medium');
    const vars = {};
    try {
      for (const v of JSON.parse(tpl.variables || '[]')) {
        if (v.name) vars[v.name] = v.default || '';
      }
    } catch {}
    setTemplateVars(vars);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const finalDescription = selectedTemplate
      ? description.trim()
        ? description.trim() + '\n\n' + generatedDescription
        : generatedDescription
      : description.trim();
    try {
      await onSubmit({
        title: title.trim(),
        description: finalDescription,
        priority,
        taskType,
        acceptanceCriteria: acceptanceCriteria.trim(),
        model,
        thinkingEffort,
        roleId: roleId || null,
        tags: tags.length > 0 ? JSON.stringify(tags) : '[]',
        _files: attachedFiles.length > 0 ? attachedFiles : undefined,
        _pendingDeps: isCreating ? dependencies.parents : undefined,
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
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-claude" />
            <h2 className="text-sm sm:text-base font-medium">
              {task ? t('taskModal.editTask') : t('taskModal.newTask')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
            {/* Template Selector */}
            {isCreating && (
              <TemplateSelector
                templates={templates}
                selectedTemplate={selectedTemplate}
                onSelect={handleSelectTemplate}
                onClear={() => {
                  setSelectedTemplate(null);
                  setTemplateVars({});
                }}
                templateVars={templateVars}
                onVarChange={(name, value) => setTemplateVars((prev) => ({ ...prev, [name]: value }))}
                generatedDescription={generatedDescription}
              />
            )}

            {/* Type + Title row */}
            <div className="flex gap-2">
              <div className="relative flex-shrink-0" ref={typeMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    const menu = e.currentTarget.nextElementSibling;
                    if (menu) menu.classList.toggle('hidden');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all border border-surface-700 ${
                    TASK_TYPES.find((t) => t.value === taskType)?.color || ''
                  }`}
                >
                  {TASK_TYPES.find((t) => t.value === taskType)?.label}
                  <ChevronDown size={11} />
                </button>
                <div className="hidden absolute left-0 top-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-10 overflow-hidden min-w-[120px]">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={(e) => {
                        setTaskType(t.value);
                        e.currentTarget.closest('.hidden, [class*="absolute"]')?.classList.add('hidden');
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        taskType === t.value ? t.color : 'text-surface-300 hover:bg-surface-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0 relative">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={titleVoice.isListening ? t('taskModal.listening') : t('taskModal.titlePlaceholder')}
                  className={`w-full px-3 py-2 pr-9 bg-surface-800 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 transition-colors ${
                    titleVoice.isListening ? 'border-red-500/50 bg-red-500/5' : 'border-surface-700'
                  }`}
                  required
                />
                {titleVoice.isSupported && (
                  <button
                    type="button"
                    onClick={titleVoice.toggle}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all ${
                      titleVoice.isListening
                        ? 'bg-red-500/20 text-red-400 animate-pulse'
                        : 'text-surface-500 hover:text-claude hover:bg-surface-700'
                    }`}
                    title={titleVoice.isListening ? t('taskModal.stopRecording') : t('taskModal.dictate')}
                  >
                    {titleVoice.isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                )}
                {titleVoice.interim && (
                  <div className="absolute left-0 right-0 top-full mt-1 px-2.5 py-1 bg-surface-800 border border-red-500/30 rounded-lg text-xs text-surface-400 italic z-10">
                    {titleVoice.interim}...
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-surface-400">
                  {t('taskModal.prompt')}
                  <span className="text-surface-600 font-normal ml-1">{t('taskModal.sentToClaude')}</span>
                </label>
                {descVoice.isSupported && (
                  <button
                    type="button"
                    onClick={descVoice.toggle}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                      descVoice.isListening
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-surface-500 hover:text-claude hover:bg-surface-800'
                    }`}
                    title={descVoice.isListening ? t('taskModal.stopRecording') : t('taskModal.dictate')}
                  >
                    {descVoice.isListening ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        {t('taskModal.listening')}
                        <MicOff size={11} />
                      </>
                    ) : (
                      <>
                        <Mic size={11} />
                        {t('taskModal.dictate')}
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    descVoice.isListening ? t('taskModal.startSpeaking') : t('taskModal.descriptionPlaceholder')
                  }
                  rows={4}
                  className={`w-full px-3 py-2 bg-surface-800 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none transition-colors ${
                    descVoice.isListening ? 'border-red-500/50 bg-red-500/5' : 'border-surface-700'
                  }`}
                />
                {descVoice.interim && (
                  <div className="absolute left-2 right-2 bottom-2 px-2 py-1 bg-surface-900/90 border border-red-500/30 rounded text-xs text-surface-400 italic">
                    {descVoice.interim}...
                  </div>
                )}
              </div>
            </div>

            {/* Token Estimate */}
            <TokenEstimate
              title={title}
              description={description}
              acceptanceCriteria={acceptanceCriteria}
              model={model}
            />

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">{t('taskModal.priority')}</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
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

            {/* Options toggle */}
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1.5 w-full text-left group"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-surface-400 group-hover:text-surface-200 transition-colors">
                <Settings2 size={12} />
                Options
                <ChevronRight size={12} className={`transition-transform ${showOptions ? 'rotate-90' : ''}`} />
              </div>
              {!showOptions && optionsSummary.length > 0 && (
                <div className="flex items-center gap-1 ml-1 flex-wrap">
                  {optionsSummary.map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </button>

            {/* Collapsible options */}
            {showOptions && (
              <TaskOptionsPanel
                model={model}
                onModelChange={setModel}
                thinkingEffort={thinkingEffort}
                onEffortChange={setThinkingEffort}
                roleId={roleId}
                onRoleChange={setRoleId}
                roles={roles}
                acceptanceCriteria={acceptanceCriteria}
                onAcceptanceChange={setAcceptanceCriteria}
                attachedFiles={attachedFiles}
                onFilesChange={setAttachedFiles}
                tags={tags}
                onTagsChange={setTags}
                tagSuggestions={[
                  ...new Set(
                    allTasks.flatMap((t) => {
                      try {
                        return typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags || [];
                      } catch {
                        return [];
                      }
                    }),
                  ),
                ]}
                taskId={task?.id || 'new'}
                allTasks={allTasks.filter((t) => t.id !== task?.id)}
                dependencies={dependencies}
                onAddDependency={(_, depId) => {
                  if (task?.id) {
                    api
                      .addDependency(task.id, depId)
                      .then(() => api.getTaskDependencies(task.id).then(setDependencies));
                  } else {
                    setDependencies((prev) => ({
                      ...prev,
                      parents: [...prev.parents, depId],
                    }));
                  }
                }}
                onRemoveDependency={(_, depId) => {
                  if (task?.id) {
                    api
                      .removeDependency(task.id, depId)
                      .then(() => api.getTaskDependencies(task.id).then(setDependencies));
                  } else {
                    setDependencies((prev) => ({
                      ...prev,
                      parents: prev.parents.filter((id) => id !== depId),
                    }));
                  }
                }}
              />
            )}
          </div>

          {/* Sticky footer */}
          <div className="flex gap-2 px-4 sm:px-5 py-3 border-t border-surface-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? t('common.saving') : task ? t('common.update') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
