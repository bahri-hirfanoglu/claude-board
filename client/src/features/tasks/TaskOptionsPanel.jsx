import { useRef } from 'react';
import {
  Cpu, Zap, Shield, Paperclip, Image, FileText, Trash2,
} from 'lucide-react';
import { useTranslation } from '../../i18n/I18nProvider';
import { MODEL_OPTIONS, EFFORT_OPTIONS } from '../../lib/constants';

const MODELS = MODEL_OPTIONS;
const EFFORTS = EFFORT_OPTIONS;

export default function TaskOptionsPanel({ model, onModelChange, thinkingEffort, onEffortChange, roleId, onRoleChange, roles, acceptanceCriteria, onAcceptanceChange, attachedFiles, onFilesChange }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-3 bg-surface-800/20 rounded-lg p-3 border border-surface-700/30">
      {/* Acceptance Criteria */}
      <div>
        <label className="block text-xs font-medium text-surface-400 mb-1">
          {t('taskModal.acceptance')}
          <span className="text-surface-600 font-normal ml-1">- {t('common.optional')}</span>
        </label>
        <textarea
          value={acceptanceCriteria}
          onChange={(e) => onAcceptanceChange(e.target.value)}
          placeholder={t('taskModal.acceptancePlaceholder')}
          rows={2}
          className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 resize-none"
        />
      </div>

      {/* Model + Effort */}
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
                onClick={() => onModelChange(m.value)}
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
                onClick={() => onEffortChange(e.value)}
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
              onClick={() => onRoleChange(null)}
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
                onClick={() => onRoleChange(r.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                  roleId === r.id
                    ? 'ring-1 ring-current'
                    : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                }`}
                style={roleId === r.id ? { backgroundColor: r.color + '20', color: r.color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
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
            onFilesChange(prev => [...prev, ...files]);
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
                    onClick={() => onFilesChange(prev => prev.filter((_, j) => j !== i))}
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
  );
}
