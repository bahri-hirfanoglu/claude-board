import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Zap,
  Settings,
  ArrowDown,
  Activity,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

const EVENT_CONFIG = {
  task_created: { icon: Plus, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  task_started: { icon: Play, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  task_completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  task_approved: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
  task_failed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  claude_started: { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  revision_requested: { icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  queue_auto_started: { icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  project_created: { icon: Settings, color: 'text-surface-400', bg: 'bg-surface-500/10' },
};

function getEventConfig(type) {
  return EVENT_CONFIG[type] || { icon: Clock, color: 'text-surface-400', bg: 'bg-surface-500/10' };
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActivityTimeline({ projectId, onClose }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadEvents = useCallback(
    async (offset = 0) => {
      try {
        const data = await api.getActivity(projectId, 50, offset);
        if (offset === 0) {
          setEvents(data);
        } else {
          setEvents((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === 50);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Group events by date
  const grouped = events.reduce((acc, ev) => {
    const date = formatDate(ev.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(ev);
    return acc;
  }, {});

  return (
    <div className="w-full md:w-[380px] h-full flex-shrink-0 flex flex-col bg-surface-900 md:border-l border-surface-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-claude" />
          <h3 className="text-sm font-semibold">{t('activity.title')}</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-surface-600 text-sm">{t('activity.noActivity')}</div>
        ) : (
          Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date}>
              <div className="sticky top-0 bg-surface-900/95 backdrop-blur-sm px-4 py-1.5 border-b border-surface-800/50">
                <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wider">{date}</span>
              </div>
              <div className="px-4 py-1">
                {dayEvents.map((ev) => {
                  const config = getEventConfig(ev.event_type);
                  const Icon = config.icon;
                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2.5 py-2 border-b border-surface-800/30 last:border-0"
                    >
                      <div className={`p-1 rounded-md ${config.bg} mt-0.5`}>
                        <Icon size={11} className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-surface-300 leading-relaxed">{ev.message}</p>
                        {ev.task_title && ev.event_type !== 'project_created' && (
                          <p className="text-[10px] text-surface-600 mt-0.5 truncate">{ev.task_title}</p>
                        )}
                        {ev.metadata?.feedback && (
                          <p className="text-[10px] text-surface-500 mt-1 italic line-clamp-2">
                            &quot;{ev.metadata.feedback}&quot;
                          </p>
                        )}
                      </div>
                      <span className="text-[9px] text-surface-600 flex-shrink-0 mt-0.5" title={ev.created_at}>
                        {formatTime(ev.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {hasMore && events.length > 0 && (
          <button
            onClick={() => loadEvents(events.length)}
            className="w-full py-3 text-[11px] text-surface-500 hover:text-surface-300 transition-colors flex items-center justify-center gap-1"
          >
            <ArrowDown size={10} />
            {t('activity.loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}
