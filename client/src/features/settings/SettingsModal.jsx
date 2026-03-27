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
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';
import { IS_TAURI } from '../../lib/tauriEvents';

const TABS = [
  { key: 'general', icon: Settings, labelKey: 'settings.general' },
  { key: 'notifications', icon: Bell, labelKey: 'settings.notifications' },
  { key: 'about', icon: Info, labelKey: 'settings.about' },
];

const MODELS = [
  { value: 'haiku', label: 'Haiku', desc: 'Fast & lightweight' },
  { value: 'sonnet', label: 'Sonnet', desc: 'Balanced' },
  { value: 'opus', label: 'Opus', desc: 'Most capable' },
];

const EFFORTS = [
  { value: 'low', labelKey: 'effort.low' },
  { value: 'medium', labelKey: 'effort.medium' },
  { value: 'high', labelKey: 'effort.high' },
];

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

function GeneralTab({ settings, onChange, t }) {
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
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
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

function AboutTab({ t }) {
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
  auto_open_terminal: true,
};

export default function SettingsModal({ onClose }) {
  const { t, setLang } = useTranslation();
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        localStorage.setItem('lang', value);
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
              {tab === 'general' && <GeneralTab settings={settings} onChange={handleChange} t={t} />}
              {tab === 'notifications' && <NotificationsTab settings={settings} onChange={handleChange} t={t} />}
              {tab === 'about' && <AboutTab t={t} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
