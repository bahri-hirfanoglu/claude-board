import { useState, useEffect, useRef } from 'react';
import {
  X,
  FolderOpen,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Info,
  Zap,
  GitBranch,
  Settings,
  Workflow,
  FlaskConical,
  Timer,
  RotateCcw,
  Github,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_VARIANTS, AVATAR_COLORS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import { api } from '../../lib/api';

const PERMISSION_MODES = [
  {
    value: 'auto-accept',
    label: 'Auto Accept',
    desc: 'Full autonomy — all tools allowed',
    icon: ShieldCheck,
    color: 'bg-emerald-500/20 text-emerald-300',
    warning: null,
  },
  {
    value: 'allow-tools',
    label: 'Allowed Tools',
    desc: 'Only specified tools allowed',
    icon: Shield,
    color: 'bg-amber-500/20 text-amber-300',
    warning: null,
  },
  {
    value: 'default',
    label: 'Default',
    desc: "Claude's built-in permissions",
    icon: ShieldAlert,
    color: 'bg-red-500/20 text-red-300',
    warning:
      'Claude runs with --no-input, so it cannot ask for permission interactively. Tasks will fail if they need unapproved tools.',
  },
];

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'automation', label: 'Automation', icon: Workflow },
  { id: 'github', label: 'GitHub', icon: Github },
];

export default function ProjectModal({ project, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('general');
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
  const [autoTest, setAutoTest] = useState(project?.auto_test ? true : false);
  const [testPrompt, setTestPrompt] = useState(project?.test_prompt || '');
  const [taskTimeoutMinutes, setTaskTimeoutMinutes] = useState(project?.task_timeout_minutes || 0);
  const [maxRetries, setMaxRetries] = useState(project?.max_retries || 0);
  const [githubRepo, setGithubRepo] = useState(project?.github_repo || '');
  const [githubSyncEnabled, setGithubSyncEnabled] = useState(!!project?.github_sync_enabled);
  const [githubValidating, setGithubValidating] = useState(false);
  const [githubValid, setGithubValid] = useState(null);
  const [githubDetecting, setGithubDetecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!project);
  const nameRef = useRef(null);

  useEffect(() => {
    if (tab === 'general') nameRef.current?.focus();
  }, [tab]);

  // Auto-detect GitHub repo when switching to GitHub tab with empty repo
  useEffect(() => {
    if (tab !== 'github' || githubRepo || !workingDir) return;
    setGithubDetecting(true);
    api
      .githubDetectRepo(workingDir)
      .then((repo) => {
        if (repo) setGithubRepo(typeof repo === 'string' ? repo : repo.toString());
      })
      .catch((e) => console.error('Failed to detect GitHub repo:', e))
      .finally(() => setGithubDetecting(false));
  }, [tab, workingDir, githubRepo]);

  const generateSlug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const handleNameChange = (val) => {
    setName(val);
    if (autoSlug) setSlug(generateSlug(val));
  };

  const randomizeSeed = () => {
    setIconSeed(Math.random().toString(36).substring(2, 10));
  };

  const avatarSeed = iconSeed || name || 'project';
  const selectedMode = PERMISSION_MODES.find((m) => m.value === permissionMode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !workingDir.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        slug: slug.trim(),
        workingDir: workingDir.trim(),
        icon,
        iconSeed: iconSeed,
        permissionMode: permissionMode,
        allowedTools: allowedTools.trim(),
        autoQueue: !!autoQueue,
        maxConcurrent: maxConcurrent,
        autoBranch: !!autoBranch,
        autoPr: !!autoPr,
        prBaseBranch: prBaseBranch.trim() || 'main',
        autoTest: !!autoTest,
        testPrompt: testPrompt.trim(),
        taskTimeoutMinutes: taskTimeoutMinutes || 0,
        maxRetries: maxRetries || 0,
        githubRepo: githubRepo,
        githubSyncEnabled: githubSyncEnabled ? 1 : 0,
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
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-claude" />
            <h2 className="text-sm sm:text-base font-medium">
              {project ? t('projectModal.editProject') : t('projectModal.newProject')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-800 px-4 sm:px-5 flex-shrink-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                  tab === t.id ? 'text-claude' : 'text-surface-500 hover:text-surface-300'
                }`}
              >
                <Icon size={12} />
                {t.label}
                {tab === t.id && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-claude rounded-full" />}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
            {/* General Tab */}
            {tab === 'general' && (
              <div className="space-y-4">
                {/* Avatar + Name row */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="rounded-xl overflow-hidden ring-2 ring-surface-700">
                      <Avatar size={48} name={avatarSeed} variant={icon} colors={AVATAR_COLORS} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-surface-400 mb-1">
                      {t('projectModal.projectName')}
                    </label>
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="My Project"
                      className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600"
                      required
                    />
                  </div>
                </div>

                {/* Icon variants */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex flex-wrap gap-1">
                      {AVATAR_VARIANTS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setIcon(v)}
                          className={`p-0.5 rounded-lg transition-all ${
                            icon === v ? 'ring-2 ring-claude bg-claude/10' : 'hover:bg-surface-800'
                          }`}
                          title={v}
                        >
                          <Avatar size={24} name={avatarSeed} variant={v} colors={AVATAR_COLORS} />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={randomizeSeed}
                      className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors"
                      title="Randomize"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>

                {/* Slug + Working Dir */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1">{t('projectModal.slug')}</label>
                    <input
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setAutoSlug(false);
                      }}
                      placeholder="my-project"
                      className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1">
                      {t('projectModal.baseBranch')}
                    </label>
                    <input
                      value={prBaseBranch}
                      onChange={(e) => setPrBaseBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">
                    {t('projectModal.workingDir')}
                  </label>
                  <input
                    value={workingDir}
                    onChange={(e) => setWorkingDir(e.target.value)}
                    placeholder="/home/user/projects/my-project"
                    className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 font-mono"
                    required
                  />
                  <p className="text-[10px] text-surface-600 mt-0.5">{t('projectModal.workingDirHint')}</p>
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {tab === 'permissions' && (
              <div className="space-y-2">
                {PERMISSION_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = permissionMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setPermissionMode(mode.value)}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-lg text-left transition-all ${
                        isActive
                          ? `${mode.color} ring-1 ring-current`
                          : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                      }`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{mode.label}</div>
                        <div className={`text-[10px] mt-0.5 ${isActive ? 'opacity-80' : 'text-surface-600'}`}>
                          {mode.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {selectedMode?.warning && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <Info size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-red-300">{selectedMode.warning}</p>
                  </div>
                )}

                {permissionMode === 'allow-tools' && (
                  <div className="pt-1">
                    <label className="block text-[10px] text-surface-500 mb-1">{t('projectModal.allowedTools')}</label>
                    <input
                      value={allowedTools}
                      onChange={(e) => setAllowedTools(e.target.value)}
                      placeholder="Bash, Read, Write, Edit, Glob, Grep"
                      className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 font-mono"
                    />
                    <p className="text-[9px] text-surface-600 mt-1">
                      Bash, Read, Write, Edit, Glob, Grep, Agent, WebSearch, WebFetch, NotebookEdit
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Automation Tab */}
            {tab === 'automation' && (
              <div className="space-y-3">
                {/* Auto Queue */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                    <Zap size={12} />
                    {t('projectModal.taskQueue')}
                  </label>
                  <ToggleRow
                    enabled={autoQueue}
                    onToggle={() => setAutoQueue(!autoQueue)}
                    label={autoQueue ? t('projectModal.autoQueueEnabled') : t('projectModal.autoQueueDisabled')}
                    desc={t('projectModal.autoQueueDesc')}
                    activeColor="emerald"
                  />
                  {autoQueue && (
                    <div className="mt-2 pl-1">
                      <label className="block text-[10px] text-surface-500 mb-1">
                        {t('projectModal.maxConcurrent')}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 5, 10].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setMaxConcurrent(n)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                              maxConcurrent === n
                                ? 'bg-claude text-white'
                                : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={maxConcurrent}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (v >= 1 && v <= 50) setMaxConcurrent(v);
                          }}
                          className="w-14 h-7 rounded-lg text-xs font-medium text-center bg-surface-800 border border-surface-700 text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Git Workflow */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                    <GitBranch size={12} />
                    {t('projectModal.gitWorkflow')}
                  </label>
                  <div className="space-y-1.5">
                    <ToggleRow
                      enabled={autoBranch}
                      onToggle={() => setAutoBranch(!autoBranch)}
                      label={t('projectModal.autoBranch')}
                      desc={t('projectModal.autoBranchDesc')}
                      activeColor="violet"
                    />
                    <ToggleRow
                      enabled={autoPr}
                      onToggle={() => setAutoPr(!autoPr)}
                      label={t('projectModal.autoPR')}
                      desc={t('projectModal.autoPRDesc')}
                      activeColor="violet"
                    />
                  </div>
                </div>

                {/* Auto Test */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                    <FlaskConical size={12} />
                    {t('projectModal.autoTest')}
                  </label>
                  <ToggleRow
                    enabled={autoTest}
                    onToggle={() => setAutoTest(!autoTest)}
                    label={autoTest ? t('projectModal.autoTestEnabled') : t('projectModal.autoTestDisabled')}
                    desc={t('projectModal.autoTestDescription')}
                    activeColor="emerald"
                  />
                  {autoTest && (
                    <div className="mt-2 pl-1">
                      <label className="block text-[10px] text-surface-500 mb-1">
                        {t('projectModal.customTestInstructions')}
                      </label>
                      <textarea
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        placeholder={
                          "e.g. Run 'npm test' and check all tests pass.\nVerify TypeScript compilation with 'npx tsc --noEmit'.\nCheck that no console.log statements remain."
                        }
                        rows={3}
                        className="w-full px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 resize-none font-mono"
                      />
                      <p className="text-[9px] text-surface-600 mt-1">{t('projectModal.customTestPlaceholder')}</p>
                    </div>
                  )}
                </div>

                {/* Task Timeout */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                    <Timer size={12} />
                    Task Timeout
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={taskTimeoutMinutes || ''}
                      onChange={(e) => setTaskTimeoutMinutes(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
                    />
                    <span className="text-[10px] text-surface-500">minutes (0 = no limit)</span>
                  </div>
                  <p className="text-[9px] text-surface-600 mt-1">
                    Auto-kill tasks that exceed this duration. Timed-out tasks follow the retry policy.
                  </p>
                </div>

                {/* Max Retries */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                    <RotateCcw size={12} />
                    Max Retries
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={maxRetries || ''}
                      onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
                    />
                    <span className="text-[10px] text-surface-500">times (0 = default 2)</span>
                  </div>
                  <p className="text-[9px] text-surface-600 mt-1">
                    How many times to auto-retry failed tasks before marking as permanently failed.
                  </p>
                </div>
              </div>
            )}

            {/* GitHub Tab */}
            {tab === 'github' && (
              <div className="space-y-3">
                {/* Enable GitHub Sync */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                    <Github size={12} />
                    GitHub Issues Sync
                  </label>
                  <ToggleRow
                    enabled={githubSyncEnabled}
                    onToggle={() => setGithubSyncEnabled(!githubSyncEnabled)}
                    label={githubSyncEnabled ? 'Sync enabled' : 'Sync disabled'}
                    desc="Automatically sync GitHub issues as tasks"
                    activeColor="violet"
                  />
                </div>

                {githubSyncEnabled && (
                  <>
                    {/* Repository */}
                    <div>
                      <label className="block text-[10px] text-surface-500 mb-1">{t('projectModal.repository')}</label>
                      <div className="flex gap-2">
                        <input
                          value={githubRepo}
                          onChange={(e) => {
                            setGithubRepo(e.target.value);
                            setGithubValid(null);
                          }}
                          placeholder="owner/repo"
                          className="flex-1 px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude placeholder-surface-600 font-mono"
                        />
                        <button
                          type="button"
                          disabled={githubDetecting || !workingDir.trim()}
                          onClick={async () => {
                            setGithubDetecting(true);
                            try {
                              const repo = await api.githubDetectRepo(workingDir);
                              if (repo) {
                                setGithubRepo(typeof repo === 'string' ? repo : repo.toString());
                                setGithubValid(null);
                              }
                            } catch (e) {
                              console.error('Failed to detect GitHub repo:', e);
                            }
                            setGithubDetecting(false);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          title="Detect from git remote"
                        >
                          {githubDetecting ? <Loader2 size={10} className="animate-spin" /> : <GitBranch size={10} />}
                          Detect
                        </button>
                      </div>
                      <p className="text-[9px] text-surface-600 mt-1">{t('projectModal.repoHelpText')}</p>
                    </div>

                    {/* gh CLI Status */}
                    {githubValid !== null && (
                      <div
                        className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                          githubValid === 'ready'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : githubValid === 'not_installed'
                              ? 'bg-red-500/10 border-red-500/20 text-red-300'
                              : githubValid === 'not_authenticated'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                : 'bg-red-500/10 border-red-500/20 text-red-300'
                        }`}
                      >
                        {githubValid === 'ready' ? (
                          <CheckCircle2 size={12} />
                        ) : githubValid === 'not_authenticated' ? (
                          <Info size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        <span className="text-[10px] font-medium">
                          {githubValid === 'ready' && 'Connected — using gh CLI authentication'}
                          {githubValid === 'not_installed' &&
                            'GitHub CLI (gh) not installed. Install from cli.github.com'}
                          {githubValid === 'not_authenticated' && 'Not logged in. Run: gh auth login'}
                          {githubValid === 'no_access' && 'Cannot access this repository'}
                          {githubValid === 'authenticated' && 'Authenticated — enter a repository'}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={githubValidating || !githubRepo.trim()}
                        onClick={async () => {
                          setGithubValidating(true);
                          setGithubValid(null);
                          try {
                            const result = await api.githubCheckStatus(githubRepo);
                            setGithubValid(result?.status || 'error');
                          } catch (e) {
                            console.error('Failed to check GitHub connection:', e);
                            setGithubValid('error');
                          } finally {
                            setGithubValidating(false);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {githubValidating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Check Connection
                      </button>
                    </div>

                    <p className="text-[9px] text-surface-600">{t('projectModal.ghCliHelpText')}</p>
                  </>
                )}
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
              disabled={loading || !name.trim() || !slug.trim() || !workingDir.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? t('common.saving') : project ? t('common.update') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToggleRow({ enabled, onToggle, label, desc, activeColor = 'emerald' }) {
  const colors = {
    emerald: {
      bg: enabled ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-surface-800',
      text: enabled ? 'text-emerald-300' : 'text-surface-400 hover:text-surface-300',
      toggle: enabled ? 'bg-emerald-500' : 'bg-surface-600',
      desc: enabled ? 'text-emerald-400/70' : 'text-surface-600',
    },
    violet: {
      bg: enabled ? 'bg-violet-500/10 ring-1 ring-violet-500/30' : 'bg-surface-800',
      text: enabled ? 'text-violet-300' : 'text-surface-400 hover:text-surface-300',
      toggle: enabled ? 'bg-violet-500' : 'bg-surface-600',
      desc: enabled ? 'text-violet-400/70' : 'text-surface-600',
    },
  };
  const c = colors[activeColor];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${c.bg} ${c.text}`}
    >
      <div className={`w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 ${c.toggle}`}>
        <div
          className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${enabled ? 'left-[15px]' : 'left-[3px]'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className={`text-[10px] ${c.desc}`}>{desc}</div>
      </div>
    </button>
  );
}
