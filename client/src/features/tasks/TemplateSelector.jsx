import { useState, useEffect, useRef, useMemo } from 'react';
import { Layers, ChevronDown, X } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nProvider';

export default function TemplateSelector({ templates, selectedTemplate, onSelect, onClear, templateVars, onVarChange, generatedDescription }) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showMenu]);

  const parsedVars = useMemo(() => {
    if (!selectedTemplate?.variables) return [];
    try { return JSON.parse(selectedTemplate.variables); }
    catch { return []; }
  }, [selectedTemplate]);

  if (!templates.length) return null;

  return (
    <>
      <div>
        {!selectedTemplate ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors w-full justify-center"
            >
              <Layers size={12} />
              {t('taskModal.useTemplate')}
              <ChevronDown size={11} />
            </button>
            {showMenu && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => { onSelect(tpl); setShowMenu(false); }}
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
            <button type="button" onClick={onClear} className="text-xs text-surface-400 hover:text-surface-200 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {selectedTemplate && parsedVars.length > 0 && (
        <div className="bg-surface-800/30 rounded-lg p-3 border border-surface-700/50 space-y-2">
          <label className="text-xs font-medium text-surface-400 block">{t('taskModal.templateVars')}</label>
          {parsedVars.map((v) => (
            <div key={v.name}>
              <label className="text-[11px] text-surface-500 mb-0.5 block">{v.label || v.name}</label>
              <input
                value={templateVars[v.name] || ''}
                onChange={(e) => onVarChange(v.name, e.target.value)}
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
    </>
  );
}
