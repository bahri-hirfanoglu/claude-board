import { useState, useEffect } from 'react';
import { X, Terminal, ChevronRight, FileText, FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

export default function CommandsModal({ onClose }) {
  const { t } = useTranslation();
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.listCustomCommands()
      .then(setCommands)
      .catch(() => setCommands([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-cyan-400" />
            <h2 className="text-sm font-medium">{t('commands.title')}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500">~/.claude/commands/</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-surface-500 text-sm">
              {t('common.loading')}
            </div>
          ) : commands.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
              <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center">
                <Terminal size={24} className="text-surface-600" />
              </div>
              <div>
                <p className="text-sm text-surface-300 font-medium">{t('commands.empty')}</p>
                <p className="text-xs text-surface-500 mt-1 max-w-sm">{t('commands.emptyDesc')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Command list */}
              <div className="w-48 border-r border-surface-800 overflow-y-auto flex-shrink-0">
                {commands.map((cmd) => (
                  <button
                    key={cmd.name}
                    onClick={() => setSelected(cmd)}
                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-2 ${
                      selected?.name === cmd.name
                        ? 'bg-cyan-500/10 text-cyan-300 border-r-2 border-cyan-400'
                        : 'text-surface-300 hover:bg-surface-800'
                    }`}
                  >
                    <Terminal size={12} className="flex-shrink-0" />
                    <span className="truncate font-medium">/{cmd.name}</span>
                  </button>
                ))}
              </div>

              {/* Command content */}
              <div className="flex-1 overflow-y-auto p-4 min-w-0">
                {selected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-surface-200">/{selected.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500">{selected.scope}</span>
                      <span className="text-[10px] text-surface-600">{(selected.size / 1024).toFixed(1)}KB</span>
                    </div>
                    <pre className="text-xs text-surface-400 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-3 border border-surface-700/50 leading-relaxed">
                      {selected.content}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-surface-600 text-xs">
                    {t('commands.selectOne')}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-surface-800 flex-shrink-0">
          <span className="text-[10px] text-surface-600">
            {commands.length} {t('commands.commandCount')}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
