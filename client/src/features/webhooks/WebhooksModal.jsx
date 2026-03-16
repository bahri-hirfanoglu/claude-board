import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Bell, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

const PLATFORMS = [
  { id: 'slack', label: 'Slack', color: 'bg-[#4A154B]/20 text-[#E01E5A]', icon: '#' },
  { id: 'discord', label: 'Discord', color: 'bg-[#5865F2]/20 text-[#5865F2]', icon: 'D' },
  { id: 'teams', label: 'Teams', color: 'bg-[#6264A7]/20 text-[#6264A7]', icon: 'T' },
  { id: 'custom', label: 'Custom', color: 'bg-surface-500/20 text-surface-300', icon: '{}' },
];

const ALL_EVENTS = [
  { id: 'task_created', label: 'Task Created', desc: 'New task added' },
  { id: 'task_started', label: 'Task Started', desc: 'Task moved to in progress' },
  { id: 'task_approved', label: 'Task Completed', desc: 'Task marked as done' },
  { id: 'revision_requested', label: 'Revision Requested', desc: 'Changes requested on task' },
  { id: 'queue_auto_started', label: 'Auto-Queue', desc: 'Task auto-started from queue' },
];

function WebhookForm({ webhook, onSave, onCancel }) {
  const [name, setName] = useState(webhook?.name || '');
  const [url, setUrl] = useState(webhook?.url || '');
  const [platform, setPlatform] = useState(webhook?.platform || 'slack');
  const [events, setEvents] = useState(webhook?.events || []);
  const [allEvents, setAllEvents] = useState(!webhook || (webhook?.events?.length === 0));

  const toggleEvent = (eventId) => {
    setAllEvents(false);
    setEvents(prev => prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onSave({
      name: name.trim(),
      url: url.trim(),
      platform,
      events: allEvents ? [] : events,
      enabled: webhook?.enabled !== undefined ? webhook.enabled : true,
    });
  };

  const placeholders = {
    slack: 'https://hooks.slack.com/services/...',
    discord: 'https://discord.com/api/webhooks/...',
    teams: 'https://outlook.office.com/webhook/...',
    custom: 'https://example.com/webhook',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Platform</label>
        <div className="flex gap-1.5">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                platform === p.id
                  ? `${p.color} ring-1 ring-current`
                  : 'bg-surface-800 text-surface-500 hover:text-surface-300'
              }`}
            >
              <span className="text-[10px] font-bold w-4 text-center">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Dev Notifications"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Webhook URL</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={placeholders[platform]}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-claude"
        />
      </div>

      <div>
        <label className="text-xs text-surface-400 mb-2 block">Events</label>
        <button
          type="button"
          onClick={() => { setAllEvents(!allEvents); if (!allEvents) setEvents([]); }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all mb-2 ${
            allEvents
              ? 'bg-claude/10 text-claude ring-1 ring-claude/30'
              : 'bg-surface-800 text-surface-500 hover:text-surface-300'
          }`}
        >
          <Bell size={12} />
          <span className="font-medium">All Events</span>
          {allEvents && <CheckCircle2 size={12} className="ml-auto" />}
        </button>
        {!allEvents && (
          <div className="grid grid-cols-1 gap-1">
            {ALL_EVENTS.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => toggleEvent(ev.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  events.includes(ev.id)
                    ? 'bg-surface-700/50 text-surface-200 ring-1 ring-surface-600'
                    : 'bg-surface-800/50 text-surface-500 hover:text-surface-300'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${events.includes(ev.id) ? 'bg-claude' : 'bg-surface-600'}`} />
                <span className="font-medium">{ev.label}</span>
                <span className="text-[10px] text-surface-600 ml-auto">{ev.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !url.trim()}
          className="px-4 py-1.5 text-xs bg-claude hover:bg-claude-light text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
        >
          {webhook?.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function WebhooksModal({ projectId, projectName, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getWebhooks(projectId);
      setWebhooks(data);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    if (editing === 'new') {
      await api.createWebhook(projectId, data);
    } else if (editing?.id) {
      await api.updateWebhook(editing.id, data);
    }
    setEditing(null);
    load();
  };

  const handleToggle = async (webhook) => {
    await api.updateWebhook(webhook.id, { ...webhook, enabled: !webhook.enabled });
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteWebhook(id);
    setDeleting(null);
    load();
  };

  const handleTest = async (webhook) => {
    setTesting(webhook.id);
    setTestResult(null);
    try {
      const result = await api.testWebhook(webhook.id);
      setTestResult({ id: webhook.id, ...result });
    } catch (err) {
      setTestResult({ id: webhook.id, ok: false, error: err.message });
    }
    setTesting(null);
  };

  const getPlatform = (id) => PLATFORMS.find(p => p.id === id) || PLATFORMS[3];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-[5vh] overflow-y-auto" onClick={onClose}>
      <div className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-lg shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div>
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              <Bell size={16} className="text-claude" />
              Webhooks
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">{projectName} — send notifications to external services</p>
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
              {/* Webhook list */}
              {webhooks.length > 0 && !editing && (
                <div className="space-y-2 mb-4">
                  {webhooks.map(w => {
                    const p = getPlatform(w.platform);
                    const isTestOk = testResult?.id === w.id && testResult.ok;
                    const isTestFail = testResult?.id === w.id && !testResult.ok;
                    return (
                      <div key={w.id} className={`bg-surface-800/50 rounded-lg px-4 py-3 border ${w.enabled ? 'border-surface-700/50' : 'border-surface-800 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.color}`}>{p.label}</span>
                            <h3 className="text-sm font-medium text-surface-200 truncate">{w.name}</h3>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => handleTest(w)}
                              disabled={testing === w.id}
                              className={`p-1 rounded transition-colors ${
                                isTestOk ? 'text-emerald-400' : isTestFail ? 'text-red-400' : 'text-surface-400 hover:text-blue-400'
                              }`}
                              title="Test webhook"
                            >
                              {testing === w.id ? <Loader2 size={13} className="animate-spin" /> :
                               isTestOk ? <CheckCircle2 size={13} /> :
                               isTestFail ? <AlertCircle size={13} /> :
                               <Send size={13} />}
                            </button>
                            <button
                              onClick={() => handleToggle(w)}
                              className={`p-1 rounded transition-colors ${w.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-surface-600 hover:text-surface-400'}`}
                              title={w.enabled ? 'Disable' : 'Enable'}
                            >
                              {w.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                            <button onClick={() => setEditing(w)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeleting(w.id)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-surface-500 font-mono truncate">{w.url}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {w.events.length === 0 ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-claude/10 text-claude">All Events</span>
                          ) : (
                            w.events.map(ev => (
                              <span key={ev} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-400">{ev.replace(/_/g, ' ')}</span>
                            ))
                          )}
                        </div>
                        {isTestFail && testResult.error && (
                          <p className="text-[10px] text-red-400 mt-1.5">Error: {testResult.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {webhooks.length === 0 && !editing && (
                <div className="text-center py-8 text-surface-500">
                  <Bell size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No webhooks configured</p>
                  <p className="text-xs mt-1">Send task notifications to Slack, Discord, Teams or any HTTP endpoint</p>
                </div>
              )}

              {/* Edit/Create form */}
              {editing && (
                <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                  <h3 className="text-xs font-medium text-surface-400 mb-3">
                    {editing === 'new' ? 'New Webhook' : `Edit: ${editing.name}`}
                  </h3>
                  <WebhookForm
                    webhook={editing === 'new' ? null : editing}
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
                  Add Webhook
                </button>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation */}
        {deleting && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
            <div className="bg-surface-800 rounded-lg p-4 border border-surface-700 shadow-xl mx-4">
              <p className="text-sm text-surface-200 mb-3">Delete this webhook?</p>
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
