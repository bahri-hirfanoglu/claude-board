import { useState, useEffect, useRef } from 'react';
import { X, FolderOpen, RefreshCw, Shield, ShieldAlert, ShieldCheck, Info, Zap, GitBranch } from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_VARIANTS, AVATAR_COLORS } from '../../lib/constants';

const PERMISSION_MODES = [
  {
    value: 'auto-accept',
    label: 'Auto Accept',
    desc: 'Full autonomy - Claude can use all tools without asking. Best for trusted projects.',
    icon: ShieldCheck,
    color: 'bg-emerald-500/20 text-emerald-300',
    warning: null,
  },
  {
    value: 'allow-tools',
    label: 'Allowed Tools',
    desc: 'Only specified tool categories are allowed. Configure the list below.',
    icon: Shield,
    color: 'bg-amber-500/20 text-amber-300',
    warning: null,
  },
  {
    value: 'default',
    label: 'Default',
    desc: 'Uses Claude\'s built-in permission settings. Tasks may fail if permissions are not pre-configured.',
    icon: ShieldAlert,
    color: 'bg-red-500/20 text-red-300',
    warning: 'Claude runs with --no-input, so it cannot ask for permission interactively. Tasks will fail if they need unapproved tools.',
  },
];

export default function ProjectModal({ project, onSubmit, onClose }) {
  const [name, setName] = useState(project?.name || '');
  const [slug, setSlug] = useState(project?.slug || '');
  const [workingDir, setWorkingDir] = useState(project?.working_dir || '');
  const [icon, setIcon] = useState(project?.icon || 'marble');
  const [iconSeed, setIconSeed] = useState(project?.icon_seed || '');
  const [permissionMode, setPermissionMode] = useState(project?.permission_mode || 'auto-accept');
  const [allowedTools, setAllowedTools] = useState(project?.allowed_tools || '');
  const [autoQueue, setAutoQueue] = useState(project?.auto_queue ? true : false);
  const [maxConcurrent, setMaxConcurrent] = useState(project?.max_concurrent || 1);
  const [autoBranch, setAutoBranch] = useState(project?.auto_branch !== undefined ? !!project.auto_branch : true);
  const [autoPr, setAutoPr] = useState(project?.auto_pr ? true : false);
  const [prBaseBranch, setPrBaseBranch] = useState(project?.pr_base_branch || 'main');
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
        permission_mode: permissionMode,
        allowed_tools: allowedTools.trim(),
        auto_queue: autoQueue ? 1 : 0,
        max_concurrent: maxConcurrent,
        auto_branch: autoBranch ? 1 : 0,
        auto_pr: autoPr ? 1 : 0,
        pr_base_branch: prBaseBranch.trim() || 'main',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedMode = PERMISSION_MODES.find(m => m.value === permissionMode);

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
              Path to the project directory. Claude will run in this directory.
            </p>
          </div>

          {/* Permission Mode */}
          <div className="border-t border-surface-800 pt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-2">
              <Shield size={12} />
              Permission Mode
            </label>
            <div className="space-y-1.5">
              {PERMISSION_MODES.map(mode => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setPermissionMode(mode.value)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                      permissionMode === mode.value
                        ? `${mode.color} ring-1 ring-current`
                        : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    <Icon size={14} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{mode.label}</div>
                      <div className={`text-[10px] mt-0.5 ${permissionMode === mode.value ? 'opacity-80' : 'text-surface-600'}`}>
                        {mode.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Warning for selected mode */}
            {selectedMode?.warning && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <Info size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-red-300">{selectedMode.warning}</p>
              </div>
            )}

            {/* Allowed tools input */}
            {permissionMode === 'allow-tools' && (
              <div className="mt-2">
                <label className="block text-[10px] text-surface-500 mb-1">Allowed Tools (comma-separated)</label>
                <input
                  value={allowedTools}
                  onChange={e => setAllowedTools(e.target.value)}
                  placeholder="Bash, Read, Write, Edit, Glob, Grep"
                  className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
                />
                <p className="text-[9px] text-surface-600 mt-1">
                  Tool names: Bash, Read, Write, Edit, Glob, Grep, Agent, WebSearch, WebFetch, NotebookEdit
                </p>
              </div>
            )}
          </div>

          {/* Auto Queue */}
          <div className="border-t border-surface-800 pt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-2">
              <Zap size={12} />
              Task Queue
            </label>
            <button
              type="button"
              onClick={() => setAutoQueue(!autoQueue)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                autoQueue
                  ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-300'
              }`}
            >
              <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${autoQueue ? 'bg-emerald-500' : 'bg-surface-600'}`}>
                <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${autoQueue ? 'left-[18px]' : 'left-[3px]'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{autoQueue ? 'Auto Queue Enabled' : 'Auto Queue Disabled'}</div>
                <div className={`text-[10px] mt-0.5 ${autoQueue ? 'text-emerald-400/70' : 'text-surface-600'}`}>
                  Automatically start backlog tasks when a running task finishes
                </div>
              </div>
            </button>

            {autoQueue && (
              <div className="mt-2">
                <label className="block text-[10px] text-surface-500 mb-1">Max Concurrent Tasks</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxConcurrent(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        maxConcurrent === n
                          ? 'bg-claude text-white'
                          : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-surface-600 mt-1">
                  Number of tasks that can run simultaneously
                </p>
              </div>
            )}
          </div>

          {/* Git Workflow */}
          <div className="border-t border-surface-800 pt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-2">
              <GitBranch size={12} />
              Git Workflow
            </label>

            {/* Auto Branch */}
            <button
              type="button"
              onClick={() => setAutoBranch(!autoBranch)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                autoBranch
                  ? 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-300'
              }`}
            >
              <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${autoBranch ? 'bg-violet-500' : 'bg-surface-600'}`}>
                <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${autoBranch ? 'left-[18px]' : 'left-[3px]'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{autoBranch ? 'Auto Branch Enabled' : 'Auto Branch Disabled'}</div>
                <div className={`text-[10px] mt-0.5 ${autoBranch ? 'text-violet-400/70' : 'text-surface-600'}`}>
                  Create a feature branch for each task before Claude starts
                </div>
              </div>
            </button>

            {/* Auto PR */}
            <button
              type="button"
              onClick={() => setAutoPr(!autoPr)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all mt-1.5 ${
                autoPr
                  ? 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-300'
              }`}
            >
              <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${autoPr ? 'bg-violet-500' : 'bg-surface-600'}`}>
                <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${autoPr ? 'left-[18px]' : 'left-[3px]'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{autoPr ? 'Auto PR Enabled' : 'Auto PR Disabled'}</div>
                <div className={`text-[10px] mt-0.5 ${autoPr ? 'text-violet-400/70' : 'text-surface-600'}`}>
                  Automatically create a pull request when task completes (requires gh CLI)
                </div>
              </div>
            </button>

            {/* Base Branch */}
            {(autoBranch || autoPr) && (
              <div className="mt-2">
                <label className="block text-[10px] text-surface-500 mb-1">Base Branch</label>
                <input
                  value={prBaseBranch}
                  onChange={e => setPrBaseBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600 font-mono"
                />
                <p className="text-[9px] text-surface-600 mt-1">
                  Branch to create feature branches from and merge PRs into
                </p>
              </div>
            )}
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
