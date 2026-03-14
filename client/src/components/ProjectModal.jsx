import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function ProjectModal({ project, onSubmit, onClose }) {
  const [name, setName] = useState(project?.name || '');
  const [slug, setSlug] = useState(project?.slug || '');
  const [workingDir, setWorkingDir] = useState(project?.working_dir || '');
  const [gitlabToken, setGitlabToken] = useState(project?.gitlab_token || '');
  const [gitlabUrl, setGitlabUrl] = useState(project?.gitlab_url || 'https://gitlab.com');
  const [gitlabProjectIds, setGitlabProjectIds] = useState(() => {
    try {
      const ids = project?.gitlab_project_ids ? JSON.parse(project.gitlab_project_ids) : [];
      return Array.isArray(ids) ? ids : [];
    } catch { return []; }
  });
  const [newGitlabId, setNewGitlabId] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!project);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const generateSlug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (val) => {
    setName(val);
    if (autoSlug) setSlug(generateSlug(val));
  };

  const addGitlabId = () => {
    if (newGitlabId.trim() && !gitlabProjectIds.includes(newGitlabId.trim())) {
      setGitlabProjectIds(prev => [...prev, newGitlabId.trim()]);
      setNewGitlabId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !workingDir.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        slug: slug.trim(),
        working_dir: workingDir.trim(),
        gitlab_token: gitlabToken.trim(),
        gitlab_url: gitlabUrl.trim(),
        gitlab_project_ids: gitlabProjectIds,
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
          <h2 className="text-base font-medium">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Project Name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="My Project"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Slug</label>
            <input
              value={slug}
              onChange={e => { setSlug(e.target.value); setAutoSlug(false); }}
              placeholder="my-project"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Working Directory</label>
            <input
              value={workingDir}
              onChange={e => setWorkingDir(e.target.value)}
              placeholder="C:/projects/my-project"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
              required
            />
          </div>

          <div className="border-t border-surface-800 pt-4">
            <h3 className="text-xs font-medium text-surface-400 mb-3">GitLab Integration (optional)</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Token</label>
                <input
                  value={gitlabToken}
                  onChange={e => setGitlabToken(e.target.value)}
                  type="password"
                  placeholder="glpat-xxxxx"
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-surface-500 mb-1">GitLab URL</label>
                <input
                  value={gitlabUrl}
                  onChange={e => setGitlabUrl(e.target.value)}
                  placeholder="https://gitlab.com"
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-surface-500 mb-1">Project IDs</label>
                <div className="space-y-1.5">
                  {gitlabProjectIds.map((id, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1 px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs font-mono text-surface-300">{id}</span>
                      <button
                        type="button"
                        onClick={() => setGitlabProjectIds(prev => prev.filter((_, idx) => idx !== i))}
                        className="p-1 rounded hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      value={newGitlabId}
                      onChange={e => setNewGitlabId(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGitlabId(); } }}
                      placeholder="group/project"
                      className="flex-1 px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={addGitlabId}
                      className="p-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-400 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
              disabled={loading || !name.trim() || !slug.trim() || !workingDir.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : project ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
