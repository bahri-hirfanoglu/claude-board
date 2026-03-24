import { useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';
import { useCrudResource } from '../../hooks/useCrudResource';
import ModalShell from '../../components/ModalShell';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import InlineDeleteConfirm from '../../components/InlineDeleteConfirm';

function SnippetForm({ snippet, onSave, onCancel, t }) {
  const [title, setTitle] = useState(snippet?.title || '');
  const [content, setContent] = useState(snippet?.content || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({ title: title.trim(), content: content.trim(), enabled: snippet?.enabled !== undefined ? snippet.enabled : 1 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-surface-400 mb-1 block">{t('snippets.formTitle')}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('snippets.titlePlaceholder')}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude" autoFocus />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">{t('snippets.content')}</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('snippets.contentPlaceholder')} rows={4}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude resize-y" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors">Cancel</button>
        <button type="submit" disabled={!title.trim() || !content.trim()}
          className="px-3 py-1.5 text-xs bg-claude hover:bg-claude-light text-white rounded-lg disabled:opacity-50 transition-colors">
          {snippet?.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function SnippetsModal({ projectId, projectName, onClose }) {
  const { t } = useTranslation();
  const crud = useCrudResource({
    projectId,
    getAll: api.getSnippets,
    create: api.createSnippet,
    update: api.updateSnippet,
    remove: api.deleteSnippet,
  });

  const handleToggle = async (snippet) => {
    await api.updateSnippet(snippet.id, { enabled: !snippet.enabled });
    crud.reload();
  };

  return (
    <ModalShell title={t('snippets.title')} subtitle={`${projectName} — auto-injected into Claude prompts`} icon={BookOpen} onClose={onClose}>
      <div className="px-5 py-4">
        {crud.loading ? <Spinner /> : (
          <>
            {crud.items.length > 0 && !crud.editing && (
              <div className="space-y-2 mb-4">
                {crud.items.map((s) => (
                  <div key={s.id} className={`bg-surface-800/50 rounded-lg px-4 py-3 border ${s.enabled ? 'border-surface-700/50' : 'border-surface-800 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-surface-200">{s.title}</h3>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleToggle(s)} className={`p-1 rounded transition-colors ${s.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-surface-600 hover:text-surface-400'}`}>
                          {s.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => crud.setEditing(s)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => crud.setDeleting(s.id)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-surface-400 whitespace-pre-wrap line-clamp-3">{s.content}</p>
                  </div>
                ))}
              </div>
            )}

            {crud.items.length === 0 && !crud.editing && (
              <EmptyState icon={BookOpen} title={t('snippets.noSnippets')} description={t('snippets.noSnippetsDesc')} />
            )}

            {crud.editing && (
              <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                <h3 className="text-xs font-medium text-surface-400 mb-3">{crud.editing === 'new' ? 'New Snippet' : `Edit: ${crud.editing.title}`}</h3>
                <SnippetForm snippet={crud.editing === 'new' ? null : crud.editing} onSave={crud.handleSave} onCancel={() => crud.setEditing(null)} t={t} />
              </div>
            )}

            {!crud.editing && (
              <button onClick={() => crud.setEditing('new')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors">
                <Plus size={14} /> {t('snippets.addSnippet')}
              </button>
            )}
          </>
        )}
      </div>

      {crud.deleting && (
        <InlineDeleteConfirm message="Delete this snippet?" onConfirm={() => crud.handleDelete(crud.deleting)} onCancel={() => crud.setDeleting(null)} />
      )}
    </ModalShell>
  );
}
