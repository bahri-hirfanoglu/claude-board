import { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Plug,
  Shield,
  Settings,
  Trash2,
  Plus,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bot,
  Zap,
  Users,
  Store,
  ArrowUpCircle,
  Webhook,
  History,
  Lock,
  Check,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

const TABS = [
  { id: 'mcp', labelKey: 'cm.tabs.mcp', icon: Server },
  { id: 'plugins', labelKey: 'cm.tabs.plugins', icon: Plug },
  { id: 'agents', labelKey: 'cm.tabs.agents', icon: Users },
  { id: 'sessions', labelKey: 'cm.tabs.sessions', icon: History },
  { id: 'permissions', labelKey: 'cm.tabs.permissions', icon: Lock },
  { id: 'hooks', labelKey: 'cm.tabs.hooks', icon: Webhook },
  { id: 'auth', labelKey: 'cm.tabs.account', icon: Shield },
  { id: 'settings', labelKey: 'cm.tabs.settings', icon: Settings },
];

const INPUT =
  'px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-claude';
const BTN_PRIMARY = 'px-3 py-1.5 font-medium bg-claude hover:bg-claude-light rounded-lg disabled:opacity-50 text-xs';

export default function ClaudeManager() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('mcp');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === tb.id ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'}`}
            >
              <Icon size={13} /> {t(tb.labelKey)}
            </button>
          );
        })}
      </div>
      {tab === 'mcp' && <McpTab />}
      {tab === 'plugins' && <PluginsTab />}
      {tab === 'agents' && <AgentsTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'permissions' && <PermissionsTab />}
      {tab === 'hooks' && <HooksTab />}
      {tab === 'auth' && <AuthTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

// ─── MCP Servers ───
function McpTab() {
  const { t } = useTranslation();
  const [servers, setServers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setServers(await api.listMcpServers());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const handleRemove = async (name) => {
    try {
      setServers(await api.removeMcpServer(name));
    } catch (e) {
      setError(e.message);
    }
  };
  const serverList = Array.isArray(servers) ? servers : [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-500">{t('cm.mcp.desc')}</p>
        <div className="flex gap-2">
          <RefreshBtn loading={loading} onClick={load} />
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-claude/15 text-claude hover:bg-claude/25"
          >
            <Plus size={12} /> {t('cm.mcp.add')}
          </button>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {showAdd && (
        <AddMcpForm
          onDone={(d) => {
            setServers(d);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}
      {loading && !servers ? (
        <LoadingState />
      ) : serverList.length === 0 ? (
        <EmptyState message={t('cm.mcp.empty')} />
      ) : (
        <div className="space-y-1.5">
          {serverList.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-surface-800/50 rounded-lg px-3 py-2.5 border border-surface-700/30"
            >
              <Server size={14} className={s.connected ? 'text-emerald-400' : 'text-amber-400'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-200">{s.name}</span>
                  {s.connected ? (
                    <Badge color="emerald">{t('cm.mcp.connected')}</Badge>
                  ) : (
                    <Badge color="amber">{s.status || t('cm.mcp.disconnected')}</Badge>
                  )}
                </div>
                <p className="text-[11px] text-surface-500 truncate mt-0.5 font-mono">{s.detail}</p>
              </div>
              <button
                onClick={() => handleRemove(s.name)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-600 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddMcpForm({ onDone, onCancel }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [scope, setScope] = useState('local');
  const [env, setEnv] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const handleSubmit = async () => {
    if (!name.trim() || !command.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const parts = command.trim().split(/\s+/);
      const envList = env.trim() ? env.trim().split('\n').filter(Boolean) : [];
      onDone(await api.addMcpServer(name.trim(), parts[0], parts.slice(1), scope, envList));
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };
  return (
    <div className="bg-surface-800/50 rounded-lg border border-surface-700/30 p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-surface-500 mb-1 block">{t('cm.mcp.name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-server"
            className={`${INPUT} w-full`}
          />
        </div>
        <div>
          <label className="text-[10px] text-surface-500 mb-1 block">{t('cm.mcp.scope')}</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={`${INPUT} w-full`}>
            <option value="local">Local</option>
            <option value="project">Project</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-surface-500 mb-1 block">{t('cm.mcp.command')}</label>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="npx -y @modelcontextprotocol/server-memory"
          className={`${INPUT} w-full font-mono`}
        />
      </div>
      <div>
        <label className="text-[10px] text-surface-500 mb-1 block">{t('cm.mcp.envLabel')}</label>
        <textarea
          value={env}
          onChange={(e) => setEnv(e.target.value)}
          rows={2}
          placeholder="API_KEY=xxx"
          className={`${INPUT} w-full font-mono resize-none`}
        />
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200">
          {t('cm.cancel')}
        </button>
        <button onClick={handleSubmit} disabled={!name.trim() || !command.trim() || saving} className={BTN_PRIMARY}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : t('cm.mcp.add')}
        </button>
      </div>
    </div>
  );
}

// ─── Plugins ───
function PluginsTab() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installName, setInstallName] = useState('');
  const [installing, setInstalling] = useState(false);
  const [mpSource, setMpSource] = useState('');
  const [addingMp, setAddingMp] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m] = await Promise.all([api.listPlugins(), api.listMarketplaces()]);
      setPlugins(Array.isArray(p) ? p : []);
      setMarketplaces(Array.isArray(m) ? m : []);
    } catch (e) {
      setError(e.message);
      setPlugins([]);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const handleInstall = async () => {
    if (!installName.trim()) return;
    setInstalling(true);
    setError(null);
    try {
      setPlugins(await api.installPlugin(installName.trim()));
      setInstallName('');
    } catch (e) {
      setError(e.message);
    }
    setInstalling(false);
  };
  const handleUninstall = async (name) => {
    setActionLoading(name);
    try {
      setPlugins(await api.uninstallPlugin(name));
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(null);
  };
  const handleToggle = async (name, enabled) => {
    setActionLoading(name);
    try {
      setPlugins(await api.togglePlugin(name, enabled));
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(null);
  };
  const handleAddMp = async () => {
    if (!mpSource.trim()) return;
    setAddingMp(true);
    setError(null);
    try {
      setMarketplaces(await api.addMarketplace(mpSource.trim()));
      setMpSource('');
    } catch (e) {
      setError(e.message);
    }
    setAddingMp(false);
  };
  const handleRemoveMp = async (name) => {
    try {
      setMarketplaces(await api.removeMarketplace(name));
    } catch (e) {
      setError(e.message);
    }
  };
  const pluginList = Array.isArray(plugins) ? plugins : [];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-surface-500 mb-2">
          {t('cm.plugins.desc')} (<code className="bg-surface-700 px-1 rounded">{t('cm.plugins.placeholder')}</code>)
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Download size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              value={installName}
              onChange={(e) => setInstallName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
              placeholder={t('cm.plugins.placeholder')}
              className={`${INPUT} w-full pl-8 font-mono`}
            />
          </div>
          <button
            onClick={handleInstall}
            disabled={!installName.trim() || installing}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg disabled:opacity-50"
          >
            {installing ? <Loader2 size={12} className="animate-spin" /> : t('cm.plugins.install')}
          </button>
          <RefreshBtn loading={loading} onClick={load} />
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading && !plugins ? (
        <LoadingState />
      ) : pluginList.length === 0 ? (
        <EmptyState message={t('cm.plugins.empty')} />
      ) : (
        <div className="space-y-1.5">
          <span className="text-[10px] text-surface-500 font-medium">
            {t('cm.plugins.installed')} ({pluginList.length})
          </span>
          {pluginList.map((p, i) => {
            const name = typeof p === 'string' ? p : p.name;
            const enabled = typeof p === 'object' ? p.enabled !== false : true;
            const version = typeof p === 'object' ? p.version : '';
            const scope = typeof p === 'object' ? p.scope : '';
            return (
              <div
                key={i}
                className="flex items-center gap-3 bg-surface-800/50 rounded-lg px-3 py-2.5 border border-surface-700/30"
              >
                <Plug size={14} className={enabled ? 'text-emerald-400' : 'text-surface-600'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${enabled ? 'text-surface-200' : 'text-surface-500'}`}>
                      {name}
                    </span>
                    {version && <Badge color="surface">v{version}</Badge>}
                    {scope && <span className="text-[9px] text-surface-600">{scope}</span>}
                  </div>
                </div>
                <button onClick={() => handleToggle(name, !enabled)} disabled={actionLoading === name} className="p-1">
                  {enabled ? (
                    <ToggleRight size={18} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={18} className="text-surface-500" />
                  )}
                </button>
                <button
                  onClick={() => handleUninstall(name)}
                  disabled={actionLoading === name}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-600 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="border-t border-surface-800 pt-4 space-y-2">
        <span className="text-xs font-medium text-surface-400 flex items-center gap-1.5">
          <Store size={12} /> {t('cm.plugins.marketplaces')}
        </span>
        <div className="flex gap-2">
          <input
            value={mpSource}
            onChange={(e) => setMpSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMp()}
            placeholder={t('cm.plugins.mpPlaceholder')}
            className={`${INPUT} flex-1 font-mono`}
          />
          <button
            onClick={handleAddMp}
            disabled={!mpSource.trim() || addingMp}
            className="px-3 py-1.5 text-xs font-medium bg-claude/15 text-claude hover:bg-claude/25 rounded-lg disabled:opacity-50"
          >
            {addingMp ? <Loader2 size={12} className="animate-spin" /> : t('cm.plugins.addMp')}
          </button>
        </div>
        {marketplaces.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-surface-800/30 rounded-lg px-3 py-2 border border-surface-700/20"
          >
            <Store size={13} className="text-purple-400" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-surface-300">{m.name}</span>
              {m.source && <p className="text-[10px] text-surface-600 mt-0.5">{m.source}</p>}
            </div>
            <button
              onClick={() => handleRemoveMp(m.name)}
              className="p-1 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Agents ───
function AgentsTab() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    api
      .listAgents()
      .then((d) => {
        setAgents(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorBanner message={error} />;
  const userAgents = (agents || []).filter((a) => a.type === 'user');
  const builtinAgents = (agents || []).filter((a) => a.type === 'builtin');
  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-500">{t('cm.agents.desc')}</p>
      {userAgents.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] text-surface-500 font-medium">
            {t('cm.agents.user')} ({userAgents.length})
          </span>
          {userAgents.map((a, i) => (
            <AgentCard key={i} agent={a} />
          ))}
        </div>
      )}
      {builtinAgents.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] text-surface-500 font-medium">
            {t('cm.agents.builtin')} ({builtinAgents.length})
          </span>
          {builtinAgents.map((a, i) => (
            <AgentCard key={i} agent={a} />
          ))}
        </div>
      )}
      {(agents || []).length === 0 && <EmptyState message={t('cm.agents.empty')} />}
    </div>
  );
}
function AgentCard({ agent }) {
  const colors = {
    haiku: 'text-green-400',
    sonnet: 'text-blue-400',
    opus: 'text-purple-400',
    inherit: 'text-surface-400',
  };
  return (
    <div className="flex items-center gap-3 bg-surface-800/50 rounded-lg px-3 py-2.5 border border-surface-700/30">
      <Bot size={14} className={agent.type === 'builtin' ? 'text-blue-400' : 'text-claude'} />
      <span className="text-sm font-medium text-surface-200 flex-1">{agent.name}</span>
      <span className={`text-[10px] font-mono ${colors[agent.model] || 'text-surface-400'}`}>{agent.model}</span>
    </div>
  );
}

// ─── Sessions ───
function SessionsTab() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    api
      .listSessions()
      .then((d) => {
        setSessions(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorBanner message={error} />;
  const list = sessions || [];
  const formatSize = (bytes) => {
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  };
  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  };
  // Group by project
  const grouped = {};
  list.forEach((s) => {
    if (!grouped[s.project]) grouped[s.project] = [];
    grouped[s.project].push(s);
  });
  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-500">{t('cm.sessions.desc')}</p>
      {list.length === 0 ? (
        <EmptyState message={t('cm.sessions.empty')} />
      ) : (
        Object.entries(grouped).map(([project, sessions]) => (
          <div key={project} className="space-y-1.5">
            <span className="text-[10px] text-surface-500 font-medium font-mono truncate block">{project}</span>
            {sessions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/30"
              >
                <History size={13} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-surface-300 truncate block">{s.sessionId}</span>
                </div>
                <span className="text-[10px] text-surface-500">
                  {s.lines} {t('cm.sessions.lines')}
                </span>
                <span className="text-[10px] text-surface-600">{formatSize(s.size)}</span>
                <span className="text-[10px] text-surface-600">{formatDate(s.modified)}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Permissions ───
function PermissionsTab() {
  const { t } = useTranslation();
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    api
      .getPermissionRules()
      .then((d) => {
        setRules(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorBanner message={error} />;
  const allowRules = rules?.allow || [];
  const softDenyRules = rules?.soft_deny || [];
  const blockRules = rules?.block || [];
  const RuleCard = ({ rule, icon: Icon, color }) => {
    const [title, ...rest] = rule.split(':');
    const desc = rest.join(':').trim();
    return (
      <div className="bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/30">
        <div className="flex items-start gap-2">
          <Icon size={12} className={`${color} flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-surface-200">{title.trim()}</span>
            {desc && <p className="text-[10px] text-surface-500 mt-0.5 leading-relaxed">{desc}</p>}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-500">{t('cm.permissions.desc')}</p>
      {allowRules.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
            <Check size={11} /> {t('cm.permissions.allow')} ({allowRules.length})
          </span>
          {allowRules.map((r, i) => (
            <RuleCard key={i} rule={r} icon={Check} color="text-emerald-400" />
          ))}
        </div>
      )}
      {softDenyRules.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <HelpCircle size={11} /> {t('cm.permissions.softDeny')} ({softDenyRules.length})
          </span>
          {softDenyRules.map((r, i) => (
            <RuleCard key={i} rule={r} icon={HelpCircle} color="text-amber-400" />
          ))}
        </div>
      )}
      {blockRules.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium text-red-400 flex items-center gap-1">
            <XCircle size={11} /> {t('cm.permissions.block')} ({blockRules.length})
          </span>
          {blockRules.map((r, i) => (
            <RuleCard key={i} rule={r} icon={XCircle} color="text-red-400" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hooks ───
function HooksTab() {
  const { t } = useTranslation();
  const [hooks, setHooks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    api
      .getHooks()
      .then((d) => {
        setHooks(d);
        setRaw(JSON.stringify(d, null, 2));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const parsed = JSON.parse(raw);
      await api.saveHooks(parsed);
      setHooks(parsed);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };
  if (loading) return <LoadingState />;
  const hookEntries = hooks && typeof hooks === 'object' ? Object.entries(hooks) : [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-500">{t('cm.hooks.desc')}</p>
        <div className="flex items-center gap-2">
          {success && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={10} /> {t('cm.hooks.saved')}
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : t('cm.save')}
          </button>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {hookEntries.length > 0 && (
        <div className="space-y-1.5">
          {hookEntries.map(([event, config]) => {
            const commands = Array.isArray(config) ? config : [config];
            return (
              <div key={event} className="bg-surface-800/50 rounded-lg px-3 py-2.5 border border-surface-700/30">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={12} className="text-amber-400" />
                  <span className="text-xs font-semibold text-surface-300">{event}</span>
                  <Badge color="surface">{commands.length}</Badge>
                </div>
                {commands.map((cmd, i) => (
                  <p key={i} className="text-[11px] text-surface-500 font-mono ml-5 truncate">
                    {typeof cmd === 'string' ? cmd : cmd.command || JSON.stringify(cmd)}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <div>
        <label className="text-[10px] text-surface-500 mb-1 block">{t('cm.hooks.editor')}</label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-xs font-mono text-surface-300 focus:outline-none focus:ring-1 focus:ring-claude resize-y leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Auth & Version ───
function AuthTab() {
  const { t } = useTranslation();
  const [auth, setAuth] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  useEffect(() => {
    Promise.all([api.getAuthInfo().catch(() => null), api.getClaudeVersion().catch(() => null)]).then(([a, v]) => {
      setAuth(a);
      setVersion(v);
      setLoading(false);
    });
  }, []);
  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateResult(null);
    try {
      setUpdateResult(await api.updateClaudeCli());
      const v = await api.getClaudeVersion().catch(() => null);
      if (v) setVersion(v);
    } catch (e) {
      setUpdateResult(e.message);
    }
    setUpdating(false);
  };
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-lg border border-surface-700/30 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-surface-300 flex items-center gap-1.5">
          <Shield size={13} className="text-claude" /> {t('cm.auth.account')}
        </h3>
        {auth && !auth.raw ? (
          <div className="space-y-2">
            {auth.email && <InfoRow label={t('cm.auth.email')} value={auth.email} />}
            {auth.subscriptionType && (
              <InfoRow label={t('cm.auth.plan')} value={<span className="capitalize">{auth.subscriptionType}</span>} />
            )}
            {auth.orgName && <InfoRow label={t('cm.auth.org')} value={auth.orgName} />}
            {auth.authMethod && <InfoRow label={t('cm.auth.method')} value={auth.authMethod} />}
            <InfoRow
              label={t('cm.auth.status')}
              value={
                auth.loggedIn ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={11} /> {t('cm.auth.authenticated')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle size={11} /> {t('cm.auth.notLoggedIn')}
                  </span>
                )
              }
            />
          </div>
        ) : (
          <p className="text-xs text-surface-500">{t('cm.auth.loginHint')}</p>
        )}
      </div>
      <div className="bg-surface-800/50 rounded-lg border border-surface-700/30 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-surface-300 flex items-center gap-1.5">
          <Bot size={13} className="text-blue-400" /> {t('cm.auth.cli')}
        </h3>
        <InfoRow label={t('cm.auth.version')} value={version || 'Unknown'} />
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 rounded-lg disabled:opacity-50"
          >
            {updating ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
            {updating ? t('cm.auth.checking') : t('cm.auth.checkUpdates')}
          </button>
          {updateResult && <span className="text-[10px] text-surface-400">{updateResult}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Settings ───
function SettingsTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    api
      .getClaudeSettings()
      .then((d) => {
        setRaw(JSON.stringify(d, null, 2));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.saveClaudeSettings(JSON.parse(raw));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-500">
          {t('cm.settings.desc')} <code className="bg-surface-700 px-1 rounded">~/.claude/settings.json</code>
        </p>
        <div className="flex items-center gap-2">
          {success && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={10} /> {t('cm.settings.saved')}
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : t('cm.settings.save')}
          </button>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={20}
        className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-xs font-mono text-surface-300 focus:outline-none focus:ring-1 focus:ring-claude resize-y leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}

// ─── Shared ───
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-surface-600">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );
}
function EmptyState({ message }) {
  return <div className="text-center py-8 text-surface-600 text-sm">{message}</div>;
}
function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
      <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-red-400">{message}</p>
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className="text-[11px] text-surface-300 font-medium">{value}</span>
    </div>
  );
}
function Badge({ color, children }) {
  const c = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
    surface: 'bg-surface-700 text-surface-400',
  };
  return <span className={`text-[9px] px-1.5 py-0.5 rounded ${c[color] || c.surface}`}>{children}</span>;
}
function RefreshBtn({ loading, onClick }) {
  return (
    <button onClick={onClick} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300">
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
    </button>
  );
}
