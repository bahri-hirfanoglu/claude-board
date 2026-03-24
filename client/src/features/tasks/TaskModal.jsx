import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Cpu,
  Zap,
  Layers,
  ChevronDown,
  Paperclip,
  Image,
  FileText,
  Trash2,
  Shield,
  Settings2,
  ChevronRight,
  Mic,
  MicOff,
  Coins,
} from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useTranslation } from '../../i18n/I18nProvider';

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
  { value: 'haiku', label: 'Haiku', color: 'bg-green-500/20 text-green-300' },
  { value: 'sonnet', label: 'Sonnet', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'opus', label: 'Opus', color: 'bg-purple-500/20 text-purple-300' },
];

const EFFORTS = [
  { value: 'low', label: 'Low', color: 'bg-green-500/20 text-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'high', label: 'High', color: 'bg-red-500/20 text-red-300' },
];

// Token cost per million tokens (USD)
const MODEL_COSTS = {
  haiku:  { input: 0.25,  output: 1.25 },
  sonnet: { input: 3.0,   output: 15.0 },
  opus:   { input: 15.0,  output: 75.0 },
};

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export default function TaskModal({ task, onSubmit, onClose, templates = [], roles = [] }) {
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
  const fileInputRef = useRef(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(
    // Auto-expand if editing task with non-default options
    !!(task && (task.acceptance_criteria || task.role_id || task.priority > 0)),
  );
  const titleRef = useRef(null);
  const templateMenuRef = useRef(null);

  const isCreating = !task;

  // ─── Voice input ───
  const titleVoice = useVoiceInput({
    lang: 'en-US',
    onResult: useCallback((text) => setTitle(prev => prev ? prev + ' ' + text : text), []),
  });

  const descVoice = useVoiceInput({
    lang: 'en-US',
    continuous: true,
    onResult: useCallback((text) => setDescription(prev => prev ? prev + ' ' + text : text), []),
  });

  // Summary of current options for the collapsed state
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

  useEffect(() => {
    if (!showTemplateMenu) return;
    const close = (e) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target)) setShowTemplateMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showTemplateMenu]);

  const parsedVars = useMemo(() => {
    if (!selectedTemplate?.variables) return [];
    try {
      return JSON.parse(selectedTemplate.variables);
    } catch {
      return [];
    }
  }, [selectedTemplate]);

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
    setTaskType(tpl.task_type || 'feature');
    setModel(tpl.model || 'sonnet');
    setThinkingEffort(tpl.thinking_effort || 'medium');
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
        taskType: taskType,
        acceptanceCriteria: acceptanceCriteria.trim(),
        model,
        thinkingEffort: thinkingEffort,
        roleId: roleId || null,
        _files: attachedFiles.length > 0 ? attachedFiles : undefined,
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
            <h2 className="text-sm sm:text-base font-medium">{task ? t('taskModal.editTask') : t('taskModal.newTask')}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
            {/* Template Selector */}
            {isCreating && templates.length > 0 && (
              <div>
                {!selectedTemplate ? (
                  <div className="relative" ref={templateMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors w-full justify-center"
                    >
                      <Layers size={12} />
                      {t('taskModal.useTemplate')}
                      <ChevronDown size={11} />
                    </button>
                    {showTemplateMenu && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                        {templates.map((tpl) => (
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
                  <div className="bg-claude/5 border border-claude/20 rounded-lg px-3 py-1.5 flex items-center justify-between">
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
              <div className="bg-surface-800/30 rounded-lg p-3 border border-surface-700/50 space-y-2">
                <label className="text-xs font-medium text-surface-400 block">{t('taskModal.templateVars')}</label>
                {parsedVars.map((v) => (
                  <div key={v.name}>
                    <label className="text-[11px] text-surface-500 mb-0.5 block">{v.label || v.name}</label>
                    <input
                      value={templateVars[v.name] || ''}
                      onChange={(e) => setTemplateVars((prev) => ({ ...prev, [v.name]: e.target.value }))}
                      placeholder={v.placeholder || ''}
                      className="w-full px-2.5 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600"
                    />
                  </div>
                ))}
                {generatedDescription && (
                  <div>
                    <label className="text-[11px] text-surface-500 mb-0.5 block">Preview</label>
                    <div className="bg-surface-900 rounded-lg px-2.5 py-2 text-xs text-surface-400 whitespace-pre-wrap max-h-20 overflow-y-auto border border-surface-700/50">
                      {generatedDescription}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Type + Title row */}
            <div className="flex gap-2">
              <div className="relative flex-shrink-0" ref={templateMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    const btn = e.currentTarget;
                    const menu = btn.nextElementSibling;
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
                  placeholder={titleVoice.isListening ? 'Listening...' : 'Task title...'}
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
                    title={titleVoice.isListening ? 'Stop recording' : 'Dictate'}
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
                  Prompt
                  <span className="text-surface-600 font-normal ml-1">- sent to Claude</span>
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
                    title={descVoice.isListening ? 'Stop recording' : 'Dictate'}
                  >
                    {descVoice.isListening ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        Listening...
                        <MicOff size={11} />
                      </>
                    ) : (
                      <>
                        <Mic size={11} />
                        Dictate
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={descVoice.isListening ? 'Start speaking...' : 'Describe what Claude should implement...'}
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
            {(() => {
              const fullText = (title + ' ' + description + ' ' + acceptanceCriteria).trim();
              const tokens = estimateTokens(fullText);
              if (tokens < 10) return null;
              const cost = MODEL_COSTS[model];
              const inputCost = (tokens / 1e6) * cost.input;
              return (
                <div className="flex items-center gap-3 text-[11px] text-surface-500">
                  <span className="flex items-center gap-1">
                    <Cpu size={10} />
                    ~{tokens.toLocaleString()} tokens
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins size={10} />
                    ~${inputCost < 0.001 ? '<0.001' : inputCost.toFixed(4)} input
                  </span>
                  <span className="text-surface-600">{description.length} chars</span>
                </div>
              );
            })()}

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
              <div className="space-y-3 bg-surface-800/20 rounded-lg p-3 border border-surface-700/30">
                {/* Acceptance Criteria */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">
                    {t('taskModal.acceptance')}
                    <span className="text-surface-600 font-normal ml-1">- {t('common.optional')}</span>
                  </label>
                  <textarea
                    value={acceptanceCriteria}
                    onChange={(e) => setAcceptanceCriteria(e.target.value)}
                    placeholder={t('taskModal.acceptancePlaceholder')}
                    rows={2}
                    className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none"
                  />
                </div>

                {/* Model + Effort — compact row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-surface-500 mb-1">
                      <Cpu size={10} />
                      Model
                    </label>
                    <div className="flex flex-col gap-0.5">
                      {MODELS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setModel(m.value)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-all text-center ${
                            model === m.value
                              ? `${m.color} ring-1 ring-current`
                              : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-surface-500 mb-1">
                      <Zap size={10} />
                      Effort
                    </label>
                    <div className="flex flex-col gap-0.5">
                      {EFFORTS.map((e) => (
                        <button
                          key={e.value}
                          type="button"
                          onClick={() => setThinkingEffort(e.value)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-all text-center ${
                            thinkingEffort === e.value
                              ? `${e.color} ring-1 ring-current`
                              : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role */}
                {roles.length > 0 && (
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-surface-500 mb-1">
                      <Shield size={10} />
                      Role
                    </label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setRoleId(null)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                          !roleId
                            ? 'bg-surface-700 text-surface-200 ring-1 ring-surface-500'
                            : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                        }`}
                      >
                        None
                      </button>
                      {roles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRoleId(r.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                            roleId === r.id
                              ? 'ring-1 ring-current'
                              : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                          }`}
                          style={roleId === r.id ? { backgroundColor: r.color + '20', color: r.color } : {}}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.md,.csv,.json,.xml"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAttachedFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                  {attachedFiles.length > 0 && (
                    <div className="space-y-0.5 mb-1.5">
                      {attachedFiles.map((file, i) => {
                        const isImage = file.type?.startsWith('image/');
                        return (
                          <div key={i} className="flex items-center gap-2 bg-surface-800/60 rounded px-2 py-1 group">
                            {isImage ? (
                              <Image size={11} className="text-blue-400 flex-shrink-0" />
                            ) : (
                              <FileText size={11} className="text-surface-400 flex-shrink-0" />
                            )}
                            <span className="text-[11px] text-surface-300 truncate flex-1">{file.name}</span>
                            <span className="text-[10px] text-surface-600">{(file.size / 1024).toFixed(0)}KB</span>
                            <button
                              type="button"
                              onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                              className="p-0.5 rounded hover:bg-surface-700 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-dashed border-surface-700 text-[11px] text-surface-400 hover:text-claude hover:border-claude/50 transition-colors w-full justify-center"
                  >
                    <Paperclip size={11} />
                    {attachedFiles.length > 0 ? 'Add More Files' : 'Attach Files'}
                  </button>
                </div>
              </div>
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
