import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';

function SnippetForm({ snippet, onSave, onCancel }) {
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
        <label className="text-xs text-surface-400 mb-1 block">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Tech Stack Rules"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">Content</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="e.g. Always use Tailwind for styling. Use Vitest for tests."
          rows={4}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude resize-y"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || !content.trim()}
          className="px-3 py-1.5 text-xs bg-claude hover:bg-claude-light text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {snippet?.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function SnippetsModal({ projectId, projectName, onClose }) {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | snippet object
  const [deleting, setDeleting] = useState(null);

  const loadSnippets = useCallback(async () => {
    try {
      const data = await api.getSnippets(projectId);
      setSnippets(data);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadSnippets(); }, [loadSnippets]);

  const handleSave = async (data) => {
    if (editing === 'new') {
      await api.createSnippet(projectId, data);
    } else if (editing?.id) {
      await api.updateSnippet(editing.id, data);
    }
    setEditing(null);
    loadSnippets();
  };

  const handleToggle = async (snippet) => {
    await api.updateSnippet(snippet.id, { enabled: !snippet.enabled });
    loadSnippets();
  };

  const handleDelete = async (id) => {
    await api.deleteSnippet(id);
    setDeleting(null);
    loadSnippets();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-[5vh] overflow-y-auto" onClick={onClose}>
      <div className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-lg shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div>
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              <BookOpen size={16} className="text-claude" />
              Context Snippets
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">{projectName} — auto-injected into Claude prompts</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400"><X size={16} /></button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
            </div>
          ) : (
            <>
              {/* Snippet list */}
              {snippets.length > 0 && !editing && (
                <div className="space-y-2 mb-4">
                  {snippets.map(s => (
                    <div key={s.id} className={`bg-surface-800/50 rounded-lg px-4 py-3 border ${s.enabled ? 'border-surface-700/50' : 'border-surface-800 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-medium text-surface-200">{s.title}</h3>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggle(s)}
                            className={`p-1 rounded transition-colors ${s.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-surface-600 hover:text-surface-400'}`}
                            title={s.enabled ? 'Disable' : 'Enable'}
                          >
                            {s.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            onClick={() => setEditing(s)}
                            className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleting(s.id)}
                            className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-surface-400 whitespace-pre-wrap line-clamp-3">{s.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {snippets.length === 0 && !editing && (
                <div className="text-center py-8 text-surface-500">
                  <BookOpen size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No snippets yet</p>
                  <p className="text-xs mt-1">Add project rules and context that Claude will follow</p>
                </div>
              )}

              {/* Edit/Create form */}
              {editing && (
                <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                  <h3 className="text-xs font-medium text-surface-400 mb-3">
                    {editing === 'new' ? 'New Snippet' : `Edit: ${editing.title}`}
                  </h3>
                  <SnippetForm
                    snippet={editing === 'new' ? null : editing}
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
                  Add Snippet
                </button>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation */}
        {deleting && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
            <div className="bg-surface-800 rounded-lg p-4 border border-surface-700 shadow-xl mx-4">
              <p className="text-sm text-surface-200 mb-3">Delete this snippet?</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleting(null)} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200">Cancel</button>
                <button onClick={() => handleDelete(deleting)} className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
