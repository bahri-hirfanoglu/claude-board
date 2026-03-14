import { useState, useEffect, useRef } from 'react';
import { X, FolderOpen, RefreshCw } from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_VARIANTS, AVATAR_COLORS } from './Dashboard';

export default function ProjectModal({ project, onSubmit, onClose }) {
  const [name, setName] = useState(project?.name || '');
  const [slug, setSlug] = useState(project?.slug || '');
  const [workingDir, setWorkingDir] = useState(project?.working_dir || '');
  const [icon, setIcon] = useState(project?.icon || 'marble');
  const [iconSeed, setIconSeed] = useState(project?.icon_seed || '');
  const [loading, setLoading] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!project);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const generateSlug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (val) => {
    setName(val);
    if (autoSlug) setSlug(generateSlug(val));
  };

  const randomizeSeed = () => {
    setIconSeed(Math.random().toString(36).substring(2, 10));
  };

  const avatarSeed = iconSeed || name || 'project';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !workingDir.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        slug: slug.trim(),
        working_dir: workingDir.trim(),
        icon,
        icon_seed: iconSeed,
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
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-claude" />
            <h2 className="text-base font-medium">{project ? 'Edit Project' : 'New Project'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Avatar Picker */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-2">Project Icon</label>
            <div className="flex items-center gap-4">
              <div className="rounded-xl overflow-hidden ring-2 ring-surface-700 flex-shrink-0">
                <Avatar size={56} name={avatarSeed} variant={icon} colors={AVATAR_COLORS} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {AVATAR_VARIANTS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setIcon(v)}
                      className={`p-1 rounded-lg transition-all ${
                        icon === v
                          ? 'ring-2 ring-claude bg-claude/10'
                          : 'hover:bg-surface-800'
                      }`}
                      title={v}
                    >
                      <Avatar size={28} name={avatarSeed} variant={v} colors={AVATAR_COLORS} />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={randomizeSeed}
                  className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-surface-300 transition-colors"
                >
                  <RefreshCw size={10} />
                  Randomize
                </button>
              </div>
            </div>
          </div>

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
              placeholder="/home/user/projects/my-project"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
              required
            />
            <p className="text-[10px] text-surface-600 mt-1">
              Path to the project directory. Claude will run in this directory. Can contain multiple git repos.
            </p>
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
