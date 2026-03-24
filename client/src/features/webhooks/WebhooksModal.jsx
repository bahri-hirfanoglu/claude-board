import { useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Bell, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';
import { useCrudResource } from '../../hooks/useCrudResource';
import ModalShell from '../../components/ModalShell';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import InlineDeleteConfirm from '../../components/InlineDeleteConfirm';

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
  const [allEvents, setAllEvents] = useState(!webhook || webhook?.events?.length === 0);

  const toggleEvent = (eventId) => {
    setAllEvents(false);
    setEvents((prev) => (prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onSave({ name: name.trim(), url: url.trim(), platform, events: allEvents ? [] : events, enabled: webhook?.enabled !== undefined ? webhook.enabled : true });
  };

  const placeholders = { slack: 'https://hooks.slack.com/services/...', discord: 'https://discord.com/api/webhooks/...', teams: 'https://outlook.office.com/webhook/...', custom: 'https://example.com/webhook' };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Platform</label>
        <div className="flex gap-1.5">
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${platform === p.id ? `${p.color} ring-1 ring-current` : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}>
              <span className="text-[10px] font-bold w-4 text-center">{p.icon}</span>{p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dev Notifications"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude" autoFocus />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Webhook URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholders[platform]}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-claude" />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-2 block">Events</label>
        <button type="button" onClick={() => { setAllEvents(!allEvents); if (!allEvents) setEvents([]); }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all mb-2 ${allEvents ? 'bg-claude/10 text-claude ring-1 ring-claude/30' : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}>
          <Bell size={12} /><span className="font-medium">All Events</span>{allEvents && <CheckCircle2 size={12} className="ml-auto" />}
        </button>
        {!allEvents && (
          <div className="grid grid-cols-1 gap-1">
            {ALL_EVENTS.map((ev) => (
              <button key={ev.id} type="button" onClick={() => toggleEvent(ev.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${events.includes(ev.id) ? 'bg-surface-700/50 text-surface-200 ring-1 ring-surface-600' : 'bg-surface-800/50 text-surface-500 hover:text-surface-300'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${events.includes(ev.id) ? 'bg-claude' : 'bg-surface-600'}`} />
                <span className="font-medium">{ev.label}</span>
                <span className="text-[10px] text-surface-600 ml-auto">{ev.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors">Cancel</button>
        <button type="submit" disabled={!name.trim() || !url.trim()} className="px-4 py-1.5 text-xs bg-claude hover:bg-claude-light text-white rounded-lg disabled:opacity-50 transition-colors font-medium">{webhook?.id ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

export default function WebhooksModal({ projectId, projectName, onClose }) {
  const { t } = useTranslation();
  const crud = useCrudResource({
    projectId,
    getAll: api.getWebhooks,
    create: api.createWebhook,
    update: api.updateWebhook,
    remove: api.deleteWebhook,
  });
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const handleToggle = async (webhook) => {
    await api.updateWebhook(webhook.id, { ...webhook, enabled: !webhook.enabled });
    crud.reload();
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

  const getPlatform = (id) => PLATFORMS.find((p) => p.id === id) || PLATFORMS[3];

  return (
    <ModalShell title={t('webhooks.title')} subtitle={`${projectName} — send notifications to external services`} icon={Bell} onClose={onClose}>
      <div className="px-5 py-4">
        {crud.loading ? <Spinner /> : (
          <>
            {crud.items.length > 0 && !crud.editing && (
              <div className="space-y-2 mb-4">
                {crud.items.map((w) => {
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
                          <button onClick={() => handleTest(w)} disabled={testing === w.id}
                            className={`p-1 rounded transition-colors ${isTestOk ? 'text-emerald-400' : isTestFail ? 'text-red-400' : 'text-surface-400 hover:text-blue-400'}`} title="Test webhook">
                            {testing === w.id ? <Loader2 size={13} className="animate-spin" /> : isTestOk ? <CheckCircle2 size={13} /> : isTestFail ? <AlertCircle size={13} /> : <Send size={13} />}
                          </button>
                          <button onClick={() => handleToggle(w)} className={`p-1 rounded transition-colors ${w.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-surface-600 hover:text-surface-400'}`}>
                            {w.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => crud.setEditing(w)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => crud.setDeleting(w.id)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <p className="text-[10px] text-surface-500 font-mono truncate">{w.url}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {w.events.length === 0 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-claude/10 text-claude">All Events</span>
                        ) : w.events.map((ev) => (
                          <span key={ev} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-400">{ev.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                      {isTestFail && testResult.error && <p className="text-[10px] text-red-400 mt-1.5">Error: {testResult.error}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {crud.items.length === 0 && !crud.editing && (
              <EmptyState icon={Bell} title={t('webhooks.noWebhooks')} description="Send task notifications to Slack, Discord, Teams or any HTTP endpoint" />
            )}

            {crud.editing && (
              <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                <h3 className="text-xs font-medium text-surface-400 mb-3">{crud.editing === 'new' ? 'New Webhook' : `Edit: ${crud.editing.name}`}</h3>
                <WebhookForm webhook={crud.editing === 'new' ? null : crud.editing} onSave={crud.handleSave} onCancel={() => crud.setEditing(null)} />
              </div>
            )}

            {!crud.editing && (
              <button onClick={() => crud.setEditing('new')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors">
                <Plus size={14} /> {t('webhooks.addWebhook')}
              </button>
            )}
          </>
        )}
      </div>

      {crud.deleting && (
        <InlineDeleteConfirm message="Delete this webhook?" onConfirm={() => crud.handleDelete(crud.deleting)} onCancel={() => crud.setDeleting(null)} />
      )}
    </ModalShell>
  );
}
