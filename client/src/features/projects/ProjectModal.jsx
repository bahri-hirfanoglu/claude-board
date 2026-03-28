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
  Cog,
  Brain,
  ChevronRight,
  ShieldBan,
  BadgeCheck,
} from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_VARIANTS, AVATAR_COLORS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import { api } from '../../lib/api';
import { IS_TAURI } from '../../lib/tauriEvents';

const PERMISSION_MODES = [
  {
    value: 'auto-accept',
    label: 'Auto Accept',
    desc: 'Full autonomy — all tools allowed',
    icon: ShieldCheck,
    color: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  },
  {
    value: 'allow-tools',
    label: 'Allowed Tools',
    desc: 'Only specified tools allowed',
    icon: Shield,
    color: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  },
  {
    value: 'default',
    label: 'Default',
    desc: "Claude's built-in permissions",
    icon: ShieldAlert,
    color: 'bg-red-500/20 text-red-300 ring-red-500/30',
    warning:
      'Claude runs with --no-input, so it cannot ask for permission interactively. Tasks will fail if they need unapproved tools.',
  },
];

const NAV_ITEMS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'automation', label: 'Automation', icon: Workflow },
  { id: 'engine', label: 'Engine', icon: Cog },
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
  const [maxAutoRevisions, setMaxAutoRevisions] = useState(project?.max_auto_revisions || 0);
  const [retryBaseDelay, setRetryBaseDelay] = useState(project?.retry_base_delay_secs || 0);
  const [retryMaxDelay, setRetryMaxDelay] = useState(project?.retry_max_delay_secs || 0);
  const [autoTestModel, setAutoTestModel] = useState(project?.auto_test_model || '');
  const [circuitBreakerThreshold, setCircuitBreakerThreshold] = useState(project?.circuit_breaker_threshold || 0);
  const [requireApproval, setRequireApproval] = useState(!!project?.require_approval);
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

  const randomizeSeed = () => setIconSeed(Math.random().toString(36).substring(2, 10));
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
        iconSeed,
        permissionMode,
        allowedTools: allowedTools.trim(),
        autoQueue: !!autoQueue,
        maxConcurrent,
        autoBranch: !!autoBranch,
        autoPr: !!autoPr,
        prBaseBranch: prBaseBranch.trim() || 'main',
        autoTest: !!autoTest,
        testPrompt: testPrompt.trim(),
        taskTimeoutMinutes: taskTimeoutMinutes || 0,
        maxRetries: maxRetries || 0,
        maxAutoRevisions: maxAutoRevisions || 0,
        retryBaseDelaySecs: retryBaseDelay || 0,
        retryMaxDelaySecs: retryMaxDelay || 0,
        autoTestModel: autoTestModel || '',
        circuitBreakerThreshold: circuitBreakerThreshold || 0,
        requireApproval: !!requireApproval,
        githubRepo,
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
        className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-[720px] mx-4 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-claude/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-claude" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {project ? t('projectModal.editProject') : t('projectModal.newProject')}
              </h2>
              {project && <p className="text-xs text-surface-500 mt-0.5 font-mono">{project.slug}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <nav className="w-44 flex-shrink-0 border-r border-surface-800 py-3 px-2 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all mb-0.5 ${
                    active
                      ? 'bg-claude/10 text-claude font-medium'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                  }`}
                >
                  <Icon size={14} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight size={12} className="opacity-50" />}
                </button>
              );
            })}
          </nav>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* ── General ── */}
              {tab === 'general' && (
                <div className="space-y-5">
                  {/* Identity */}
                  <Section title={t('projectModal.projectName')} icon={FolderOpen}>
                    <div className="flex gap-4 items-start">
                      <div className="flex flex-col items-center gap-2">
                        <div className="rounded-xl overflow-hidden ring-2 ring-surface-700">
                          <Avatar size={56} name={avatarSeed} variant={icon} colors={AVATAR_COLORS} />
                        </div>
                        <button
                          type="button"
                          onClick={randomizeSeed}
                          className="p-1 rounded-md hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors"
                          title={t('projectModal.randomize')}
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                      <div className="flex-1 space-y-3">
                        <Field label={t('projectModal.projectName')}>
                          <input
                            ref={nameRef}
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder={t('projectModal.namePlaceholder')}
                            className="input-field"
                            required
                          />
                        </Field>
                        <div className="flex flex-wrap gap-1.5">
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
                              <Avatar size={22} name={avatarSeed} variant={v} colors={AVATAR_COLORS} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Section>

                  {/* Project Details */}
                  <Section title={t('projectModal.workingDir')} icon={Settings}>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={t('projectModal.slug')}>
                        <input
                          value={slug}
                          onChange={(e) => {
                            setSlug(e.target.value);
                            setAutoSlug(false);
                          }}
                          placeholder="my-project"
                          className="input-field font-mono"
                          required
                        />
                      </Field>
                      <Field label={t('projectModal.baseBranch')}>
                        <input
                          value={prBaseBranch}
                          onChange={(e) => setPrBaseBranch(e.target.value)}
                          placeholder="main"
                          className="input-field font-mono"
                        />
                      </Field>
                    </div>
                    <Field label={t('projectModal.workingDir')} hint={t('projectModal.workingDirHint')}>
                      <div className="flex gap-2">
                        <input
                          value={workingDir}
                          onChange={(e) => setWorkingDir(e.target.value)}
                          placeholder="/home/user/projects/my-project"
                          className="input-field font-mono flex-1"
                          required
                        />
                        {IS_TAURI && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { open } = await import('@tauri-apps/plugin-dialog');
                                const selected = await open({ directory: true, multiple: false });
                                if (selected) setWorkingDir(selected);
                              } catch (e) {
                                console.error('Failed to open folder picker:', e);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-100 hover:bg-surface-700 transition-colors whitespace-nowrap"
                          >
                            <FolderOpen size={13} />
                            {t('projectModal.browse')}
                          </button>
                        )}
                      </div>
                    </Field>
                  </Section>
                </div>
              )}

              {/* ── Permissions ── */}
              {tab === 'permissions' && (
                <div className="space-y-4">
                  <Section title={t('projectModal.permissionMode') || 'Permission Mode'} icon={Shield}>
                    <div className="grid gap-2">
                      {PERMISSION_MODES.map((mode) => {
                        const Icon = mode.icon;
                        const isActive = permissionMode === mode.value;
                        return (
                          <button
                            key={mode.value}
                            type="button"
                            onClick={() => setPermissionMode(mode.value)}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
                              isActive
                                ? `${mode.color} ring-1`
                                : 'bg-surface-800/60 text-surface-500 hover:text-surface-300 hover:bg-surface-800'
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/10' : 'bg-surface-700/50'}`}
                            >
                              <Icon size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{mode.label}</div>
                              <div className={`text-xs mt-0.5 ${isActive ? 'opacity-75' : 'text-surface-600'}`}>
                                {mode.desc}
                              </div>
                            </div>
                            {isActive && <CheckCircle2 size={16} className="flex-shrink-0 opacity-60" />}
                          </button>
                        );
                      })}
                    </div>

                    {selectedMode?.warning && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <Info size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-300 leading-relaxed">{selectedMode.warning}</p>
                      </div>
                    )}

                    {permissionMode === 'allow-tools' && (
                      <Field
                        label={t('projectModal.allowedTools')}
                        hint="Bash, Read, Write, Edit, Glob, Grep, Agent, WebSearch, WebFetch, NotebookEdit"
                      >
                        <input
                          value={allowedTools}
                          onChange={(e) => setAllowedTools(e.target.value)}
                          placeholder="Bash, Read, Write, Edit, Glob, Grep"
                          className="input-field font-mono"
                        />
                      </Field>
                    )}
                  </Section>
                </div>
              )}

              {/* ── Automation ── */}
              {tab === 'automation' && (
                <div className="space-y-4">
                  {/* Task Queue */}
                  <Section title={t('projectModal.taskQueue')} icon={Zap}>
                    <ToggleRow
                      enabled={autoQueue}
                      onToggle={() => setAutoQueue(!autoQueue)}
                      label={autoQueue ? t('projectModal.autoQueueEnabled') : t('projectModal.autoQueueDisabled')}
                      desc={t('projectModal.autoQueueDesc')}
                      activeColor="emerald"
                    />
                    {autoQueue && (
                      <Field label={t('projectModal.maxConcurrent')}>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 5, 10].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setMaxConcurrent(n)}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                                maxConcurrent === n
                                  ? 'bg-claude text-white shadow-sm shadow-claude/20'
                                  : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
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
                            className="w-16 h-9 rounded-lg text-sm font-medium text-center bg-surface-800 border border-surface-700 text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </Field>
                    )}
                  </Section>

                  {/* Git Workflow */}
                  <Section title={t('projectModal.gitWorkflow')} icon={GitBranch}>
                    <div className="grid gap-2">
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
                  </Section>

                  {/* Auto Test */}
                  <Section title={t('projectModal.autoTest')} icon={FlaskConical}>
                    <ToggleRow
                      enabled={autoTest}
                      onToggle={() => setAutoTest(!autoTest)}
                      label={autoTest ? t('projectModal.autoTestEnabled') : t('projectModal.autoTestDisabled')}
                      desc={t('projectModal.autoTestDescription')}
                      activeColor="emerald"
                    />
                    {autoTest && (
                      <Field
                        label={t('projectModal.customTestInstructions')}
                        hint={t('projectModal.customTestPlaceholder')}
                      >
                        <textarea
                          value={testPrompt}
                          onChange={(e) => setTestPrompt(e.target.value)}
                          placeholder="e.g. Run 'npm test' and check all tests pass."
                          rows={3}
                          className="input-field resize-none font-mono"
                        />
                      </Field>
                    )}
                  </Section>

                  {/* Timeout & Retries */}
                  <Section title={t('projectModal.taskTimeout') + ' & ' + t('projectModal.maxRetries')} icon={Timer}>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label={t('projectModal.taskTimeout')} hint={t('projectModal.taskTimeoutDesc')}>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={1440}
                            value={taskTimeoutMinutes || ''}
                            onChange={(e) => setTaskTimeoutMinutes(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="input-field w-20"
                          />
                          <span className="text-xs text-surface-500">{t('projectModal.minutesNoLimit')}</span>
                        </div>
                      </Field>
                      <Field label={t('projectModal.maxRetries')} hint={t('projectModal.maxRetriesDesc')}>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={maxRetries || ''}
                            onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="input-field w-20"
                          />
                          <span className="text-xs text-surface-500">{t('projectModal.timesDefault')}</span>
                        </div>
                      </Field>
                    </div>
                  </Section>
                </div>
              )}

              {/* ── Engine ── */}
              {tab === 'engine' && (
                <div className="space-y-4">
                  <Section
                    title={t('projectModal.engineSettings')}
                    icon={Cog}
                    desc={t('projectModal.engineSettingsDesc')}
                  >
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label={t('projectModal.maxAutoRevisions')}>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={maxAutoRevisions || ''}
                              onChange={(e) => setMaxAutoRevisions(parseInt(e.target.value) || 0)}
                              placeholder="3"
                              className="input-field w-20"
                            />
                            <span className="text-xs text-surface-500">{t('projectModal.default3')}</span>
                          </div>
                        </Field>
                        <Field label={t('projectModal.autoTestModel')}>
                          <select
                            value={autoTestModel || ''}
                            onChange={(e) => setAutoTestModel(e.target.value)}
                            className="input-field"
                          >
                            <option value="">{t('projectModal.defaultSonnet')}</option>
                            <option value="haiku">Haiku</option>
                            <option value="sonnet">Sonnet</option>
                            <option value="opus">Opus</option>
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label={t('projectModal.retryBaseDelay')}>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={3600}
                              value={retryBaseDelay || ''}
                              onChange={(e) => setRetryBaseDelay(parseInt(e.target.value) || 0)}
                              placeholder="30"
                              className="input-field w-20"
                            />
                            <span className="text-xs text-surface-500">{t('projectModal.secondsDefault30')}</span>
                          </div>
                        </Field>
                        <Field label={t('projectModal.retryMaxDelay')}>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={7200}
                              value={retryMaxDelay || ''}
                              onChange={(e) => setRetryMaxDelay(parseInt(e.target.value) || 0)}
                              placeholder="600"
                              className="input-field w-20"
                            />
                            <span className="text-xs text-surface-500">{t('projectModal.secondsDefault600')}</span>
                          </div>
                        </Field>
                      </div>
                    </div>
                  </Section>

                  {/* Circuit Breaker */}
                  <Section
                    title={t('projectModal.circuitBreaker')}
                    icon={ShieldBan}
                    desc={t('projectModal.circuitBreakerDesc')}
                  >
                    <Field
                      label={t('projectModal.circuitBreakerThreshold')}
                      hint={t('projectModal.circuitBreakerHint')}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={circuitBreakerThreshold || ''}
                          onChange={(e) => setCircuitBreakerThreshold(parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="input-field w-20"
                        />
                        <span className="text-xs text-surface-500">{t('projectModal.failuresDisabled')}</span>
                      </div>
                    </Field>
                  </Section>

                  {/* Approval Gate */}
                  <Section title={t('projectModal.approvalGate')} icon={BadgeCheck}>
                    <ToggleRow
                      enabled={requireApproval}
                      onToggle={() => setRequireApproval(!requireApproval)}
                      label={
                        requireApproval ? t('projectModal.approvalRequired') : t('projectModal.approvalNotRequired')
                      }
                      desc={t('projectModal.approvalDesc')}
                      activeColor="emerald"
                    />
                  </Section>
                </div>
              )}

              {/* ── GitHub ── */}
              {tab === 'github' && (
                <div className="space-y-4">
                  <Section title={t('projectModal.githubIssuesSync')} icon={Github}>
                    <ToggleRow
                      enabled={githubSyncEnabled}
                      onToggle={() => setGithubSyncEnabled(!githubSyncEnabled)}
                      label={githubSyncEnabled ? t('projectModal.syncEnabled') : t('projectModal.syncDisabled')}
                      desc={t('projectModal.syncDesc')}
                      activeColor="violet"
                    />

                    {githubSyncEnabled && (
                      <>
                        <Field label={t('projectModal.repository')} hint={t('projectModal.repoHelpText')}>
                          <div className="flex gap-2">
                            <input
                              value={githubRepo}
                              onChange={(e) => {
                                setGithubRepo(e.target.value);
                                setGithubValid(null);
                              }}
                              placeholder="owner/repo"
                              className="input-field font-mono flex-1"
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
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                              {githubDetecting ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <GitBranch size={12} />
                              )}
                              {t('projectModal.detect')}
                            </button>
                          </div>
                        </Field>

                        {githubValid !== null && (
                          <div
                            className={`flex items-center gap-2.5 p-3 rounded-lg border ${
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
                              <CheckCircle2 size={14} />
                            ) : githubValid === 'not_authenticated' ? (
                              <Info size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}
                            <span className="text-xs font-medium">
                              {githubValid === 'ready' && t('projectModal.ghReady')}
                              {githubValid === 'not_installed' && t('projectModal.ghNotInstalled')}
                              {githubValid === 'not_authenticated' && t('projectModal.ghNotAuth')}
                              {githubValid === 'no_access' && t('projectModal.ghNoAccess')}
                              {githubValid === 'authenticated' && t('projectModal.ghAuthenticated')}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
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
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {githubValidating ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            {t('projectModal.checkConnection')}
                          </button>
                          <p className="text-xs text-surface-600">{t('projectModal.ghCliHelpText')}</p>
                        </div>
                      </>
                    )}
                  </Section>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-800 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !slug.trim() || !workingDir.trim()}
                className="px-6 py-2.5 text-sm font-medium bg-claude hover:bg-claude-light disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm shadow-claude/20"
              >
                {loading ? t('common.saving') : project ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────

function Section({ title, icon: Icon, desc, children }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-800/60">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-surface-400" />}
          <h3 className="text-sm font-medium text-surface-200">{title}</h3>
        </div>
        {desc && <p className="text-xs text-surface-500 mt-1 ml-[22px]">{desc}</p>}
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-surface-600 mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function ToggleRow({ enabled, onToggle, label, desc, activeColor = 'emerald' }) {
  const colors = {
    emerald: {
      bg: enabled ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-surface-800/60',
      text: enabled ? 'text-emerald-300' : 'text-surface-400 hover:text-surface-300',
      toggle: enabled ? 'bg-emerald-500' : 'bg-surface-600',
      desc: enabled ? 'text-emerald-400/70' : 'text-surface-600',
    },
    violet: {
      bg: enabled ? 'bg-violet-500/10 ring-1 ring-violet-500/30' : 'bg-surface-800/60',
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
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-all ${c.bg} ${c.text}`}
    >
      <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${c.toggle}`}>
        <div
          className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${enabled ? 'left-[17px]' : 'left-[3px]'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className={`text-xs mt-0.5 ${c.desc}`}>{desc}</div>
      </div>
    </button>
  );
}
