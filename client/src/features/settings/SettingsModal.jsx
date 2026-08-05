import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Settings,
  Bell,
  Info,
  Monitor,
  BellRing,
  BellOff,
  Volume2,
  VolumeX,
  Power,
  Minimize2,
  Trash2,
  Brain,
  Gauge,
  Terminal,
  Globe,
  FolderOpen,
  Plus,
  Trash,
  Edit2,
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatTimeAgo } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';
import { IS_TAURI } from '../../lib/tauriEvents';
import { EFFORT_OPTIONS } from '../../lib/constants';
import { useModels, refreshModels } from '../../lib/useModels';

const TABS = [
  { key: 'general', icon: Settings, labelKey: 'settings.general' },
  { key: 'models', icon: Brain, labelKey: 'settings.modelsTab' },
  { key: 'notifications', icon: Bell, labelKey: 'settings.notifications' },
  { key: 'about', icon: Info, labelKey: 'settings.about' },
];

const EFFORTS = EFFORT_OPTIONS.map((e) => ({ value: e.value, labelKey: `effort.${e.value}` }));

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-claude' : 'bg-surface-600'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <Icon size={16} className="text-surface-400 mt-0.5 flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm text-surface-200">{label}</div>
          {description && <div className="text-[11px] text-surface-500 mt-0.5">{description}</div>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function GeneralTab({ settings, onChange, t, models }) {
  return (
    <div className="divide-y divide-surface-700/30">
      {IS_TAURI && (
        <SettingRow icon={Power} label={t('settings.launchAtStartup')} description={t('settings.launchAtStartupDesc')}>
          <Toggle enabled={settings.launch_at_startup} onChange={(v) => onChange('launch_at_startup', v)} />
        </SettingRow>
      )}

      {IS_TAURI && (
        <SettingRow
          icon={Minimize2}
          label={t('settings.minimizeToTray')}
          description={t('settings.minimizeToTrayDesc')}
        >
          <Toggle enabled={settings.minimize_to_tray} onChange={(v) => onChange('minimize_to_tray', v)} />
        </SettingRow>
      )}

      <SettingRow
        icon={Trash2}
        label={t('settings.confirmBeforeDelete')}
        description={t('settings.confirmBeforeDeleteDesc')}
      >
        <Toggle enabled={settings.confirm_before_delete} onChange={(v) => onChange('confirm_before_delete', v)} />
      </SettingRow>

      <SettingRow
        icon={Terminal}
        label={t('settings.autoOpenTerminal')}
        description={t('settings.autoOpenTerminalDesc')}
      >
        <Toggle enabled={settings.auto_open_terminal} onChange={(v) => onChange('auto_open_terminal', v)} />
      </SettingRow>

      <SettingRow icon={Brain} label={t('settings.defaultModel')} description={t('settings.defaultModelDesc')}>
        <select
          value={settings.default_model}
          onChange={(e) => onChange('default_model', e.target.value)}
          className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
              {m.source === 'custom' ? ' (custom)' : ''}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow icon={Gauge} label={t('settings.defaultEffort')} description={t('settings.defaultEffortDesc')}>
        <select
          value={settings.default_effort}
          onChange={(e) => onChange('default_effort', e.target.value)}
          className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
        >
          {EFFORTS.map((e) => (
            <option key={e.value} value={e.value}>
              {t(e.labelKey)}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow icon={Globe} label={t('settings.language')} description={t('settings.languageDesc')}>
        <select
          value={settings.language}
          onChange={(e) => onChange('language', e.target.value)}
          className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
        >
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
        </select>
      </SettingRow>
    </div>
  );
}

const NOTIFICATION_ITEMS = [
  {
    key: 'notify_task_completed',
    icon: BellRing,
    labelKey: 'settings.notifyTaskCompleted',
    descKey: 'settings.notifyTaskCompletedDesc',
  },
  {
    key: 'notify_task_failed',
    icon: BellOff,
    labelKey: 'settings.notifyTaskFailed',
    descKey: 'settings.notifyTaskFailedDesc',
  },
  {
    key: 'notify_task_started',
    icon: Bell,
    labelKey: 'settings.notifyTaskStarted',
    descKey: 'settings.notifyTaskStartedDesc',
  },
  {
    key: 'notify_revision_requested',
    icon: Bell,
    labelKey: 'settings.notifyRevisionRequested',
    descKey: 'settings.notifyRevisionRequestedDesc',
  },
  {
    key: 'notify_queue_started',
    icon: Bell,
    labelKey: 'settings.notifyQueueStarted',
    descKey: 'settings.notifyQueueStartedDesc',
  },
];

function NotificationsTab({ settings, onChange, t }) {
  const anyEnabled = NOTIFICATION_ITEMS.some((item) => settings[item.key]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-700/30">
        <Monitor size={14} className="text-surface-400" />
        <span className="text-xs text-surface-400">{t('settings.notificationsDesc')}</span>
      </div>

      <div className="divide-y divide-surface-700/30">
        {NOTIFICATION_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <SettingRow key={item.key} icon={Icon} label={t(item.labelKey)} description={t(item.descKey)}>
              <Toggle enabled={settings[item.key]} onChange={(v) => onChange(item.key, v)} />
            </SettingRow>
          );
        })}

        <SettingRow
          icon={anyEnabled && settings.sound_enabled ? Volume2 : VolumeX}
          label={t('settings.soundEnabled')}
          description={t('settings.soundEnabledDesc')}
        >
          <Toggle enabled={settings.sound_enabled} onChange={(v) => onChange('sound_enabled', v)} />
        </SettingRow>
      </div>
    </div>
  );
}

// SQLite datetimes use a space separator, which WebKit refuses to parse.
const isoish = (ts) => String(ts).replace(' ', 'T');

function ModelsTab({ t, models }) {
  const synced = models.filter((m) => m.source === 'upstream');
  const customs = models.filter((m) => m.source === 'custom');
  const [editing, setEditing] = useState(null); // null | 'new' | { id, ...row }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api
      .modelsSyncedAt()
      .then(setSyncedAt)
      .catch(() => setSyncedAt(null));
  }, []);

  const doRefresh = async () => {
    setSyncing(true);
    setError(null);
    try {
      await api.refreshModels();
      await refreshModels();
      setSyncedAt(await api.modelsSyncedAt().catch(() => null));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  };

  const startNew = () =>
    setEditing({
      mode: 'new',
      model_id: '',
      label: '',
      color: 'bg-cyan-500/20 text-cyan-300',
      input_cost_per_mtok: '',
      output_cost_per_mtok: '',
    });
  // Editing a synced row has no custom_id to update, so `save` turns it into a
  // new override row instead. sort_order carries over so the override keeps its
  // place in the list.
  const startEdit = (m) =>
    setEditing({
      mode: 'edit',
      id: m.custom_id ?? null,
      model_id: m.value,
      label: m.label,
      color: m.color || '',
      input_cost_per_mtok: m.input_cost_per_mtok ?? '',
      output_cost_per_mtok: m.output_cost_per_mtok ?? '',
      sort_order: m.sort_order ?? 0,
    });

  const cancelEdit = () => {
    setEditing(null);
    setError(null);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        modelId: editing.model_id.trim(),
        label: editing.label.trim(),
        color: editing.color?.trim() || null,
        inputCostPerMtok: editing.input_cost_per_mtok === '' ? null : Number(editing.input_cost_per_mtok),
        outputCostPerMtok: editing.output_cost_per_mtok === '' ? null : Number(editing.output_cost_per_mtok),
        sortOrder: editing.sort_order ?? 0,
      };
      // A synced row has no override row yet, so editing one creates it.
      if (editing.mode === 'new' || editing.id == null) {
        await api.addCustomModel(payload);
      } else {
        await api.updateCustomModel(editing.id, payload);
      }
      await refreshModels();
      setEditing(null);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (modelId) => {
    if (!confirm(t('settings.confirmDeleteModel'))) return;
    setBusy(true);
    try {
      await api.deleteModel(modelId);
      await refreshModels();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (modelId) => {
    setBusy(true);
    setError(null);
    try {
      await api.resetModel(modelId);
      await refreshModels();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const renderForm = () => (
    <div className="p-3 rounded-lg bg-surface-800/60 border border-claude/40 ring-1 ring-claude/20 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.modelId')}
          </span>
          <input
            value={editing.model_id}
            onChange={(e) => setEditing({ ...editing, model_id: e.target.value })}
            placeholder="claude-opus-4-8"
            className="mt-1 w-full bg-surface-900 border border-surface-700 rounded-md px-2 py-1.5 text-xs text-surface-200 font-mono focus:outline-none focus:ring-1 focus:ring-claude"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.modelLabel')}
          </span>
          <input
            value={editing.label}
            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
            placeholder="Opus 4.8"
            className="mt-1 w-full bg-surface-900 border border-surface-700 rounded-md px-2 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.inputCost')}
          </span>
          <input
            type="number"
            step="0.01"
            value={editing.input_cost_per_mtok}
            onChange={(e) => setEditing({ ...editing, input_cost_per_mtok: e.target.value })}
            placeholder="5.00"
            className="mt-1 w-full bg-surface-900 border border-surface-700 rounded-md px-2 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.outputCost')}
          </span>
          <input
            type="number"
            step="0.01"
            value={editing.output_cost_per_mtok}
            onChange={(e) => setEditing({ ...editing, output_cost_per_mtok: e.target.value })}
            placeholder="25.00"
            className="mt-1 w-full bg-surface-900 border border-surface-700 rounded-md px-2 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-surface-500 font-semibold">
          {t('settings.modelColor')}
        </span>
        <input
          value={editing.color}
          onChange={(e) => setEditing({ ...editing, color: e.target.value })}
          placeholder="bg-cyan-500/20 text-cyan-300"
          className="mt-1 w-full bg-surface-900 border border-surface-700 rounded-md px-2 py-1.5 text-xs text-surface-200 font-mono focus:outline-none focus:ring-1 focus:ring-claude"
        />
      </label>
      {error && <div className="text-[11px] text-red-400">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={cancelEdit}
          disabled={busy}
          className="px-3 py-1.5 text-xs text-surface-300 bg-surface-700/50 hover:bg-surface-700 rounded-md disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !editing.model_id.trim() || !editing.label.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-claude hover:bg-claude-light text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          {t('common.save')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.syncedModels')}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-surface-500">
              {syncedAt
                ? t('settings.lastSynced', { when: formatTimeAgo(isoish(syncedAt)) })
                : t('settings.neverSynced')}
            </span>
            <button
              type="button"
              onClick={doRefresh}
              disabled={syncing || busy}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-surface-700/50 hover:bg-surface-700 text-surface-300 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> {t('settings.refreshModels')}
            </button>
          </div>
        </div>
        {synced.length === 0 ? (
          <div className="text-[11px] text-surface-500 px-3 py-3 rounded-lg bg-surface-800/30 border border-dashed border-surface-700/40">
            {t('settings.noSyncedModels')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {synced.map((m) =>
              editing?.mode === 'edit' && editing.model_id === m.value ? (
                <div key={m.value}>{renderForm()}</div>
              ) : (
                <div
                  key={m.value}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-800/40 border border-surface-700/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${m.color || 'bg-surface-700/50 text-surface-300'}`}
                    >
                      {m.value}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm text-surface-200 truncate">{m.label}</div>
                      <div className="text-[10px] text-surface-500 font-mono">
                        ${m.input_cost_per_mtok ?? '—'} / ${m.output_cost_per_mtok ?? '—'} per Mtok
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase tracking-wide text-surface-600 px-1.5">
                      {t('settings.sourceSynced')}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      disabled={busy || editing !== null}
                      className="p-1.5 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 disabled:opacity-50"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m.value)}
                      disabled={busy || editing !== null}
                      className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.customModels')}
          </div>
          <button
            type="button"
            onClick={startNew}
            disabled={busy || editing !== null}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-claude/20 hover:bg-claude/30 text-claude disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={11} /> {t('settings.addModel')}
          </button>
        </div>
        {customs.length === 0 && !editing && (
          <div className="text-[11px] text-surface-500 px-3 py-3 rounded-lg bg-surface-800/30 border border-dashed border-surface-700/40">
            {t('settings.noCustomModels')}
          </div>
        )}
        {editing?.mode === 'new' && <div className="mb-2">{renderForm()}</div>}
        <div className="space-y-1.5">
          {customs.map((m) =>
            editing?.mode === 'edit' && editing.model_id === m.value ? (
              <div key={m.value}>{renderForm()}</div>
            ) : (
              <div
                key={m.value}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-800/40 border border-surface-700/30"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${m.color || 'bg-surface-700/50 text-surface-300'}`}
                  >
                    {m.value}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-surface-200 truncate">{m.label}</div>
                    <div className="text-[10px] text-surface-500 font-mono">
                      ${m.input_cost_per_mtok ?? '—'} / ${m.output_cost_per_mtok ?? '—'} per Mtok
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] uppercase tracking-wide text-claude/70 px-1.5">
                    {t('settings.sourceCustom')}
                  </span>
                  <button
                    type="button"
                    onClick={() => reset(m.value)}
                    disabled={busy || editing !== null}
                    title={t('settings.resetModel')}
                    className="p-1.5 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    disabled={busy || editing !== null}
                    className="p-1.5 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 disabled:opacity-50"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.value)}
                    disabled={busy || editing !== null}
                    className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function AboutTab({ t }) {
  const [logsPath, setLogsPath] = useState(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!IS_TAURI) return;
    api
      .getLogsDir()
      .then((p) => setLogsPath(p))
      .catch(() => setLogsPath(null));
  }, []);

  const handleOpenLogs = async () => {
    if (!IS_TAURI || opening) return;
    setOpening(true);
    try {
      await api.openLogsDir();
    } catch (e) {
      console.error('Failed to open logs directory:', e);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-800/60 border border-surface-700/30">
        <span className="text-claude text-3xl">&#10022;</span>
        <div>
          <h3 className="text-base font-semibold text-surface-100">Claude Board</h3>
          <p className="text-xs text-surface-500 mt-0.5">{t('settings.aboutTagline')}</p>
        </div>
        <span className="ml-auto text-xs text-surface-600 font-mono bg-surface-700/50 px-2 py-1 rounded">
          v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?.?.?'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">{t('settings.version')}</span>
          <span className="text-surface-300 font-mono">
            {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">{t('settings.platform')}</span>
          <span className="text-surface-300 font-mono">{navigator.platform || 'unknown'}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">{t('settings.runtime')}</span>
          <span className="text-surface-300 font-mono">{IS_TAURI ? 'Tauri Desktop' : 'Web'}</span>
        </div>
      </div>

      {IS_TAURI && (
        <div className="pt-4 border-t border-surface-700/30 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-surface-500 font-semibold">
            {t('settings.diagnostics')}
          </div>
          <div className="text-[11px] text-surface-500">{t('settings.logsDescription')}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenLogs}
              disabled={opening}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700/50 disabled:opacity-50 transition-colors"
            >
              <FolderOpen size={12} />
              {opening ? t('common.loading') : t('settings.openLogsDir')}
            </button>
            {logsPath && (
              <span className="text-[10px] text-surface-600 font-mono truncate" title={logsPath}>
                {logsPath}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-surface-700/30">
        <p className="text-[11px] text-surface-600 text-center">{t('settings.madeBy')}</p>
      </div>
    </div>
  );
}

const DEFAULT_SETTINGS = {
  launch_at_startup: false,
  minimize_to_tray: false,
  confirm_before_delete: true,
  default_model: 'sonnet',
  default_effort: 'medium',
  language: 'en',
  notify_task_completed: true,
  notify_task_failed: true,
  notify_task_started: false,
  notify_revision_requested: true,
  notify_queue_started: false,
  sound_enabled: true,
  auto_open_terminal: false,
};

export default function SettingsModal({ onClose }) {
  const { t, setLang } = useTranslation();
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { models } = useModels();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getAppSettings();
      setSettings(data);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback(
    async (key, value) => {
      const updated = { ...settings, [key]: value };
      setSettings(updated);

      // Sync language change
      if (key === 'language') {
        setLang(value);
      }

      setSaving(true);
      try {
        await api.updateAppSettings({ [key]: value });
      } catch (e) {
        console.error('Failed to save setting:', e);
      } finally {
        setSaving(false);
      }
    },
    [settings, setLang],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/50">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-claude" />
            <h2 className="text-base font-semibold">{t('settings.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[10px] text-surface-500 animate-pulse">{t('common.saving')}</span>}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 gap-1 border-b border-surface-700/30">
          {TABS.map((t_) => {
            const Icon = t_.icon;
            return (
              <button
                key={t_.key}
                onClick={() => setTab(t_.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  tab === t_.key
                    ? 'text-claude border-claude bg-surface-800/30'
                    : 'text-surface-500 border-transparent hover:text-surface-300 hover:bg-surface-800/20'
                }`}
              >
                <Icon size={13} />
                {t(t_.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-surface-500 text-sm">{t('common.loading')}</div>
          ) : (
            <>
              {tab === 'general' && <GeneralTab settings={settings} onChange={handleChange} t={t} models={models} />}
              {tab === 'models' && <ModelsTab t={t} models={models} />}
              {tab === 'notifications' && <NotificationsTab settings={settings} onChange={handleChange} t={t} />}
              {tab === 'about' && <AboutTab t={t} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
